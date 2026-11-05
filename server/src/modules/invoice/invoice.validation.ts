
import { z } from "zod";

// Validate invoice items submitted by suppliers.
const invoiceItemSchema = z.object({
  poItemId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid purchase order item ID."),

  quantity: z
    .number()
    .positive("Invoice quantity must be greater than zero."),

  unitPrice: z
    .number()
    .min(0, "Unit price cannot be negative."),
});

// Supplier invoice submission.
export const createInvoiceSchema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .min(1, "Invoice number is required.")
      .max(100),

    purchaseOrderId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid purchase order ID."),

    items: z
      .array(invoiceItemSchema)
      .min(1, "At least one invoice item is required."),

    invoiceDate: z.coerce.date(),

    dueDate: z.coerce.date(),

    taxPercentage: z
      .number()
      .min(0)
      .max(100),

    additionalCharges: z
      .number()
      .min(0)
      .default(0),

    documentUrl: z
      .string()
      .trim()
      .max(2048)
      .optional(),

    notes: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .refine(
    (data) => data.invoiceDate <= new Date(),
    {
      message: "Invoice date cannot be in the future.",
      path: ["invoiceDate"],
    }
  )
  .refine(
    (data) => data.dueDate >= data.invoiceDate,
    {
      message: "Due date cannot be earlier than invoice date.",
      path: ["dueDate"],
    }
  )
  .refine(
    (data) => {
      const itemIds = data.items.map((item) => item.poItemId);
      return new Set(itemIds).size === itemIds.length;
    },
    {
      message: "Duplicate purchase order items are not allowed.",
      path: ["items"],
    }
  );

// Procurement verification or rejection.
export const procurementInvoiceReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),

  remarks: z
    .string()
    .trim()
    .max(2000)
    .optional(),
}).refine(
  (data) =>
    data.decision !== "reject" ||
    Boolean(data.remarks?.trim()),
  {
    message: "Remarks are required when rejecting an invoice.",
    path: ["remarks"],
  }
);

// Finance approval or rejection.
export const financeInvoiceReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),

  remarks: z
    .string()
    .trim()
    .max(2000)
    .optional(),
}).refine(
  (data) =>
    data.decision !== "reject" ||
    Boolean(data.remarks?.trim()),
  {
    message: "Remarks are required when rejecting an invoice.",
    path: ["remarks"],
  }
);

// Export TypeScript types.
export type CreateInvoiceInput = z.infer<
  typeof createInvoiceSchema
>;

export type ProcurementInvoiceReviewInput = z.infer<
  typeof procurementInvoiceReviewSchema
>;

export type FinanceInvoiceReviewInput = z.infer<
  typeof financeInvoiceReviewSchema
>;
