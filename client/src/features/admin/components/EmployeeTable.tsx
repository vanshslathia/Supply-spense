import { Eye, UserRound } from "lucide-react";
import type { Employee } from "../types/admin.types";
import {
  formatDate,
  getOrganizationName,
  getRoleLabel,
} from "../utils/adminFormat";

interface EmployeeTableProps {
  employees: Employee[];
  updatingId: string | null;
  onView: (employee: Employee) => void;
  onStatusChange: (employee: Employee) => void;
}

export default function EmployeeTable({
  employees,
  updatingId,
  onView,
  onStatusChange,
}: EmployeeTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3.5">Employee</th>
            <th className="px-5 py-3.5">Email</th>
            <th className="px-5 py-3.5">Role</th>
            <th className="px-5 py-3.5">Organization</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Created at</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((employee) => {
            const isActive = employee.accountStatus === "active";
            const id = employee._id || employee.id || "";

            return (
              <tr key={id} className="transition hover:bg-slate-50/70">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {employee.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {employee.fullName}
                      </p>
                      <p className="text-xs text-slate-400">Team member</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {employee.email}
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {getRoleLabel(employee.role)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-slate-700">
                    {getOrganizationName(employee)}
                  </p>
                  {employee.organizationId &&
                    typeof employee.organizationId !== "string" && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {employee.organizationId.organizationCode}
                      </p>
                    )}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDate(employee.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onView(employee)}
                      title="View employee details"
                      aria-label={`View ${employee.fullName}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStatusChange(employee)}
                      disabled={updatingId === id}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                        isActive
                          ? "text-rose-600 hover:bg-rose-50"
                          : "text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {updatingId === id
                        ? "Saving…"
                        : isActive
                          ? "Suspend"
                          : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {employees.length === 0 && (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
            <UserRound size={22} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            No employees match your filters
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try changing your search or filter selections.
          </p>
        </div>
      )}
    </div>
  );
}
