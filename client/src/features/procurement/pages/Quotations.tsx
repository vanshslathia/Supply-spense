import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  RefreshCw,
  Search,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";

// ==========================================
// TYPES
// ==========================================

interface RFQ {
  _id: string;
  rfqNumber?: string;
  title: string;
  status?: string;
  submissionDeadline?: string;
}

interface Supplier {
  fullName?: string;
  email?: string;
  companyName?: string;
}

interface Quotation {
  _id?: string;
  id?: string;
  quotationId?: string;
  quotationNumber: string;
  supplier?: Supplier | string | null;
  supplierId?: Supplier | string | null;
  subtotal?: number;
  taxAmount?: number;
  deliveryCharges?: number;
  totalAmount: number;
  status: string;
  submittedAt?: string;
  validityDate?: string;
  deliveryTimeline?: string;
  supplierRemarks?: string;
}

interface RFQListResponse {
  success: boolean;
  data: {
    rfqs: RFQ[];
  };
  message?: string;
}

interface QuotationsResponse {
  success: boolean;
  count?: number;
  data: {
    quotations: Quotation[];
  };
  message?: string;
}

// ==========================================
// HELPERS
// ==========================================

const formatCurrency = (value?: number | null) => {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const getSupplier = (quotation: Quotation) => {
  const supplier = quotation.supplier ?? quotation.supplierId;

  if (!supplier || typeof supplier === "string") {
    return {
      name: "Supplier details unavailable",
      company:
        typeof supplier === "string"
          ? supplier
          : "Company unavailable",
      email: "",
    };
  }

  return {
    name: supplier.fullName || "Unnamed Supplier",
    company: supplier.companyName || "Company not provided",
    email: supplier.email || "",
  };
};

const getQuotationId = (quotation: Quotation) =>
  quotation.quotationId ||
  quotation._id ||
  quotation.id ||
  "";

const statusClass = (status: string) => {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-700";

    case "rejected":
      return "bg-red-50 text-red-700";

    case "under_review":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-blue-50 text-blue-700";
  }
};

// ==========================================
// COMPONENT
// ==========================================

export default function Quotations() {
  const navigate = useNavigate();

  // State
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState("");

  const [quotations, setQuotations] = useState<Quotation[]>([]);

  const [loadingRfqs, setLoadingRfqs] = useState(true);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState("");

  // ==========================================
  // SELECTED RFQ
  // ==========================================

  const selectedRfq = useMemo(
    () =>
      rfqs.find((rfq) => rfq._id === selectedRfqId) || null,
    [rfqs, selectedRfqId]
  );

  // ==========================================
  // FETCH RFQS
  // ==========================================

  const fetchRfqs = useCallback(async () => {
    try {
      setError("");

      const response = await apiRequest<RFQListResponse>("/rfqs");

      if (!response.success || !response.data?.rfqs) {
        throw new Error(
          response.message || "Unable to load RFQs."
        );
      }

      const list = response.data.rfqs;

      setRfqs(list);

      setSelectedRfqId((current) => {
        if (
          current &&
          list.some((rfq) => rfq._id === current)
        ) {
          return current;
        }

        const firstPublished = list.find(
          (rfq) =>
            rfq.status?.toLowerCase() === "published"
        );

        return (firstPublished || list[0])?._id || "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load RFQs."
      );
    } finally {
      setLoadingRfqs(false);
    }
  }, []);

  // ==========================================
  // FETCH QUOTATIONS FOR SELECTED RFQ
  // ==========================================

  const fetchQuotations = useCallback(
    async (rfqId: string) => {
      if (!rfqId) {
        setQuotations([]);
        return;
      }

      try {
        setLoadingQuotations(true);
        setError("");

        const response =
          await apiRequest<QuotationsResponse>(
            `/quotations/rfq/${rfqId}`
          );

        if (
          !response.success ||
          !response.data?.quotations
        ) {
          throw new Error(
            response.message ||
              "Unable to load quotations."
          );
        }

        setQuotations(response.data.quotations);
      } catch (err) {
        setQuotations([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load quotations."
        );
      } finally {
        setLoadingQuotations(false);
      }
    },
    []
  );

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    fetchRfqs();
  }, [fetchRfqs]);

  // ==========================================
  // LOAD QUOTATIONS WHEN RFQ CHANGES
  // ==========================================

  useEffect(() => {
    fetchQuotations(selectedRfqId);
  }, [selectedRfqId, fetchQuotations]);

  // ==========================================
  // REFRESH
  // ==========================================

  const refreshAll = async () => {
    setRefreshing(true);

    await fetchRfqs();

    if (selectedRfqId) {
      await fetchQuotations(selectedRfqId);
    }

    setRefreshing(false);
  };

  // ==========================================
  // ACCEPT / REJECT QUOTATION
  // ==========================================

  const handleReview = async (
    quotation: Quotation,
    decision: "accepted" | "rejected"
  ) => {
    const quotationId = getQuotationId(quotation);

    if (!quotationId) {
      window.alert(
        "Quotation ID is missing. Please refresh and try again."
      );
      return;
    }

    let rejectionReason: string | undefined;

    // Accept confirmation
    if (decision === "accepted") {
      const confirmed = window.confirm(
        `Accept ${quotation.quotationNumber}?\n\nOther active quotations for this RFQ will be rejected automatically.`
      );

      if (!confirmed) return;
    }

    // Rejection reason
    if (decision === "rejected") {
      const reason = window.prompt(
        `Enter the reason for rejecting ${quotation.quotationNumber}:`
      );

      if (reason === null) return;

      if (!reason.trim()) {
        window.alert(
          "Please provide a rejection reason."
        );
        return;
      }

      rejectionReason = reason.trim();
    }

    try {
      setActionLoading(quotationId);
      setActionMessage("");

      const response = await apiRequest<{
        success: boolean;
        message?: string;
      }>(
        `/quotations/${quotationId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision,
            ...(rejectionReason
              ? { rejectionReason }
              : {}),
          }),
        }
      );

      if (!response.success) {
        throw new Error(
          response.message ||
            "Unable to review quotation."
        );
      }

      setActionMessage(
        response.message ||
          "Quotation reviewed successfully."
      );

      await fetchQuotations(selectedRfqId);
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to review quotation."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================================
  // SEARCH FILTER
  // ==========================================

  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return quotations;

    return quotations.filter((quotation) => {
      const supplier = getSupplier(quotation);

      return [
        quotation.quotationNumber,
        supplier.name,
        supplier.company,
        quotation.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [quotations, searchTerm]);

  // ==========================================
  // SUMMARY DATA
  // ==========================================

  const pendingCount = quotations.filter(
    (quotation) =>
      quotation.status === "submitted" ||
      quotation.status === "under_review"
  ).length;

  const acceptedCount = quotations.filter(
    (quotation) => quotation.status === "accepted"
  ).length;

  const lowestQuotation =
    quotations.length > 0
      ? [...quotations].sort(
          (a, b) =>
            Number(a.totalAmount) -
            Number(b.totalAmount)
        )[0]
      : null;

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loadingRfqs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="text-center">
          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading procurement RFQs...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">

        {/* HEADER */}

        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <button
              onClick={() =>
                navigate("/procurement/dashboard")
              }
              className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </button>

            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Procurement</span>
              <span>/</span>
              <span className="text-blue-600">
                Quotations
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Quotations Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review supplier offers, compare commercial terms,
              and make award decisions.
            </p>
          </div>

          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                refreshing ? "animate-spin" : ""
              }
            />

            Refresh Data
          </button>
        </section>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Unable to load data
              </p>

              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {actionMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={17} />
            {actionMessage}
          </div>
        )}

        {/* RFQ SELECTION */}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText
              size={18}
              className="text-blue-600"
            />

            <h2 className="text-sm font-bold text-slate-900">
              Select an RFQ
            </h2>
          </div>

          {rfqs.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-8 text-center">
              <FileText
                size={30}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 text-sm font-semibold text-slate-700">
                No RFQs found
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Create an RFQ first. Supplier quotations
                will appear here after submission.
              </p>

              <button
                onClick={() =>
                  navigate("/procurement/rfqs/create")
                }
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Create RFQ
              </button>
            </div>
          ) : (
            <div className="relative max-w-3xl">
              <select
                value={selectedRfqId}
                onChange={(event) => {
                  setSelectedRfqId(event.target.value);
                  setActionMessage("");
                  setSearchTerm("");
                }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {rfqs.map((rfq) => (
                  <option
                    key={rfq._id}
                    value={rfq._id}
                  >
                    {rfq.rfqNumber
                      ? `${rfq.rfqNumber} · `
                      : ""}
                    {rfq.title}
                    {rfq.status
                      ? ` (${rfq.status})`
                      : ""}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          )}

          {/* SELECTED RFQ DETAILS */}

          {selectedRfq && (
            <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedRfq.title}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedRfq.rfqNumber || "RFQ"} ·
                  Deadline:{" "}
                  {formatDate(
                    selectedRfq.submissionDeadline
                  )}
                </p>
              </div>

              <button
                onClick={() =>
                  navigate(
                    `/procurement/rfqs/${selectedRfq._id}/quotations/compare`
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Compare Quotations
              </button>
            </div>
          )}
        </section>

        {/* RFQ-BASED CONTENT */}

        {selectedRfq && (
          <>
            {/* SUMMARY CARDS */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              {/* TOTAL QUOTATIONS */}

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Total Quotations
                  </p>

                  <FileText
                    size={19}
                    className="text-blue-600"
                  />
                </div>

                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {loadingQuotations
                    ? "—"
                    : quotations.length}
                </p>
              </div>

              {/* PENDING REVIEW */}

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Pending Review
                  </p>

                  <Clock3
                    size={19}
                    className="text-amber-600"
                  />
                </div>

                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {loadingQuotations
                    ? "—"
                    : pendingCount}
                </p>
              </div>

              {/* ACCEPTED */}

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Accepted
                  </p>

                  <CheckCircle2
                    size={19}
                    className="text-emerald-600"
                  />
                </div>

                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {loadingQuotations
                    ? "—"
                    : acceptedCount}
                </p>
              </div>

              {/* LOWEST QUOTATION */}

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Lowest Quotation
                  </p>

                  <TrendingDown
                    size={19}
                    className="text-emerald-600"
                  />
                </div>

                <p className="mt-4 text-xl font-bold text-slate-900">
                  {loadingQuotations
                    ? "—"
                    : lowestQuotation
                      ? formatCurrency(
                          lowestQuotation.totalAmount
                        )
                      : "—"}
                </p>
              </div>
            </section>

            {/* SUPPLIER QUOTATIONS TABLE */}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

              {/* TABLE HEADER */}

              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                    <Building2 size={19} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Supplier Quotations
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      Supplier submissions for the selected RFQ
                    </p>
                  </div>
                </div>

                {/* SEARCH */}

                <div className="relative w-full md:max-w-xs">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                    placeholder="Search supplier or quotation..."
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* LOADING */}

              {loadingQuotations ? (
                <div className="p-12 text-center">
                  <RefreshCw
                    size={25}
                    className="mx-auto animate-spin text-blue-600"
                  />

                  <p className="mt-3 text-xs text-slate-500">
                    Loading supplier quotations...
                  </p>
                </div>
              ) : filteredQuotations.length === 0 ? (
                /* EMPTY STATE */

                <div className="p-12 text-center">
                  <FileText
                    size={34}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {quotations.length === 0
                      ? "No quotations submitted yet"
                      : "No matching quotations"}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {quotations.length === 0
                      ? "Supplier quotations will appear here once suppliers submit their offers."
                      : "Try a different supplier name, company, or quotation number."}
                  </p>
                </div>
              ) : (
                /* QUOTATION DATA */

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left">

                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-5 py-4">
                          Supplier
                        </th>

                        <th className="px-5 py-4">
                          Quotation No.
                        </th>

                        <th className="px-5 py-4">
                          Submitted
                        </th>

                        <th className="px-5 py-4">
                          Total Amount
                        </th>

                        <th className="px-5 py-4">
                          Delivery
                        </th>

                        <th className="px-5 py-4">
                          Valid Until
                        </th>

                        <th className="px-5 py-4">
                          Status
                        </th>

                        <th className="px-5 py-4">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredQuotations.map(
                        (quotation) => {
                          const supplier =
                            getSupplier(quotation);

                          const quotationId =
                            getQuotationId(quotation);

                          const canReview =
                            quotation.status === "submitted" ||
                            quotation.status === "under_review";

                          return (
                            <tr
                              key={
                                quotationId ||
                                quotation.quotationNumber
                              }
                              className="hover:bg-slate-50/70"
                            >
                              {/* SUPPLIER */}

                              <td className="px-5 py-4">
                                <p className="text-xs font-semibold text-slate-800">
                                  {supplier.name}
                                </p>

                                <p className="mt-1 text-[10px] text-slate-400">
                                  {supplier.company}
                                </p>

                                {supplier.email && (
                                  <p className="mt-1 text-[10px] text-slate-400">
                                    {supplier.email}
                                  </p>
                                )}
                              </td>

                              {/* QUOTATION NUMBER */}

                              <td className="px-5 py-4 text-xs text-slate-600">
                                {quotation.quotationNumber}
                              </td>

                              {/* SUBMISSION DATE */}

                              <td className="px-5 py-4 text-xs text-slate-600">
                                {formatDate(
                                  quotation.submittedAt
                                )}
                              </td>

                              {/* TOTAL AMOUNT */}

                              <td className="px-5 py-4 text-xs font-bold text-slate-900">
                                {formatCurrency(
                                  quotation.totalAmount
                                )}
                              </td>

                              {/* DELIVERY TIMELINE */}

                              <td className="px-5 py-4 text-xs text-slate-600">
                                {quotation.deliveryTimeline ||
                                  "—"}
                              </td>

                              {/* VALIDITY */}

                              <td className="px-5 py-4 text-xs text-slate-600">
                                {formatDate(
                                  quotation.validityDate
                                )}
                              </td>

                              {/* STATUS */}

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                                    quotation.status
                                  )}`}
                                >
                                  {quotation.status.replace(
                                    /_/g,
                                    " "
                                  )}
                                </span>
                              </td>

                              {/* ACTIONS */}

                              <td className="px-5 py-4">
                                {canReview ? (
                                  <div className="flex gap-2">

                                    {/* ACCEPT */}

                                    <button
                                      disabled={
                                        actionLoading !== null
                                      }
                                      onClick={() =>
                                        handleReview(
                                          quotation,
                                          "accepted"
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      {actionLoading ===
                                      quotationId ? (
                                        "..."
                                      ) : (
                                        <CheckCircle2 size={12} />
                                      )}

                                      Accept
                                    </button>

                                    {/* REJECT */}

                                    <button
                                      disabled={
                                        actionLoading !== null
                                      }
                                      onClick={() =>
                                        handleReview(
                                          quotation,
                                          "rejected"
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <XCircle size={12} />
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    No action available
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* FOOTER */}

        <footer className="pb-4 text-center text-[10px] text-slate-400">
          SupplySense AI · Procurement Management Platform
        </footer>
      </div>
    </div>
  );
}