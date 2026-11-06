import type { Employee } from "../types/admin.types";

export function getRoleLabel(role: Employee["role"]): string {
  const labels: Record<Employee["role"], string> = {
    procurement: "Procurement",
    finance: "Finance",
    warehouse: "Warehouse",
    qc_inspector: "QC Inspector",
    analyst: "Analyst",
  };
  return labels[role];
}

export function getOrganizationName(employee: Employee): string {
  if (!employee.organizationId || typeof employee.organizationId === "string") {
    return "—";
  }
  return employee.organizationId.name;
}

export function formatDate(
  date: string | number | Date | null | undefined
): string {
  if (date === null || date === undefined || date === "") return "—";
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed);
}
