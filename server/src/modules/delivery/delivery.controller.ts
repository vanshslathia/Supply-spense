
import { Request, Response } from "express";

import {
  createDelivery,
  updateDeliveryStatus,
  getSupplierDeliveries,
  getBuyerDeliveries,
  getWarehouseDeliveries,
  getQcInspectorDashboard,
  confirmDeliveryReceipt,
  recordDeliveryArrival,
  recordWarehouseReceipt,
  submitDeliveryForQc,
  startQualityInspection,
  submitQualityInspectionResults,
} from "./delivery.service";

import {
  createDeliverySchema,
  updateDeliveryStatusSchema,
  confirmDeliveryReceiptSchema,
  recordDeliveryArrivalSchema,
  recordWarehouseReceiptSchema,
  startInspectionSchema,
  submitInspectionResultsSchema,
} from "./delivery.validation";

// Create delivery
export const createDeliveryController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      return res.status(403).json({
        success: false,
        message: "Only suppliers can create deliveries.",
      });
    }

    const validation = createDeliverySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery information.",
        errors: validation.error.flatten(),
      });
    }

    const delivery = await createDelivery(
      req.params.purchaseOrderId as string,
      req.session.userId,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Delivery created successfully.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create delivery.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Supplier updates shipment progress.
export const updateDeliveryStatusController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      return res.status(403).json({
        success: false,
        message: "Only suppliers can update delivery status.",
      });
    }

    const validation = updateDeliveryStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status information.",
        errors: validation.error.flatten(),
      });
    }

    const delivery = await updateDeliveryStatus(
      req.params.deliveryId as string,
      req.session.userId,
      validation.data.status,
      validation.data.notes
    );

    return res.status(200).json({
      success: true,
      message: "Delivery status updated successfully.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update delivery status.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Get all deliveries belonging to the supplier.
export const getSupplierDeliveriesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "supplier") {
      return res.status(403).json({
        success: false,
        message: "Only suppliers can view their deliveries.",
      });
    }

    const deliveries = await getSupplierDeliveries(req.session.userId);

    return res.status(200).json({
      success: true,
      message: "Supplier deliveries retrieved successfully.",
      data: { deliveries },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve supplier deliveries.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Get deliveries belonging to the buyer organization.
export const getBuyerDeliveriesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      return res.status(403).json({
        success: false,
        message: "Only procurement users can view buyer deliveries.",
      });
    }

    const deliveries = await getBuyerDeliveries(req.session.userId);

    return res.status(200).json({
      success: true,
      message: "Buyer deliveries retrieved successfully.",
      data: { deliveries },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve buyer deliveries.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Get deliveries belonging to the warehouse user's organization.
export const getWarehouseDeliveriesController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "warehouse") {
      return res.status(403).json({
        success: false,
        message: "Only warehouse staff can view warehouse deliveries.",
      });
    }

    const deliveries = await getWarehouseDeliveries(req.session.userId);

    return res.status(200).json({
      success: true,
      message: "Warehouse deliveries retrieved successfully.",
      data: { deliveries },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve warehouse deliveries.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Legacy procurement receipt endpoint retained for backward compatibility.
export const confirmDeliveryReceiptController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "procurement") {
      return res.status(403).json({
        success: false,
        message: "Only procurement users can confirm delivery receipts.",
      });
    }

    const validation = confirmDeliveryReceiptSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery receipt information.",
        errors: validation.error.flatten(),
      });
    }

    const delivery = await confirmDeliveryReceipt(
      req.params.deliveryId as string,
      req.session.userId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Delivery receipt confirmed successfully.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to confirm delivery receipt.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Warehouse records truck arrival at the facility.
export const recordDeliveryArrivalController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "warehouse") {
      return res.status(403).json({
        success: false,
        message: "Only warehouse staff can record delivery arrival.",
      });
    }

    const validation = recordDeliveryArrivalSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid arrival information.",
        errors: validation.error.flatten(),
      });
    }

    const delivery = await recordDeliveryArrival(
      req.params.deliveryId as string,
      req.session.userId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Delivery arrival recorded successfully.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record delivery arrival.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Warehouse records the quantities physically received.
export const recordWarehouseReceiptController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "warehouse") {
      return res.status(403).json({
        success: false,
        message: "Only warehouse staff can record received quantities.",
      });
    }

    const validation = recordWarehouseReceiptSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse receipt information.",
        errors: validation.error.flatten(),
      });
    }

    const delivery = await recordWarehouseReceipt(
      req.params.deliveryId as string,
      req.session.userId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Warehouse receipt recorded successfully.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record warehouse receipt.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Warehouse hands a fully received delivery over to QC.
export const submitDeliveryForQcController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "warehouse") {
      return res.status(403).json({
        success: false,
        message: "Only warehouse staff can submit deliveries for QC.",
      });
    }

    const notes = req.body?.notes;

    if (
      notes !== undefined &&
      (typeof notes !== "string" || notes.length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Notes must be text with a maximum length of 2000 characters.",
      });
    }

    const delivery = await submitDeliveryForQc(
      req.params.deliveryId as string,
      req.session.userId,
      notes
    );

    return res.status(200).json({
      success: true,
      message: "Delivery submitted for quality inspection.",
      data: { delivery },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit delivery for QC.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// QC inspector starts a sample-based inspection.
export const startQualityInspectionController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "qc_inspector") {
      return res.status(403).json({
        success: false,
        message: "Only QC inspectors can start quality inspections.",
      });
    }

    const validation = startInspectionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid inspection information.",
        errors: validation.error.flatten(),
      });
    }

    const inspection = await startQualityInspection(
      req.params.deliveryId as string,
      req.session.userId,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: "Quality inspection started successfully.",
      data: { inspection },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start quality inspection.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// QC inspector submits sampled unit results.
// The backend determines the final QC decision.
export const submitQualityInspectionResultsController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "qc_inspector") {
      return res.status(403).json({
        success: false,
        message: "Only QC inspectors can submit quality inspection results.",
      });
    }

    const validation = submitInspectionResultsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid quality inspection results.",
        errors: validation.error.flatten(),
      });
    }

    const inspection = await submitQualityInspectionResults(
      req.params.inspectionId as string,
      req.session.userId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Quality inspection results submitted successfully.",
      data: { inspection },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit quality inspection results.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

// Get QC dashboard data for the logged-in inspector.
export const getQcInspectorDashboardController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.session.userId || req.session.role !== "qc_inspector") {
      return res.status(403).json({
        success: false,
        message: "Only QC inspectors can access this dashboard.",
      });
    }

    const dashboard = await getQcInspectorDashboard(req.session.userId);

    return res.status(200).json({
      success: true,
      message: "QC inspector dashboard retrieved successfully.",
      data: dashboard,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve QC dashboard.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};
