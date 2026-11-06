
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Building2,
  Package,
  MapPin,
  Clock,
  FileText,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
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

interface RFQ {
  _id: string;
  rfqNumber: string;
  title: string;
  description?: string;
  category: string;
  items: RFQItem[];
  buyerOrganizationId: {
    _id?: string;
    name: string;
  } | string;
  deliveryLocation: string;
  deliveryDate: string;
  submissionDeadline: string;
  visibility: "open" | "invited";
  status: string;
}

interface RFQResponse {
  success: boolean;
  data: {
    rfq: RFQ;
  };
}

interface QuotationResponse {
  success: boolean;
  message: string;
  data: {
    quotation: {
      _id: string;
      quotationNumber: string;
    };
  };
}

interface PriceInput {
  unitPrice: string;
  remarks: string;
}

const formatDate = (date: string) => {
  if (!date) return "Not specified";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

export default function SupplierRFQDetails() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [prices, setPrices] = useState<Record<string, PriceInput>>({});
  const [taxPercentage, setTaxPercentage] = useState("18");
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [deliveryTimeline, setDeliveryTimeline] = useState("15");
  const [validityDate, setValidityDate] = useState("");
  const [supplierRemarks, setSupplierRemarks] = useState("");

  useEffect(() => {
    const fetchRFQ = async () => {
      if (!rfqId) {
        setError("Invalid RFQ ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await apiRequest<RFQResponse>(
          `/rfqs/supplier/${rfqId}`
        );

        setRfq(response.data.rfq);

        const initialPrices: Record<string, PriceInput> = {};

        response.data.rfq.items.forEach((item) => {
          initialPrices[item._id] = {
            unitPrice: "",
            remarks: "",
          };
        });

        setPrices(initialPrices);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load RFQ details."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRFQ();
  }, [rfqId]);

  const subtotal = useMemo(() => {
    if (!rfq) return 0;

    return rfq.items.reduce((total, item) => {
      const unitPrice = Number(prices[item._id]?.unitPrice || 0);

      return total + item.quantity * unitPrice;
    }, 0);
  }, [rfq, prices]);

  const taxAmount =
    (subtotal * Number(taxPercentage || 0)) / 100;

  const totalAmount =
    subtotal + taxAmount + Number(deliveryCharges || 0);

  const updateItemPrice = (
    itemId: string,
    field: keyof PriceInput,
    value: string
  ) => {
    setPrices((previous) => ({
      ...previous,
      [itemId]: {
        ...previous[itemId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!rfq) return;

    setError("");
    setSuccessMessage("");

    const missingPrice = rfq.items.some((item) => {
      const value = prices[item._id]?.unitPrice;

      return (
        value === undefined ||
        value.trim() === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      );
    });

    if (missingPrice) {
      setError("Enter a valid unit price for every RFQ item.");
      return;
    }

    if (
      !Number.isFinite(Number(taxPercentage)) ||
      Number(taxPercentage) < 0 ||
      Number(taxPercentage) > 100
    ) {
      setError("Tax percentage must be between 0 and 100.");
      return;
    }

    if (
      !Number.isFinite(Number(deliveryCharges)) ||
      Number(deliveryCharges) < 0
    ) {
      setError("Enter valid delivery charges.");
      return;
    }

    if (
      !Number.isInteger(Number(deliveryTimeline)) ||
      Number(deliveryTimeline) < 1 ||
      Number(deliveryTimeline) > 365
    ) {
      setError("Delivery timeline must be between 1 and 365 days.");
      return;
    }

    if (!validityDate || new Date(validityDate) <= new Date()) {
      setError("Select a quotation validity date in the future.");
      return;
    }

    const payload = {
      rfqId: rfq._id,
      items: rfq.items.map((item) => ({
        rfqItemId: item._id,
        unitPrice: Number(prices[item._id].unitPrice),
        ...(prices[item._id].remarks.trim()
          ? { remarks: prices[item._id].remarks.trim() }
          : {}),
      })),
      taxPercentage: Number(taxPercentage),
      deliveryCharges: Number(deliveryCharges),
      deliveryTimeline: Number(deliveryTimeline),
      validityDate: new Date(
        `${validityDate}T23:59:59`
      ).toISOString(),
      ...(supplierRemarks.trim()
        ? { supplierRemarks: supplierRemarks.trim() }
        : {}),
    };

    try {
      setSubmitting(true);

      const response = await apiRequest<QuotationResponse>(
        "/quotations",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setSuccessMessage(
        response.message || "Quotation submitted successfully."
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit quotation."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">
          Loading RFQ details...
        </span>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button
          onClick={() => navigate("/supplier/rfqs")}
          className="flex items-center gap-2 text-blue-600 mb-6"
        >
          <ArrowLeft size={18} />
          Back to RFQs
        </button>

        <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-xl p-6">
          <AlertCircle className="text-red-500 mb-3" size={28} />
          <h2 className="text-lg font-semibold text-slate-900">
            Unable to load RFQ
          </h2>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const buyerName =
    typeof rfq.buyerOrganizationId === "string"
      ? rfq.buyerOrganizationId
      : rfq.buyerOrganizationId?.name || "Buyer";

  const deadlinePassed =
    new Date(rfq.submissionDeadline).getTime() <= Date.now();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/supplier/rfqs")}
              className="flex items-center gap-2 text-sm text-blue-600 mb-1"
            >
              <ArrowLeft size={16} />
              Supplier Workspace
            </button>

            <h1 className="text-xl font-bold">
              RFQ Details
            </h1>
          </div>

          <span className="text-sm font-medium text-slate-500">
            {rfq.rfqNumber}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex gap-3">
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-5 rounded-xl border border-green-200 bg-green-50 text-green-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} />
              <div>
                <h2 className="font-semibold">
                  Quotation submitted
                </h2>
                <p className="text-sm mt-1">{successMessage}</p>
              </div>
            </div>

            <button
              onClick={() => navigate("/supplier/rfqs")}
              className="mt-4 text-sm font-semibold underline"
            >
              Return to RFQ Management
            </button>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                {rfq.visibility === "open"
                  ? "Open RFQ"
                  : "Private Invitation"}
              </span>

              <h2 className="text-2xl font-bold mt-3">
                {rfq.title}
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                {rfq.rfqNumber}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">
                Submission deadline
              </p>
              <p className="font-semibold mt-1">
                {formatDate(rfq.submissionDeadline)}
              </p>
            </div>
          </div>

          {rfq.description && (
            <p className="text-slate-600 mt-5 leading-7">
              {rfq.description}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-7 pt-6 border-t border-slate-100">
            <div className="flex gap-3">
              <Building2 className="text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Buyer</p>
                <p className="font-medium mt-1">{buyerName}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <MapPin className="text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Delivery location</p>
                <p className="font-medium mt-1">
                  {rfq.deliveryLocation}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CalendarDays className="text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Expected delivery</p>
                <p className="font-medium mt-1">
                  {formatDate(rfq.deliveryDate)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-7">
          <div className="flex items-center gap-3 mb-6">
            <Package className="text-blue-600" size={22} />
            <div>
              <h2 className="text-lg font-bold">
                Product Requirements
              </h2>
              <p className="text-sm text-slate-500">
                {rfq.items.length} items requested by the buyer
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {rfq.items.map((item, index) => (
              <div
                key={item._id}
                className="border border-slate-200 rounded-xl p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Item {index + 1} · {item.category}
                    </p>
                    <h3 className="font-semibold text-lg mt-1">
                      {item.productName}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-slate-600 mt-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 rounded-lg px-4 py-3 h-fit">
                    <p className="text-xs text-slate-500">
                      Required quantity
                    </p>
                    <p className="font-bold text-blue-700 mt-1">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                </div>

                {item.specifications && (
                  <div className="mt-4 bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      Specifications
                    </p>
                    <p className="text-sm">
                      {item.specifications}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={22} />
            <div>
              <h2 className="text-xl font-bold">
                Submit Your Quotation
              </h2>
              <p className="text-sm text-slate-500">
                Provide pricing for every requested product.
              </p>
            </div>
          </div>

          {deadlinePassed && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              The submission deadline has passed. New quotations may no longer be accepted.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <h3 className="font-semibold mb-4">
                Product-wise Pricing
              </h3>

              <div className="space-y-5">
                {rfq.items.map((item) => (
                  <div
                    key={item._id}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 pb-5"
                  >
                    <div>
                      <p className="font-medium">
                        {item.productName}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {item.quantity} {item.unit} required
                      </p>
                      <p className="text-sm text-blue-700 mt-2">
                        Line total:{" "}
                        {formatCurrency(
                          item.quantity *
                            Number(prices[item._id]?.unitPrice || 0)
                        )}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Unit price (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={prices[item._id]?.unitPrice || ""}
                          onChange={(event) =>
                            updateItemPrice(
                              item._id,
                              "unitPrice",
                              event.target.value
                            )
                          }
                          placeholder="Enter unit price"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Item remarks
                        </label>
                        <input
                          type="text"
                          maxLength={1000}
                          value={prices[item._id]?.remarks || ""}
                          onChange={(event) =>
                            updateItemPrice(
                              item._id,
                              "remarks",
                              event.target.value
                            )
                          }
                          placeholder="Optional product remarks"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">
                Commercial Terms
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tax percentage (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={taxPercentage}
                    onChange={(event) =>
                      setTaxPercentage(event.target.value)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Delivery charges (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={deliveryCharges}
                    onChange={(event) =>
                      setDeliveryCharges(event.target.value)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Delivery timeline (days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    required
                    value={deliveryTimeline}
                    onChange={(event) =>
                      setDeliveryTimeline(event.target.value)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quotation validity date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={validityDate}
                    onChange={(event) =>
                      setValidityDate(event.target.value)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium mb-1">
                  Supplier remarks
                </label>
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={supplierRemarks}
                  onChange={(event) =>
                    setSupplierRemarks(event.target.value)
                  }
                  placeholder="Add payment terms, warranty, certifications or other commercial information..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold mb-4">
                Quotation Summary
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Tax ({Number(taxPercentage || 0)}%)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(taxAmount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Delivery charges
                  </span>
                  <span className="font-medium">
                    {formatCurrency(Number(deliveryCharges || 0))}
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between text-lg">
                  <span className="font-bold">Grand Total</span>
                  <span className="font-bold text-blue-700">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("/supplier/rfqs")}
                className="px-5 py-3 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || deadlinePassed || !!successMessage}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Submit Quotation
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <footer className="text-center text-xs text-slate-400 py-8">
          <Clock size={13} className="inline mr-1" />
          SupplySense AI · Secure Supplier Workspace
        </footer>
      </main>
    </div>
  );
}
