
import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPaymentSchema = z.object({
  invoiceId: z
    .string()
    .regex(objectIdRegex, "Invalid invoice ID"),

  amount: z
    .number()
    .positive("Payment amount must be greater than zero")
    .finite(),

  paymentMethod: z.enum([
    "bank_transfer",
    "upi",
    "neft",
    "rtgs",
    "imps",
    "cheque",
    "other",
  ]),

  transactionReference: z
    .string()
    .trim()
    .max(150)
    .optional(),

  paymentDate: z
    .coerce
    .date()
    .refine(
      (date) => date <= new Date(),
      "Payment date cannot be in the future"
    ),

  remarks: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

export const updatePaymentStatusSchema = z.object({
  status: z.enum([
    "completed",
    "failed",
    "reversed",
  ]),

  remarks: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

export type CreatePaymentInput = z.infer<
  typeof createPaymentSchema
>;

export type UpdatePaymentStatusInput = z.infer<
  typeof updatePaymentStatusSchema
>;
