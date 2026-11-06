import { Search, SlidersHorizontal } from "lucide-react";
import type { EmployeeRole, Employee, AccountStatus } from "../types/admin.types";

interface EmployeeFiltersProps {
  employees: Employee[];
  search: string;
  role: EmployeeRole | "all";
  status: AccountStatus | "all";
  onSearchChange: (value: string) => void;
  onRoleChange: (value: EmployeeRole | "all") => void;
  onStatusChange: (value: AccountStatus | "all") => void;
}

export default function EmployeeFilters({
  employees,
  search,
  role,
  status,
  onSearchChange,
  onRoleChange,
  onStatusChange,
}: EmployeeFiltersProps) {
  const selectClass =
    "h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <label className="relative min-w-0 flex-1">
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          aria-label="Search employees"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
        />
      </label>
      <div className="flex items-center gap-2 text-slate-400">
        <SlidersHorizontal size={17} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Filter
        </span>
      </div>
      <select
        aria-label="Filter by role"
        value={role}
        onChange={(event) =>
          onRoleChange(event.target.value as EmployeeRole | "all")
        }
        className={selectClass}
      >
        <option value="all">All roles</option>
        <option value="procurement">Procurement</option>
        <option value="finance">Finance</option>
        <option value="warehouse">Warehouse</option>
        <option value="qc_inspector">QC Inspector</option>
        <option value="analyst">Analyst</option>
      </select>
      <select
        aria-label="Filter by account status"
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as AccountStatus | "all")
        }
        className={selectClass}
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
      <span className="whitespace-nowrap text-sm text-slate-500">
        {employees.length} {employees.length === 1 ? "employee" : "employees"}
      </span>
    </div>
  );
}
