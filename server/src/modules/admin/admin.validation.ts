import { z } from "zod";

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters"),

  email: z.string().trim().email("Enter a valid email address"),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters"),

  role: z.enum([
    "procurement",
    "analyst",
    "finance",
    "warehouse",
    "qc_inspector",
  ]),

  organizationId: z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Invalid organization ID"
  ),
});

export const updateEmployeeStatusSchema = z.object({
  accountStatus: z.enum(["active", "suspended"]),
});

export type CreateEmployeeInput = z.infer<
  typeof createEmployeeSchema
>;

export type UpdateEmployeeStatusInput = z.infer<
  typeof updateEmployeeStatusSchema
>;