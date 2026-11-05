
import { Router } from "express";

import {
  createRFQController,
  getProcurementRFQsController,
  getProcurementRFQByIdController,
  getSupplierRFQsController,
  getSupplierRFQByIdController,
  publishRFQController,
} from "./rfq.controller";

import { requireProcurement } from "./rfq.middleware";

const router = Router();

// ==========================================
// SUPPLIER ROUTES
// Keep these BEFORE dynamic /:id routes
// ==========================================

// Get all available RFQs
router.get(
  "/supplier",
  getSupplierRFQsController
);

// Get a specific RFQ
router.get(
  "/supplier/:id",
  getSupplierRFQByIdController
);

// ==========================================
// PROCUREMENT ROUTES
// ==========================================

// Get all RFQs belonging to the procurement organization
router.get(
  "/",
  requireProcurement,
  getProcurementRFQsController
);

// Create a new RFQ (Draft)
router.post(
  "/",
  requireProcurement,
  createRFQController
);

// Publish an existing Draft RFQ
router.patch(
  "/:id/publish",
  requireProcurement,
  publishRFQController
);

// Get a specific RFQ belonging to the procurement organization
router.get(
  "/:id",
  requireProcurement,
  getProcurementRFQByIdController
);

export default router;
