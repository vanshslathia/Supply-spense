
import mongoose from "mongoose";
import PurchaseOrder from "../../models/PurchaseOrder";
import Quotation from "../../models/Quotation";
import RFQ from "../../models/RFQ";
import User from "../../models/User";
import Delivery from "../../models/Delivery";

// ==========================================
// GENERATE UNIQUE PO NUMBER
// ==========================================

export const generatePONumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);

  return `PO-${timestamp}-${random}`;
};

// ==========================================
// 1. GENERATE PURCHASE ORDER
// ==========================================

export const generatePurchaseOrder = async (
  quotationId: string,
  procurementUserId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(quotationId)) {
    throw new Error("Invalid quotation ID.");
  }

  if (!mongoose.Types.ObjectId.isValid(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const procurementUser = await User.findById(procurementUserId);

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active" ||
    !procurementUser.organizationId
  ) {
    throw new Error("Active procurement account required.");
  }

  const quotation = await Quotation.findById(quotationId);

  if (!quotation) {
    throw new Error("Quotation not found.");
  }

  if (quotation.status !== "accepted") {
    throw new Error("Only accepted quotations can generate a PO.");
  }

  if (
    quotation.buyerOrganizationId.toString() !==
    procurementUser.organizationId.toString()
  ) {
    throw new Error("You are not authorized to generate this PO.");
  }

  const existingPO = await PurchaseOrder.findOne({ quotationId });

  if (existingPO) {
    throw new Error("A purchase order already exists for this quotation.");
  }

  const rfq = await RFQ.findById(quotation.rfqId);

  if (!rfq) {
    throw new Error("Associated RFQ not found.");
  }

  if (!rfq.deliveryLocation || !rfq.deliveryDate) {
    throw new Error("RFQ delivery details are missing.");
  }

  const purchaseOrder = await PurchaseOrder.create({
    poNumber: generatePONumber(),
    rfqId: quotation.rfqId,
    quotationId: quotation._id,
    supplierId: quotation.supplierId,
    buyerOrganizationId: quotation.buyerOrganizationId,
    items: quotation.items.map((item) => ({
      rfqItemId: item.rfqItemId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subtotal: quotation.subtotal,
    taxPercentage: quotation.taxPercentage,
    taxAmount: quotation.taxAmount,
    deliveryCharges: quotation.deliveryCharges,
    totalAmount: quotation.totalAmount,
    deliveryLocation: rfq.deliveryLocation,
    deliveryDate: rfq.deliveryDate,
    deliveryTimeline: quotation.deliveryTimeline,
    status: "draft",
    createdBy: procurementUser._id,
  });

  return purchaseOrder;
};

// ==========================================
// 2. ISSUE PURCHASE ORDER
// ==========================================

export const issuePurchaseOrder = async (
  purchaseOrderId: string,
  procurementUserId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Invalid purchase order ID.");
  }

  if (!mongoose.Types.ObjectId.isValid(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const procurementUser = await User.findById(procurementUserId);

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active" ||
    !procurementUser.organizationId
  ) {
    throw new Error("Active procurement account required.");
  }

  const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  if (
    purchaseOrder.buyerOrganizationId.toString() !==
    procurementUser.organizationId.toString()
  ) {
    throw new Error("You are not authorized to issue this PO.");
  }

  if (purchaseOrder.status !== "draft") {
    throw new Error("Only draft purchase orders can be issued.");
  }

  purchaseOrder.status = "issued";
  purchaseOrder.issuedAt = new Date();

  await purchaseOrder.save();

  return purchaseOrder;
};

// ==========================================
// 3. PROCUREMENT VIEWS ALL ORGANIZATION POs
// ==========================================

export const getProcurementPurchaseOrders = async (
  procurementUserId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const procurementUser = await User.findById(procurementUserId);

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active" ||
    !procurementUser.organizationId
  ) {
    throw new Error("Active procurement account required.");
  }

  const purchaseOrders = await PurchaseOrder.find({
    buyerOrganizationId: procurementUser.organizationId,
  })
    .populate("supplierId", "fullName companyName email")
    .populate("rfqId", "rfqNumber title")
    .populate("quotationId", "quotationNumber status")
    .sort({ createdAt: -1 });

  return purchaseOrders;
};

// ==========================================
// 4. SUPPLIER VIEWS PURCHASE ORDERS
// Includes delivery quantities and shipment records.
// ==========================================

export const getSupplierPurchaseOrders = async (
  supplierId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new Error("Invalid supplier ID.");
  }

  const supplier = await User.findById(supplierId);

  if (
    !supplier ||
    supplier.role !== "supplier" ||
    supplier.accountStatus !== "active" ||
    supplier.emailVerified !== true ||
    supplier.supplierApprovalStatus !== "approved"
  ) {
    throw new Error("Active approved supplier account required.");
  }

  const purchaseOrders = await PurchaseOrder.find({
    supplierId: supplier._id,
    status: {
      $in: [
        "issued",
        "acknowledged",
        "rejected",
        "in_progress",
        "partially_delivered",
        "delivered",
      ],
    },
  })
    .populate("buyerOrganizationId", "name organizationCode")
    .populate("rfqId", "rfqNumber title")
    .sort({ issuedAt: -1 });

  if (purchaseOrders.length === 0) {
    return [];
  }

  const purchaseOrderIds = purchaseOrders.map((po) => po._id);

  const deliveries = await Delivery.find({
    purchaseOrderId: { $in: purchaseOrderIds },
    supplierId: supplier._id,
    status: { $ne: "cancelled" },
  }).sort({ createdAt: -1 });

  // Group deliveries by purchase order.
  const deliveriesByPO = new Map<string, typeof deliveries>();

  for (const delivery of deliveries) {
    const poId = delivery.purchaseOrderId.toString();

    if (!deliveriesByPO.has(poId)) {
      deliveriesByPO.set(poId, []);
    }

    deliveriesByPO.get(poId)!.push(delivery);
  }

  // Enrich each PO with actual delivery quantities.
  const enrichedPurchaseOrders = purchaseOrders.map(
    (purchaseOrder) => {
      const poId = purchaseOrder._id.toString();
      const poDeliveries = deliveriesByPO.get(poId) || [];

      const purchaseOrderObject = purchaseOrder.toObject();

      const enrichedItems = purchaseOrder.items.map((poItem) => {
        const itemId = poItem.rfqItemId.toString();

        let dispatchedQuantity = 0;
        let receivedQuantity = 0;

        for (const delivery of poDeliveries) {
          for (const deliveryItem of delivery.items) {
            if (deliveryItem.rfqItemId.toString() === itemId) {
              dispatchedQuantity +=
                deliveryItem.dispatchedQuantity;

              receivedQuantity +=
                deliveryItem.deliveredQuantity;
            }
          }
        }

        return {
          ...poItem,
          dispatchedQuantity,
          receivedQuantity,
        };
      });

      return {
        ...purchaseOrderObject,
        items: enrichedItems,
        deliveries: poDeliveries.map((delivery) =>
          delivery.toObject()
        ),
      };
    }
  );

  return enrichedPurchaseOrders;
};

// ==========================================
// 5. SUPPLIER ACKNOWLEDGES PURCHASE ORDER
// ==========================================

export const acknowledgePurchaseOrder = async (
  purchaseOrderId: string,
  supplierId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Invalid purchase order ID.");
  }

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new Error("Invalid supplier ID.");
  }

  const supplier = await User.findById(supplierId);

  if (
    !supplier ||
    supplier.role !== "supplier" ||
    supplier.accountStatus !== "active" ||
    supplier.emailVerified !== true ||
    supplier.supplierApprovalStatus !== "approved"
  ) {
    throw new Error("Active approved supplier account required.");
  }

  const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  if (purchaseOrder.supplierId.toString() !== supplierId) {
    throw new Error(
      "You are not authorized to acknowledge this PO."
    );
  }

  if (purchaseOrder.status !== "issued") {
    throw new Error(
      "Only issued purchase orders can be acknowledged."
    );
  }

  purchaseOrder.status = "acknowledged";
  purchaseOrder.acknowledgedAt = new Date();

  await purchaseOrder.save();

  return purchaseOrder;
};

// ==========================================
// 6. SUPPLIER REJECTS PURCHASE ORDER
// ==========================================

export const rejectPurchaseOrder = async (
  purchaseOrderId: string,
  supplierId: string,
  rejectionReason: string
) => {
  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Invalid purchase order ID.");
  }

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new Error("Invalid supplier ID.");
  }

  if (
    typeof rejectionReason !== "string" ||
    !rejectionReason.trim()
  ) {
    throw new Error("A rejection reason is required.");
  }

  if (rejectionReason.trim().length > 2000) {
    throw new Error(
      "Rejection reason cannot exceed 2000 characters."
    );
  }

  const supplier = await User.findById(supplierId);

  if (
    !supplier ||
    supplier.role !== "supplier" ||
    supplier.accountStatus !== "active" ||
    supplier.emailVerified !== true ||
    supplier.supplierApprovalStatus !== "approved"
  ) {
    throw new Error("Active approved supplier account required.");
  }

  const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  if (purchaseOrder.supplierId.toString() !== supplierId) {
    throw new Error(
      "You are not authorized to reject this PO."
    );
  }

  if (purchaseOrder.status !== "issued") {
    throw new Error(
      "Only issued purchase orders can be rejected."
    );
  }

  purchaseOrder.status = "rejected";
  purchaseOrder.rejectedAt = new Date();
  purchaseOrder.rejectionReason = rejectionReason.trim();

  await purchaseOrder.save();

  return purchaseOrder;
};
