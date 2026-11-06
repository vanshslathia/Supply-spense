
import { Router } from "express";

import {
  createInvoiceController,
  procurementReviewInvoiceController,
  financeReviewInvoiceController,
  getSupplierInvoicesController,
  getBuyerInvoicesController,
  getFinanceInvoicesController,
} from "./invoice.controller";

const router = Router();

// Supplier routes
router.post("/", createInvoiceController);
router.get("/supplier", getSupplierInvoicesController);

// Procurement routes
router.get("/buyer", getBuyerInvoicesController);

router.patch(
  "/:invoiceId/procurement-review",
  procurementReviewInvoiceController
);

// Finance routes
router.get("/finance", getFinanceInvoicesController);

router.patch(
  "/:invoiceId/finance-review",
  financeReviewInvoiceController
);

export default router;
