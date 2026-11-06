
import { z } from "zod";

const quotationItemSchema = z.object({
  rfqItemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid RFQ item ID."),
  unitPrice: z.number().min(0, "Unit price cannot be negative."),
  remarks: z.string().trim().max(1000).optional(),
});

export const createQuotationSchema = z.object({
  rfqId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid RFQ ID."),

  items: z.array(quotationItemSchema).min(
    1,
    "At least one quotation item is required."
  ),

  taxPercentage: z.number().min(0).max(100),

  deliveryCharges: z.number().min(0),

  deliveryTimeline: z.number().int().min(1).max(365),

  validityDate: z.coerce.date(),

  supplierRemarks: z.string().trim().max(3000).optional(),
}).refine(
  (data) => data.validityDate > new Date(),
  {
    message: "Quotation validity date must be in the future.",
    path: ["validityDate"],
  }
);

export type CreateQuotationInput = z.infer<
  typeof createQuotationSchema
>;
