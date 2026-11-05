
import mongoose, { Types } from "mongoose";
import Payment, { PaymentStatus } from "../../models/Payment";
import Invoice from "../../models/Invoice";
import User from "../../models/User";
import {
  CreatePaymentInput,
  UpdatePaymentStatusInput,
} from "./payment.validation";

async function getEligibleFinanceUser(financeUserId: string) {
  if (!Types.ObjectId.isValid(financeUserId)) {
    throw new Error("Invalid finance user ID.");
  }

  const user = await User.findById(financeUserId);

  if (!user || user.role !== "finance" || user.accountStatus !== "active") {
    throw new Error("Active Finance Manager account required.");
  }

  if (!user.organizationId) {
    throw new Error("Finance user is not linked to an organization.");
  }

  return user;
}

function generatePaymentNumber(): string {
  return `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function isDuplicateTransactionReference(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== 11000
  ) {
    return false;
  }

  const mongoError = error as {
    keyPattern?: Record<string, number>;
    message?: string;
  };

  return (
    mongoError.keyPattern?.transactionReference === 1 ||
    mongoError.message?.includes("unique_org_transaction_reference") === true
  );
}

// 1. Record a new payment against an approved invoice.
export async function createPayment(
  financeUserId: string,
  input: CreatePaymentInput
) {
  const financeUser = await getEligibleFinanceUser(financeUserId);

  const normalizedReference = input.transactionReference
    ?.trim()
    .toUpperCase();

  const session = await mongoose.startSession();

  try {
    let createdPayment: InstanceType<typeof Payment> | null = null;

    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: input.invoiceId,
        buyerOrganizationId: financeUser.organizationId,
        status: "finance_approved",
      }).session(session);

      if (!invoice) {
        throw new Error(
          "Finance-approved invoice not found for your organization."
        );
      }

      // Fast duplicate check. The unique MongoDB index remains
      // the final protection against concurrent duplicate requests.
      if (normalizedReference) {
        const existingPayment = await Payment.findOne({
          buyerOrganizationId: financeUser.organizationId,
          transactionReference: normalizedReference,
        }).session(session);

        if (existingPayment) {
          throw new Error(
            "This transaction reference has already been used."
          );
        }
      }

      const remainingAmount =
        invoice.totalAmount - invoice.amountPaid;

      if (input.amount > remainingAmount) {
        throw new Error(
          `Payment exceeds the outstanding balance of ${remainingAmount}.`
        );
      }

      const payment = new Payment({
        paymentNumber: generatePaymentNumber(),
        invoiceId: invoice._id,
        purchaseOrderId: invoice.purchaseOrderId,
        supplierId: invoice.supplierId,
        buyerOrganizationId: invoice.buyerOrganizationId,
        amount: input.amount,
        currency: "INR",
        paymentMethod: input.paymentMethod,
        transactionReference: normalizedReference,
        paymentDate: input.paymentDate,
        status: "pending",
        recordedBy: financeUser._id,
        remarks: input.remarks,
        statusHistory: [],
      });

      await payment.save({ session });

      createdPayment = payment;
    });

    if (!createdPayment) {
      throw new Error("Payment could not be created.");
    }

    return createdPayment;
  } catch (error) {
    if (isDuplicateTransactionReference(error)) {
      throw new Error(
        "This transaction reference has already been used."
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

// 2. Update payment status and synchronize the invoice balance.
export async function updatePaymentStatus(
  financeUserId: string,
  paymentId: string,
  input: UpdatePaymentStatusInput
) {
  if (!Types.ObjectId.isValid(paymentId)) {
    throw new Error("Invalid payment ID.");
  }

  const financeUser = await getEligibleFinanceUser(financeUserId);
  const session = await mongoose.startSession();

  try {
    let updatedPayment: InstanceType<typeof Payment> | null = null;

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: paymentId,
        buyerOrganizationId: financeUser.organizationId,
      }).session(session);

      if (!payment) {
        throw new Error("Payment not found.");
      }

      const invoice = await Invoice.findOne({
        _id: payment.invoiceId,
        buyerOrganizationId: financeUser.organizationId,
      }).session(session);

      if (!invoice) {
        throw new Error("Associated invoice not found.");
      }

      const previousStatus: PaymentStatus = payment.status;
      const nextStatus = input.status;

      if (previousStatus === nextStatus) {
        throw new Error("Payment already has this status.");
      }

      if (previousStatus === "pending") {
        if (nextStatus === "reversed") {
          throw new Error("A pending payment cannot be reversed.");
        }
      } else if (previousStatus === "completed") {
        if (nextStatus !== "reversed") {
          throw new Error(
            "A completed payment can only be reversed."
          );
        }
      } else {
        throw new Error(
          "Failed or reversed payments cannot be updated."
        );
      }

      if (previousStatus === "pending" && nextStatus === "completed") {
        const remainingAmount =
          invoice.totalAmount - invoice.amountPaid;

        if (payment.amount > remainingAmount) {
          throw new Error(
            "This payment would exceed the invoice balance."
          );
        }

        invoice.amountPaid += payment.amount;
      }

      if (previousStatus === "completed" && nextStatus === "reversed") {
        invoice.amountPaid = Math.max(
          0,
          invoice.amountPaid - payment.amount
        );
      }

      if (invoice.amountPaid >= invoice.totalAmount) {
        invoice.amountPaid = invoice.totalAmount;
        invoice.paymentStatus = "paid";
      } else if (invoice.amountPaid > 0) {
        invoice.paymentStatus = "partially_paid";
      } else {
        invoice.paymentStatus = "pending";
      }

      // Update current payment status.
      payment.status = nextStatus;

      if (input.remarks) {
        payment.remarks = input.remarks;
      }

      // Append an immutable audit event for this transition.
      payment.statusHistory.push({
        fromStatus: previousStatus,
        toStatus: nextStatus,
        changedBy: financeUser._id,
        changedAt: new Date(),
        remarks: input.remarks,
      });

      // Save both changes within the same MongoDB transaction.
      await invoice.save({ session });
      await payment.save({ session });

      updatedPayment = payment;
    });

    if (!updatedPayment) {
      throw new Error("Payment status could not be updated.");
    }

    return updatedPayment;
  } finally {
    await session.endSession();
  }
}

// 3. Get all payments for an invoice, including audit history.
export async function getInvoicePayments(
  financeUserId: string,
  invoiceId: string
) {
  if (!Types.ObjectId.isValid(invoiceId)) {
    throw new Error("Invalid invoice ID.");
  }

  const financeUser = await getEligibleFinanceUser(financeUserId);

  const invoice = await Invoice.findOne({
    _id: invoiceId,
    buyerOrganizationId: financeUser.organizationId,
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  return Payment.find({
    invoiceId: invoice._id,
    buyerOrganizationId: financeUser.organizationId,
  })
    .populate("recordedBy", "fullName email")
    .populate("statusHistory.changedBy", "fullName email")
    .sort({ paymentDate: -1, createdAt: -1 });
}

// 4. Get all payments made by an organization.
export async function getOrganizationPayments(
  financeUserId: string
) {
  const financeUser = await getEligibleFinanceUser(financeUserId);

  return Payment.find({
    buyerOrganizationId: financeUser.organizationId,
  })
    .populate("invoiceId", "invoiceNumber totalAmount paymentStatus")
    .populate("supplierId", "fullName companyName email")
    .populate("recordedBy", "fullName email")
    .populate("statusHistory.changedBy", "fullName email")
    .sort({ paymentDate: -1, createdAt: -1 });
}
