
import { Router } from "express";

import {
  createPaymentController,
  updatePaymentStatusController,
  getInvoicePaymentsController,
  getOrganizationPaymentsController,
} from "./payment.controller";

const router = Router();

// Record a payment
router.post("/", createPaymentController);

// Update payment status
router.patch("/:paymentId/status", updatePaymentStatusController);

// Get payment history for a specific invoice
router.get("/invoice/:invoiceId", getInvoicePaymentsController);

// Get all payments for the organization
router.get("/organization", getOrganizationPaymentsController);

export default router;
