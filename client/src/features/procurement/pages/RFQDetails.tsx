import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Package,
  Users,
  CalendarDays,
  MapPin,
  Clock3,
  CheckCircle2,
  Download,
  Pencil,
  XCircle,
  Building2,
  Eye,
  RefreshCw,
  Mail,
  GitCompareArrows,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";

// ==========================================
// TYPES
// ==========================================

interface RFQItem {
  _id?: string;
  productName?: string;
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  specifications?: string;
}

interface RFQ {
  _id: string;
  rfqNumber: string;
  title: string;
  description: string;
  category: string;
  status: "draft" | "published" | "closed" | "cancelled";
  visibility: "open" | "invited";
  invitedSuppliers?: string[];
  items: RFQItem[];
  deliveryLocation: string;
  deliveryDate: string;
  submissionDeadline: string;
  createdAt: string;
  updatedAt?: string;
}

interface Supplier {
  _id?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
}

interface Quotation {
  _id: string;
  quotationNumber: string;
  supplierId: Supplier | string | null;
  totalAmount: number;
  status: string;
  submittedAt: string;
}

interface RFQDetailsResponse {
  success: boolean;
  data: {
    rfq: RFQ;
  };
  message?: string;
}

interface QuotationsResponse {
  success: boolean;
  count: number;
  data: {
    quotations: Quotation[];
  };
  message?: string;
}

// ==========================================
// HELPERS
// ==========================================

const formatDate = (value?: string, includeTime = false) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      : {}),
  });
};

const getDaysRemaining = (deadline: string) => {
  const difference = new Date(deadline).getTime() - Date.now();

  if (Number.isNaN(difference)) return "Not available";
  if (difference <= 0) return "Expired";

  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

  return `${days} ${days === 1 ? "Day" : "Days"}`;
};

const formatStatus = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

const getSupplierDetails = (supplier: Supplier | string | null) => {
  if (!supplier || typeof supplier === "string") {
    return {
      name: "Supplier details unavailable",
      email: "",
      company: "Company information unavailable",
    };
  }

  return {
    name: supplier.fullName || "Unnamed Supplier",
    email: supplier.email || "",
    company: supplier.companyName || "Company not provided",
  };
};

const getQuotationStatusClass = (status: string) => {
  switch (status) {
    case "submitted":
      return "bg-blue-50 text-blue-700";
    case "under_review":
      return "bg-amber-50 text-amber-700";
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// ==========================================
// COMPONENT
// ==========================================

export default function RFQDetails() {
  const navigate = useNavigate();
  const { rfqId } = useParams();

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotationLoading, setQuotationLoading] = useState(true);
  const [error, setError] = useState("");
  const [quotationError, setQuotationError] = useState("");

  // ==========================================
  // FETCH RFQ DETAILS
  // ==========================================

  const fetchRFQDetails = useCallback(async () => {
    if (!rfqId) {
      setError("RFQ identifier is missing.");
      setLoading(false);
      setQuotationLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<RFQDetailsResponse>(
        `/rfqs/${rfqId}`
      );

      if (!response.success || !response.data?.rfq) {
        throw new Error("Unable to retrieve RFQ details.");
      }

      setRfq(response.data.rfq);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load RFQ details."
      );
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  // ==========================================
  // FETCH QUOTATIONS
  // ==========================================

  const fetchQuotations = useCallback(async () => {
    if (!rfqId) {
      setQuotationLoading(false);
      return;
    }

    setQuotationLoading(true);
    setQuotationError("");

    try {
      const response = await apiRequest<QuotationsResponse>(
        `/quotations/rfq/${rfqId}`
      );

      if (!response.success) {
        throw new Error(
          response.message || "Unable to retrieve quotations."
        );
      }

      setQuotations(response.data?.quotations || []);
    } catch (err) {
      setQuotationError(
        err instanceof Error
          ? err.message
          : "Unable to load supplier quotations."
      );
    } finally {
      setQuotationLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    fetchRFQDetails();
    fetchQuotations();
  }, [fetchRFQDetails, fetchQuotations]);

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="text-center">
          <RefreshCw
            className="mx-auto animate-spin text-blue-600"
            size={30}
          />
          <p className="mt-4 text-sm text-slate-500">
            Loading RFQ details...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERROR STATE
  // ==========================================

  if (error || !rfq) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-5">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-500" size={36} />

          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Unable to Load RFQ
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error || "The requested RFQ could not be found."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={fetchRFQDetails}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate("/procurement/rfqs")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Back to RFQs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DERIVED DATA
  // ==========================================

  const statusClass =
    rfq.status === "published"
      ? "bg-blue-50 text-blue-700"
      : rfq.status === "closed"
        ? "bg-slate-100 text-slate-600"
        : rfq.status === "cancelled"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700";

  const invitedSupplierCount =
    rfq.visibility === "invited"
      ? rfq.invitedSuppliers?.length ?? 0
      : null;

  const quotationCount = quotations.length;

  const summaryCards = [
    {
      label: "Invited Suppliers",
      value:
        invitedSupplierCount === null
          ? "Open Access"
          : invitedSupplierCount,
      icon: Users,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Received Quotations",
      value: quotationLoading ? "Loading..." : quotationCount,
      icon: FileText,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Estimated RFQ Value",
      value: "Not available",
      icon: Package,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Days Remaining",
      value: getDaysRemaining(rfq.submissionDeadline),
      icon: Clock3,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  const acceptedCount = quotations.filter(
    (quotation) => quotation.status === "accepted"
  ).length;

  const submittedCount = quotations.filter(
    (quotation) => quotation.status === "submitted"
  ).length;

  const underReviewCount = quotations.filter(
    (quotation) => quotation.status === "under_review"
  ).length;

  const rejectedCount = quotations.filter(
    (quotation) => quotation.status === "rejected"
  ).length;

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">

        {/* HEADER */}

        <section>
          <button
            onClick={() => navigate("/procurement/rfqs")}
            className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={15} />
            Back to RFQ Management
          </button>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                <span>Procurement</span>
                <span>/</span>
                <span>RFQ Management</span>
                <span>/</span>
                <span className="text-blue-600">RFQ Details</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {rfq.title}
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${statusClass}`}
                >
                  {formatStatus(rfq.status)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {rfq.rfqNumber} · Created {formatDate(rfq.createdAt)}
              </p>
            </div>

            {/* HEADER ACTIONS */}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  navigate(
                    `/procurement/rfqs/${rfq._id}/quotations/compare`
                  )
                }
                disabled={quotationLoading || quotationCount === 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GitCompareArrows size={15} />
                Compare Quotations
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Download size={15} />
                Export
              </button>

              <button
                onClick={() => navigate("/procurement/rfqs/create")}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={15} />
                Edit RFQ
              </button>
            </div>
          </div>
        </section>

        {/* SUMMARY CARDS */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {item.label}
                  </p>

                  <div className={`rounded-lg p-2.5 ${item.color}`}>
                    <Icon size={19} />
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  {item.value}
                </h2>
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

          {/* MAIN CONTENT */}

          <div className="space-y-5 xl:col-span-2">

            {/* RFQ OVERVIEW */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                  <FileText size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    RFQ Overview
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    General request information
                  </p>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      RFQ Number
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-800">
                      {rfq.rfqNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Category
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-800">
                      {rfq.category}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Description
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    {rfq.description || "No description provided."}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Supplier Access
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    {rfq.visibility === "open"
                      ? "Open to eligible suppliers"
                      : "Invitation only"}
                  </p>
                </div>
              </div>
            </section>

            {/* PRODUCT REQUIREMENTS */}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                <div className="rounded-lg bg-violet-50 p-2.5 text-violet-600">
                  <Package size={19} />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Product Requirements
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Products requested from suppliers
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-4">Product</th>
                      <th className="px-5 py-4">Quantity</th>
                      <th className="px-5 py-4">Specifications</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {rfq.items?.length ? (
                      rfq.items.map((item, index) => (
                        <tr key={item._id || index}>
                          <td className="px-5 py-4">
                            <p className="text-xs font-semibold text-slate-800">
                              {item.productName ||
                                item.name ||
                                "Unnamed product"}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {item.description || "No description"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                            {item.quantity ?? "—"} {item.unit || ""}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {item.specifications || "Not specified"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-5 py-8 text-center text-xs text-slate-400"
                        >
                          No product requirements found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SUPPLIER PARTICIPATION */}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
                    <Users size={19} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Supplier Participation
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Actual supplier quotation responses
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-blue-600">
                  {quotationLoading
                    ? "Loading..."
                    : `${quotationCount} Quotations`}
                </span>
              </div>

              {quotationLoading ? (
                <div className="p-10 text-center">
                  <RefreshCw
                    className="mx-auto animate-spin text-blue-600"
                    size={25}
                  />
                  <p className="mt-3 text-xs text-slate-400">
                    Loading supplier responses...
                  </p>
                </div>
              ) : quotationError ? (
                <div className="p-8 text-center">
                  <XCircle
                    className="mx-auto text-red-500"
                    size={28}
                  />
                  <p className="mt-3 text-xs font-semibold text-slate-700">
                    Unable to load supplier participation
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {quotationError}
                  </p>
                  <button
                    onClick={fetchQuotations}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : quotations.length === 0 ? (
                <div className="p-10 text-center">
                  <Building2
                    className="mx-auto text-slate-300"
                    size={30}
                  />

                  <p className="mt-3 text-xs font-semibold text-slate-700">
                    No quotations received yet
                  </p>

                  <p className="mt-2 text-[11px] text-slate-400">
                    Supplier quotations will appear here when suppliers
                    submit their responses.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Submitted: {submittedCount}
                    </span>

                    <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Under Review: {underReviewCount}
                    </span>

                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Accepted: {acceptedCount}
                    </span>

                    <span className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      Rejected: {rejectedCount}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {quotations.map((quotation) => {
                      const supplier = getSupplierDetails(
                        quotation.supplierId
                      );

                      return (
                        <div
                          key={quotation._id}
                          className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <Building2 size={18} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {supplier.name}
                              </p>

                              <p className="mt-1 truncate text-[10px] text-slate-400">
                                {supplier.company}
                              </p>

                              {supplier.email && (
                                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                                  <Mail size={11} />
                                  {supplier.email}
                                </p>
                              )}

                              <p className="mt-1 text-[10px] text-slate-400">
                                {quotation.quotationNumber}
                                {" · "}
                                {formatDate(quotation.submittedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${getQuotationStatusClass(quotation.status)}`}
                            >
                              {formatStatus(quotation.status)}
                            </span>

                            <p className="text-xs font-bold text-slate-800">
                              ₹
                              {Number(
                                quotation.totalAmount || 0
                              ).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* RIGHT SIDEBAR */}

          <div className="space-y-5">

            {/* TIMELINE */}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">
                RFQ Timeline
              </h2>

              <div className="mt-5 space-y-5">
                {[
                  {
                    label: "RFQ Created",
                    date: formatDate(rfq.createdAt),
                    done: true,
                  },
                  {
                    label: "Current RFQ Status",
                    date: formatStatus(rfq.status),
                    done:
                      rfq.status === "published" ||
                      rfq.status === "closed",
                  },
                  {
                    label: "Quotation Deadline",
                    date: formatDate(rfq.submissionDeadline, true),
                    done: false,
                  },
                  {
                    label: "Expected Delivery",
                    date: formatDate(rfq.deliveryDate),
                    done: false,
                  },
                ].map((step, index) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          step.done
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {step.done ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <CalendarDays size={15} />
                        )}
                      </div>

                      {index !== 3 && (
                        <div className="mt-1 h-7 w-px bg-slate-200" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {step.label}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {step.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* DELIVERY INFORMATION */}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-50 p-2.5 text-orange-600">
                  <MapPin size={19} />
                </div>

                <h2 className="text-sm font-bold text-slate-900">
                  Delivery Information
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Delivery Location
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-700">
                    {rfq.deliveryLocation || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Expected Date
                  </p>

                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {formatDate(rfq.deliveryDate)}
                  </p>
                </div>
              </div>
            </section>

            {/* QUOTATION PROGRESS */}

            <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex items-center gap-2 text-blue-700">
                <Eye size={17} />
                <h2 className="text-xs font-bold">
                  Quotation Progress
                </h2>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-900">
                  {quotationLoading ? "..." : quotationCount}
                </p>

                <p className="mt-1 text-[10px] text-slate-500">
                  {quotationCount === 1
                    ? "Quotation received"
                    : "Quotations received"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-[10px] text-slate-400">
                    Accepted
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    {acceptedCount}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-[10px] text-slate-400">
                    Pending Review
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-700">
                    {submittedCount + underReviewCount}
                  </p>
                </div>
              </div>
            </section>

            <button
              onClick={() => navigate("/procurement/rfqs")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <XCircle size={15} />
              Back to RFQ Listing
            </button>
          </div>
        </div>

        <footer className="pb-4 text-center text-[10px] text-slate-400">
          SupplySense AI · Procurement Management Platform
        </footer>
      </div>
    </div>
  );
}