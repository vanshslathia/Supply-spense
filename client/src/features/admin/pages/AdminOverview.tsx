import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  RefreshCw,
  UserRoundPlus,
  Users,
  UserX,
} from "lucide-react";
import {
  formatDate,
  getOrganizationName,
  getRoleLabel,
} from "../utils/adminFormat";
import {
  fetchEmployees,
  fetchOrganizations,
  getAdminErrorMessage,
} from "../services/admin.service";
import type { Employee, Organization } from "../types/admin.types";

const roles = [
  "procurement",
  "finance",
  "warehouse",
  "qc_inspector",
  "analyst",
] as const;

const requestOverviewData = () =>
  Promise.all([fetchEmployees(), fetchOrganizations()] as const);

export default function AdminOverview() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      const [employeeData, organizationData] = await requestOverviewData();
      setEmployees(employeeData);
      setOrganizations(organizationData);
    } catch (loadError) {
      setError(getAdminErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [employeeData, organizationData] = await requestOverviewData();
        if (mounted) {
          setEmployees(employeeData);
          setOrganizations(organizationData);
        }
      } catch (loadError) {
        if (mounted) setError(getAdminErrorMessage(loadError));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshOverview = () => {
    setLoading(true);
    setError(null);
    void loadOverview();
  };

  const activeCount = employees.filter(
    (employee) => employee.accountStatus === "active"
  ).length;
  const suspendedCount = employees.length - activeCount;
  const metrics = [
    {
      label: "Total employees",
      value: employees.length,
      note: "Employee accounts",
      icon: Users,
      tone: "blue",
    },
    {
      label: "Active employees",
      value: activeCount,
      note: "Accounts with access",
      icon: CheckCircle2,
      tone: "green",
    },
    {
      label: "Suspended employees",
      value: suspendedCount,
      note: "Accounts on hold",
      icon: UserX,
      tone: "amber",
    },
    {
      label: "Organizations",
      value: organizations.length,
      note: `${organizations.filter((item) => item.isActive).length} active`,
      icon: Building2,
      tone: "violet",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-blue-600">
            Administrator workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A live view of employee access and organizations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshOverview}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <Link
            to="/admin/users"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserRoundPlus size={16} />
            Manage users
          </Link>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <AlertCircle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={refreshOverview}
            className="font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const colors: Record<string, string> = {
            blue: "bg-blue-50 text-blue-600",
            green: "bg-emerald-50 text-emerald-600",
            amber: "bg-amber-50 text-amber-600",
            violet: "bg-violet-50 text-violet-600",
          };
          return (
            <article
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {metric.label}
                </p>
                <span className={`rounded-lg p-2.5 ${colors[metric.tone]}`}>
                  <Icon size={19} />
                </span>
              </div>
              <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                {loading ? "—" : metric.value}
              </p>
              <p className="mt-1.5 text-xs text-slate-400">{metric.note}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Employee distribution
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Active and suspended employee accounts by role.
              </p>
            </div>
            <Users size={19} className="text-slate-400" />
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading employee data…
            </div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No employee data is available yet.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {roles.map((role) => {
                const count = employees.filter(
                  (employee) => employee.role === role
                ).length;
                const percentage = (count / employees.length) * 100;
                return (
                  <div key={role}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-600">
                        {getRoleLabel(role)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {count}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`${getRoleLabel(role)} employee share`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(percentage)}
                    >
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between p-5 sm:p-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Recently created
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Latest employee accounts.
              </p>
            </div>
            <Link
              to="/admin/users"
              aria-label="View all employees"
              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
            >
              <ArrowRight size={17} />
            </Link>
          </div>
          {loading ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-400">
              Loading recent employees…
            </div>
          ) : employees.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
              No employees have been created yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {employees.slice(0, 5).map((employee) => (
                <div
                  key={employee._id || employee.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {employee.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {employee.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {getOrganizationName(employee)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600">
                      {getRoleLabel(employee.role)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDate(employee.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-5">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Access management
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Employee accounts are created under an organization and can be
            activated or suspended from the user directory.
          </p>
        </div>
      </section>
    </div>
  );
}
