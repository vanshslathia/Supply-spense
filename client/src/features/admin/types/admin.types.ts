export type EmployeeRole =
  | "procurement"
  | "finance"
  | "warehouse"
  | "qc_inspector"
  | "analyst";

export type AccountStatus = "active" | "suspended";

export interface Organization {
  _id: string;
  name: string;
  organizationCode: string;
  isActive: boolean;
}

export interface Employee {
  _id: string;
  id?: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  organizationId:
    | string
    | Pick<Organization, "_id" | "name" | "organizationCode">
    | null;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: string;
}

export interface CreateEmployeeInput {
  fullName: string;
  email: string;
  password: string;
  role: EmployeeRole;
  organizationId: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type EmployeeListResponse = ApiResponse<Employee[]>;
export type OrganizationListResponse = ApiResponse<Organization[]>;
export type EmployeeResponse = ApiResponse<Employee>;
