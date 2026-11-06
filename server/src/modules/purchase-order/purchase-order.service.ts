
import mongoose, { ClientSession, Types } from "mongoose";
import PurchaseOrder, { IPurchaseOrderItem } from "../../models/PurchaseOrder";
import Quotation, { IQuotation, IQuotationItem } from "../../models/Quotation";
import RFQ, { IRFQ } from "../../models/RFQ";
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

export const mergePurchaseOrderItemsWithQuotation = (
  purchaseOrderItems: Partial<IPurchaseOrderItem>[] | undefined,
  quotationItems: IQuotationItem[] | undefined
): Partial<IPurchaseOrderItem>[] => {
  const savedItems = Array.isArray(purchaseOrderItems)
    ? purchaseOrderItems
    : [];
  if (!quotationItems?.length) return savedItems;

  return quotationItems.map((quotationItem, index) => {
    const quotationItemId = quotationItem.rfqItemId?.toString();
    const savedItem =
      savedItems.find(
        (item) =>
          item.rfqItemId?.toString() === quotationItemId
      ) ||
      (savedItems.length === quotationItems.length &&
      !savedItems[index]?.rfqItemId
        ? savedItems[index]
        : undefined);

    return {
      ...quotationItem,
      ...savedItem,
      rfqItemId: savedItem?.rfqItemId || quotationItem.rfqItemId,
      productName:
        typeof savedItem?.productName === "string" &&
        savedItem.productName.trim()
          ? savedItem.productName
          : quotationItem.productName,
      quantity:
        Number.isFinite(Number(savedItem?.quantity)) &&
        Number(savedItem?.quantity) > 0
          ? Number(savedItem?.quantity)
          : quotationItem.quantity,
      unit:
        typeof savedItem?.unit === "string" && savedItem.unit.trim()
          ? savedItem.unit
          : quotationItem.unit,
      unitPrice:
        Number.isFinite(Number(savedItem?.unitPrice)) &&
        savedItem?.unitPrice !== undefined &&
        savedItem?.unitPrice !== null
          ? Number(savedItem.unitPrice)
          : quotationItem.unitPrice,
      totalPrice:
        Number.isFinite(Number(savedItem?.totalPrice)) &&
        savedItem?.totalPrice !== undefined &&
        savedItem?.totalPrice !== null
          ? Number(savedItem.totalPrice)
          : quotationItem.totalPrice,
    };
  });
};

const toCents = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Quotation ${label} is invalid.`);
  }

  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Quotation ${label} is outside the supported range.`);
  }

  return cents;
};

export const buildPurchaseOrderData = (
  quotation: IQuotation,
  rfq: IRFQ,
  procurementUserId: Types.ObjectId,
  issuedAt = new Date()
) => {
  if (!quotation.items.length) {
    throw new Error("Quotation must contain at least one item.");
  }

  const subtotalCents = quotation.items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPriceCents = toCents(Number(item.unitPrice), "unit price");
    const itemTotalCents = toCents(Number(item.totalPrice), "item total");

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Quotation contains an invalid item quantity.");
    }

    if (Math.round(quantity * unitPriceCents) !== itemTotalCents) {
      throw new Error(
        "Quotation item totals do not match their quantities and prices."
      );
    }

    return sum + itemTotalCents;
  }, 0);

  if (!Number.isSafeInteger(subtotalCents)) {
    throw new Error("Quotation subtotal is outside the supported range.");
  }

  const storedSubtotalCents = toCents(
    Number(quotation.subtotal),
    "subtotal"
  );
  const taxPercentage = Number(quotation.taxPercentage);
  if (
    !Number.isFinite(taxPercentage) ||
    taxPercentage < 0 ||
    taxPercentage > 100
  ) {
    throw new Error("Quotation tax percentage is invalid.");
  }

  const taxAmountCents = toCents(Number(quotation.taxAmount), "tax amount");
  const expectedTaxCents = Math.round(
    (subtotalCents * taxPercentage) / 100
  );
  const deliveryChargesCents = toCents(
    Number(quotation.deliveryCharges),
    "delivery charges"
  );
  const totalAmountCents = toCents(
    Number(quotation.totalAmount),
    "total amount"
  );

  if (
    subtotalCents !== storedSubtotalCents ||
    expectedTaxCents !== taxAmountCents ||
    subtotalCents + taxAmountCents + deliveryChargesCents !== totalAmountCents
  ) {
    throw new Error("Quotation commercial totals are inconsistent.");
  }

  if (
    !rfq.deliveryLocation?.trim() ||
    !rfq.deliveryDate ||
    !Number.isFinite(new Date(rfq.deliveryDate).getTime())
  ) {
    throw new Error("RFQ delivery details are missing or invalid.");
  }

  if (
    !Number.isInteger(quotation.deliveryTimeline) ||
    quotation.deliveryTimeline < 1
  ) {
    throw new Error("Quotation delivery timeline is invalid.");
  }

  return {
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
    notes: quotation.supplierRemarks,
    status: "issued" as const,
    issuedAt,
    createdBy: procurementUserId,
  };
};

export const createPurchaseOrderForAcceptedQuotation = async (
  quotation: IQuotation,
  rfq: IRFQ,
  procurementUserId: Types.ObjectId,
  session: ClientSession
) => {
  if (quotation.status !== "accepted") {
    throw new Error("Only accepted quotations can generate a PO.");
  }

  if (!["published", "closed"].includes(rfq.status)) {
    throw new Error("RFQ is not eligible for award.");
  }

  if (
    quotation.rfqId.toString() !== rfq._id.toString() ||
    quotation.buyerOrganizationId.toString() !==
      rfq.buyerOrganizationId.toString()
  ) {
    throw new Error(
      "Quotation and RFQ organization relationships are invalid."
    );
  }

  const supplier = await User.findById(quotation.supplierId)
    .select("role accountStatus emailVerified supplierApprovalStatus")
    .session(session);

  if (
    !supplier ||
    supplier.role !== "supplier" ||
    supplier.accountStatus !== "active" ||
    supplier.emailVerified !== true ||
    supplier.supplierApprovalStatus !== "approved"
  ) {
    throw new Error(
      "Supplier account is not eligible to receive a purchase order."
    );
  }

  const existingPO = await PurchaseOrder.findOne({
    quotationId: quotation._id,
  }).session(session);

  if (existingPO) {
    if (
      existingPO.rfqId.toString() !== rfq._id.toString() ||
      existingPO.supplierId.toString() !== quotation.supplierId.toString() ||
      existingPO.buyerOrganizationId.toString() !==
        quotation.buyerOrganizationId.toString()
    ) {
      throw new Error(
        "Existing purchase order has inconsistent quotation relationships."
      );
    }

    if (existingPO.status === "draft") {
      existingPO.status = "issued";
      existingPO.issuedAt = new Date();
      await existingPO.save({ session });
    }

    if (rfq.status !== "closed") {
      rfq.status = "closed";
      await rfq.save({ session });
    }

    return existingPO;
  }

  const [purchaseOrder] = await PurchaseOrder.create(
    [
      buildPurchaseOrderData(
        quotation,
        rfq,
        procurementUserId
      ),
    ],
    { session }
  );

  rfq.status = "closed";
  await rfq.save({ session });

  return purchaseOrder;
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

  const session = await mongoose.startSession();
  let purchaseOrder: Awaited<
    ReturnType<typeof createPurchaseOrderForAcceptedQuotation>
  > | null = null;
  let authorizedOrganizationId: Types.ObjectId | undefined;

  try {
    await session.withTransaction(async () => {
      const procurementUser = await User.findById(procurementUserId)
        .select("organizationId role accountStatus")
        .session(session);

      if (
        !procurementUser ||
        procurementUser.role !== "procurement" ||
        procurementUser.accountStatus !== "active" ||
        !procurementUser.organizationId
      ) {
        throw new Error("Active procurement account required.");
      }

      authorizedOrganizationId = procurementUser.organizationId;

      const quotation = await Quotation.findById(quotationId).session(session);
      if (!quotation) {
        throw new Error("Quotation not found.");
      }

      if (
        quotation.buyerOrganizationId.toString() !==
        procurementUser.organizationId.toString()
      ) {
        throw new Error("You are not authorized to generate this PO.");
      }

      if (quotation.status !== "accepted") {
        throw new Error("Only accepted quotations can generate a PO.");
      }

      const rfq = await RFQ.findById(quotation.rfqId).session(session);
      if (!rfq) {
        throw new Error("Associated RFQ not found.");
      }

      if (
        rfq.buyerOrganizationId.toString() !==
        procurementUser.organizationId.toString()
      ) {
        throw new Error("You are not authorized to generate a PO for this RFQ.");
      }

      purchaseOrder = await createPurchaseOrderForAcceptedQuotation(
        quotation,
        rfq,
        procurementUser._id,
        session
      );
    });

    if (!purchaseOrder) {
      throw new Error("Purchase order generation did not complete.");
    }

    return purchaseOrder;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000 &&
      authorizedOrganizationId
    ) {
      const existingPO = await PurchaseOrder.findOne({
        quotationId,
        buyerOrganizationId: authorizedOrganizationId,
      });

      if (existingPO) {
        return existingPO;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
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
): Promise<Record<string, unknown>[]> => {
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
    .populate("acknowledgedBy", "fullName email")
    .sort({ createdAt: -1 });
  const quotations = await Quotation.find({
    _id: { $in: purchaseOrders.map((purchaseOrder) => purchaseOrder.quotationId) },
  })
    .select("quotationNumber status items")
    .lean();
  const quotationById = new Map(
    quotations.map((quotation) => [quotation._id.toString(), quotation])
  );

  return purchaseOrders.map((purchaseOrder) => {
    const quotation = quotationById.get(
      purchaseOrder.quotationId.toString()
    );
    return {
      ...purchaseOrder.toObject(),
      quotationId: quotation
        ? {
            _id: quotation._id,
            quotationNumber: quotation.quotationNumber,
            status: quotation.status,
          }
        : purchaseOrder.quotationId,
      items: mergePurchaseOrderItemsWithQuotation(
        purchaseOrder.items,
        quotation?.items
      ),
    };
  });
};

// ==========================================
// 4. SUPPLIER VIEWS PURCHASE ORDERS
// Includes delivery quantities and shipment records.
// ==========================================

export const getSupplierPurchaseOrders = async (
  supplierId: string
): Promise<Record<string, unknown>[]> => {
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
  .populate("acknowledgedBy", "fullName email")
  .sort({ issuedAt: -1 });

  if (purchaseOrders.length === 0) {
    return [];
  }

  const quotations = await Quotation.find({
    _id: { $in: purchaseOrders.map((purchaseOrder) => purchaseOrder.quotationId) },
  })
    .select("quotationNumber status items")
    .lean();
  const quotationById = new Map(
    quotations.map((quotation) => [quotation._id.toString(), quotation])
  );

  const purchaseOrderIds = purchaseOrders.map((po) => po._id);

  const deliveries = await Delivery.find({
    purchaseOrderId: { $in: purchaseOrderIds },
    supplierId: supplier._id,
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
      const activeDeliveries = poDeliveries.filter(
        (delivery) => delivery.status !== "cancelled"
      );

      const purchaseOrderObject = purchaseOrder.toObject();
      const quotation = quotationById.get(
        purchaseOrder.quotationId.toString()
      );

      const normalizedItems = mergePurchaseOrderItemsWithQuotation(
        purchaseOrder.items,
        quotation?.items
      );
      const enrichedItems = normalizedItems.map((poItem) => {
        const itemId = poItem.rfqItemId?.toString();

        let dispatchedQuantity = 0;
        let receivedQuantity = 0;

        for (const delivery of activeDeliveries) {
          for (const deliveryItem of delivery.items) {
            if (
              itemId &&
              deliveryItem.rfqItemId?.toString() === itemId
            ) {
              dispatchedQuantity += Number.isFinite(
                Number(deliveryItem.dispatchedQuantity)
              )
                ? Number(deliveryItem.dispatchedQuantity)
                : 0;

              receivedQuantity += Number.isFinite(
                Number(deliveryItem.deliveredQuantity)
              )
                ? Number(deliveryItem.deliveredQuantity)
                : 0;
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
        quotationId: quotation
          ? {
              _id: quotation._id,
              quotationNumber: quotation.quotationNumber,
              status: quotation.status,
            }
          : purchaseOrderObject.quotationId,
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

  const now = new Date();
  const acknowledgedPO = await PurchaseOrder.findOneAndUpdate(
    {
      _id: purchaseOrderId,
      supplierId: supplier._id,
      status: "issued",
    },
    {
      $set: {
        status: "acknowledged",
        acknowledgedAt: now,
        acknowledgedBy: supplier._id,
      },
    },
    { new: true, runValidators: true }
  );
  if (acknowledgedPO) return acknowledgedPO;

  const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }
  if (purchaseOrder.supplierId.toString() !== supplier._id.toString()) {
    throw new Error("You are not authorized to acknowledge this PO.");
  }
  if (purchaseOrder.status === "acknowledged") {
    return purchaseOrder;
  }
  if (purchaseOrder.status === "cancelled") {
    throw new Error("Cancelled purchase orders cannot be acknowledged.");
  }
  throw new Error("Only issued purchase orders can be acknowledged.");
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
