
import { useState } from "react";
import { apiRequest } from "../../../lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  FileText,
  Package,
  Truck,
  CalendarDays,
  Users,
  Globe,
  Lock,
  Save,
  Send,
  CheckCircle2,
  Info,
  MapPin,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RFQItem {
  id: number;
  productName: string;
  description: string;
  quantity: string;
  unit: string;
  specifications: string;
}

const initialItem: RFQItem = {
  id: 1,
  productName: "",
  description: "",
  quantity: "",
  unit: "Pieces",
  specifications: "",
};

export default function CreateRFQ() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const [items, setItems] = useState<RFQItem[]>([initialItem]);

  const [visibility, setVisibility] = useState<"open" | "invited">("open");
  const [invitedSuppliers, setInvitedSuppliers] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successStatus, setSuccessStatus] = useState<"draft" | "published">("draft");

  const updateItem = (
    id: number,
    field: keyof RFQItem,
    value: string
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        ...initialItem,
        id: Math.max(...current.map((item) => item.id)) + 1,
      },
    ]);
  };

  const removeItem = (id: number) => {
    if (items.length === 1) return;
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!title.trim()) newErrors.push("RFQ title is required.");
    if (!category) newErrors.push("Please select a category.");
    if (!description.trim()) newErrors.push("Description is required.");

    if (items.length === 0) {
      newErrors.push("Add at least one product.");
    }

    items.forEach((item, index) => {
      if (!item.productName.trim()) {
        newErrors.push(`Product ${index + 1}: Product name is required.`);
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        newErrors.push(`Product ${index + 1}: Enter a valid quantity.`);
      }
    });

    if (!deliveryLocation.trim()) {
      newErrors.push("Delivery location is required.");
    }

    if (!deliveryDate) {
      newErrors.push("Expected delivery date is required.");
    }

    if (!deadline) {
      newErrors.push("Quotation deadline is required.");
    } else if (new Date(deadline).getTime() <= Date.now()) {
      newErrors.push("Quotation deadline must be in the future.");
    }

    if (
      deliveryDate &&
      deadline &&
      new Date(deliveryDate) <= new Date(deadline)
    ) {
      newErrors.push(
        "Expected delivery date must be after the quotation deadline."
      );
    }

    if (visibility === "invited" && !invitedSuppliers.trim()) {
      newErrors.push("Enter at least one invited supplier ID.");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (publish: boolean) => {
    if (isSubmitting) return;

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    const rfqData = {
      title: title.trim(),
      category,
      description: description.trim(),
      items: items.map(({ id, ...item }) => ({
        ...item,
        productName: item.productName.trim(),
        description: item.description.trim() || undefined,
        specifications: item.specifications.trim() || undefined,
        category,
        quantity: Number(item.quantity),
      })),
      visibility,
      invitedSuppliers:
        visibility === "invited"
          ? invitedSuppliers.split(",").map((id) => id.trim()).filter(Boolean)
          : [],
      deliveryLocation: deliveryLocation.trim(),
      deliveryDate,
      submissionDeadline: new Date(deadline).toISOString(),
    };

    try {
      // The backend always creates a new RFQ as a draft first.
      const createResponse = await apiRequest<{
        success: boolean;
        message: string;
        data: { rfq: { _id: string } };
      }>("/rfqs", {
        method: "POST",
        body: JSON.stringify(rfqData),
      });

      const createdRfqId = createResponse?.data?.rfq?._id;
      if (!createdRfqId) {
        throw new Error("RFQ was created, but the server did not return its ID.");
      }

      if (publish) {
        // Publish the saved draft using its MongoDB ID.
        await apiRequest<{
          success: boolean;
          message: string;
          data: { rfq: unknown };
        }>(`/rfqs/${createdRfqId}/publish`, {
          method: "PATCH",
          body: JSON.stringify({}),
        });
        setSuccessStatus("published");
      } else {
        setSuccessStatus("draft");
      }

      setShowSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while saving the RFQ.";
      setErrors([
        publish
          ? `RFQ may have been saved as a draft, but publishing failed: ${message}`
          : `Unable to save RFQ: ${message}`,
      ]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center bg-[#F5F7FB] p-5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={32} />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-900">
            {successStatus === "published" ? "RFQ Published Successfully!" : "RFQ Saved as Draft!"}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {successStatus === "published"
              ? "Your RFQ has been saved and published. Eligible suppliers can now view it."
              : "Your RFQ has been saved to the database as a draft. It is not visible to suppliers yet."}
          </p>

          <button
            onClick={() => navigate("/procurement/rfqs")}
            className="mt-7 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Return to RFQ Management
          </button>

          <button
            onClick={() => {
              setShowSuccess(false);
              setErrors([]);
            }}
            className="mt-3 w-full rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Create Another RFQ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1200px] space-y-6 p-5 md:p-8">

        {/* Header */}
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => navigate("/procurement/rfqs")}
              className="hover:text-blue-600"
            >
              RFQ Management
            </button>
            <span>/</span>
            <span className="font-medium text-blue-600">
              Create RFQ
            </span>
          </div>

          <button
            onClick={() => navigate("/procurement/rfqs")}
            className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={15} />
            Back to RFQ Management
          </button>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Create Request for Quotation
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Provide your procurement requirements and invite suppliers.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-700">
              <Info size={15} />
              All fields marked * are required
            </div>
          </div>
        </section>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-red-700">
                Please correct the following:
              </p>
              <button onClick={() => setErrors([])} aria-label="Dismiss errors">
                <X size={16} className="text-red-500" />
              </button>
            </div>
            <ul className="list-inside list-disc space-y-1 text-xs text-red-600">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Basic information */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <FileText size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Basic Information
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Define the purpose of this procurement request.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                RFQ Title <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Procurement of Stainless Steel Sheets"
                maxLength={150}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Procurement Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Select category</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Mechanical Components">Mechanical Components</option>
                <option value="Electrical Materials">Electrical Materials</option>
                <option value="Industrial Equipment">Industrial Equipment</option>
                <option value="Packaging">Packaging Materials</option>
                <option value="Safety Equipment">Safety Equipment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                RFQ Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe the procurement requirements, intended use and any important details..."
                className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-right text-[10px] text-slate-400">
                {description.length}/2000 characters
              </p>
            </div>
          </div>
        </section>

        {/* Product requirements */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-50 p-2.5 text-violet-600">
                <Package size={19} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Product Requirements
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Add products and specify required quantities.
                </p>
              </div>
            </div>

            <button
              onClick={addItem}
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
            >
              <Plus size={15} />
              Add Product
            </button>
          </div>

          <div className="space-y-4 p-5">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                      {index + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-800">
                      Product {index + 1}
                    </h3>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label={`Remove product ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={item.productName}
                      onChange={(e) =>
                        updateItem(item.id, "productName", e.target.value)
                      }
                      placeholder="Enter product name"
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Required Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", e.target.value)
                      }
                      placeholder="Enter quantity"
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Unit
                    </label>
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updateItem(item.id, "unit", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
                    >
                      <option>Pieces</option>
                      <option>Kg</option>
                      <option>Tonnes</option>
                      <option>Litres</option>
                      <option>Metres</option>
                      <option>Sheets</option>
                      <option>Boxes</option>
                      <option>Sets</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Product Description
                    </label>
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      placeholder="Optional description"
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Technical Specifications
                    </label>
                    <input
                      value={item.specifications}
                      onChange={(e) =>
                        updateItem(item.id, "specifications", e.target.value)
                      }
                      placeholder="Grade, dimensions, material, etc."
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Supplier selection */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <Users size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Supplier Selection
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Choose who can participate in this RFQ.
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <button
              type="button"
              onClick={() => setVisibility("open")}
              className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                visibility === "open"
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className={`rounded-lg p-2.5 ${visibility === "open" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                <Globe size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">
                  Open RFQ
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Make this RFQ available to all eligible suppliers on the platform.
                </p>
              </div>
              <span className={`mt-1 h-4 w-4 rounded-full border-2 ${visibility === "open" ? "border-blue-600 bg-blue-600 ring-2 ring-blue-100" : "border-slate-300"}`} />
            </button>

            <button
              type="button"
              onClick={() => setVisibility("invited")}
              className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                visibility === "invited"
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className={`rounded-lg p-2.5 ${visibility === "invited" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                <Lock size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">
                  Invite Selected Suppliers
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Restrict RFQ participation to selected suppliers.
                </p>
              </div>
              <span className={`mt-1 h-4 w-4 rounded-full border-2 ${visibility === "invited" ? "border-blue-600 bg-blue-600 ring-2 ring-blue-100" : "border-slate-300"}`} />
            </button>

            {visibility === "invited" && (
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  Invited Supplier IDs <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={invitedSuppliers}
                  onChange={(e) => setInvitedSuppliers(e.target.value)}
                  rows={3}
                  placeholder="Enter supplier IDs separated by commas"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Demo input only. Supplier discovery and selection will be
                  connected to the supplier directory later.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Delivery requirements */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <div className="rounded-lg bg-orange-50 p-2.5 text-orange-600">
              <Truck size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Delivery Requirements
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Specify where and when the materials are required.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Delivery Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="Enter complete delivery address"
                  className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Quotation Submission Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Additional Instructions
              </label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Mention packaging, transportation, inspection or other requirements..."
                className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Footer actions */}
        <section className="sticky bottom-0 z-20 flex flex-col justify-between gap-3 border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:px-6">
          <p className="text-[11px] text-slate-400">
            Review all details before publishing your RFQ.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/procurement/rfqs")}
              className="rounded-lg border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} />
              {isSubmitting ? "Saving..." : "Save as Draft"}
            </button>

            <button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={15} />
              {isSubmitting ? "Publishing..." : "Publish RFQ"}
              <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <footer className="pb-4 text-center text-[10px] text-slate-400">
          SupplySense AI · Procurement Management Platform
        </footer>
      </div>
    </div>
  );
}
