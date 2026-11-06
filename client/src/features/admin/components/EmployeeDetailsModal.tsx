import { X } from "lucide-react";
import type { Employee } from "../types/admin.types";
import {
  formatDate,
  getOrganizationName,
  getRoleLabel,
} from "../utils/adminFormat";

interface EmployeeDetailsModalProps {
  employee: Employee;
  onClose: () => void;
}

export default function EmployeeDetailsModal({
  employee,
  onClose,
}: EmployeeDetailsModalProps) {
  const employeeId = employee._id || employee.id || "—";
  const details = [
    { label: "Employee ID", value: employeeId, mono: true },
    { label: "Role", value: getRoleLabel(employee.role) },
    { label: "Organization", value: getOrganizationName(employee) },
    {
      label: "Account status",
      value: employee.accountStatus === "active" ? "Active" : "Suspended",
    },
    {
      label: "Email verification",
      value: employee.emailVerified ? "Verified" : "Not verified",
    },
    { label: "Account created", value: formatDate(employee.createdAt) },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-details-title"
        className="my-auto w-full max-w-[540px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-base font-bold text-blue-700">
              {employee.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Employee profile
              </p>
              <h2
                id="employee-details-title"
                className="mt-0.5 text-lg font-bold text-slate-900"
              >
                {employee.fullName}
              </h2>
              <p className="text-sm text-slate-500">{employee.email}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={19} />
          </button>
        </header>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {details.map((item) => (
            <div
              key={item.label}
              className="border-b border-slate-100 px-6 py-4 last:border-b-0 sm:odd:border-r"
            >
              <dt className="text-xs font-medium text-slate-400">
                {item.label}
              </dt>
              <dd
                className={`mt-1.5 break-all text-sm font-semibold text-slate-800 ${
                  "mono" in item && item.mono
                    ? "font-mono text-xs"
                    : ""
                }`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <footer className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
