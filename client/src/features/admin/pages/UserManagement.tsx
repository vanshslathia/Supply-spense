import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import CreateEmployeeModal from "../components/CreateEmployeeModal";
import EmployeeDetailsModal from "../components/EmployeeDetailsModal";
import EmployeeFilters from "../components/EmployeeFilters";
import EmployeeTable from "../components/EmployeeTable";
import {
  createEmployee,
  fetchEmployees,
  fetchOrganizations,
  getAdminErrorMessage,
  setEmployeeStatus,
} from "../services/admin.service";
import type {
  AccountStatus,
  CreateEmployeeInput,
  Employee,
  EmployeeRole,
  Organization,
} from "../types/admin.types";

export default function UserManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<EmployeeRole | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");

  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await fetchEmployees());
    } catch (error) {
      setLoadError(getAdminErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchEmployees();
        if (mounted) setEmployees(data);
      } catch (error) {
        if (mounted) setLoadError(getAdminErrorMessage(error));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshEmployees = () => {
    setRefreshing(true);
    setLoadError(null);
    void loadEmployees();
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.fullName.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query);
      const matchesRole = role === "all" || employee.role === role;
      const matchesStatus = status === "all" || employee.accountStatus === status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, role, search, status]);

  const openCreateModal = async () => {
    setFormError(null);
    setShowCreate(true);
    if (organizations.length) return;

    setOrganizationsLoading(true);
    try {
      setOrganizations(await fetchOrganizations(true));
    } catch (error) {
      setFormError(getAdminErrorMessage(error));
    } finally {
      setOrganizationsLoading(false);
    }
  };

  const handleCreate = async (input: CreateEmployeeInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createEmployee(input);
      setShowCreate(false);
      setNotice(`${created.fullName} was added to the team.`);
      await loadEmployees();
    } catch (error) {
      setFormError(getAdminErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (employee: Employee) => {
    const id = employee._id || employee.id || "";
    if (!id) {
      setLoadError("This employee record does not include an ID.");
      return;
    }

    const nextStatus =
      employee.accountStatus === "active" ? "suspended" : "active";
    setUpdatingId(id);
    setLoadError(null);
    try {
      const updated = await setEmployeeStatus(id, nextStatus);
      setEmployees((current) =>
        current.map((item) =>
          (item._id || item.id) === id
            ? { ...item, accountStatus: updated.accountStatus }
            : item
        )
      );
      setNotice(
        `${employee.fullName} was ${
          nextStatus === "active" ? "activated" : "suspended"
        }.`
      );
    } catch (error) {
      setLoadError(getAdminErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-blue-600">
            People & access
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            User management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage employee accounts, roles, and organization access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshEmployees}
            disabled={refreshing || loading}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void openCreateModal()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Plus size={17} />
            Add employee
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Users size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Employee directory
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Search, filter, and update employee access.
              </p>
            </div>
          </div>
          <EmployeeFilters
            employees={filteredEmployees}
            search={search}
            role={role}
            status={status}
            onSearchChange={setSearch}
            onRoleChange={setRole}
            onStatusChange={setStatus}
          />
        </div>

        {loadError && (
          <div
            role="alert"
            className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-5"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">{loadError}</div>
            <button
              type="button"
              onClick={refreshEmployees}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 py-20 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
            Loading employees…
          </div>
        ) : loadError && employees.length === 0 ? (
          <div className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
            Employee data could not be loaded.
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center border-t border-slate-100 px-6 py-16 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <Users size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              Your employee directory is empty
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Add your first employee to give your team secure platform access.
            </p>
            <button
              type="button"
              onClick={() => void openCreateModal()}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Add employee
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-100">
            <EmployeeTable
              employees={filteredEmployees}
              updatingId={updatingId}
              onView={setSelectedEmployee}
              onStatusChange={(employee) => void handleStatusChange(employee)}
            />
          </div>
        )}
      </section>

      {showCreate && (
        <CreateEmployeeModal
          organizations={organizations}
          submitting={submitting}
          loadingOrganizations={organizationsLoading}
          error={formError}
          onClose={() => {
            if (!submitting) setShowCreate(false);
          }}
          onSubmit={handleCreate}
        />
      )}
      {selectedEmployee && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
