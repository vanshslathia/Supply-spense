
import mongoose, { Types } from "mongoose";

import Invoice from "../../models/Invoice";
import PurchaseOrder from "../../models/PurchaseOrder";
import Delivery from "../../models/Delivery";
import User from "../../models/User";

import {
  CreateInvoiceInput,
  ProcurementInvoiceReviewInput,
  FinanceInvoiceReviewInput,
} from "./invoice.validation";

// Generate invoice reference.
const generateInvoiceReference = () => {
  return `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
    throw new Error("Supplier is not eligible to submit invoices.");
  }

  return supplier;
};

// Verify procurement eligibility.
const getEligibleProcurementUser = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid procurement user ID.");
  }

  const user = await User.findById(userId);

  if (
    !user ||
    user.role !== "procurement" ||
    user.accountStatus !== "active" ||
    !user.organizationId
  ) {
    throw new Error("Procurement account is not eligible.");
  }

  return user;
};

// Verify finance eligibility.
const getEligibleFinanceUser = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid finance user ID.");
  }

  const user = await User.findById(userId);

  if (
    !user ||
    user.role !== "finance" ||
    user.accountStatus !== "active" ||
    !user.organizationId
  ) {
    throw new Error("Finance account is not eligible.");
  }

  return user;
};

// Supplier submits an invoice against a purchase order.
export const createInvoice = async (
  supplierId: string,
  input: CreateInvoiceInput
) => {
  const supplier = await getEligibleSupplier(supplierId);

  if (!Types.ObjectId.isValid(input.purchaseOrderId)) {
    throw new Error("Invalid purchase order ID.");
  }

  const purchaseOrder = await PurchaseOrder.findById(
    input.purchaseOrderId
  );

  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  if (purchaseOrder.supplierId.toString() !== supplier._id.toString()) {
    throw new Error("You are not authorized to invoice this purchase order.");
  }

  if (
    !["in_progress", "partially_delivered", "delivered"].includes(
      purchaseOrder.status
    )
  ) {
    throw new Error(
      "Invoices can only be submitted for purchase orders with delivered items."
    );
  }

  // Calculate total quantities actually delivered against this PO.
  const deliveries = await Delivery.find({
    purchaseOrderId: purchaseOrder._id,
    status: { $ne: "cancelled" },
  });

  const deliveredQuantities = new Map<string, number>();

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

  // Get previous non-rejected invoice quantities.
  const previousInvoices = await Invoice.find({
    purchaseOrderId: purchaseOrder._id,
    status: {
      $nin: ["procurement_rejected", "finance_rejected"],
    },
  });

  const previouslyInvoiced = new Map<string, number>();

  for (const invoice of previousInvoices) {
    for (const item of invoice.items) {
      const key = item.poItemId.toString();

      previouslyInvoiced.set(
        key,
        (previouslyInvoiced.get(key) || 0) + item.quantity
      );
    }
  }

  const invoiceItems = input.items.map((inputItem) => {
    // poItemId references the RFQ item ID used by the PO.
    const poItem = purchaseOrder.items.find(
      (item) =>
        item.rfqItemId.toString() === inputItem.poItemId
    );

    if (!poItem) {
      throw new Error(
        "Invoice contains an item that does not belong to this purchase order."
      );
    }

    const itemId = poItem.rfqItemId.toString();

    const deliveredQuantity =
      deliveredQuantities.get(itemId) || 0;

    const alreadyInvoiced =
      previouslyInvoiced.get(itemId) || 0;

    const remainingInvoiceQuantity =
      deliveredQuantity - alreadyInvoiced;

    if (inputItem.quantity > remainingInvoiceQuantity) {
      throw new Error(
        `Invoice quantity exceeds the uninvoiced delivered quantity for ${poItem.productName}. Remaining: ${remainingInvoiceQuantity}.`
      );
    }

    const totalPrice = Number(
      (inputItem.quantity * inputItem.unitPrice).toFixed(2)
    );

    return {
      poItemId: poItem.rfqItemId,
      productName: poItem.productName,
      quantity: inputItem.quantity,
      unit: poItem.unit,
      unitPrice: inputItem.unitPrice,
      totalPrice,
    };
  });

  const subtotal = Number(
    invoiceItems
      .reduce((total, item) => total + item.totalPrice, 0)
      .toFixed(2)
  );

  const taxAmount = Number(
    ((subtotal * input.taxPercentage) / 100).toFixed(2)
  );

  const totalAmount = Number(
    (
      subtotal +
      taxAmount +
      input.additionalCharges
    ).toFixed(2)
  );

  const invoice = await Invoice.create({
    invoiceNumber: input.invoiceNumber,
    purchaseOrderId: purchaseOrder._id,
    supplierId: supplier._id,
    buyerOrganizationId: purchaseOrder.buyerOrganizationId,
    items: invoiceItems,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    subtotal,
    taxPercentage: input.taxPercentage,
    taxAmount,
    additionalCharges: input.additionalCharges,
    totalAmount,
    documentUrl: input.documentUrl,
    notes: input.notes,
    status: "submitted",
    paymentStatus: "pending",
    amountPaid: 0,
  });

  return invoice;
};

// Procurement verifies or rejects an invoice.
export const reviewInvoiceByProcurement = async (
  invoiceId: string,
  procurementUserId: string,
  input: ProcurementInvoiceReviewInput
) => {
  if (!Types.ObjectId.isValid(invoiceId)) {
    throw new Error("Invalid invoice ID.");
  }

  const procurementUser =
    await getEligibleProcurementUser(procurementUserId);

  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (
    invoice.buyerOrganizationId.toString() !==
    procurementUser.organizationId!.toString()
  ) {
    throw new Error("You are not authorized to review this invoice.");
  }

  if (invoice.status !== "submitted") {
    throw new Error("Only submitted invoices can be reviewed.");
  }

  invoice.procurementReviewedBy = procurementUser._id;
  invoice.procurementReviewedAt = new Date();
  invoice.procurementRemarks = input.remarks;

  if (input.decision === "approve") {
    invoice.status = "procurement_verified";
  } else {
    invoice.status = "procurement_rejected";
  }

  await invoice.save();

  return invoice;
};

// Finance approves or rejects a verified invoice.
export const reviewInvoiceByFinance = async (
  invoiceId: string,
  financeUserId: string,
  input: FinanceInvoiceReviewInput
) => {
  if (!Types.ObjectId.isValid(invoiceId)) {
    throw new Error("Invalid invoice ID.");
  }

  const financeUser = await getEligibleFinanceUser(financeUserId);

  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (
    invoice.buyerOrganizationId.toString() !==
    financeUser.organizationId!.toString()
  ) {
    throw new Error("You are not authorized to review this invoice.");
  }

  if (invoice.status !== "procurement_verified") {
    throw new Error(
      "Only procurement-verified invoices can be reviewed by Finance."
    );
  }

  invoice.financeApprovedBy = financeUser._id;
  invoice.financeApprovedAt = new Date();
  invoice.financeRemarks = input.remarks;

  if (input.decision === "approve") {
    invoice.status = "finance_approved";
  } else {
    invoice.status = "finance_rejected";
  }

  await invoice.save();

  return invoice;
};

// Supplier views their invoices.
export const getSupplierInvoices = async (supplierId: string) => {
  const supplier = await getEligibleSupplier(supplierId);

  return Invoice.find({
    supplierId: supplier._id,
  })
    .populate("purchaseOrderId", "poNumber status totalAmount")
    .populate("buyerOrganizationId", "name organizationCode")
    .sort({ createdAt: -1 });
};

// Procurement views invoices belonging to their organization.
export const getBuyerInvoices = async (procurementUserId: string) => {
  const procurementUser =
    await getEligibleProcurementUser(procurementUserId);

  return Invoice.find({
    buyerOrganizationId: procurementUser.organizationId,
  })
    .populate("purchaseOrderId", "poNumber status totalAmount")
    .populate("supplierId", "fullName email companyName")
    .sort({ createdAt: -1 });
};

// Finance views invoices belonging to their organization.
export const getFinanceInvoices = async (financeUserId: string) => {
  const financeUser = await getEligibleFinanceUser(financeUserId);

  return Invoice.find({
    buyerOrganizationId: financeUser.organizationId,
  })
    .populate("purchaseOrderId", "poNumber status totalAmount")
    .populate("supplierId", "fullName email companyName")
    .sort({ createdAt: -1 });
};
