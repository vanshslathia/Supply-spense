import { z } from "zod";

const organizationName = z
  .string()
  .trim()
  .min(2, "Organization name must contain at least 2 characters.")
  .max(120, "Organization name cannot exceed 120 characters.");

const organizationCode = z
  .string()
  .trim()
  .min(2, "Organization code must contain at least 2 characters.")
  .max(32, "Organization code cannot exceed 32 characters.")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
    "Organization code may contain letters, numbers, hyphens, and underscores."
  )
  .transform((value) => value.toUpperCase());

const organizationEmail = z
  .string()
  .trim()
  .email("Enter a valid organization email.")
  .max(254, "Organization email is too long.")
  .transform((value) => value.toLowerCase());

const optionalIndustry = z
  .string()
  .trim()
  .max(100, "Industry cannot exceed 100 characters.")
  .optional();

const optionalAddress = z
  .string()
  .trim()
  .max(500, "Address cannot exceed 500 characters.")
  .optional();

export const createOrganizationSchema = z.object({
  name: organizationName,
  organizationCode,
  email: organizationEmail,
  industry: optionalIndustry,
  address: optionalAddress,
});

export const updateOrganizationSchema = createOrganizationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one organization field must be provided.",
  });

export const updateOrganizationStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationSchema
>;
export type UpdateOrganizationInput = z.infer<
  typeof updateOrganizationSchema
>;
export type UpdateOrganizationStatusInput = z.infer<
  typeof updateOrganizationStatusSchema
>;
