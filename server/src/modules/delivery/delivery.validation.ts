
import { z } from "zod";

// ==========================================
// SUPPLIER DELIVERY VALIDATION
// ==========================================

// Validate individual delivery items.
const deliveryItemSchema = z.object({
  rfqItemId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid RFQ item ID."),

  dispatchedQuantity: z
    .number()
    .int("Quantity must be a whole number.")
    .positive("Dispatched quantity must be greater than zero."),
});

// Create delivery validation.
export const createDeliverySchema = z.object({
  items: z
    .array(deliveryItemSchema)
    .min(1, "At least one delivery item is required."),

  trackingNumber: z.string().trim().max(100).optional(),

  transporterName: z.string().trim().max(150).optional(),

  vehicleNumber: z.string().trim().max(50).optional(),

  expectedDeliveryDate: z.coerce.date(),

  notes: z.string().trim().max(2000).optional(),
});

// Update delivery status validation.
export const updateDeliveryStatusSchema = z.object({
  status: z.enum([
    "planned",
    "dispatched",
    "in_transit",
    "partially_delivered",
    "delivered",
    "delayed",
    "cancelled",
  ]),

  notes: z.string().trim().max(2000).optional(),
});

// ==========================================
// WAREHOUSE RECEIVING VALIDATION
// ==========================================

// Validate actual quantities received by Warehouse Staff.
export const recordWarehouseReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        rfqItemId: z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid RFQ item ID."),

        receivedQuantity: z
          .number()
          .int("Quantity must be a whole number.")
          .min(0, "Received quantity cannot be negative."),
      })
    )
    .min(1, "At least one delivery item is required."),

  notes: z.string().trim().max(2000).optional(),
});

// Validate warehouse arrival information.
export const recordDeliveryArrivalSchema = z.object({
  vehicleNumber: z
    .string()
    .trim()
    .max(50)
    .optional(),

  notes: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

// ==========================================
// QC INSPECTION VALIDATION
// ==========================================

// Start an inspection with a sample size.
// Rejection threshold will be determined by backend rules.
export const startInspectionSchema = z.object({
  sampleSize: z
    .number()
    .int("Sample size must be a whole number.")
    .positive("Sample size must be greater than zero."),
});

// Validate individual inspected units.
const inspectedUnitSchema = z
  .object({
    productId: z
      .string()
      .trim()
      .min(1, "Product ID is required.")
      .max(150, "Product ID is too long."),

    result: z.enum(["passed", "defective"]),

    defectCategory: z
      .string()
      .trim()
      .max(150)
      .optional(),

    defectDescription: z
      .string()
      .trim()
      .max(2000)
      .optional(),

    evidenceUrls: z
      .array(z.string().url("Invalid evidence URL."))
      .max(10, "Maximum 10 evidence files are allowed.")
      .optional(),

    remarks: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .superRefine((unit, ctx) => {
    if (
      unit.result === "defective" &&
      !unit.defectCategory &&
      !unit.defectDescription
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Defective units must include a defect category or description.",
        path: ["defectCategory"],
      });
    }
  });

// Submit inspection results.
export const submitInspectionResultsSchema = z.object({
  inspectedUnits: z
    .array(inspectedUnitSchema)
    .min(1, "At least one inspected unit is required."),

  inspectionNotes: z
    .string()
    .trim()
    .max(3000)
    .optional(),
});

// ==========================================
// LEGACY PROCUREMENT RECEIPT VALIDATION
// ==========================================

// Retained temporarily for compatibility with the existing
// Procurement receipt controller and service.
export const confirmDeliveryReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        rfqItemId: z
          .string()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid RFQ item ID."),

        receivedQuantity: z
          .number()
          .int("Received quantity must be a whole number.")
          .min(0, "Received quantity cannot be negative."),
      })
    )
    .min(1, "At least one delivery item is required."),

  notes: z.string().trim().max(2000).optional(),
});

// ==========================================
// EXPORTED TYPES
// ==========================================

export type CreateDeliveryInput = z.infer<
  typeof createDeliverySchema
>;

export type UpdateDeliveryStatusInput = z.infer<
  typeof updateDeliveryStatusSchema
>;

export type RecordWarehouseReceiptInput = z.infer<
  typeof recordWarehouseReceiptSchema
>;

export type RecordDeliveryArrivalInput = z.infer<
  typeof recordDeliveryArrivalSchema
>;

export type StartInspectionInput = z.infer<
  typeof startInspectionSchema
>;

export type SubmitInspectionResultsInput = z.infer<
  typeof submitInspectionResultsSchema
>;

export type ConfirmDeliveryReceiptInput = z.infer<
  typeof confirmDeliveryReceiptSchema
>;
