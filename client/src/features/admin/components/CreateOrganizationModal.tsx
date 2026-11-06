import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type {
  Organization,
  OrganizationInput,
} from "../organization.types";

interface CreateOrganizationModalProps {
  organization?: Organization | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: OrganizationInput) => Promise<void>;
}

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

export default function CreateOrganizationModal({
  organization,
  submitting,
  error,
  onClose,
  onSubmit,
}: CreateOrganizationModalProps) {
  const [name, setName] = useState(organization?.name ?? "");
  const [organizationCode, setOrganizationCode] = useState(
    organization?.organizationCode ?? ""
  );
  const [email, setEmail] = useState(organization?.email ?? "");
  const [industry, setIndustry] = useState(organization?.industry ?? "");
  const [address, setAddress] = useState(organization?.address ?? "");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ name, organizationCode, email, industry, address });
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
        aria-labelledby="organization-form-title"
        className="my-auto w-full max-w-[600px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Organization administration
            </p>
            <h2
              id="organization-form-title"
              className="mt-1 text-xl font-bold tracking-tight text-slate-900"
            >
              {organization ? "Edit organization" : "Add an organization"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {organization
                ? "Update company information. The organization ID remains unchanged."
                : "Register a business to organize employee access."}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Organization name
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Northstar Manufacturing"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Organization code
              <input
                required
                minLength={2}
                maxLength={32}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                value={organizationCode}
                onChange={(event) => setOrganizationCode(event.target.value)}
                placeholder="e.g. NORTHSTAR-01"
                className={fieldClass}
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Unique code. Letters, numbers, hyphens, and underscores.
              </span>
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Official email
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operations@company.com"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Industry
            <input
              maxLength={100}
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="e.g. Manufacturing"
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Business address
            <textarea
              maxLength={500}
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street address, city, region, postal code"
              className={`${fieldClass} h-auto py-3`}
            />
          </label>
          {!organization && (
            <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
              New organizations are active by default.
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting
                ? "Saving…"
                : organization
                  ? "Save changes"
                  : "Create organization"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
