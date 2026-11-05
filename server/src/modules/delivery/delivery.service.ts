
import mongoose, { Types } from "mongoose";

import Delivery, { DeliveryStatus } from "../../models/Delivery";
import Inspection from "../../models/Inspection";
import PurchaseOrder from "../../models/PurchaseOrder";
import User from "../../models/User";
import Organization from "../../models/Organizational";

const generateDeliveryNumber = (): string => {
  return `DEL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
    items: {
      rfqItemId: string;
      dispatchedQuantity: number;
    }[];
    trackingNumber?: string;
    transporterName?: string;
    vehicleNumber?: string;
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
          unit: orderedItem.unit,
        };
      });

      const now = new Date();

      const [delivery] = await Delivery.create(
        [
          {
            deliveryNumber: generateDeliveryNumber(),
            purchaseOrderId: purchaseOrder._id,
            supplierId: supplier._id,
            buyerOrganizationId: purchaseOrder.buyerOrganizationId,
            items: deliveryItems,
            trackingNumber: input.trackingNumber,
            transporterName: input.transporterName,
            vehicleNumber: input.vehicleNumber,
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

      createdDelivery = delivery;
    });

    if (!createdDelivery) {
      throw new Error("Delivery creation failed.");
    }

    return createdDelivery;
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

  const delivery = await Delivery.findById(deliveryId);

  if (!delivery) {
    throw new Error("Delivery not found.");
  }

  if (delivery.supplierId.toString() !== supplier._id.toString()) {
    throw new Error("You are not authorized to update this delivery.");
  }

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

  const previousStatus = delivery.status;

  if (!allowedTransitions[previousStatus].includes(status)) {
    throw new Error(
      `Cannot change delivery status from ${previousStatus} to ${status}. Receipt confirmation must be performed by Procurement.`
    );
  }

  delivery.status = status;

  if (notes !== undefined) {
    delivery.notes = notes;
  }

  if (status === "dispatched" && !delivery.dispatchedAt) {
    delivery.dispatchedAt = new Date();
  }

  // Record supplier status change.
  delivery.statusHistory.push({
    status,
    updatedBy: supplier._id,
    role: "supplier",
    note: notes || `Delivery status changed from ${previousStatus} to ${status}.`,
    changedAt: new Date(),
  });

  await delivery.save();

  return delivery;
};

// Get all deliveries belonging to a supplier.
export const getSupplierDeliveries = async (supplierId: string) => {
  const supplier = await getEligibleSupplier(supplierId);

  const deliveries = await Delivery.find({
    supplierId: supplier._id,
  })
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount deliveryDate status",
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
      select: "poNumber totalAmount deliveryDate status",
    })
    .populate({
      path: "supplierId",
      select: "fullName email companyName",
    })
    .sort({ createdAt: -1 });

  return deliveries;
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

  const pendingDeliveries = await Delivery.find({
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
    .sort({ createdAt: -1 });

  const inspections = await Inspection.find({
    inspectorId: inspector._id,
  })
    .populate({
      path: "deliveryId",
      select: "deliveryNumber status receivingStatus items",
    })
    .populate({
      path: "purchaseOrderId",
      select: "poNumber totalAmount",
    })
    .sort({ updatedAt: -1 });

  return {
    pendingDeliveries,
    inspections,
  };
};

// Buyer confirms actual quantities received.
// Delivery and Purchase Order changes happen in one transaction.
export const confirmDeliveryReceipt = async (
  deliveryId: string,
  procurementUserId: string,
  input: {
    items: {
      rfqItemId: string;
      receivedQuantity: number;
    }[];
    notes?: string;
  }
) => {
  if (!Types.ObjectId.isValid(deliveryId)) {
    throw new Error("Invalid delivery ID.");
  }

  const procurementUser =
    await getEligibleProcurementUser(procurementUserId);

  if (input.items.length === 0) {
    throw new Error("At least one receipt item is required.");
  }

  const requestedItemIds = input.items.map(
    (item) => item.rfqItemId
  );

  if (new Set(requestedItemIds).size !== requestedItemIds.length) {
    throw new Error("Duplicate items are not allowed in one receipt.");
  }

  for (const item of input.items) {
    if (!Types.ObjectId.isValid(item.rfqItemId)) {
      throw new Error("Invalid RFQ item ID.");
    }

    if (
      !Number.isInteger(item.receivedQuantity) ||
      item.receivedQuantity < 0
    ) {
      throw new Error(
        "Received quantity must be a non-negative integer."
      );
    }
  }

  if (!input.items.some((item) => item.receivedQuantity > 0)) {
    throw new Error(
      "At least one received quantity must be greater than zero."
    );
  }

  const session = await mongoose.startSession();

  let updatedDelivery: InstanceType<typeof Delivery> | null = null;

  try {
    await session.withTransaction(async () => {
      const delivery = await Delivery.findById(deliveryId)
        .session(session);

      if (!delivery) {
        throw new Error("Delivery not found.");
      }

      if (
        delivery.buyerOrganizationId.toString() !==
        procurementUser.organizationId!.toString()
      ) {
        throw new Error(
          "You are not authorized to confirm this delivery."
        );
      }

      if (
        !["in_transit", "partially_delivered"].includes(
          delivery.status
        )
      ) {
        throw new Error(
          "Receipt can only be confirmed for deliveries in transit or partially delivered."
        );
      }

      let totalReceived = 0;
      const receivedSummary: string[] = [];

      for (const inputItem of input.items) {
        const deliveryItem = delivery.items.find(
          (item) =>
            item.rfqItemId.toString() === inputItem.rfqItemId
        );

        if (!deliveryItem) {
          throw new Error(
            "Receipt contains an item not present in this delivery."
          );
        }

        const remainingQuantity =
          deliveryItem.dispatchedQuantity -
          deliveryItem.deliveredQuantity;

        if (inputItem.receivedQuantity > remainingQuantity) {
          throw new Error(
            `Received quantity exceeds the outstanding dispatched quantity for ${deliveryItem.productName}. Remaining: ${remainingQuantity}.`
          );
        }

        deliveryItem.deliveredQuantity +=
          inputItem.receivedQuantity;

        totalReceived += inputItem.receivedQuantity;

        if (inputItem.receivedQuantity > 0) {
          receivedSummary.push(
            `${deliveryItem.productName}: ${inputItem.receivedQuantity} ${deliveryItem.unit}`
          );
        }
      }

      if (totalReceived === 0) {
        throw new Error(
          "At least one received quantity must be greater than zero."
        );
      }

      const previousStatus = delivery.status;

      const allItemsReceived = delivery.items.every(
        (item) =>
          item.deliveredQuantity === item.dispatchedQuantity
      );

      delivery.status = allItemsReceived
        ? "delivered"
        : "partially_delivered";

      if (allItemsReceived) {
        delivery.deliveredAt = new Date();
      }

      if (input.notes !== undefined) {
        delivery.notes = input.notes;
      }

      // Record buyer receipt confirmation.
      delivery.statusHistory.push({
        status: delivery.status,
        updatedBy: procurementUser._id,
        role: "procurement",
        note:
          input.notes ||
          `Receipt confirmed: ${receivedSummary.join(", ")}. Status changed from ${previousStatus} to ${delivery.status}.`,
        changedAt: new Date(),
      });

      await delivery.save({ session });

      // Recalculate PO status in the same transaction.
      await updatePurchaseOrderDeliveryStatus(
        delivery.purchaseOrderId,
        session
      );

      updatedDelivery = delivery;
    });

    if (!updatedDelivery) {
      throw new Error("Delivery receipt confirmation failed.");
    }

    return updatedDelivery;
  } finally {
    await session.endSession();
  }
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
  return `QC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// Warehouse records the truck's arrival. This does not mean goods are received
// or accepted by QC; it only records the physical arrival at the facility.
export const recordDeliveryArrival = async (
  deliveryId: string,
  warehouseUserId: string,
  input: { vehicleNumber?: string; notes?: string }
) => {
  if (!Types.ObjectId.isValid(deliveryId)) {
    throw new Error("Invalid delivery ID.");
  }

  const warehouseUser = await getEligibleWarehouseUser(warehouseUserId);
  const delivery = await Delivery.findById(deliveryId);

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

  if (input.vehicleNumber?.trim()) {
    delivery.vehicleNumber = input.vehicleNumber.trim();
  }
  if (input.notes !== undefined) {
    delivery.receivingNotes = input.notes;
  }

  delivery.receivingHistory.push({
    status: "arrived",
    updatedBy: warehouseUser._id,
    role: "warehouse",
    note: input.notes || "Truck arrival recorded by warehouse.",
    changedAt: now,
  });

  await delivery.save();
  return delivery;
};

// Warehouse records physical quantities received. Shipment/PO delivery status
// remains a physical-receipt measure and is deliberately separate from QC.
export const recordWarehouseReceipt = async (
  deliveryId: string,
  warehouseUserId: string,
  input: {
    items: { rfqItemId: string; receivedQuantity: number }[];
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
  }
  if (!input.items.some((item) => item.receivedQuantity > 0)) {
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

      for (const inputItem of input.items) {
        const deliveryItem = delivery.items.find(
          (item) => item.rfqItemId.toString() === inputItem.rfqItemId
        );
        if (!deliveryItem) throw new Error("Receipt contains an item not present in this delivery.");

        const remaining = deliveryItem.dispatchedQuantity - deliveryItem.deliveredQuantity;
        if (inputItem.receivedQuantity > remaining) {
          throw new Error(
            `Received quantity exceeds the outstanding dispatched quantity for ${deliveryItem.productName}. Remaining: ${remaining}.`
          );
        }

        deliveryItem.deliveredQuantity += inputItem.receivedQuantity;
        totalReceivedNow += inputItem.receivedQuantity;
        if (inputItem.receivedQuantity > 0) {
          summary.push(`${deliveryItem.productName}: ${inputItem.receivedQuantity} ${deliveryItem.unit}`);
        }
      }

      if (totalReceivedNow === 0) {
        throw new Error("At least one received quantity must be greater than zero.");
      }

      const allItemsReceived = delivery.items.every(
        (item) => item.deliveredQuantity === item.dispatchedQuantity
      );
      const now = new Date();

      delivery.status = allItemsReceived ? "delivered" : "partially_delivered";
      if (allItemsReceived) delivery.deliveredAt = now;

      delivery.receivingStatus = allItemsReceived ? "received" : "receiving_in_progress";
      delivery.receivedAt = now;
      delivery.receivedBy = warehouseUser._id;
      if (input.notes !== undefined) delivery.receivingNotes = input.notes;

      const receiptNote = input.notes || `Warehouse receipt recorded: ${summary.join(", ")}.`;
      // Receiving activity is recorded separately from supplier shipment history.
      delivery.receivingHistory.push({
        status: delivery.receivingStatus,
        updatedBy: warehouseUser._id,
        role: "warehouse",
        note: receiptNote,
        changedAt: now,
      });

      await delivery.save({ session });
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
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new Error("Delivery not found.");

  assertDeliveryBelongsToOrganization(
    delivery,
    warehouseUser.organizationId!,
    "submit for QC"
  );

  if (delivery.receivingStatus !== "received") {
    throw new Error("Only fully received deliveries can be submitted for QC.");
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

  await delivery.save();
  return delivery;
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

  const receivedQuantity = delivery.items.reduce(
    (total, item) => total + item.deliveredQuantity,
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
      evidenceUrls?: string[];
      remarks?: string;
    }[];
    inspectionNotes?: string;
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
  const decision = defectiveCount >= inspection.rejectionThreshold ? "rejected" : "passed";
  const now = new Date();

  inspection.inspectedUnits = input.inspectedUnits.map((unit) => ({
    ...unit,
    productId: unit.productId.trim(),
  })) as typeof inspection.inspectedUnits;
  inspection.totalSampled = input.inspectedUnits.length;
  inspection.defectiveCount = defectiveCount;
  inspection.passedCount = passedCount;
  inspection.status = "completed";
  inspection.decision = decision;
  inspection.inspectionNotes = input.inspectionNotes;
  inspection.completedAt = now;
  inspection.history.push({
    action: "inspection_completed",
    performedBy: inspector._id,
    note: `Inspection completed. ${passedCount} passed, ${defectiveCount} defective. Decision: ${decision}.`,
    changedAt: now,
  });

  await inspection.save();
  return inspection;
};

