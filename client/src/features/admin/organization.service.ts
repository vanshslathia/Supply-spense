import { apiRequest } from "../../lib/api";
import type {
  Organization,
  OrganizationDetails,
  OrganizationDetailsResponse,
  OrganizationInput,
  OrganizationListResponse,
  OrganizationResponse,
} from "./organization.types";

export async function fetchOrganizations(): Promise<Organization[]> {
  const response =
    await apiRequest<OrganizationListResponse>("/admin/organizations");
  return response.data;
}

export async function fetchOrganizationDetails(
  organizationId: string
): Promise<OrganizationDetails> {
  const response = await apiRequest<OrganizationDetailsResponse>(
    `/admin/organizations/${encodeURIComponent(organizationId)}`
  );
  return response.data;
}

export async function createOrganization(
  input: OrganizationInput
): Promise<Organization> {
  const response = await apiRequest<OrganizationResponse>(
    "/admin/organizations",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function updateOrganization(
  organizationId: string,
  input: OrganizationInput
): Promise<Organization> {
  const response = await apiRequest<OrganizationResponse>(
    `/admin/organizations/${encodeURIComponent(organizationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function setOrganizationStatus(
  organizationId: string,
  isActive: boolean
): Promise<Organization> {
  const response = await apiRequest<OrganizationResponse>(
    `/admin/organizations/${encodeURIComponent(organizationId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }
  );
  return response.data;
}

export function getOrganizationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }
  if ("status" in error && typeof error.status === "number") {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (error.status === 403) {
      return "You do not have permission to manage organizations.";
    }
    if (error.status === 400 || error.status === 409 || error.status === 404) {
      return error.message;
    }
    if (error.status >= 500) {
      return "The server could not complete the request. Please try again.";
    }
  }
  return error.message || "An unexpected error occurred. Please try again.";
}
