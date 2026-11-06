
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  Building2,
  Package,
  CheckCircle2,
  Clock,
  CalendarDays,
  Truck,
  TrendingDown,
  AlertCircle,
  IndianRupee,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";

// ==========================================
// TYPES
// ==========================================

interface Supplier {
  _id?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
}

interface SupplierComparison {
  quotationId: string;
  quotationNumber: string;
  supplier: Supplier | string | null;
  subtotal: number;
  taxAmount: number;
  deliveryCharges: number;
  totalAmount: number;
  deliveryTimeline: string;
  validityDate: string;
  status: string;
  submittedAt: string;
  supplierRemarks?: string;
}

interface SupplierPrice {
  quotationId: string;
  quotationNumber: string;
  supplier: Supplier | string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface ItemComparison {
  rfqItemId: string;
  productName: string;
  requiredQuantity: number;
  unit: string;
  supplierPrices: SupplierPrice[];
  lowestUnitPrice: number | null;
  highestUnitPrice: number | null;
}

interface ComparisonData {
  rfq: {
    id: string;
    rfqNumber: string;
    title: string;
    submissionDeadline: string;
    itemCount: number;
  };
  quotationCount: number;
  supplierComparisons: SupplierComparison[];
  itemComparisons: ItemComparison[];
}

interface ComparisonResponse {
  success: boolean;
  message?: string;
  data: ComparisonData;
}

// ==========================================
// HELPERS
// ==========================================

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return "—";

  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value?: string) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getSupplier = (supplier: Supplier | string | null) => {
  if (!supplier || typeof supplier === "string") {
    return {
      name: "Supplier details unavailable",
      company: "Company unavailable",
      email: "",
    };
  }

  return {
    name: supplier.fullName || "Unnamed Supplier",
    company: supplier.companyName || "Company not provided",
    email: supplier.email || "",
  };
};

const statusStyle = (status: string) => {
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

export default function QuotationComparison() {
  const navigate = useNavigate();
  const { rfqId } = useParams();

  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  // ==========================================
  // FETCH COMPARISON
  // ==========================================

  const fetchComparison = useCallback(async () => {
    if (!rfqId) {
      setError("RFQ ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiRequest<ComparisonResponse>(
        `/quotations/rfq/${rfqId}/compare`
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.message || "Unable to load quotation comparison."
        );
      }

      setComparison(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load quotation comparison."
      );
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  // ==========================================
  // REVIEW QUOTATION
  // ==========================================

  const handleReview = async (
    quotationId: string,
    decision: "accepted" | "rejected",
    quotationNumber: string
  ) => {
    let rejectionReason: string | undefined;

    if (decision === "accepted") {
      const confirmed = window.confirm(
        `Are you sure you want to accept ${quotationNumber}?\n\nOther active quotations for this RFQ will be rejected automatically.`
      );

      if (!confirmed) return;
    }

    if (decision === "rejected") {
      const reason = window.prompt(
        `Enter the reason for rejecting ${quotationNumber}:`
      );

      if (reason === null) return;

      if (!reason.trim()) {
        window.alert("Please provide a rejection reason.");
        return;
      }

      rejectionReason = reason.trim();
    }

    try {
      setActionLoading(quotationId);
      setActionMessage("");

      const response = await apiRequest<{
        success: boolean;
        message: string;
      }>(`/quotations/${quotationId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          ...(rejectionReason ? { rejectionReason } : {}),
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Unable to review quotation.");
      }

      setActionMessage(response.message || "Quotation reviewed successfully.");

      await fetchComparison();
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
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="text-center">
          <RefreshCw
            size={30}
            className="mx-auto animate-spin text-blue-600"
          />
          <p className="mt-4 text-sm text-slate-500">
            Loading quotation comparison...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================

  if (error || !comparison) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-5">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto text-red-500" size={36} />

          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Unable to Load Comparison
          </h2>

          <p className="mt-2 text-sm text-slate-500">{error}</p>

          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={fetchComparison}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Try Again
            </button>

            <button
              onClick={() => navigate("/procurement/rfqs")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DERIVED DATA
  // ==========================================

  const suppliers = comparison.supplierComparisons || [];
  const products = comparison.itemComparisons || [];

  const lowestQuotation =
    suppliers.length > 0
      ? [...suppliers].sort(
          (a, b) => a.totalAmount - b.totalAmount
        )[0]
      : null;

  const acceptedQuotation = suppliers.find(
    (quotation) => quotation.status === "accepted"
  );

  const pendingCount = suppliers.filter(
    (quotation) =>
      quotation.status === "submitted" ||
      quotation.status === "under_review"
  ).length;

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-5 md:p-8">

        {/* HEADER */}

        <section>
          <button
            onClick={() => navigate(`/procurement/rfqs/${rfqId}`)}
            className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={15} />
            Back to RFQ Details
          </button>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                <span>Procurement</span>
                <span>/</span>
                <span>RFQ Management</span>
                <span>/</span>
                <span className="text-blue-600">
                  Quotation Comparison
                </span>
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Quotation Comparison
              </h1>

              <p className="mt-2 text-xs text-slate-500">
                {comparison.rfq.title} · {comparison.rfq.rfqNumber}
              </p>
            </div>

            <button
              onClick={fetchComparison}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              Refresh Data
            </button>
          </div>
        </section>

        {/* SUCCESS MESSAGE */}

        {actionMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={17} />
            {actionMessage}
          </div>
        )}

        {/* SUMMARY CARDS */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Total Quotations</p>
              <FileText className="text-blue-600" size={20} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              {comparison.quotationCount}
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Lowest Quotation</p>
              <TrendingDown className="text-emerald-600" size={20} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {lowestQuotation
                ? formatCurrency(lowestQuotation.totalAmount)
                : "—"}
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Pending Review</p>
              <Clock className="text-amber-600" size={20} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">
              {pendingCount}
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Accepted Quotation</p>
              <CheckCircle2 className="text-emerald-600" size={20} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {acceptedQuotation
                ? formatCurrency(acceptedQuotation.totalAmount)
                : "Not selected"}
            </h2>
          </div>
        </section>

        {/* SUPPLIER COMPARISON */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <Building2 size={20} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Supplier Quotation Comparison
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Compare supplier offers and commercial terms
              </p>
            </div>
          </div>

          {suppliers.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto text-slate-300" size={35} />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No quotations available
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Supplier quotations will appear here after submission.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Quotation No.</th>
                    <th className="px-5 py-4">Subtotal</th>
                    <th className="px-5 py-4">Tax</th>
                    <th className="px-5 py-4">Delivery Charges</th>
                    <th className="px-5 py-4">Total Amount</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((quotation) => {
                    const supplier = getSupplier(quotation.supplier);

                    const isLowest =
                      lowestQuotation?.quotationId === quotation.quotationId;

                    const canReview =
                      quotation.status === "submitted" ||
                      quotation.status === "under_review";

                    return (
                      <tr
                        key={quotation.quotationId}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="text-xs font-semibold text-slate-800">
                            {supplier.name}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {supplier.company}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600">
                          {quotation.quotationNumber}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-700">
                          {formatCurrency(quotation.subtotal)}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-700">
                          {formatCurrency(quotation.taxAmount)}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-700">
                          {formatCurrency(quotation.deliveryCharges)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {formatCurrency(quotation.totalAmount)}
                            </span>

                            {isLowest && (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                                Lowest
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyle(quotation.status)}`}
                          >
                            {quotation.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {canReview ? (
                            <div className="flex gap-2">
                              <button
                                disabled={actionLoading !== null}
                                onClick={() =>
                                  handleReview(
                                    quotation.quotationId,
                                    "accepted",
                                    quotation.quotationNumber
                                  )
                                }
                                className="rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actionLoading === quotation.quotationId
                                  ? "..."
                                  : "Accept"}
                              </button>

                              <button
                                disabled={actionLoading !== null}
                                onClick={() =>
                                  handleReview(
                                    quotation.quotationId,
                                    "rejected",
                                    quotation.quotationNumber
                                  )
                                }
                                className="rounded-md border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PRODUCT-WISE PRICE COMPARISON */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5">
            <div className="rounded-lg bg-violet-50 p-2.5 text-violet-600">
              <Package size={20} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Product-wise Price Comparison
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Compare unit prices offered by each supplier
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No product comparison data available.
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {products.map((product) => (
                <div
                  key={product.rfqItemId}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {product.productName}
                      </h3>

                      <p className="mt-1 text-[10px] text-slate-500">
                        Required Quantity: {product.requiredQuantity}{" "}
                        {product.unit}
                      </p>
                    </div>

                    <div className="flex gap-3 text-[10px]">
                      <span className="text-emerald-700">
                        Lowest: {formatCurrency(product.lowestUnitPrice)}
                      </span>

                      <span className="text-slate-500">
                        Highest: {formatCurrency(product.highestUnitPrice)}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Unit Price</th>
                          <th className="px-4 py-3">Total Price</th>
                          <th className="px-4 py-3">Comparison</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {product.supplierPrices.map((price) => {
                          const supplier = getSupplier(price.supplier);

                          const isLowest =
                            price.unitPrice !== null &&
                            price.unitPrice === product.lowestUnitPrice;

                          return (
                            <tr key={price.quotationId}>
                              <td className="px-4 py-3 text-xs font-medium text-slate-700">
                                {supplier.name}
                              </td>

                              <td className="px-4 py-3 text-xs text-slate-700">
                                {formatCurrency(price.unitPrice)}
                              </td>

                              <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                                {formatCurrency(price.totalPrice)}
                              </td>

                              <td className="px-4 py-3">
                                {isLowest ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                                    <TrendingDown size={12} />
                                    Lowest Price
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* COMMERCIAL TERMS */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5">
            <div className="rounded-lg bg-orange-50 p-2.5 text-orange-600">
              <Truck size={20} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Commercial Terms
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Delivery commitments and quotation validity
              </p>
            </div>
          </div>

          {suppliers.length === 0 ? (
            <p className="p-6 text-xs text-slate-400">
              No commercial terms available.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((quotation) => {
                const supplier = getSupplier(quotation.supplier);

                return (
                  <div
                    key={quotation.quotationId}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <h3 className="text-xs font-bold text-slate-800">
                      {supplier.name}
                    </h3>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {quotation.quotationNumber}
                    </p>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={15} className="text-blue-600" />
                        <div>
                          <p className="text-[10px] text-slate-400">
                            Delivery Timeline
                          </p>
                          <p className="text-xs font-medium text-slate-700">
                            {quotation.deliveryTimeline || "Not provided"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-orange-600" />
                        <div>
                          <p className="text-[10px] text-slate-400">
                            Valid Until
                          </p>
                          <p className="text-xs font-medium text-slate-700">
                            {formatDate(quotation.validityDate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <IndianRupee size={15} className="text-emerald-600" />
                        <div>
                          <p className="text-[10px] text-slate-400">
                            Total Amount
                          </p>
                          <p className="text-xs font-bold text-slate-800">
                            {formatCurrency(quotation.totalAmount)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {quotation.supplierRemarks && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-semibold text-slate-500">
                          Supplier Remarks
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {quotation.supplierRemarks}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FOOTER */}

        <footer className="pb-4 text-center text-[10px] text-slate-400">
          SupplySense AI · Procurement Management Platform
        </footer>
      </div>
    </div>
  );
}
