
import { Router } from "express";

import {
  createDeliveryController,
  updateDeliveryStatusController,
  getSupplierDeliveriesController,
  getBuyerDeliveriesController,
  getWarehouseDeliveriesController,
  getQcInspectorDashboardController,
  confirmDeliveryReceiptController,
  recordDeliveryArrivalController,
  recordWarehouseReceiptController,
  submitDeliveryForQcController,
  startQualityInspectionController,
  submitQualityInspectionResultsController,
} from "./delivery.controller";

const router = Router();

// Supplier routes
router.post(
  "/purchase-order/:purchaseOrderId",
  createDeliveryController
);

router.patch(
  "/:deliveryId/status",
  updateDeliveryStatusController
);

router.get(
  "/supplier",
  getSupplierDeliveriesController
);

// Procurement routes
router.get(
  "/buyer",
  getBuyerDeliveriesController
);

// Legacy procurement receipt endpoint
router.patch(
  "/:deliveryId/confirm-receipt",
  confirmDeliveryReceiptController
);

// Warehouse routes
router.get(
  "/warehouse",
  getWarehouseDeliveriesController
);

router.patch(
  "/:deliveryId/arrival",
  recordDeliveryArrivalController
);

router.patch(
  "/:deliveryId/warehouse-receipt",
  recordWarehouseReceiptController
);

router.patch(
  "/:deliveryId/submit-for-qc",
  submitDeliveryForQcController
);

// QC inspector routes
router.get(
  "/qc-inspector",
  getQcInspectorDashboardController
);

router.post(
  "/:deliveryId/inspections",
  startQualityInspectionController
);

router.patch(
  "/inspections/:inspectionId/results",
  submitQualityInspectionResultsController
);

export default router;
