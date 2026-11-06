
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  FileText,
  CalendarDays,
  Building2,
  Package,
  ArrowRight,
  Clock,
  Filter,
  AlertCircle,
  Inbox,
  ChevronLeft,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

interface RFQItem {
  _id: string;
  productName: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  specifications?: string;
}

interface BuyerOrganization {
  _id: string;
  name: string;
}

interface SupplierRFQ {
  _id: string;
  rfqNumber: string;
  title: string;
  description: string;
  category: string;
  items: RFQItem[];
  buyerOrganizationId: BuyerOrganization | string;
  visibility: "open" | "invited";
  deliveryLocation: string;
  deliveryDate: string;
  submissionDeadline: string;
  status: string;
  createdAt: string;
}

interface SupplierRFQResponse {
  success: boolean;
  count: number;
  data: {
    rfqs: SupplierRFQ[];
  };
}

type VisibilityFilter = "all" | "open" | "invited";

function formatDate(date: string) {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(deadline: string) {
  const difference = new Date(deadline).getTime() - Date.now();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function getBuyerName(
  buyer: BuyerOrganization | string
): string {
  if (typeof buyer === "object" && buyer !== null) {
    return buyer.name || "Buyer organization";
  }

  return "Buyer organization";
}

function VisibilityBadge({
  visibility,
}: {
  visibility: "open" | "invited";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        visibility === "open"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-purple-50 text-purple-700"
      }`}
    >
      {visibility === "open" ? "Open RFQ" : "Invitation"}
    </span>
  );
}

export default function SupplierRFQs() {
  const navigate = useNavigate();

  const [rfqs, setRfqs] = useState<SupplierRFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");

  const fetchRFQs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiRequest<SupplierRFQResponse>(
        "/rfqs/supplier"
      );

      setRfqs(response.data.rfqs || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve available RFQs."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRFQs();
  }, [fetchRFQs]);

  const filteredRFQs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const buyerName = getBuyerName(rfq.buyerOrganizationId);

      const matchesSearch = [
        rfq.rfqNumber,
        rfq.title,
        rfq.category,
        rfq.description,
        buyerName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesVisibility =
        visibilityFilter === "all" ||
        rfq.visibility === visibilityFilter;

      return matchesSearch && matchesVisibility;
    });
  }, [rfqs, search, visibilityFilter]);

  const openCount = rfqs.filter(
    (rfq) => rfq.visibility === "open"
  ).length;

  const invitedCount = rfqs.filter(
    (rfq) => rfq.visibility === "invited"
  ).length;

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/supplier/dashboard")}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={21} />
            </button>

            <div>
              <p className="text-xs font-medium text-blue-600">
                Supplier Workspace
              </p>
              <h1 className="text-lg font-bold text-slate-900">
                RFQ Management
              </h1>
            </div>
          </div>

          <button
            onClick={() => fetchRFQs(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-7">
        {/* PAGE INTRO */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Available Requests for Quotation
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Discover procurement opportunities from buyers,
              review their requirements, and submit competitive quotations.
            </p>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Total Available RFQs
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {loading ? "—" : rfqs.length}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <FileText size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Open Opportunities
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-600">
                  {loading ? "—" : openCount}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <Package size={23} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Private Invitations
                </p>
                <p className="mt-2 text-3xl font-bold text-purple-600">
                  {loading ? "—" : invitedCount}
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
                <Inbox size={23} />
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search RFQ number, title, buyer..."
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Filter size={15} />
                Visibility:
              </span>

              {(
                [
                  ["all", "All RFQs"],
                  ["open", "Open"],
                  ["invited", "Invited"],
                ] as [VisibilityFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setVisibilityFilter(value)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    visibilityFilter === value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Unable to load RFQs
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>

            <button
              onClick={() => fetchRFQs()}
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* RFQ LIST */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="font-bold text-slate-900">
                Procurement Opportunities
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                {loading
                  ? "Loading available RFQs..."
                  : `${filteredRFQs.length} matching RFQ${filteredRFQs.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              Sorted by submission deadline
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center">
              <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <p className="text-sm text-slate-500">
                Loading available opportunities...
              </p>
            </div>
          ) : filteredRFQs.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Inbox size={32} />
              </div>

              <h3 className="font-semibold text-slate-800">
                {error
                  ? "RFQs could not be loaded"
                  : "No matching RFQs found"}
              </h3>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                {error
                  ? "Please check your connection and try again."
                  : search || visibilityFilter !== "all"
                    ? "Try changing your search or visibility filters."
                    : "There are currently no published RFQs available for your supplier account."}
              </p>

              {(search || visibilityFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setVisibilityFilter("all");
                  }}
                  className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRFQs.map((rfq) => {
                const daysRemaining = getDaysRemaining(
                  rfq.submissionDeadline
                );

                const urgent = daysRemaining <= 3;

                return (
                  <article
                    key={rfq._id}
                    className="p-5 transition hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-blue-600">
                            {rfq.rfqNumber}
                          </span>

                          <VisibilityBadge visibility={rfq.visibility} />

                          {urgent && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                              {daysRemaining <= 0
                                ? "Deadline today"
                                : `${daysRemaining} days left`}
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg font-bold text-slate-900">
                          {rfq.title}
                        </h4>

                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                          {rfq.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-500">
                          <span className="flex items-center gap-2">
                            <Building2
                              size={15}
                              className="text-slate-400"
                            />
                            {getBuyerName(rfq.buyerOrganizationId)}
                          </span>

                          <span className="flex items-center gap-2">
                            <Package
                              size={15}
                              className="text-slate-400"
                            />
                            {rfq.category}
                          </span>

                          <span className="flex items-center gap-2">
                            <FileText
                              size={15}
                              className="text-slate-400"
                            />
                            {rfq.items?.length || 0} products
                          </span>

                          <span className="flex items-center gap-2">
                            <CalendarDays
                              size={15}
                              className="text-slate-400"
                            />
                            Delivery: {formatDate(rfq.deliveryDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 xl:w-[220px] xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                        <div>
                          <p className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={14} />
                            Submission deadline
                          </p>

                          <p
                            className={`mt-1 text-sm font-bold ${
                              urgent
                                ? "text-red-600"
                                : "text-slate-800"
                            }`}
                          >
                            {formatDate(rfq.submissionDeadline)}
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            navigate(`/supplier/rfqs/${rfq._id}`)
                          }
                          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          View RFQ Details
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400">
          <span>© 2026 SupplySense AI. All rights reserved.</span>
          <span>Secure Supplier Workspace</span>
        </footer>
      </main>
    </div>
  );
}
