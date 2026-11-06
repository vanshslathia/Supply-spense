import { apiRequest } from "../../../lib/api";
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListResponse,
  EmployeeResponse,
  Organization,
  OrganizationListResponse,
} from "../types/admin.types";

export async function fetchEmployees(): Promise<Employee[]> {
  const response = await apiRequest<EmployeeListResponse>("/admin/users");
  return response.data;
}

export async function fetchOrganizations(
  activeOnly = false
): Promise<Organization[]> {
  const query = activeOnly ? "?activeOnly=true" : "";
  const response = await apiRequest<OrganizationListResponse>(
    `/admin/organizations${query}`
  );
  return response.data;
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<Employee> {
  const response = await apiRequest<EmployeeResponse>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function setEmployeeStatus(
  userId: string,
  accountStatus: "active" | "suspended"
): Promise<Employee> {
  const response = await apiRequest<EmployeeResponse>(
    `/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ accountStatus }),
    }
  );
  return response.data;
}

export function getAdminErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }

  if ("status" in error && typeof error.status === "number") {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (error.status === 403) {
      return "You do not have permission to manage admin users.";
    }
    if (error.status === 400) {
      return error.message || "Please check the submitted information.";
    }
    if (error.status >= 500) {
      return "The server could not complete the request. Please try again.";
    }
  }

  return error.message || "An unexpected error occurred. Please try again.";
}
