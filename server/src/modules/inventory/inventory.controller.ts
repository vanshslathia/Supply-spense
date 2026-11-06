import { Request, Response } from "express";
import { z } from "zod";
import {
  getInventoryLedger,
  getInventoryLocations,
  getInventoryOverview,
  getInventoryProductsForUser,
  updateInventoryReorderLevel,
} from "./inventory.service";

const filtersSchema = z.object({
  organizationId: z.string().trim().optional(),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  locationId: z.string().trim().optional(),
  status: z.enum(["all", "healthy", "low_stock", "out_of_stock"]).optional(),
});

const ledgerSchema = z.object({
  organizationId: z.string().trim().optional(),
  sourceRfqItemId: z.string().trim().optional(),
  transactionType: z.enum(["qc_accepted_receipt", "qc_disposition"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const reorderLevelSchema = z.object({
  reorderLevel: z.number().finite().min(0).max(1_000_000_000),
});

const getUser = (res: Response) => res.locals.user;

const sendError = (res: Response, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  return res.status(message.startsWith("You are not authorized") ? 403 : 400).json({
    success: false,
    message,
  });
};

export const getInventoryOverviewController = async (
  req: Request,
  res: Response
) => {
  const validation = filtersSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory filters.",
      errors: validation.error.flatten(),
    });
  }
  try {
    const data = await getInventoryOverview(
      getUser(res),
      validation.data.organizationId,
      validation.data
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Unable to load inventory overview.");
  }
};

export const getInventoryProductsController = async (
  req: Request,
  res: Response
) => {
  const validation = filtersSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory filters.",
      errors: validation.error.flatten(),
    });
  }
  try {
    const products = await getInventoryProductsForUser(
      getUser(res),
      validation.data.organizationId,
      validation.data
    );
    return res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    return sendError(res, error, "Unable to load inventory products.");
  }
};

export const getInventoryLocationsController = async (
  req: Request,
  res: Response
) => {
  const validation = z.object({
    organizationId: z.string().trim().optional(),
  }).safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: "Invalid organization ID." });
  }
  try {
    const locations = await getInventoryLocations(
      getUser(res),
      validation.data.organizationId
    );
    return res.status(200).json({ success: true, data: { locations } });
  } catch (error) {
    return sendError(res, error, "Unable to load warehouse locations.");
  }
};

export const getInventoryLedgerController = async (
  req: Request,
  res: Response
) => {
  const validation = ledgerSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory ledger filters.",
      errors: validation.error.flatten(),
    });
  }
  if (
    validation.data.startDate &&
    validation.data.endDate &&
    validation.data.startDate > validation.data.endDate
  ) {
    return res.status(400).json({
      success: false,
      message: "Start date must not be later than end date.",
    });
  }
  try {
    const data = await getInventoryLedger(getUser(res), validation.data);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Unable to load inventory ledger.");
  }
};

export const updateInventoryReorderLevelController = async (
  req: Request,
  res: Response
) => {
  const validation = reorderLevelSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid reorder level.",
      errors: validation.error.flatten(),
    });
  }
  try {
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }
    const product = await updateInventoryReorderLevel(
      getUser(res),
      productId,
      validation.data.reorderLevel,
      typeof req.query.organizationId === "string" ? req.query.organizationId : undefined
    );
    return res.status(200).json({
      success: true,
      message: "Reorder level updated.",
      data: { product },
    });
  } catch (error) {
    return sendError(res, error, "Unable to update reorder level.");
  }
};
