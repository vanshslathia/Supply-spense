import { useEffect, useState } from "react";
import { Building2, CalendarDays, Mail, MapPin, X } from "lucide-react";
import type {
  Organization,
  OrganizationDetails as OrganizationDetailsData,
} from "../organization.types";
import {
  fetchOrganizationDetails,
  getOrganizationErrorMessage,
} from "../organization.service";
import { formatDate, getRoleLabel } from "../utils/adminFormat";

interface OrganizationDetailsProps {
  organization: Organization;
  onClose: () => void;
  onEdit: (organization: Organization) => void;
}

const employeeRoles = [
  "procurement",
  "finance",
  "warehouse",
  "qc_inspector",
  "analyst",
] as const;

export default function OrganizationDetails({
  organization,
  onClose,
  onEdit,
}: OrganizationDetailsProps) {
  const [details, setDetails] = useState<OrganizationDetailsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await fetchOrganizationDetails(organization._id);
        if (mounted) setDetails(result);
      } catch (loadError) {
        if (mounted) setError(getOrganizationErrorMessage(loadError));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [organization._id]);

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
        aria-labelledby="organization-details-title"
        className="my-auto w-full max-w-[700px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-7">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Organization profile
              </p>
              <h2
                id="organization-details-title"
                className="mt-0.5 text-lg font-bold text-slate-900"
              >
                {organization.name}
              </h2>
              <p className="font-mono text-xs text-slate-500">
                {organization.organizationCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close organization details"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={19} />
          </button>
        </header>

        <div className="space-y-6 p-6 sm:p-7">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
              Loading organization details…
            </div>
          ) : details ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                  <Mail size={17} className="mt-0.5 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Official email</p>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                      {details.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                  <Building2 size={17} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Industry</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {details.industry || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 sm:col-span-2">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Business address</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">
                      {details.address || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 sm:col-span-2">
                  <CalendarDays size={17} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Organization created</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {formatDate(details.createdAt)}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900">
                  Employee overview
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total", value: details.employeeCount },
                    { label: "Active", value: details.activeEmployees },
                    { label: "Suspended", value: details.suspendedEmployees },
                    {
                      label: "Organization",
                      value: details.isActive ? "Active" : "Inactive",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-slate-50 p-3.5"
                    >
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900">
                  Employees by role
                </h3>
                <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {employeeRoles.map((role) => (
                    <div
                      key={role}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-sm text-slate-600">
                        {getRoleLabel(role)}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {details.employeesByRole[role]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(organization)}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Edit organization
          </button>
        </footer>
      </section>
    </div>
  );
}
