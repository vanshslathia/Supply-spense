
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
  idempotencyKey: z.string().uuid(),

  items: z
    .array(deliveryItemSchema)
    .min(1, "At least one delivery item is required."),

  trackingNumber: z
    .string()
    .trim()
    .min(3, "A valid tracking number is required.")
    .max(100)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/, "Tracking number contains invalid characters."),

  transporterName: z.string().trim().min(1, "Carrier name is required.").max(150),

  vehicleNumber: z.string().trim().max(50).optional(),

  challanNumber: z.string().trim().max(100).optional(),

  challanUrl: z.string().url("Invalid delivery challan URL.").max(2048).optional(),

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

        damagedQuantity: z
          .number()
          .int("Quantity must be a whole number.")
          .min(0, "Damaged quantity cannot be negative.")
          .default(0),
      })
    )
    .min(1, "At least one delivery item is required."),

  finalizeReceipt: z.boolean().default(false),

  notes: z.string().trim().max(2000).optional(),
}).superRefine((input, ctx) => {
  input.items.forEach((item, index) => {
    if (item.damagedQuantity > item.receivedQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damaged quantity cannot exceed received quantity.",
        path: ["items", index, "damagedQuantity"],
      });
    }
  });
});

// Validate warehouse arrival information.
export const recordDeliveryArrivalSchema = z.object({
  vehicleNumber: z
    .string()
    .trim()
    .max(50)
    .optional(),

  challanNumber: z.string().trim().max(100).optional(),

  packagingCondition: z.enum(["intact", "damaged", "unknown"]).optional(),

  sealCondition: z.enum(["intact", "damaged", "missing", "unknown"]).optional(),

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

    severity: z.enum(["minor", "major", "critical"]).optional(),

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
    if (unit.result === "defective" && !unit.severity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Defective units must include a severity.",
        path: ["severity"],
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

  dispositions: z.array(
    z.object({
    productId: z.string().trim().min(1).max(150),
    acceptedQuantity: z.number().int().min(0),
    rejectedQuantity: z.number().int().min(0),
    onHoldQuantity: z.number().int().min(0),
    remarks: z.string().trim().max(2000).optional(),
    })
  ).min(1, "A disposition is required for every received product."),

  placeOnHold: z.boolean().default(false),

  holdReason: z.string().trim().max(2000).optional(),
}).superRefine((input, ctx) => {
  if (input.placeOnHold && !input.holdReason?.trim()) {
    ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "A reason is required when placing an inspection on hold.",
    path: ["holdReason"],
    });
  }
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
