import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type {
  CreateEmployeeInput,
  EmployeeRole,
  Organization,
} from "../types/admin.types";

interface CreateEmployeeModalProps {
  organizations: Organization[];
  loadingOrganizations: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: CreateEmployeeInput) => Promise<void>;
}

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

export default function CreateEmployeeModal({
  organizations,
  loadingOrganizations,
  submitting,
  error,
  onClose,
  onSubmit,
}: CreateEmployeeModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("procurement");
  const [organizationId, setOrganizationId] = useState("");
  const activeOrganizations = organizations.filter(
    (organization) => organization.isActive
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ fullName, email, password, role, organizationId });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-employee-title"
        className="my-auto w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Team administration
            </p>
            <h2
              id="create-employee-title"
              className="mt-1 text-xl font-bold tracking-tight text-slate-900"
            >
              Add an employee
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set up a team account and assign organization access.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={19} />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6 sm:px-7">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Jordan Williams"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Work email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Temporary password
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              className={fieldClass}
            />
            <span className="mt-1.5 block text-xs font-normal text-slate-400">
              Must contain at least 12 characters.
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Role
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as EmployeeRole)
                }
                className={fieldClass}
              >
                <option value="procurement">Procurement</option>
                <option value="finance">Finance</option>
                <option value="warehouse">Warehouse</option>
                <option value="qc_inspector">QC Inspector</option>
                <option value="analyst">Analyst</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Organization
              <select
                required
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                disabled={activeOrganizations.length === 0}
                className={fieldClass}
              >
                <option value="">Select an organization</option>
                {activeOrganizations.map((organization) => (
                  <option key={organization._id} value={organization._id}>
                    {organization.name} · {organization.organizationCode}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loadingOrganizations && (
            <p className="text-sm text-slate-500">
              Loading organizations…
            </p>
          )}
          {error &&
            activeOrganizations.length === 0 &&
            !loadingOrganizations && (
              <p className="text-sm text-slate-500">
                Organization options could not be loaded. Close the form and
                try again.
              </p>
            )}
          {!loadingOrganizations &&
            !error &&
            activeOrganizations.length === 0 && (
            <p className="text-sm text-amber-700">
              No active organizations are available. Activate an organization
              before creating an employee.
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                loadingOrganizations ||
                activeOrganizations.length === 0
              }
              className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create employee"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
