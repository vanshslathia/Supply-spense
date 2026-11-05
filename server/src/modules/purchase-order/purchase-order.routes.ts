
import { Router } from "express";

import {
  generatePurchaseOrderController,
  issuePurchaseOrderController,
  getProcurementPurchaseOrdersController,
  getSupplierPurchaseOrdersController,
  acknowledgePurchaseOrderController,
  rejectPurchaseOrderController,
} from "./purchase-order.controller";

const router = Router();

// Supplier route
router.get("/supplier", getSupplierPurchaseOrdersController);

// ==========================================
// PROCUREMENT ROUTES
// ==========================================

router.get("/", getProcurementPurchaseOrdersController);

// Generate a purchase order from an accepted quotation
router.post(
  "/generate/:quotationId",
  generatePurchaseOrderController
);

// Issue a draft purchase order
router.patch(
  "/:purchaseOrderId/issue",
  issuePurchaseOrderController
);

// ==========================================
// SUPPLIER ACTION ROUTES
// ==========================================

// Acknowledge an issued purchase order
router.patch(
  "/:purchaseOrderId/acknowledge",
  acknowledgePurchaseOrderController
);

// Reject an issued purchase order
router.patch(
  "/:purchaseOrderId/reject",
  rejectPurchaseOrderController
);

export default router;
