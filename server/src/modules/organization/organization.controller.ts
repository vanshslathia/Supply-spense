import type { Request, Response } from "express";
import {
  createOrganization,
  getOrganizationDetails,
  listOrganizations,
  OrganizationServiceError,
  updateOrganization,
  updateOrganizationStatus,
} from "./organization.service";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateOrganizationStatusSchema,
} from "./organization.validation";

const getOrganizationId = (req: Request): string => {
  const organizationId = req.params.organizationId;
  return Array.isArray(organizationId) ? organizationId[0] ?? "" : organizationId;
};

const sendError = (res: Response, error: unknown) => {
  if (error instanceof OrganizationServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    res.status(409).json({
      success: false,
      message: "An organization with this code already exists.",
    });
    return;
  }

  console.error("Organization management request failed:", error);
  res.status(500).json({
    success: false,
    message: "Unable to complete the organization request.",
  });
};

export const listOrganizationsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const organizations = await listOrganizations(activeOnly);
    res.status(200).json({
      success: true,
      message: "Organizations fetched successfully.",
      data: organizations,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getOrganizationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organization = await getOrganizationDetails(getOrganizationId(req));
    res.status(200).json({
      success: true,
      message: "Organization fetched successfully.",
      data: organization,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const createOrganizationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validation = createOrganizationSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: validation.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const organization = await createOrganization(validation.data);
    res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      data: organization,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateOrganizationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validation = updateOrganizationSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: validation.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const organization = await updateOrganization(
      getOrganizationId(req),
      validation.data
    );
    res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      data: organization,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateOrganizationStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validation = updateOrganizationStatusSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: validation.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const organization = await updateOrganizationStatus(
      getOrganizationId(req),
      validation.data
    );
    res.status(200).json({
      success: true,
      message: "Organization status updated successfully.",
      data: organization,
    });
  } catch (error) {
    sendError(res, error);
  }
};
