
import mongoose from "mongoose";
import RFQ from "../../models/RFQ";
import User from "../../models/User";
import Quotation from "../../models/Quotation";
import PurchaseOrder from "../../models/PurchaseOrder";
import { createPurchaseOrderForAcceptedQuotation } from "../purchase-order/purchase-order.service";
import { CreateQuotationInput } from "./quotation.validation";

// ==========================================
// 1. CREATE SUPPLIER QUOTATION
// ==========================================

export const createQuotation = async (
  input: CreateQuotationInput,
  supplierId: string
) => {
  if (!mongoose.isValidObjectId(supplierId)) {
    throw new Error("Invalid supplier ID.");
  }

  if (!mongoose.isValidObjectId(input.rfqId)) {
    throw new Error("Invalid RFQ ID.");
  }

  const now = new Date();

  const rfq = await RFQ.findOne({
    _id: input.rfqId,
    status: "published",
    submissionDeadline: { $gt: now },
    $or: [
      { visibility: "open" },
      {
        visibility: "invited",
        invitedSuppliers: new mongoose.Types.ObjectId(supplierId),
      },
    ],
  });

  if (!rfq) {
    throw new Error("RFQ not found or unavailable for quotation.");
  }

  const existingQuotation = await Quotation.findOne({
    rfqId: rfq._id,
    supplierId,
  });

  if (existingQuotation) {
    throw new Error("You have already created a quotation for this RFQ.");
  }

  const submittedItemIds = input.items.map(
    (item) => item.rfqItemId
  );

  if (new Set(submittedItemIds).size !== submittedItemIds.length) {
    throw new Error("Duplicate RFQ items are not allowed.");
  }

  const rfqItemsMap = new Map(
    rfq.items.map((item) => [item._id.toString(), item])
  );

  if (input.items.length !== rfq.items.length) {
    throw new Error("Please provide a quotation for every RFQ item.");
  }

  const quotationItems = input.items.map((submittedItem) => {
    const rfqItem = rfqItemsMap.get(submittedItem.rfqItemId);

    if (!rfqItem) {
      throw new Error(
        "One or more quotation items do not belong to this RFQ."
      );
    }

    const totalPrice = Number(
      (rfqItem.quantity * submittedItem.unitPrice).toFixed(2)
    );

    return {
      rfqItemId: rfqItem._id,
      productName: rfqItem.productName,
      quantity: rfqItem.quantity,
      unit: rfqItem.unit,
      unitPrice: submittedItem.unitPrice,
      totalPrice,
      remarks: submittedItem.remarks,
    };
  });

  const subtotal = Number(
    quotationItems
      .reduce((total, item) => total + item.totalPrice, 0)
      .toFixed(2)
  );

  const taxAmount = Number(
    (subtotal * input.taxPercentage / 100).toFixed(2)
  );

  const totalAmount = Number(
    (subtotal + taxAmount + input.deliveryCharges).toFixed(2)
  );

  const quotationNumber = `QUO-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const quotation = await Quotation.create({
    quotationNumber,
    rfqId: rfq._id,
    supplierId,
    buyerOrganizationId: rfq.buyerOrganizationId,
    items: quotationItems,
    subtotal,
    taxPercentage: input.taxPercentage,
    taxAmount,
    deliveryCharges: input.deliveryCharges,
    totalAmount,
    deliveryTimeline: input.deliveryTimeline,
    validityDate: input.validityDate,
    supplierRemarks: input.supplierRemarks,
    status: "submitted",
    submittedAt: now,
  });

  return quotation;
};

// ==========================================
// 2. GET ALL QUOTATIONS FOR AN RFQ
// PROCUREMENT MANAGER
// ==========================================

export const getQuotationsByRFQ = async (
  rfqId: string,
  procurementUserId: string
) => {
  if (!mongoose.isValidObjectId(rfqId)) {
    throw new Error("Invalid RFQ ID.");
  }

  if (!mongoose.isValidObjectId(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const rfq = await RFQ.findById(rfqId);

  if (!rfq) {
    throw new Error("RFQ not found.");
  }

  const procurementUser = await User.findById(procurementUserId)
    .select("organizationId role accountStatus");

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active"
  ) {
    throw new Error("Active procurement account required.");
  }

  if (
    !procurementUser.organizationId ||
    procurementUser.organizationId.toString() !==
      rfq.buyerOrganizationId.toString()
  ) {
    throw new Error(
      "You are not authorized to view these quotations."
    );
  }

  const quotations = await Quotation.find({
    rfqId: rfq._id,
  })
    .populate("supplierId", "fullName email companyName")
    .sort({ totalAmount: 1, createdAt: 1 })
    .lean();

  const purchaseOrders = await PurchaseOrder.find({
    quotationId: { $in: quotations.map((quotation) => quotation._id) },
    buyerOrganizationId: rfq.buyerOrganizationId,
  })
    .select("_id quotationId poNumber status")
    .lean();
  const purchaseOrderByQuotation = new Map(
    purchaseOrders.map((purchaseOrder) => [
      purchaseOrder.quotationId.toString(),
      purchaseOrder,
    ])
  );

  return quotations.map((quotation) => ({
    ...quotation,
    purchaseOrder:
      purchaseOrderByQuotation.get(quotation._id.toString()) || null,
  }));
};

// ==========================================
// 3. COMPARE SUPPLIER QUOTATIONS
// PROCUREMENT MANAGER
// ==========================================

export const compareQuotationsByRFQ = async (
  rfqId: string,
  procurementUserId: string
) => {
  if (!mongoose.isValidObjectId(rfqId)) {
    throw new Error("Invalid RFQ ID.");
  }

  if (!mongoose.isValidObjectId(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const rfq = await RFQ.findById(rfqId);

  if (!rfq) {
    throw new Error("RFQ not found.");
  }

  const procurementUser = await User.findById(procurementUserId)
    .select("organizationId role accountStatus");

  if (
    !procurementUser ||
    procurementUser.role !== "procurement" ||
    procurementUser.accountStatus !== "active"
  ) {
    throw new Error("Active procurement account required.");
  }

  if (
    !procurementUser.organizationId ||
    procurementUser.organizationId.toString() !==
      rfq.buyerOrganizationId.toString()
  ) {
    throw new Error(
      "You are not authorized to compare these quotations."
    );
  }

  const quotations = await Quotation.find({
    rfqId: rfq._id,
    status: {
      $in: ["submitted", "under_review", "accepted", "rejected"],
    },
  })
    .populate("supplierId", "fullName email companyName")
    .sort({ totalAmount: 1 })
    .lean();

  const itemComparisons = rfq.items.map((rfqItem) => {
    const supplierPrices = quotations.map((quotation) => {
      const quotedItem = quotation.items.find(
        (item) =>
          item.rfqItemId.toString() === rfqItem._id.toString()
      );

      return {
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        supplier: quotation.supplierId,
        unitPrice: quotedItem?.unitPrice ?? null,
        totalPrice: quotedItem?.totalPrice ?? null,
      };
    });

    const validPrices = supplierPrices
      .map((item) => item.unitPrice)
      .filter((price): price is number => price !== null);

    return {
      rfqItemId: rfqItem._id,
      productName: rfqItem.productName,
      requiredQuantity: rfqItem.quantity,
      unit: rfqItem.unit,
      supplierPrices,
      lowestUnitPrice:
        validPrices.length > 0
          ? Math.min(...validPrices)
          : null,
      highestUnitPrice:
        validPrices.length > 0
          ? Math.max(...validPrices)
          : null,
    };
  });

  const supplierComparisons = quotations.map((quotation) => ({
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    supplier: quotation.supplierId,
    subtotal: quotation.subtotal,
    taxAmount: quotation.taxAmount,
    deliveryCharges: quotation.deliveryCharges,
    totalAmount: quotation.totalAmount,
    deliveryTimeline: quotation.deliveryTimeline,
    validityDate: quotation.validityDate,
    status: quotation.status,
    submittedAt: quotation.submittedAt,
    supplierRemarks: quotation.supplierRemarks,
  }));

  return {
    rfq: {
      id: rfq._id,
      rfqNumber: rfq.rfqNumber,
      title: rfq.title,
      submissionDeadline: rfq.submissionDeadline,
      itemCount: rfq.items.length,
    },
    quotationCount: quotations.length,
    supplierComparisons,
    itemComparisons,
  };
};

// ==========================================
// 4. ACCEPT OR REJECT SUPPLIER QUOTATION
// PROCUREMENT MANAGER
// ==========================================

export const reviewQuotation = async (
  quotationId: string,
  procurementUserId: string,
  decision: "accepted" | "rejected",
  rejectionReason?: string
) => {
  if (!mongoose.isValidObjectId(quotationId)) {
    throw new Error("Invalid quotation ID.");
  }

  if (!mongoose.isValidObjectId(procurementUserId)) {
    throw new Error("Invalid procurement user ID.");
  }

  if (
    decision !== "accepted" &&
    decision !== "rejected"
  ) {
    throw new Error("Invalid quotation decision.");
  }

  if (
    decision === "rejected" &&
    (!rejectionReason || !rejectionReason.trim())
  ) {
    throw new Error("A rejection reason is required.");
  }

  const session = await mongoose.startSession();

  try {
    let reviewedQuotation = null;
    let reviewedPurchaseOrder: Awaited<
      ReturnType<typeof createPurchaseOrderForAcceptedQuotation>
    > | null = null;

    await session.withTransaction(async () => {
      // Verify procurement user.
      const procurementUser = await User.findById(procurementUserId)
        .select("organizationId role accountStatus")
        .session(session);

      if (
        !procurementUser ||
        procurementUser.role !== "procurement" ||
        procurementUser.accountStatus !== "active"
      ) {
        throw new Error("Active procurement account required.");
      }

      // Find quotation.
      const quotation = await Quotation.findById(quotationId)
        .session(session);

      if (!quotation) {
        throw new Error("Quotation not found.");
      }

      // Verify organization ownership.
      if (
        !procurementUser.organizationId ||
        procurementUser.organizationId.toString() !==
          quotation.buyerOrganizationId.toString()
      ) {
        throw new Error(
          "You are not authorized to review this quotation."
        );
      }

      // Verify associated RFQ.
      const rfq = await RFQ.findById(quotation.rfqId)
        .session(session);

      if (!rfq) {
        throw new Error("Associated RFQ not found.");
      }

      if (
        procurementUser.organizationId.toString() !==
        rfq.buyerOrganizationId.toString()
      ) {
        throw new Error(
          "You are not authorized to review this RFQ."
        );
      }

      // Only submitted or under-review quotations can be reviewed.
      if (
        !["submitted", "under_review"].includes(quotation.status)
      ) {
        throw new Error(
          `Quotation cannot be reviewed because its status is ${quotation.status}.`
        );
      }

      const now = new Date();

      if (decision === "accepted") {
        if (quotation.validityDate <= now) {
          throw new Error("Quotation validity period has expired.");
        }

        // Prevent another award for this RFQ.
        const existingAcceptedQuotation = await Quotation.findOne({
          rfqId: quotation.rfqId,
          status: "accepted",
          _id: { $ne: quotation._id },
        }).session(session);

        if (existingAcceptedQuotation) {
          throw new Error(
            "Another quotation has already been accepted for this RFQ."
          );
        }

        // Accept selected quotation.
        quotation.status = "accepted";
        quotation.reviewedBy = new mongoose.Types.ObjectId(
          procurementUserId
        );
        quotation.reviewedAt = now;
        quotation.rejectionReason = undefined;

        await quotation.save({ session });

        // Reject all other active quotations for this RFQ.
        await Quotation.updateMany(
          {
            rfqId: quotation.rfqId,
            _id: { $ne: quotation._id },
            status: { $in: ["submitted", "under_review"] },
          },
          {
            $set: {
              status: "rejected",
              reviewedBy: new mongoose.Types.ObjectId(
                procurementUserId
              ),
              reviewedAt: now,
              rejectionReason:
                "Another supplier quotation was selected for this RFQ.",
            },
          },
          { session }
        );

        reviewedPurchaseOrder =
          await createPurchaseOrderForAcceptedQuotation(
            quotation,
            rfq,
            procurementUser._id,
            session
          );
      } else {
        // Reject selected quotation.
        quotation.status = "rejected";
        quotation.reviewedBy = new mongoose.Types.ObjectId(
          procurementUserId
        );
        quotation.reviewedAt = now;
        quotation.rejectionReason = rejectionReason?.trim();

        await quotation.save({ session });
      }

      reviewedQuotation = quotation;
    });

    return {
      quotation: reviewedQuotation,
      purchaseOrder: reviewedPurchaseOrder,
    };
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      throw new Error(
        "Another quotation has already been accepted for this RFQ."
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};
