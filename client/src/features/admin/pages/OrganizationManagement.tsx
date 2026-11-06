import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import CreateOrganizationModal from "../components/CreateOrganizationModal";
import OrganizationDetails from "../components/OrganizationDetails";
import OrganizationTable from "../components/OrganizationTable";
import {
  createOrganization,
  fetchOrganizations,
  getOrganizationErrorMessage,
  setOrganizationStatus,
  updateOrganization,
} from "../organization.service";
import type {
  Organization,
  OrganizationInput,
} from "../organization.types";

type StatusFilter = "all" | "active" | "inactive";

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingOrganization, setEditingOrganization] =
    useState<Organization | null>(null);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      setOrganizations(await fetchOrganizations());
    } catch (loadError) {
      setError(getOrganizationErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchOrganizations();
        if (mounted) setOrganizations(data);
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
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return organizations.filter((organization) => {
      const matchesSearch =
        !query ||
        organization.name.toLowerCase().includes(query) ||
        organization.organizationCode.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && organization.isActive) ||
        (statusFilter === "inactive" && !organization.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const refresh = () => {
    setRefreshing(true);
    setError(null);
    void loadOrganizations();
  };

  const openCreate = () => {
    setEditingOrganization(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (organization: Organization) => {
    setSelectedOrganization(null);
    setEditingOrganization(organization);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (input: OrganizationInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingOrganization) {
        await updateOrganization(editingOrganization._id, input);
        setNotice(`${input.name} was updated.`);
      } else {
        await createOrganization(input);
        setNotice(`${input.name} was created and activated.`);
      }
      setShowForm(false);
      setEditingOrganization(null);
      setError(null);
      await loadOrganizations();
    } catch (saveError) {
      setFormError(getOrganizationErrorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (organization: Organization) => {
    const nextIsActive = !organization.isActive;
    setUpdatingId(organization._id);
    setError(null);
    try {
      const updated = await setOrganizationStatus(
        organization._id,
        nextIsActive
      );
      setOrganizations((current) =>
        current.map((item) =>
          item._id === updated._id
            ? { ...item, isActive: updated.isActive }
            : item
        )
      );
      if (selectedOrganization?._id === updated._id) {
        setSelectedOrganization((current) =>
          current ? { ...current, isActive: updated.isActive } : current
        );
      }
      setNotice(
        nextIsActive
          ? `${organization.name} is active.`
          : `${organization.name} is inactive. Its employees' existing sessions are blocked.`
      );
    } catch (statusError) {
      setError(getOrganizationErrorMessage(statusError));
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = organizations.filter((item) => item.isActive).length;

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
            Business directory
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Organization management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage business profiles and control organization access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
          >
            <Plus size={17} />
            Add organization
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total organizations", value: organizations.length },
          { label: "Active", value: activeCount },
          { label: "Inactive", value: organizations.length - activeCount },
        ].map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {loading ? "—" : metric.value}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex flex-1 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Organization directory
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {filteredOrganizations.length}{" "}
                {filteredOrganizations.length === 1
                  ? "organization"
                  : "organizations"}
              </p>
            </div>
          </div>
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label="Search organizations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or organization code"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <select
            aria-label="Filter organizations by status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-5"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={refresh}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 border-t border-slate-100 py-20 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
            Loading organizations…
          </div>
        ) : error && organizations.length === 0 ? (
          <div className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
            Organization data could not be loaded.
          </div>
        ) : organizations.length === 0 ? (
          <div className="flex flex-col items-center border-t border-slate-100 px-6 py-16 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <Building2 size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              No organizations yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create an organization to assign employees to a business.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Add organization
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-100">
            <OrganizationTable
              organizations={filteredOrganizations}
              onView={setSelectedOrganization}
              onEdit={openEdit}
              onToggleStatus={(organization) =>
                void handleToggleStatus(organization)
              }
              updatingId={updatingId}
            />
          </div>
        )}
      </section>

      {showForm && (
        <CreateOrganizationModal
          key={editingOrganization?._id ?? "new-organization"}
          organization={editingOrganization}
          submitting={submitting}
          error={formError}
          onClose={() => {
            if (!submitting) setShowForm(false);
          }}
          onSubmit={handleSave}
        />
      )}
      {selectedOrganization && (
        <OrganizationDetails
          organization={selectedOrganization}
          onClose={() => setSelectedOrganization(null)}
          onEdit={openEdit}
        />
      )}
    </div>
  );
}
