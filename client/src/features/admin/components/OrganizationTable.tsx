import { Building2, Eye, Pencil, Power } from "lucide-react";
import type { Organization } from "../organization.types";
import { formatDate } from "../utils/adminFormat";

interface OrganizationTableProps {
  organizations: Organization[];
  onView: (organization: Organization) => void;
  onEdit: (organization: Organization) => void;
  onToggleStatus: (organization: Organization) => void;
  updatingId: string | null;
}

export default function OrganizationTable({
  organizations,
  onView,
  onEdit,
  onToggleStatus,
  updatingId,
}: OrganizationTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3.5">Organization</th>
            <th className="px-5 py-3.5">Code</th>
            <th className="px-5 py-3.5">Official email</th>
            <th className="px-5 py-3.5">Industry</th>
            <th className="px-5 py-3.5">Employees</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {organizations.map((organization) => (
            <tr
              key={organization._id}
              className="transition hover:bg-slate-50/70"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {organization.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Added {formatDate(organization.createdAt)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
                  {organization.organizationCode}
                </span>
              </td>
              <td className="px-5 py-4 text-sm text-slate-600">
                {organization.email}
              </td>
              <td className="px-5 py-4 text-sm text-slate-600">
                {organization.industry || "—"}
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                {organization.employeeCount}
              </td>
              <td className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    organization.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      organization.isActive ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {organization.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="View organization details"
                    aria-label={`View ${organization.name}`}
                    onClick={() => onView(organization)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    title="Edit organization"
                    aria-label={`Edit ${organization.name}`}
                    onClick={() => onEdit(organization)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === organization._id}
                    onClick={() => onToggleStatus(organization)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50 ${
                      organization.isActive
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    <Power size={14} />
                    {updatingId === organization._id
                      ? "Saving…"
                      : organization.isActive
                        ? "Deactivate"
                        : "Activate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {organizations.length === 0 && (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
            <Building2 size={22} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            No organizations match your filters
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try a different search or status filter.
          </p>
        </div>
      )}
    </div>
  );
}
