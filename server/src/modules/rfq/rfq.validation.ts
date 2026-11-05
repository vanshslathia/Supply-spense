
import { z } from "zod";

const rfqItemSchema = z.object({
  productName: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(2).max(100),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(30),
  specifications: z.string().trim().max(2000).optional(),
});

export const createRFQSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(3000),
  category: z.string().trim().min(2).max(100),

  items: z.array(rfqItemSchema).min(1),

  visibility: z.enum(["open", "invited"]).default("open"),

  invitedSuppliers: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),

  deliveryLocation: z.string().trim().min(3).max(300),

  deliveryDate: z.coerce.date(),

  submissionDeadline: z.coerce.date(),
}).refine(
  (data) => data.submissionDeadline > new Date(),
  {
    message: "Submission deadline must be in the future.",
    path: ["submissionDeadline"],
  }
).refine(
  (data) => data.deliveryDate > data.submissionDeadline,
  {
    message: "Delivery date must be after the submission deadline.",
    path: ["deliveryDate"],
  }
).refine(
  (data) => data.visibility !== "invited" || (data.invitedSuppliers?.length ?? 0) > 0,
  {
    message: "Select at least one supplier for an invitation-only RFQ.",
    path: ["invitedSuppliers"],
  }
);

export type CreateRFQInput = z.infer<typeof createRFQSchema>;
