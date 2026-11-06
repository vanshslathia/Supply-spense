
import { Request, Response } from "express";
import { z } from "zod";

import {
  createPayment,
  updatePaymentStatus,
  getInvoicePayments,
  getOrganizationPayments,
} from "./payment.service";

import {
  createPaymentSchema,
  updatePaymentStatusSchema,
} from "./payment.validation";

// Centralized error handling for payment controllers.
function handlePaymentError(
  res: Response,
  error: unknown,
  fallbackMessage: string
) {
  const message =
    error instanceof Error ? error.message : fallbackMessage;

  // Missing resources.
  if (
    message.includes("not found") ||
    message.includes("not found for your organization")
  ) {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  // Duplicate references and conflicting financial operations.
  if (
    message.includes("already been used") ||
    message.includes("already has this status") ||
    message.includes("would exceed the invoice balance") ||
    message.includes("can only be reversed") ||
    message.includes("cannot be reversed") ||
    message.includes("cannot be updated")
  ) {
    return res.status(409).json({
      success: false,
      message,
    });
  }

  // Invalid IDs and business validation errors.
  if (
    message.includes("Invalid") ||
    message.includes("exceeds the outstanding balance")
  ) {
    return res.status(400).json({
      success: false,
      message,
    });
  }

  // Finance account or organization access problems.
  if (
    message.includes("Finance Manager") ||
    message.includes("linked to an organization")
  ) {
    return res.status(403).json({
      success: false,
      message,
    });
  }

  // Unexpected errors should not expose internal details.
  console.error("Payment API error:", error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

// Check Finance Manager session.
function isFinanceManager(req: Request, res: Response): boolean {
  if (!req.session.userId || req.session.role !== "finance") {
    res.status(403).json({
      success: false,
      message: "Only Finance Managers can access payment operations.",
    });

    return false;
  }

  return true;
}

// 1. Record a payment.
export async function createPaymentController(
  req: Request,
  res: Response
) {
  try {
    if (!isFinanceManager(req, res)) return;

    const validation = createPaymentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment details.",
        errors: z.treeifyError(validation.error),
      });
    }

    const payment = await createPayment(
      req.session.userId!,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      data: payment,
    });
  } catch (error) {
    return handlePaymentError(
      res,
      error,
      "Failed to record payment."
    );
  }
}

// 2. Update payment status.
export async function updatePaymentStatusController(
  req: Request,
  res: Response
) {
  try {
    if (!isFinanceManager(req, res)) return;

    const validation = updatePaymentStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status details.",
        errors: z.treeifyError(validation.error),
      });
    }

    const paymentId = req.params.paymentId;

    if (typeof paymentId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    const payment = await updatePaymentStatus(
      req.session.userId!,
      paymentId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully.",
      data: payment,
    });
  } catch (error) {
    return handlePaymentError(
      res,
      error,
      "Failed to update payment."
    );
  }
}

// 3. Get payment history for an invoice.
export async function getInvoicePaymentsController(
  req: Request,
  res: Response
) {
  try {
    if (!isFinanceManager(req, res)) return;

    const invoiceId = req.params.invoiceId;

    if (typeof invoiceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const payments = await getInvoicePayments(
      req.session.userId!,
      invoiceId
    );

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    return handlePaymentError(
      res,
      error,
      "Failed to fetch invoice payments."
    );
  }
}

// 4. Get organization-wide payment history.
export async function getOrganizationPaymentsController(
  req: Request,
  res: Response
) {
  try {
    if (!isFinanceManager(req, res)) return;

    const payments = await getOrganizationPayments(
      req.session.userId!
    );

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    return handlePaymentError(
      res,
      error,
      "Failed to fetch organization payments."
    );
  }
}
