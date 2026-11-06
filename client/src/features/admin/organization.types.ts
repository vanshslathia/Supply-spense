import type { EmployeeRole } from "./types/admin.types";

export interface Organization {
  _id: string;
  name: string;
  organizationCode: string;
  email: string;
  industry?: string;
  address?: string;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  employeeCount: number;
}

export interface OrganizationDetails extends Organization {
  activeEmployees: number;
  suspendedEmployees: number;
  employeesByRole: Record<EmployeeRole, number>;
}

export interface OrganizationInput {
  name: string;
  organizationCode: string;
  email: string;
  industry: string;
  address: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type OrganizationListResponse = ApiResponse<Organization[]>;
export type OrganizationResponse = ApiResponse<Organization>;
export type OrganizationDetailsResponse = ApiResponse<OrganizationDetails>;
