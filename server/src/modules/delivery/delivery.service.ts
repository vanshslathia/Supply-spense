
import mongoose, { Types } from "mongoose";
import { randomUUID } from "node:crypto";

import Delivery, { DeliveryStatus } from "../../models/Delivery";
import DeliveryException from "../../models/DeliveryException";
import Inspection from "../../models/Inspection";
import InventoryTransaction from "../../models/InventoryTransaction";
import InventoryProduct from "../../models/InventoryProduct";
import PurchaseOrder from "../../models/PurchaseOrder";
import RFQ from "../../models/RFQ";
import User from "../../models/User";
import Organization from "../../models/Organizational";
import {
  notifyOrganizationRoles,
  notifySupplier,
} from "../notification/notification.service";
import {
  getPendingQcDeliveries,
  getQcDashboardStats,
} from "./qc-dashboard.utils";

const generateDeliveryNumber = (): string => {
  return `DEL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

// Verify supplier eligibility.
const getEligibleSupplier = async (supplierId: string) => {
  if (!Types.ObjectId.isValid(supplierId)) {
    throw new Error("Invalid supplier ID.");
  }

  const supplier = await User.findById(supplierId);

  if (
    !supplier ||
    supplier.role !== "supplier" ||
    supplier.accountStatus !== "active" ||
    !supplier.emailVerified ||
    supplier.supplierApprovalStatus !== "approved"
  ) {
    throw new Error("Supplier is not eligible to manage deliveries.");
  }

  return supplier;
};

// Verify procurement user eligibility.
const getEligibleProcurementUser = async (procurementUserId: string) => {
  if (!Types.ObjectId.isValid(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const procurementUser = await User.findById(procurementUserId);

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active" ||
    !procurementUser.organizationId
  ) {
    throw new Error("Procurement account is not eligible.");
  }

  return procurementUser;
};

// Recalculate purchase order delivery status.
// Optional session allows this operation to participate in a transaction.
const updatePurchaseOrderDeliveryStatus = async (
  purchaseOrderId: Types.ObjectId,
  session?: mongoose.ClientSession
) => {
  const purchaseOrderQuery = PurchaseOrder.findById(purchaseOrderId);

  if (session) {
    purchaseOrderQuery.session(session);
  }

  const purchaseOrder = await purchaseOrderQuery;

  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  const deliveriesQuery = Delivery.find({
    purchaseOrderId,
    status: { $ne: "cancelled" },
  });

  if (session) {
    deliveriesQuery.session(session);
  }

  const deliveries = await deliveriesQuery;

  const orderedQuantities = new Map<string, number>();
  const deliveredQuantities = new Map<string, number>();

  for (const item of purchaseOrder.items) {
    const key = item.rfqItemId.toString();

    orderedQuantities.set(key, item.quantity);
    deliveredQuantities.set(key, 0);
  }

  for (const delivery of deliveries) {
    for (const item of delivery.items) {
      const key = item.rfqItemId.toString();

      deliveredQuantities.set(
        key,
        (deliveredQuantities.get(key) || 0) +
          item.deliveredQuantity
      );
    }
  }

  const allDelivered = [...orderedQuantities.entries()].every(
    ([key, quantity]) =>
      (deliveredQuantities.get(key) || 0) >= quantity
  );

  const hasDeliveredQuantity = [...deliveredQuantities.values()].some(
    (quantity) => quantity > 0
  );

  purchaseOrder.status = allDelivered
    ? "delivered"
    : hasDeliveredQuantity
      ? "partially_delivered"
      : "in_progress";

  await purchaseOrder.save(session ? { session } : undefined);
};

// Create a delivery against an acknowledged purchase order.

export const createDelivery = async (
  purchaseOrderId: string,
  supplierId: string,
  input: {
    idempotencyKey: string;
    items: {
      rfqItemId: string;
      dispatchedQuantity: number;
    }[];
    trackingNumber?: string;
    transporterName?: string;
    vehicleNumber?: string;
    challanNumber?: string;
    challanUrl?: string;
    expectedDeliveryDate: Date;
    notes?: string;
  }
) => {
  if (!Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Invalid purchase order ID.");
  }

  const supplier = await getEligibleSupplier(supplierId);

  if (new Date(input.expectedDeliveryDate) < new Date()) {
    throw new Error("Expected delivery date cannot be in the past.");
  }

  if (input.items.length === 0) {
    throw new Error("At least one delivery item is required.");
  }

  const requestedItemIds = input.items.map(
    (item) => item.rfqItemId
  );

  if (new Set(requestedItemIds).size !== requestedItemIds.length) {
    throw new Error("Duplicate items are not allowed in one delivery.");
  }

  for (const item of input.items) {
    if (!Types.ObjectId.isValid(item.rfqItemId)) {
      throw new Error("Invalid RFQ item ID.");
    }

    if (
      !Number.isFinite(item.dispatchedQuantity) ||
      !Number.isInteger(item.dispatchedQuantity) ||
      item.dispatchedQuantity <= 0
    ) {
      throw new Error("Dispatched quantity must be a positive integer.");
    }
  }

  const session = await mongoose.startSession();

  let createdDelivery: InstanceType<typeof Delivery> | null = null;

  try {
    await session.withTransaction(async () => {
      const retryDelivery = await Delivery.findOne({
        supplierId: supplier._id,
        idempotencyKey: input.idempotencyKey,
      }).session(session);

      if (retryDelivery) {
        if (retryDelivery.purchaseOrderId.toString() !== purchaseOrderId) {
          throw new Error(
            "This shipment request key was already used for another purchase order."
          );
        }

        createdDelivery = retryDelivery;
        return;
      }

      // Write to the PO document to serialize concurrent
      // delivery creation attempts for the same purchase order.
      const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
        {
          _id: purchaseOrderId,
          supplierId: supplier._id,
          status: {
            $in: ["acknowledged", "in_progress", "partially_delivered"],
          },
        },
        {
          $set: { updatedAt: new Date() },
        },
        {
          new: true,
          session,
        }
      );

      if (!purchaseOrder) {
        const existingPO = await PurchaseOrder.findById(
          purchaseOrderId
        ).session(session);

        if (!existingPO) {
          throw new Error("Purchase order not found.");
        }

        if (existingPO.supplierId.toString() !== supplier._id.toString()) {
          throw new Error(
            "You are not authorized to manage this purchase order."
          );
        }

        throw new Error(
          "Delivery can only be created for an acknowledged purchase order."
        );
      }

      const existingDeliveries = await Delivery.find({
        purchaseOrderId: purchaseOrder._id,
        status: { $ne: "cancelled" },
      }).session(session);

      const deliveryItems = input.items.map((item) => {
        const orderedItem = purchaseOrder.items.find(
          (poItem) =>
            poItem.rfqItemId.toString() === item.rfqItemId
        );

        if (!orderedItem) {
          throw new Error(
            "Delivery contains an item not present in the PO."
          );
        }

        const alreadyDispatched = existingDeliveries.reduce(
          (total, delivery) => {
            const existingItem = delivery.items.find(
              (deliveryItem) =>
                deliveryItem.rfqItemId.toString() === item.rfqItemId
            );

            return total + (existingItem?.dispatchedQuantity || 0);
          },
          0
        );

        const remainingQuantity =
          orderedItem.quantity - alreadyDispatched;

        if (item.dispatchedQuantity > remainingQuantity) {
          throw new Error(
            `Dispatched quantity exceeds the remaining quantity for ${orderedItem.productName}. Remaining: ${remainingQuantity}.`
          );
        }

        return {
          rfqItemId: orderedItem.rfqItemId,
          productName: orderedItem.productName,
          orderedQuantity: orderedItem.quantity,
          dispatchedQuantity: item.dispatchedQuantity,
          deliveredQuantity: 0,
          damagedQuantity: 0,
          missingQuantity: 0,
          acceptedForQcQuantity: 0,
          unit: orderedItem.unit,
        };
      });

      const now = new Date();

      const [delivery] = await Delivery.create(
        [
          {
            deliveryNumber: generateDeliveryNumber(),
            idempotencyKey: input.idempotencyKey,
            purchaseOrderId: purchaseOrder._id,
            supplierId: supplier._id,
            buyerOrganizationId: purchaseOrder.buyerOrganizationId,
            items: deliveryItems,
            trackingNumber: input.trackingNumber,
            transporterName: input.transporterName,
            vehicleNumber: input.vehicleNumber,
            challanNumber: input.challanNumber,
            challanUrl: input.challanUrl,
            deliveryAddress: purchaseOrder.deliveryLocation,
            expectedDeliveryDate: input.expectedDeliveryDate,
            status: "planned",
            notes: input.notes,
            statusHistory: [
              {
                status: "planned",
                updatedBy: supplier._id,
                role: "supplier",
                note: input.notes || "Delivery created.",
                changedAt: now,
              },
            ],
          },
        ],
        { session }
      );

      await updatePurchaseOrderDeliveryStatus(
        purchaseOrder._id,
        session
      );
      await notifyOrganizationRoles(
        purchaseOrder.buyerOrganizationId,
        ["procurement", "warehouse"],
        delivery._id,
        "delivery_created",
        "New supplier shipment",
        `A supplier created shipment ${delivery.deliveryNumber} for PO ${purchaseOrder.poNumber}.`,
        session
      );

      createdDelivery = delivery;
    });

    if (!createdDelivery) {
      throw new Error("Delivery creation failed.");
    }

    return createdDelivery;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      const existingDelivery = await Delivery.findOne({
        supplierId: supplier._id,
        idempotencyKey: input.idempotencyKey,
        purchaseOrderId,
      });
      if (existingDelivery) return existingDelivery;
    }

    throw error;
  } finally {
    await session.endSession();
  }
};


// Supplier updates shipment progress.
export const updateDeliveryStatus = async (
  deliveryId: string,
  supplierId: string,
  status: DeliveryStatus,
  notes?: string
) => {
  if (!Types.ObjectId.isValid(deliveryId)) {
    throw new Error("Invalid delivery ID.");
  }

  const supplier = await getEligibleSupplier(supplierId);

  // Suppliers cannot confirm actual receipt or full delivery.
  const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    planned: ["dispatched", "cancelled"],
    dispatched: ["in_transit", "delayed", "cancelled"],
    in_transit: ["delayed"],
    partially_delivered: ["in_transit", "delayed"],
    delivered: [],
    delayed: ["in_transit", "cancelled"],
    cancelled: [],
  };

  const session = await mongoose.startSession();
  let updatedDelivery: InstanceType<typeof Delivery> | null = null;
  try {
    await session.withTransaction(async () => {
      const delivery = await Delivery.findById(deliveryId).session(session);
      if (!delivery) throw new Error("Delivery not found.");
      if (delivery.supplierId.toString() !== supplier._id.toString()) {
        throw new Error("You are not authorized to update this delivery.");
      }
      if (delivery.status === status) {
        updatedDelivery = delivery;
        return;
      }
      if (delivery.receivingStatus !== "pending") {
        throw new Error("Supplier shipment status cannot be changed after warehouse arrival is recorded.");
      }

      const previousStatus = delivery.status;
      if (!allowedTransitions[previousStatus].includes(status)) {
        throw new Error(
          `Cannot change delivery status from ${previousStatus} to ${status}. Receipt confirmation must be performed by Procurement.`
        );
      }

      const now = new Date();
      delivery.status = status;
      if (notes !== undefined) delivery.notes = notes;
      if (status === "dispatched" && !delivery.dispatchedAt) {
        delivery.dispatchedAt = now;
      }
      delivery.statusHistory.push({
        status,
        updatedBy: supplier._id,
        role: "supplier",
        note: notes || `Delivery status changed from ${previousStatus} to ${status}.`,
        changedAt: now,
      });
      await delivery.save({ session });
      if (status === "delayed") {
        await DeliveryException.create(
          [{
            deliveryId: delivery._id,
            purchaseOrderId: delivery.purchaseOrderId,
            buyerOrganizationId: delivery.buyerOrganizationId,
            type: "shipment_delay",
            reason: notes?.trim() || "Supplier reported a shipment delay.",
            items: delivery.items.map((item) => ({
              rfqItemId: item.rfqItemId,
              productName: item.productName,
              quantity: 0,
              damagedQuantity: 0,
              missingQuantity: 0,
              acceptedQuantity: 0,
              rejectedQuantity: 0,
              onHoldQuantity: 0,
            })),
            createdBy: supplier._id,
          }],
          { session }
        );
      }

      await notifyOrganizationRoles(
        delivery.buyerOrganizationId,
        ["procurement", "warehouse"],
        delivery._id,
        status === "delayed" ? "delivery_exception" : "shipment_status",
        status === "delayed" ? "Shipment delayed" : "Shipment status updated",
        `${delivery.deliveryNumber} status changed from ${previousStatus} to ${status}.${notes?.trim() ? ` ${notes.trim()}` : ""}`,
        session
      );
      updatedDelivery = delivery;
    });
    if (!updatedDelivery) throw new Error("Delivery status update failed.");
    return updatedDelivery;
  } finally {
    await session.endSession();
  }
};

// Get all deliveries belonging to a supplier.
export const getSupplierDeliveries = async (supplierId: string) => {
  const supplier = await getEligibleSupplier(supplierId);

  const deliveries = await Delivery.find({
    supplierId: supplier._id,
  })
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount deliveryDate deliveryLocation paymentTerms status createdAt issuedAt acknowledgedAt",
    })
    .populate({
      path: "buyerOrganizationId",
      model: Organization,
      select: "name organizationCode",
    })
    .sort({ createdAt: -1 });

  return deliveries;
};

// Get all deliveries belonging to a buyer organization.
export const getBuyerDeliveries = async (
  procurementUserId: string
) => {
  const procurementUser =
    await getEligibleProcurementUser(procurementUserId);

  const deliveries = await Delivery.find({
    buyerOrganizationId: procurementUser.organizationId,
  })
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount deliveryDate deliveryLocation paymentTerms status createdAt issuedAt acknowledgedAt",
    })
    .populate({
      path: "supplierId",
      select: "fullName email companyName",
    })
    .populate("receivedBy", "fullName email")
    .populate("arrivalRecordedBy", "fullName email")
    .sort({ createdAt: -1 });

  return enrichDeliveryRecords(deliveries);
};

// Existing "admin" is the platform-wide Super Admin role.
export const getAdminDeliveries = async () => {
  const deliveries = await Delivery.find({})
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount deliveryDate deliveryLocation paymentTerms status createdAt issuedAt acknowledgedAt",
    })
    .populate({
      path: "supplierId",
      select: "fullName email companyName",
    })
    .populate({
      path: "buyerOrganizationId",
      model: Organization,
      select: "name organizationCode",
    })
    .populate("receivedBy", "fullName email")
    .populate("arrivalRecordedBy", "fullName email")
    .sort({ createdAt: -1 });

  return enrichDeliveryRecords(deliveries);
};

export const assertActiveAdmin = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid admin user ID.");
  const user = await User.findById(userId);
  if (
    !user ||
    user.role !== "admin" ||
    user.accountStatus !== "active" ||
    !user.emailVerified
  ) {
    throw new Error("An active, verified admin account is required.");
  }
};

export const getOrganizationInventory = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID.");
  const user = await User.findById(userId);
  if (!user || user.accountStatus !== "active" || !user.emailVerified) {
    throw new Error("Active user account required.");
  }
  if (user.role !== "admin" && !["procurement", "warehouse"].includes(user.role)) {
    throw new Error("Only procurement, warehouse, or admin users can view inventory.");
  }
  if (user.role !== "admin" && !user.organizationId) {
    throw new Error("An organization is required to view inventory.");
  }

  const match = user.role === "admin"
    ? {}
    : { buyerOrganizationId: user.organizationId };
  return InventoryTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          buyerOrganizationId: "$buyerOrganizationId",
          rfqItemId: "$rfqItemId",
          productName: "$productName",
        },
        quantity: {
          $sum: {
            $ifNull: [
              "$acceptedQuantity",
              {
                $cond: [
                  { $eq: ["$transactionType", "qc_accepted_receipt"] },
                  "$quantity",
                  0,
                ],
              },
            ],
          },
        },
        lastPostedAt: { $max: "$postedAt" },
      },
    },
    {
      $project: {
        _id: 0,
        buyerOrganizationId: "$_id.buyerOrganizationId",
        rfqItemId: "$_id.rfqItemId",
        productName: "$_id.productName",
        quantity: 1,
        lastPostedAt: 1,
      },
    },
    { $sort: { productName: 1 } },
  ]);
};

export const resolveDeliveryException = async (
  exceptionId: string,
  userId: string,
  note?: string
) => {
  if (!Types.ObjectId.isValid(exceptionId) || !Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid exception or user ID.");
  }
  const user = await User.findById(userId);
  if (!user || user.accountStatus !== "active" || !user.emailVerified) {
    throw new Error("Active user account required.");
  }
  if (user.role !== "admin" && user.role !== "procurement") {
    throw new Error("Only procurement or admin users can resolve delivery exceptions.");
  }

  const exception = await DeliveryException.findById(exceptionId);
  if (!exception) throw new Error("Delivery exception not found.");
  if (
    user.role !== "admin" &&
    exception.buyerOrganizationId.toString() !== user.organizationId?.toString()
  ) {
    throw new Error("You are not authorized to resolve this exception.");
  }
  if (exception.status !== "open") {
    throw new Error("This delivery exception is already resolved.");
  }

  const now = new Date();
  exception.status = "resolved";
  exception.resolvedBy = user._id;
  exception.resolvedAt = now;
  exception.resolutionHistory.push({
    action: "resolved",
    performedBy: user._id,
    note: note?.trim(),
    changedAt: now,
  });
  await exception.save();
  return exception;
};

const enrichDeliveryRecords = async (
  deliveries: InstanceType<typeof Delivery>[]
) => {
  const deliveryIds = deliveries.map((delivery) => delivery._id);
  const [inspections, inventoryTransactions, exceptions] = await Promise.all([
    Inspection.find({ deliveryId: { $in: deliveryIds } }).sort({ createdAt: -1 }),
    InventoryTransaction.find({ deliveryId: { $in: deliveryIds } }).sort({ postedAt: -1 }),
    DeliveryException.find({ deliveryId: { $in: deliveryIds } }).sort({ createdAt: -1 }),
  ]);

  const inspectionsByDelivery = new Map<string, typeof inspections>();
  const inventoryByDelivery = new Map<string, typeof inventoryTransactions>();
  const exceptionsByDelivery = new Map<string, typeof exceptions>();
  for (const inspection of inspections) {
    const key = inspection.deliveryId.toString();
    const list = inspectionsByDelivery.get(key) || [];
    list.push(inspection);
    inspectionsByDelivery.set(key, list);
  }
  for (const entry of inventoryTransactions) {
    const key = entry.deliveryId.toString();
    const list = inventoryByDelivery.get(key) || [];
    list.push(entry);
    inventoryByDelivery.set(key, list);
  }
  for (const exception of exceptions) {
    const key = exception.deliveryId.toString();
    const list = exceptionsByDelivery.get(key) || [];
    list.push(exception);
    exceptionsByDelivery.set(key, list);
  }

  return deliveries.map((delivery) => {
    const deliveryId = delivery._id.toString();
    return {
      ...delivery.toObject(),
      inspections: inspectionsByDelivery.get(deliveryId) || [],
      inventoryTransactions: (inventoryByDelivery.get(deliveryId) || [])
        .map((entry) => ({
          ...entry.toObject(),
          quantity:
            entry.acceptedQuantity ??
            (entry.transactionType === "qc_accepted_receipt" ? entry.quantity : 0),
        }))
        .filter((entry) => entry.quantity > 0),
      exceptions: exceptionsByDelivery.get(deliveryId) || [],
    };
  });
};

// Get all deliveries assigned to the warehouse user's organization.
// Warehouse staff can view deliveries for their own buyer organization only.
export const getWarehouseDeliveries = async (warehouseUserId: string) => {
  const warehouseUser = await getEligibleWarehouseUser(warehouseUserId);

  const deliveries = await Delivery.find({
    buyerOrganizationId: warehouseUser.organizationId,
  })
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount deliveryDate status",
    })
    .populate({
      path: "supplierId",
      select: "fullName email companyName",
    })
    .sort({ createdAt: -1 });

  return deliveries;
};

// Get the QC queue and inspections assigned to the logged-in inspector.
export const getQcInspectorDashboard = async (inspectorId: string) => {
  const inspector = await getEligibleQcInspector(inspectorId);

  const [eligibleDeliveries, inspections] = await Promise.all([
    Delivery.find({
      buyerOrganizationId: inspector.organizationId,
      receivingStatus: "submitted_for_qc",
    })
      .populate({
        path: "purchaseOrderId",
        select: "poNumber totalAmount deliveryDate status",
      })
      .populate({
        path: "supplierId",
        select: "fullName email companyName",
      })
      .sort({ createdAt: -1 }),
    Inspection.find({
      buyerOrganizationId: inspector.organizationId,
    })
      .populate({
        path: "deliveryId",
        select: "deliveryNumber status receivingStatus expectedDeliveryDate items supplierId",
      })
      .populate({
        path: "purchaseOrderId",
        select: "poNumber totalAmount",
      })
      .sort({ updatedAt: -1 }),
  ]);

  const pendingDeliveries = getPendingQcDeliveries(
    eligibleDeliveries,
    inspections
  );

  return {
    pendingDeliveries,
    inspections,
    stats: getQcDashboardStats(pendingDeliveries, inspections),
  };
};

// Verify warehouse staff eligibility and resolve their buyer organization.
const getEligibleWarehouseUser = async (warehouseUserId: string) => {
  if (!Types.ObjectId.isValid(warehouseUserId)) {
    throw new Error("Invalid warehouse user ID.");
  }

  const warehouseUser = await User.findById(warehouseUserId);

  if (
    !warehouseUser ||
    warehouseUser.role !== "warehouse" ||
    warehouseUser.accountStatus !== "active" ||
    !warehouseUser.emailVerified ||
    !warehouseUser.organizationId
  ) {
    throw new Error("Warehouse account is not eligible.");
  }

  return warehouseUser;
};

// Verify QC inspector eligibility and resolve their buyer organization.
const getEligibleQcInspector = async (inspectorId: string) => {
  if (!Types.ObjectId.isValid(inspectorId)) {
    throw new Error("Invalid QC inspector ID.");
  }

  const inspector = await User.findById(inspectorId);

  if (
    !inspector ||
    inspector.role !== "qc_inspector" ||
    inspector.accountStatus !== "active" ||
    !inspector.emailVerified ||
    !inspector.organizationId
  ) {
    throw new Error("QC inspector account is not eligible.");
  }

  return inspector;
};

const assertDeliveryBelongsToOrganization = (
  delivery: InstanceType<typeof Delivery>,
  organizationId: Types.ObjectId,
  action: string
) => {
  if (delivery.buyerOrganizationId.toString() !== organizationId.toString()) {
    throw new Error(`You are not authorized to ${action} this delivery.`);
  }
};

const getQcRejectionRate = (): number => {
  const configuredRate = Number(process.env.QC_REJECTION_RATE ?? "0.6");

  if (!Number.isFinite(configuredRate) || configuredRate <= 0 || configuredRate > 1) {
    throw new Error("QC_REJECTION_RATE must be greater than 0 and at most 1.");
  }

  return configuredRate;
};

const generateInspectionNumber = (): string => {
  return `QC-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

// Warehouse records the truck's arrival. This does not mean goods are received
// or accepted by QC; it only records the physical arrival at the facility.
export const recordDeliveryArrival = async (
  deliveryId: string,
  warehouseUserId: string,
  input: {
    vehicleNumber?: string;
    challanNumber?: string;
    packagingCondition?: "intact" | "damaged" | "unknown";
    sealCondition?: "intact" | "damaged" | "missing" | "unknown";
    notes?: string;
  }
) => {
  if (!Types.ObjectId.isValid(deliveryId)) {
    throw new Error("Invalid delivery ID.");
  }

  const warehouseUser = await getEligibleWarehouseUser(warehouseUserId);
  const session = await mongoose.startSession();
  let updatedDelivery: InstanceType<typeof Delivery> | null = null;
  try {
    await session.withTransaction(async () => {
      const delivery = await Delivery.findById(deliveryId).session(session);
      if (!delivery) throw new Error("Delivery not found.");

      assertDeliveryBelongsToOrganization(
        delivery,
        warehouseUser.organizationId!,
        "record arrival for"
      );
      if (delivery.receivingStatus !== "pending") {
        throw new Error("Arrival can only be recorded once for a pending delivery.");
      }
      if (!["in_transit", "delayed", "partially_delivered"].includes(delivery.status)) {
        throw new Error("The shipment must be dispatched and in transit before arrival can be recorded.");
      }

      const now = new Date();
      delivery.receivingStatus = "arrived";
      delivery.arrivalAt = now;
      delivery.arrivalRecordedBy = warehouseUser._id;
      if (input.vehicleNumber?.trim()) delivery.vehicleNumber = input.vehicleNumber.trim();
      if (input.challanNumber?.trim()) delivery.arrivalChallanNumber = input.challanNumber.trim();
      delivery.packagingCondition = input.packagingCondition;
      delivery.sealCondition = input.sealCondition;
      if (input.notes !== undefined) {
        delivery.receivingNotes = input.notes;
        delivery.arrivalRemarks = input.notes;
      }
      delivery.receivingHistory.push({
        status: "arrived",
        updatedBy: warehouseUser._id,
        role: "warehouse",
        note: input.notes || "Truck arrival recorded by warehouse.",
        changedAt: now,
      });
      await delivery.save({ session });
      await notifyOrganizationRoles(
        delivery.buyerOrganizationId,
        ["procurement"],
        delivery._id,
        "delivery_arrived",
        "Shipment arrived at warehouse",
        `${delivery.deliveryNumber} arrived at the receiving facility.`,
        session
      );
      await notifySupplier(
        delivery.supplierId,
        delivery.buyerOrganizationId,
        delivery._id,
        "delivery_arrived",
        "Shipment arrival recorded",
        `${delivery.deliveryNumber} was checked in at the buyer warehouse.`,
        session
      );
      updatedDelivery = delivery;
    });
    if (!updatedDelivery) throw new Error("Delivery arrival was not recorded.");
    return updatedDelivery;
  } finally {
    await session.endSession();
  }
};

// Warehouse records physical quantities received. Shipment/PO delivery status
// remains a physical-receipt measure and is deliberately separate from QC.
export const recordWarehouseReceipt = async (
  deliveryId: string,
  warehouseUserId: string,
  input: {
    items: {
      rfqItemId: string;
      receivedQuantity: number;
      damagedQuantity: number;
    }[];
    finalizeReceipt: boolean;
    notes?: string;
  }
) => {
  if (!Types.ObjectId.isValid(deliveryId)) {
    throw new Error("Invalid delivery ID.");
  }

  const warehouseUser = await getEligibleWarehouseUser(warehouseUserId);
  if (!input.items.length) throw new Error("At least one receipt item is required.");

  const ids = input.items.map((item) => item.rfqItemId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate items are not allowed in one receipt.");
  }

  for (const item of input.items) {
    if (!Types.ObjectId.isValid(item.rfqItemId)) throw new Error("Invalid RFQ item ID.");
    if (!Number.isInteger(item.receivedQuantity) || item.receivedQuantity < 0) {
      throw new Error("Received quantity must be a non-negative integer.");
    }
    if (!Number.isInteger(item.damagedQuantity) || item.damagedQuantity < 0) {
      throw new Error("Damaged quantity must be a non-negative integer.");
    }
    if (item.damagedQuantity > item.receivedQuantity) {
      throw new Error("Damaged quantity cannot exceed received quantity.");
    }
  }
  if (!input.finalizeReceipt && !input.items.some((item) => item.receivedQuantity > 0)) {
    throw new Error("At least one received quantity must be greater than zero.");
  }

  const session = await mongoose.startSession();
  let updatedDelivery: InstanceType<typeof Delivery> | null = null;

  try {
    await session.withTransaction(async () => {
      const delivery = await Delivery.findById(deliveryId).session(session);
      if (!delivery) throw new Error("Delivery not found.");

      assertDeliveryBelongsToOrganization(
        delivery,
        warehouseUser.organizationId!,
        "record receipt for"
      );

      if (!["arrived", "receiving_in_progress"].includes(delivery.receivingStatus)) {
        throw new Error("Record truck arrival before confirming received quantities.");
      }
      if (!["in_transit", "partially_delivered"].includes(delivery.status)) {
        throw new Error("Receipt can only be recorded for an active shipment.");
      }

      let totalReceivedNow = 0;
      const summary: string[] = [];
      const receivedByItem = new Map(
        input.items.map((item) => [item.rfqItemId, item])
      );

      for (const inputItem of input.items) {
        const deliveryItem = delivery.items.find(
          (item) => item.rfqItemId.toString() === inputItem.rfqItemId
        );
        if (!deliveryItem) throw new Error("Receipt contains an item not present in this delivery.");

        if (
          deliveryItem.deliveredQuantity > 0 &&
          deliveryItem.acceptedForQcQuantity === 0 &&
          deliveryItem.damagedQuantity === 0
        ) {
          deliveryItem.acceptedForQcQuantity = deliveryItem.deliveredQuantity;
        }

        const remaining = deliveryItem.dispatchedQuantity - deliveryItem.deliveredQuantity;
        if (inputItem.receivedQuantity > remaining) {
          throw new Error(
            `Received quantity exceeds the outstanding dispatched quantity for ${deliveryItem.productName}. Remaining: ${remaining}.`
          );
        }

        deliveryItem.deliveredQuantity += inputItem.receivedQuantity;
        deliveryItem.damagedQuantity += inputItem.damagedQuantity;
        deliveryItem.acceptedForQcQuantity =
          deliveryItem.deliveredQuantity - deliveryItem.damagedQuantity;
        totalReceivedNow += inputItem.receivedQuantity;
        if (inputItem.receivedQuantity > 0) {
          summary.push(`${deliveryItem.productName}: ${inputItem.receivedQuantity} ${deliveryItem.unit}`);
        }
      }

      if (totalReceivedNow === 0 && !input.finalizeReceipt) {
        throw new Error("At least one received quantity must be greater than zero.");
      }

      const allItemsReceived = delivery.items.every(
        (item) => item.deliveredQuantity === item.dispatchedQuantity
      );
      const receiptClosed = allItemsReceived || input.finalizeReceipt;
      if (input.finalizeReceipt) {
        for (const item of delivery.items) {
          item.missingQuantity =
            item.dispatchedQuantity - item.deliveredQuantity;
        }
      }
      const now = new Date();

      const previousShipmentStatus = delivery.status;
      delivery.status = allItemsReceived ? "delivered" : "partially_delivered";
      if (receiptClosed) delivery.deliveredAt = now;
      if (delivery.status !== previousShipmentStatus) {
        delivery.statusHistory.push({
          status: delivery.status,
          updatedBy: warehouseUser._id,
          role: "warehouse",
          note: `Warehouse receipt changed shipment status from ${previousShipmentStatus} to ${delivery.status}.`,
          changedAt: now,
        });
      }

      delivery.receivingStatus = receiptClosed ? "received" : "receiving_in_progress";
      delivery.receivingClosed = receiptClosed;
      delivery.receivedAt = now;
      delivery.receivedBy = warehouseUser._id;
      if (input.notes !== undefined) delivery.receivingNotes = input.notes;

      const receiptNote = input.notes || `Warehouse receipt recorded: ${summary.join(", ") || "no additional units"}.${input.finalizeReceipt && !allItemsReceived ? " Outstanding quantities were recorded as missing." : ""}`;
      delivery.warehouseReceipts.push({
        items: delivery.items.map((item) => {
          const submittedItem = receivedByItem.get(item.rfqItemId.toString());
          return {
            rfqItemId: item.rfqItemId,
            receivedQuantity: submittedItem?.receivedQuantity || 0,
            damagedQuantity: submittedItem?.damagedQuantity || 0,
            missingQuantity: input.finalizeReceipt
              ? item.missingQuantity
              : 0,
            acceptedForQcQuantity:
              (submittedItem?.receivedQuantity || 0) -
              (submittedItem?.damagedQuantity || 0),
          };
        }),
        recordedBy: warehouseUser._id,
        recordedAt: now,
        notes: input.notes,
      });

      // Receiving activity is recorded separately from supplier shipment history.
      delivery.receivingHistory.push({
        status: delivery.receivingStatus,
        updatedBy: warehouseUser._id,
        role: "warehouse",
        note: receiptNote,
        changedAt: now,
      });

      await delivery.save({ session });
      const discrepancyItems = delivery.items.flatMap((item) => {
        const submittedItem = receivedByItem.get(item.rfqItemId.toString());
        const receivedQuantity = submittedItem?.receivedQuantity || 0;
        const damagedQuantity = submittedItem?.damagedQuantity || 0;
        const missingQuantity = input.finalizeReceipt
          ? item.missingQuantity
          : 0;
        if (damagedQuantity === 0 && missingQuantity === 0) return [];
        return [{
          rfqItemId: item.rfqItemId,
          productName: item.productName,
          quantity: receivedQuantity,
          damagedQuantity,
          missingQuantity,
          acceptedQuantity: receivedQuantity - damagedQuantity,
          rejectedQuantity: 0,
          onHoldQuantity: 0,
        }];
      });
      if (discrepancyItems.length) {
        await DeliveryException.create(
          [{
            deliveryId: delivery._id,
            purchaseOrderId: delivery.purchaseOrderId,
            buyerOrganizationId: delivery.buyerOrganizationId,
            type: "receiving_discrepancy",
            reason: input.notes?.trim() || "Warehouse recorded damaged or missing quantities.",
            items: discrepancyItems,
            createdBy: warehouseUser._id,
          }],
          { session }
        );
        await notifyOrganizationRoles(
          delivery.buyerOrganizationId,
          ["procurement"],
          delivery._id,
          "delivery_exception",
          "Receiving discrepancy recorded",
          `Warehouse recorded damaged or missing quantities for ${delivery.deliveryNumber}.`,
          session
        );
      }
      await notifyOrganizationRoles(
        delivery.buyerOrganizationId,
        ["procurement", "qc_inspector"],
        delivery._id,
        "goods_received",
        "Goods receipt updated",
        `${delivery.deliveryNumber} has a new warehouse receipt. Receiving status: ${delivery.receivingStatus}.`,
        session
      );
      await notifySupplier(
        delivery.supplierId,
        delivery.buyerOrganizationId,
        delivery._id,
        "goods_received",
        "Warehouse receipt updated",
        `${delivery.deliveryNumber} warehouse receipt quantities have been recorded.`,
        session
      );
      await updatePurchaseOrderDeliveryStatus(delivery.purchaseOrderId, session);
      updatedDelivery = delivery;
    });

    if (!updatedDelivery) throw new Error("Warehouse receipt confirmation failed.");
    return updatedDelivery;
  } finally {
    await session.endSession();
  }
};

// Warehouse explicitly hands a fully received delivery over to QC.
export const submitDeliveryForQc = async (
  deliveryId: string,
  warehouseUserId: string,
  notes?: string
) => {
  if (!Types.ObjectId.isValid(deliveryId)) throw new Error("Invalid delivery ID.");

  const warehouseUser = await getEligibleWarehouseUser(warehouseUserId);
  const session = await mongoose.startSession();
  let updatedDelivery: InstanceType<typeof Delivery> | null = null;
  try {
    await session.withTransaction(async () => {
      const delivery = await Delivery.findById(deliveryId).session(session);
      if (!delivery) throw new Error("Delivery not found.");
      assertDeliveryBelongsToOrganization(
        delivery,
        warehouseUser.organizationId!,
        "submit for QC"
      );
      if (delivery.receivingStatus !== "received") {
        throw new Error("Only fully received deliveries can be submitted for QC.");
      }
      const qcEligibleQuantity = delivery.items.reduce(
        (total, item) =>
          total +
          (item.acceptedForQcQuantity ||
            item.deliveredQuantity - (item.damagedQuantity || 0)),
        0
      );
      if (qcEligibleQuantity <= 0) {
        throw new Error("No undamaged received quantity is eligible for QC.");
      }

      const now = new Date();
      delivery.receivingStatus = "submitted_for_qc";
      if (notes !== undefined) delivery.receivingNotes = notes;
      delivery.receivingHistory.push({
        status: "submitted_for_qc",
        updatedBy: warehouseUser._id,
        role: "warehouse",
        note: notes || "Delivery submitted for quality inspection.",
        changedAt: now,
      });
      await delivery.save({ session });
      await notifyOrganizationRoles(
        delivery.buyerOrganizationId,
        ["qc_inspector", "procurement"],
        delivery._id,
        "qc_handover",
        "Delivery submitted for QC",
        `${delivery.deliveryNumber} is ready for quality inspection.`,
        session
      );
      updatedDelivery = delivery;
    });
    if (!updatedDelivery) throw new Error("Delivery was not submitted for QC.");
    return updatedDelivery;
  } finally {
    await session.endSession();
  }
};

// QC inspector starts a sample-based inspection. The rejection threshold is
// computed by the backend from QC_REJECTION_RATE (default 0.60: 6 of 10).
export const startQualityInspection = async (
  deliveryId: string,
  inspectorId: string,
  input: { sampleSize: number }
) => {
  if (!Types.ObjectId.isValid(deliveryId)) throw new Error("Invalid delivery ID.");
  if (!Number.isInteger(input.sampleSize) || input.sampleSize <= 0) {
    throw new Error("Sample size must be a positive integer.");
  }

  const inspector = await getEligibleQcInspector(inspectorId);
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new Error("Delivery not found.");

  assertDeliveryBelongsToOrganization(
    delivery,
    inspector.organizationId!,
    "inspect"
  );

  if (delivery.receivingStatus !== "submitted_for_qc") {
    throw new Error("Delivery must be submitted by warehouse before QC can begin.");
  }

  const existingInspection = await Inspection.findOne({
    deliveryId: delivery._id,
    status: { $in: ["draft", "in_progress"] },
  });
  if (existingInspection) throw new Error("An active inspection already exists for this delivery.");
  const completedPass = await Inspection.exists({
    deliveryId: delivery._id,
    status: "completed",
    decision: "passed",
  });
  if (completedPass) {
    throw new Error("This delivery has already passed QC and cannot be inspected again.");
  }

  const receivedQuantity = delivery.items.reduce(
    (total, item) =>
      total +
      (item.acceptedForQcQuantity ||
        item.deliveredQuantity - (item.damagedQuantity || 0)),
    0
  );
  if (input.sampleSize > receivedQuantity) {
    throw new Error(`Sample size cannot exceed the received quantity (${receivedQuantity}).`);
  }

  const rejectionThreshold = Math.ceil(input.sampleSize * getQcRejectionRate());
  const now = new Date();
  const [inspection] = await Inspection.create([
    {
      inspectionNumber: generateInspectionNumber(),
      deliveryId: delivery._id,
      purchaseOrderId: delivery.purchaseOrderId,
      buyerOrganizationId: delivery.buyerOrganizationId,
      inspectorId: inspector._id,
      sampleSize: input.sampleSize,
      rejectionThreshold,
      inspectedUnits: [],
      totalSampled: 0,
      defectiveCount: 0,
      passedCount: 0,
      status: "in_progress",
      decision: "pending",
      startedAt: now,
      history: [{
        action: "inspection_started",
        performedBy: inspector._id,
        note: `QC inspection started with a sample size of ${input.sampleSize}.`,
        changedAt: now,
      }],
    },
  ]);

  return inspection;
};

// QC results are authoritative only after the backend validates the full sample
// and calculates the final decision. The client cannot submit a decision.
export const submitQualityInspectionResults = async (
  inspectionId: string,
  inspectorId: string,
  input: {
    inspectedUnits: {
      productId: string;
      result: "passed" | "defective";
      defectCategory?: string;
      defectDescription?: string;
      severity?: "minor" | "major" | "critical";
      evidenceUrls?: string[];
      remarks?: string;
    }[];
    inspectionNotes?: string;
    dispositions: {
      productId: string;
      acceptedQuantity: number;
      rejectedQuantity: number;
      onHoldQuantity: number;
      remarks?: string;
    }[];
    placeOnHold: boolean;
    holdReason?: string;
  }
) => {
  if (!Types.ObjectId.isValid(inspectionId)) throw new Error("Invalid inspection ID.");
  const inspector = await getEligibleQcInspector(inspectorId);

  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) throw new Error("Inspection not found.");

  if (inspection.inspectorId.toString() !== inspector._id.toString()) {
    throw new Error("Only the assigned inspector can submit these inspection results.");
  }
  if (inspection.buyerOrganizationId.toString() !== inspector.organizationId!.toString()) {
    throw new Error("You are not authorized to submit results for this inspection.");
  }
  if (inspection.status !== "in_progress" || inspection.decision !== "pending") {
    throw new Error("This inspection is not open for result submission.");
  }
  if (input.inspectedUnits.length !== inspection.sampleSize) {
    throw new Error(`Exactly ${inspection.sampleSize} sampled units must be inspected.`);
  }

  const productIds = input.inspectedUnits.map((unit) => unit.productId.trim());
  if (productIds.some((id) => !id) || new Set(productIds).size !== productIds.length) {
    throw new Error("Every sampled unit must have a unique, non-empty product ID.");
  }

  for (const unit of input.inspectedUnits) {
    if (unit.result === "defective" && !unit.defectCategory?.trim() && !unit.defectDescription?.trim()) {
      throw new Error("Defective units must include a defect category or description.");
    }
  }

  const defectiveCount = input.inspectedUnits.filter((unit) => unit.result === "defective").length;
  const passedCount = input.inspectedUnits.length - defectiveCount;
  if (input.placeOnHold && !input.holdReason?.trim()) {
    throw new Error("A reason is required when placing an inspection on hold.");
  }

  const delivery = await Delivery.findById(inspection.deliveryId);
  if (!delivery) throw new Error("Delivery not found.");

  if (input.dispositions.length !== delivery.items.length) {
    throw new Error("A disposition must be provided for every delivery item.");
  }
  const dispositionIds = input.dispositions.map((entry) => entry.productId);
  if (new Set(dispositionIds).size !== dispositionIds.length) {
    throw new Error("Duplicate product dispositions are not allowed.");
  }
  for (const item of delivery.items) {
    const disposition = input.dispositions.find(
      (entry) => entry.productId === item.rfqItemId.toString()
    );
    if (!disposition) {
      throw new Error(`Missing QC disposition for ${item.productName}.`);
    }
    const availableQuantity =
      item.acceptedForQcQuantity ||
      item.deliveredQuantity - (item.damagedQuantity || 0);
    const dispositionTotal =
      disposition.acceptedQuantity +
      disposition.rejectedQuantity +
      disposition.onHoldQuantity;
    if (dispositionTotal !== availableQuantity) {
      throw new Error(
        `QC disposition quantities for ${item.productName} must total ${availableQuantity}.`
      );
    }
  }

  const decision = input.placeOnHold
    ? "on_hold"
    : defectiveCount >= inspection.rejectionThreshold
      ? "rejected"
      : "passed";
  const now = new Date();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentInspection = await Inspection.findById(inspection._id).session(session);
      if (
        !currentInspection ||
        currentInspection.status !== "in_progress" ||
        currentInspection.decision !== "pending"
      ) {
        throw new Error("This inspection is no longer open for result submission.");
      }

      const currentDelivery = await Delivery.findById(delivery._id).session(session);
      if (!currentDelivery) throw new Error("Delivery not found.");

      const currentPurchaseOrder = await PurchaseOrder.findById(
        currentDelivery.purchaseOrderId
      ).session(session);
      if (
        !currentPurchaseOrder ||
        !currentPurchaseOrder.buyerOrganizationId.equals(currentDelivery.buyerOrganizationId)
      ) {
        throw new Error("Delivery purchase order organization could not be verified.");
      }
      const currentRfq = await RFQ.findById(currentPurchaseOrder.rfqId).session(session);
      if (!currentRfq || !currentRfq.buyerOrganizationId.equals(currentDelivery.buyerOrganizationId)) {
        throw new Error("Purchase order RFQ organization could not be verified.");
      }

      for (const disposition of input.dispositions) {
        const item = currentDelivery.items.find(
          (deliveryItem) =>
            deliveryItem.rfqItemId.toString() === disposition.productId
        );
        if (!item) throw new Error("QC disposition contains an unknown delivery item.");
        const sourceRfqItem = currentRfq.items.find(
          (rfqItem) => rfqItem._id.toString() === item.rfqItemId.toString()
        );
        if (!sourceRfqItem) {
          throw new Error(`The product master source for ${item.productName} could not be verified.`);
        }

        const acceptedQuantity =
          decision === "passed" ? disposition.acceptedQuantity : 0;
        const rejectedQuantity = disposition.rejectedQuantity;
        const onHoldQuantity =
          disposition.onHoldQuantity +
          (decision === "passed" ? 0 : disposition.acceptedQuantity);
        const transactionQuantity =
          acceptedQuantity + rejectedQuantity + onHoldQuantity;
        const previousEntries = await InventoryTransaction.find({
          deliveryId: currentDelivery._id,
          rfqItemId: item.rfqItemId,
        }).session(session);
        const previouslyPosted = previousEntries.reduce(
          (total, entry) =>
            total +
            (entry.acceptedQuantity ??
              (entry.transactionType === "qc_accepted_receipt" ? entry.quantity : 0)),
          0
        );
        const eligibleQuantity =
          item.acceptedForQcQuantity ||
          item.deliveredQuantity - (item.damagedQuantity || 0);
        if (previouslyPosted + acceptedQuantity > eligibleQuantity) {
          throw new Error(
            `QC-accepted quantity for ${item.productName} would exceed the unposted received quantity.`
          );
        }

        const product = await InventoryProduct.findOneAndUpdate(
          {
            buyerOrganizationId: currentDelivery.buyerOrganizationId,
            sourceRfqItemId: item.rfqItemId,
          },
          {
            $setOnInsert: {
              sku: `RFQ-${item.rfqItemId.toString().toUpperCase()}`,
              productName: item.productName,
              category: sourceRfqItem.category,
              unit: item.unit || sourceRfqItem.unit,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
          }
        );
        const purchaseOrderItem = currentPurchaseOrder.items.find(
          (purchaseItem) => purchaseItem.rfqItemId.equals(item.rfqItemId)
        );
        const hasOnlyAvailableDisposition =
          decision === "passed" &&
          acceptedQuantity > 0 &&
          rejectedQuantity === 0 &&
          onHoldQuantity === 0;

        await InventoryTransaction.create(
          [{
            buyerOrganizationId: currentDelivery.buyerOrganizationId,
            deliveryId: currentDelivery._id,
            purchaseOrderId: currentDelivery.purchaseOrderId,
            inspectionId: currentInspection._id,
            rfqItemId: item.rfqItemId,
            productId: product._id,
            warehouseLocationId: product.warehouseLocationId,
            productName: item.productName,
            category: sourceRfqItem.category,
            unit: item.unit || sourceRfqItem.unit,
            unitCost: purchaseOrderItem?.unitPrice,
            quantity: transactionQuantity,
            acceptedQuantity,
            rejectedQuantity,
            onHoldQuantity,
            remarks:
              decision === "passed"
                ? disposition.remarks
                : [disposition.remarks, `QC decision ${decision}; accepted disposition held from available stock.`]
                    .filter(Boolean)
                    .join(" "),
            transactionType: hasOnlyAvailableDisposition
              ? "qc_accepted_receipt"
              : "qc_disposition",
            createdBy: inspector._id,
            postedAt: now,
          }],
          { session }
        );
      }

      currentInspection.inspectedUnits = input.inspectedUnits.map((unit) => ({
        ...unit,
        productId: unit.productId.trim(),
      })) as typeof currentInspection.inspectedUnits;
      currentInspection.productDispositions = input.dispositions;
      currentInspection.holdReason = input.placeOnHold
        ? input.holdReason?.trim()
        : undefined;
      currentInspection.totalSampled = input.inspectedUnits.length;
      currentInspection.defectiveCount = defectiveCount;
      currentInspection.passedCount = passedCount;
      currentInspection.status = "completed";
      currentInspection.decision = decision;
      currentInspection.inspectionNotes = input.inspectionNotes;
      currentInspection.completedAt = now;
      currentInspection.history.push({
        action: "inspection_completed",
        performedBy: inspector._id,
        note: `Inspection completed. ${passedCount} passed, ${defectiveCount} defective. Decision: ${decision}.${currentInspection.holdReason ? ` Hold reason: ${currentInspection.holdReason}` : ""}`,
        changedAt: now,
      });

      await currentInspection.save({ session });

      const exceptionType =
        decision === "on_hold"
          ? "qc_on_hold"
          : decision === "rejected" ||
              input.dispositions.some((entry) => entry.rejectedQuantity > 0)
            ? "qc_rejected"
            : null;
      if (exceptionType) {
        await DeliveryException.create(
          [{
            deliveryId: currentDelivery._id,
            purchaseOrderId: currentDelivery.purchaseOrderId,
            buyerOrganizationId: currentDelivery.buyerOrganizationId,
            inspectionId: currentInspection._id,
            type: exceptionType,
            reason:
              currentInspection.holdReason ||
              input.inspectionNotes?.trim() ||
              `QC inspection resulted in ${decision}.`,
            items: currentDelivery.items.map((item) => {
              const disposition = input.dispositions.find(
                (entry) => entry.productId === item.rfqItemId.toString()
              )!;
              return {
                rfqItemId: item.rfqItemId,
                productName: item.productName,
                quantity: item.acceptedForQcQuantity ||
                  item.deliveredQuantity - (item.damagedQuantity || 0),
                damagedQuantity: item.damagedQuantity || 0,
                missingQuantity: item.missingQuantity || 0,
                acceptedQuantity: disposition.acceptedQuantity,
                rejectedQuantity: disposition.rejectedQuantity,
                onHoldQuantity: disposition.onHoldQuantity,
              };
            }),
            createdBy: inspector._id,
          }],
          { session }
        );
      }
      await notifyOrganizationRoles(
        currentDelivery.buyerOrganizationId,
        ["procurement", "warehouse"],
        currentDelivery._id,
        decision === "rejected" || decision === "on_hold"
          ? "delivery_exception"
          : "qc_completed",
        decision === "passed"
          ? "Quality inspection passed"
          : `Quality inspection ${decision.replace("_", " ")}`,
        `${currentDelivery.deliveryNumber} QC decision: ${decision}.${currentInspection.holdReason ? ` ${currentInspection.holdReason}` : ""}`,
        session
      );
      await notifySupplier(
        currentDelivery.supplierId,
        currentDelivery.buyerOrganizationId,
        currentDelivery._id,
        decision === "rejected" || decision === "on_hold"
          ? "delivery_exception"
          : "qc_completed",
        `Quality inspection ${decision.replace("_", " ")}`,
        `${currentDelivery.deliveryNumber} has completed quality inspection. Decision: ${decision}.`,
        session
      );
    });

    const updatedInspection = await Inspection.findById(inspection._id);
    if (!updatedInspection) throw new Error("Inspection result was not saved.");
    return updatedInspection;
  } finally {
    await session.endSession();
  }
};
