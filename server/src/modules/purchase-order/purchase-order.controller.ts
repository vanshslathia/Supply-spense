import type { Request, Response } from "express";

import {
  acknowledgePurchaseOrder,
  generatePurchaseOrder,
  getProcurementPurchaseOrders,
  getSupplierPurchaseOrders,
  issuePurchaseOrder,
  rejectPurchaseOrder,
} from "./purchase-order.service";

type PurchaseOrderRole = "procurement" | "supplier";

const requireRole = (
  req: Request,
  res: Response,
  role: PurchaseOrderRole
): string | undefined => {
  const userId = req.session.userId;

  if (!userId || req.session.role !== role) {
    res.status(401).json({
      success: false,
      message: `${role === "procurement" ? "Procurement" : "Supplier"} authentication required.`,
    });
    return undefined;
  }

  return userId;
};

const respondWithServiceError = (
  res: Response,
  error: unknown,
  fallbackMessage: string,
  action: string
): void => {
  const message =
    error instanceof Error ? error.message : fallbackMessage;

  if (message.includes("already exists")) {
    res.status(409).json({ success: false, message });
    return;
  }

  if (
    message.includes("not authorized") ||
    message.includes("account required")
  ) {
    res.status(403).json({ success: false, message });
    return;
  }

  if (
    message.includes("Invalid") ||
    message.includes("not found") ||
    message.includes("Only accepted") ||
    message.includes("Only draft") ||
    message.includes("Only issued") ||
    message.includes("missing") ||
    message.includes("rejection reason") ||
    message.includes("2000 characters")
  ) {
    res.status(400).json({ success: false, message });
    return;
  }

  console.error(`${action} error:`, error);
  res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const getRouteParam = (
  req: Request,
  res: Response,
  name: string,
  label: string
): string | undefined => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    res.status(400).json({
      success: false,
      message: `A valid ${label} is required.`,
    });
    return undefined;
  }

  return value;
};

export const generatePurchaseOrderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "procurement");
  if (!userId) return;

  const quotationId = getRouteParam(req, res, "quotationId", "quotation ID");
  if (!quotationId) return;

  try {
    const purchaseOrder = await generatePurchaseOrder(
      quotationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Purchase order generated successfully.",
      data: { purchaseOrder },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to generate purchase order.",
      "Generate purchase order"
    );
  }
};

export const issuePurchaseOrderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "procurement");
  if (!userId) return;

  const purchaseOrderId = getRouteParam(
    req,
    res,
    "purchaseOrderId",
    "purchase order ID"
  );
  if (!purchaseOrderId) return;

  try {
    const purchaseOrder = await issuePurchaseOrder(
      purchaseOrderId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Purchase order issued successfully.",
      data: { purchaseOrder },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to issue purchase order.",
      "Issue purchase order"
    );
  }
};

export const getProcurementPurchaseOrdersController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "procurement");
  if (!userId) return;

  try {
    const purchaseOrders = await getProcurementPurchaseOrders(userId);

    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      data: { purchaseOrders },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to retrieve purchase orders.",
      "Get procurement purchase orders"
    );
  }
};

export const getSupplierPurchaseOrdersController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "supplier");
  if (!userId) return;

  try {
    const purchaseOrders = await getSupplierPurchaseOrders(userId);

    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      data: { purchaseOrders },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to retrieve purchase orders.",
      "Get supplier purchase orders"
    );
  }
};

export const acknowledgePurchaseOrderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "supplier");
  if (!userId) return;

  const purchaseOrderId = getRouteParam(
    req,
    res,
    "purchaseOrderId",
    "purchase order ID"
  );
  if (!purchaseOrderId) return;

  try {
    const purchaseOrder = await acknowledgePurchaseOrder(
      purchaseOrderId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Purchase order acknowledged successfully.",
      data: { purchaseOrder },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to acknowledge purchase order.",
      "Acknowledge purchase order"
    );
  }
};

export const rejectPurchaseOrderController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = requireRole(req, res, "supplier");
  if (!userId) return;

  const purchaseOrderId = getRouteParam(
    req,
    res,
    "purchaseOrderId",
    "purchase order ID"
  );
  if (!purchaseOrderId) return;

  const rejectionReason: unknown = req.body?.rejectionReason;
  if (
    typeof rejectionReason !== "string" ||
    !rejectionReason.trim()
  ) {
    res.status(400).json({
      success: false,
      message: "A rejection reason is required.",
    });
    return;
  }

  try {
    const purchaseOrder = await rejectPurchaseOrder(
      purchaseOrderId,
      userId,
      rejectionReason
    );

    res.status(200).json({
      success: true,
      message: "Purchase order rejected successfully.",
      data: { purchaseOrder },
    });
  } catch (error) {
    respondWithServiceError(
      res,
      error,
      "Unable to reject purchase order.",
      "Reject purchase order"
    );
  }
};
