
import { Router } from "express";

import {
  createDeliveryController,
  updateDeliveryStatusController,
  getSupplierDeliveriesController,
  getBuyerDeliveriesController,
  getAdminDeliveriesController,
  getOrganizationInventoryController,
  resolveDeliveryExceptionController,
  getWarehouseDeliveriesController,
  getQcInspectorDashboardController,
  recordDeliveryArrivalController,
  recordWarehouseReceiptController,
  submitDeliveryForQcController,
  startQualityInspectionController,
  submitQualityInspectionResultsController,
} from "./delivery.controller";

const router = Router();

router.get(
  "/inventory",
  getOrganizationInventoryController
);

router.patch(
  "/exceptions/:exceptionId/resolve",
  resolveDeliveryExceptionController
);

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

router.get(
  "/admin",
  getAdminDeliveriesController
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
