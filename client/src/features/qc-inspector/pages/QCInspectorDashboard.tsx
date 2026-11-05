
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

type ReceivingStatus =
  | "pending"
  | "arrived"
  | "receiving_in_progress"
  | "received"
  | "submitted_for_qc";

type InspectionStatus = "draft" | "in_progress" | "completed";
type InspectionDecision = "pending" | "passed" | "rejected" | "on_hold";
type SampleResult = "passed" | "defective";

interface PurchaseOrder {
  _id?: string;
  poNumber?: string;
  totalAmount?: number;
  status?: string;
}

interface Supplier {
  _id?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
}

interface DeliveryItem {
  _id?: string;
  productName: string;
  orderedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  unit?: string;
}

interface Delivery {
  _id: string;
  deliveryNumber: string;
  purchaseOrderId?: PurchaseOrder | string;
  supplierId?: Supplier | string;
  items: DeliveryItem[];
  status: string;
  receivingStatus: ReceivingStatus;
  createdAt?: string;
}

interface InspectedUnit {
  productId: string;
  result: SampleResult;
  defectCategory?: string;
  defectDescription?: string;
  evidenceUrls?: string[];
  remarks?: string;
}

interface Inspection {
  _id: string;
  inspectionNumber?: string;
  deliveryId?: Delivery | string;
  purchaseOrderId?: PurchaseOrder | string;
  sampleSize: number;
  totalSampled: number;
  defectiveCount: number;
  passedCount: number;
  status: InspectionStatus;
  decision: InspectionDecision;
  inspectionNotes?: string;
  completedAt?: string;
  createdAt?: string;
}

interface DashboardResponse {
  success: boolean;
  message: string;
  data: {
    pendingDeliveries: Delivery[];
    inspections: Inspection[];
  };
}

const getObject = <T,>(value: T | string | undefined): T | undefined => {
  return typeof value === "object" && value !== null ? value : undefined;
};

const getDeliveryNumber = (value?: Delivery | string) => {
  return getObject(value)?.deliveryNumber || "Delivery";
};

const getPONumber = (value?: PurchaseOrder | string) => {
  return getObject(value)?.poNumber || "—";
};

const getSupplierName = (value?: Supplier | string) => {
  const supplier = getObject(value);
  return supplier?.companyName || supplier?.fullName || "Unknown supplier";
};

const decisionStyles: Record<InspectionDecision, string> = {
  pending: "bg-amber-50 text-amber-700",
  passed: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  on_hold: "bg-slate-100 text-slate-700",
};

const statusStyles: Record<InspectionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
};

export default function QCInspectorDashboard() {
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [sampleSize, setSampleSize] = useState(10);
  const [startingInspection, setStartingInspection] = useState(false);

  const [unitResults, setUnitResults] = useState<InspectedUnit[]>([]);
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [submittingResults, setSubmittingResults] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const fetchDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      setError("");

      const response = await apiRequest<DashboardResponse>(
        "/delivery/qc-inspector"
      );

      setPendingDeliveries(response.data.pendingDeliveries || []);
      setInspections(response.data.inspections || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load QC dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const completedInspections = inspections.filter(
    (inspection) => inspection.status === "completed"
  );

  const passedInspections = inspections.filter(
    (inspection) => inspection.decision === "passed"
  );

  const rejectedInspections = inspections.filter(
    (inspection) => inspection.decision === "rejected"
  );

  const filteredDeliveries = pendingDeliveries.filter((delivery) => {
    const query = search.toLowerCase();

    return (
      delivery.deliveryNumber?.toLowerCase().includes(query) ||
      getPONumber(delivery.purchaseOrderId).toLowerCase().includes(query) ||
      getSupplierName(delivery.supplierId).toLowerCase().includes(query)
    );
  });

  const filteredInspections = inspections.filter((inspection) => {
    const query = search.toLowerCase();

    return (
      inspection.inspectionNumber?.toLowerCase().includes(query) ||
      getDeliveryNumber(inspection.deliveryId).toLowerCase().includes(query) ||
      getPONumber(inspection.purchaseOrderId).toLowerCase().includes(query)
    );
  });

  const startInspection = async () => {
    if (!selectedDelivery) return;

    const totalReceived = selectedDelivery.items.reduce(
      (sum, item) => sum + (item.deliveredQuantity || 0),
      0
    );

    if (sampleSize < 1 || sampleSize > totalReceived) {
      setError(`Sample size must be between 1 and ${totalReceived}.`);
      return;
    }

    try {
      setStartingInspection(true);
      setError("");

      const response = await apiRequest<{
        success: boolean;
        data: { inspection: Inspection };
      }>(`/delivery/${selectedDelivery._id}/inspections`, {
        method: "POST",
        body: JSON.stringify({ sampleSize }),
      });

      const inspection = response.data.inspection;

      setSelectedDelivery(null);
      setSelectedInspection(inspection);

      setUnitResults(
        Array.from({ length: inspection.sampleSize }, () => ({
          productId: "",
          result: "passed" as SampleResult,
          defectCategory: "",
          defectDescription: "",
          evidenceUrls: [],
          remarks: "",
        }))
      );

      setInspectionNotes("");
      await fetchDashboard(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start inspection."
      );
    } finally {
      setStartingInspection(false);
    }
  };

  const updateUnit = (
    index: number,
    field: keyof InspectedUnit,
    value: string | SampleResult
  ) => {
    setUnitResults((previous) =>
      previous.map((unit, i) =>
        i === index ? { ...unit, [field]: value } : unit
      )
    );
  };

  const submitResults = async () => {
    if (!selectedInspection) return;

    const missingId = unitResults.some(
      (unit) => !unit.productId.trim()
    );

    if (missingId) {
      setError("Enter a product ID for every sampled unit.");
      return;
    }

    const duplicateIds =
      new Set(unitResults.map((unit) => unit.productId.trim())).size !==
      unitResults.length;

    if (duplicateIds) {
      setError("Each sampled unit must have a unique product ID.");
      return;
    }

    const missingDefectDetails = unitResults.some(
      (unit) =>
        unit.result === "defective" &&
        !unit.defectCategory?.trim() &&
        !unit.defectDescription?.trim()
    );

    if (missingDefectDetails) {
      setError(
        "For every defective unit, enter a defect category or description."
      );
      return;
    }

    try {
      setSubmittingResults(true);
      setError("");

      const inspectedUnits = unitResults.map((unit) => ({
        productId: unit.productId.trim(),
        result: unit.result,
        ...(unit.result === "defective"
          ? {
              defectCategory: unit.defectCategory,
              defectDescription: unit.defectDescription,
            }
          : {}),
        ...(unit.remarks?.trim()
          ? { remarks: unit.remarks.trim() }
          : {}),
      }));

      await apiRequest(
        `/delivery/inspections/${selectedInspection._id}/results`,
        {
          method: "PATCH",
          body: JSON.stringify({
            inspectedUnits,
            inspectionNotes,
          }),
        }
      );

      setSelectedInspection(null);
      setUnitResults([]);
      setInspectionNotes("");
      setSuccessMessage("Inspection results submitted successfully.");

      await fetchDashboard(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit inspection results."
      );
    } finally {
      setSubmittingResults(false);
    }
  };

  const closeModals = () => {
    setSelectedDelivery(null);
    setSelectedInspection(null);
    setUnitResults([]);
    setInspectionNotes("");
    setError("");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#243B64]" />
          <p className="text-sm font-medium text-slate-500">
            Loading QC dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] text-slate-800">
      {/* Sidebar */}
      <aside className="hidden w-[250px] shrink-0 flex-col bg-[#111D35] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                SupplySense
              </h1>
              <p className="text-xs text-slate-400">AI Procurement Platform</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-6">
          <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">
            Quality Control
          </p>

          <div className="flex items-center gap-3 rounded-xl bg-blue-500/15 px-4 py-3 text-sm font-medium text-blue-300">
            <LayoutDashboard size={18} />
            QC Dashboard
          </div>

          <div className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400">
            <ClipboardCheck size={18} />
            Inspections
          </div>

          <div className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400">
            <Package size={18} />
            Incoming Lots
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
              <FlaskConical size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">QC Inspector</p>
              <p className="text-xs text-slate-400">Quality Team</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <h2 className="text-lg font-bold text-[#17243D]">
              Quality Control
            </h2>
            <p className="hidden text-xs text-slate-500 sm:block">
              Inspect incoming deliveries and manage quality decisions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchDashboard(false)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9EFFB] text-sm font-bold text-[#243B64]">
              QC
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 p-5 sm:p-8">
          {/* Welcome */}
          <section>
            <p className="text-sm font-medium text-[#4169A6]">
              QUALITY OPERATIONS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17243D] sm:text-3xl">
              QC Inspector Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review incoming lots, perform sample inspections and submit
              quality results.
            </p>
          </section>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setError("")}
                className="ml-auto text-red-500"
              >
                <XCircle size={17} />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              {successMessage}
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="ml-auto text-emerald-600"
              >
                <XCircle size={17} />
              </button>
            </div>
          )}

          {/* KPI cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Awaiting Inspection"
              value={pendingDeliveries.length}
              subtitle="Submitted by warehouse"
              icon={<Clock size={20} />}
              iconClass="bg-amber-50 text-amber-600"
            />
            <KpiCard
              title="Completed Inspections"
              value={completedInspections.length}
              subtitle="Total completed"
              icon={<ClipboardCheck size={20} />}
              iconClass="bg-blue-50 text-blue-600"
            />
            <KpiCard
              title="Passed Lots"
              value={passedInspections.length}
              subtitle="QC accepted"
              icon={<CheckCircle2 size={20} />}
              iconClass="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              title="Rejected Lots"
              value={rejectedInspections.length}
              subtitle="Require corrective action"
              icon={<XCircle size={20} />}
              iconClass="bg-red-50 text-red-600"
            />
          </section>

          {/* Main table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-bold text-[#17243D]">
                  Inspection Management
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Manage your QC queue and inspection history
                </p>
              </div>

              <div className="relative w-full sm:max-w-[280px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search delivery, PO, supplier..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex gap-6 border-b border-slate-100 px-5 sm:px-6">
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`border-b-2 py-4 text-sm font-semibold ${
                  activeTab === "queue"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Pending Queue
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                  {pendingDeliveries.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`border-b-2 py-4 text-sm font-semibold ${
                  activeTab === "history"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Inspection History
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                  {inspections.length}
                </span>
              </button>
            </div>

            <div className="overflow-x-auto">
              {activeTab === "queue" ? (
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-[#F8FAFD] text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Delivery</th>
                      <th className="px-6 py-4 font-semibold">Purchase Order</th>
                      <th className="px-6 py-4 font-semibold">Supplier</th>
                      <th className="px-6 py-4 font-semibold">Items</th>
                      <th className="px-6 py-4 font-semibold">Received Qty</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 text-right font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredDeliveries.map((delivery) => {
                      const received = delivery.items.reduce(
                        (sum, item) => sum + (item.deliveredQuantity || 0),
                        0
                      );

                      return (
                        <tr key={delivery._id} className="hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-[#243B64]">
                              {delivery.deliveryNumber}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {getPONumber(delivery.purchaseOrderId)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">
                            {getSupplierName(delivery.supplierId)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {delivery.items.length} items
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                            {received}
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                              Awaiting QC
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDelivery(delivery);
                                setSampleSize(Math.min(10, received));
                                setError("");
                              }}
                              className="rounded-lg bg-[#243B64] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#172B4D]"
                            >
                              Start Inspection
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredDeliveries.length === 0 && (
                      <EmptyTableRow
                        message="No deliveries are currently awaiting inspection."
                      />
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-[#F8FAFD] text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Inspection</th>
                      <th className="px-6 py-4 font-semibold">Delivery</th>
                      <th className="px-6 py-4 font-semibold">Sample Size</th>
                      <th className="px-6 py-4 font-semibold">Passed</th>
                      <th className="px-6 py-4 font-semibold">Defective</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Decision</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredInspections.map((inspection) => (
                      <tr key={inspection._id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 text-sm font-semibold text-[#243B64]">
                          {inspection.inspectionNumber || inspection._id.slice(-8)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getDeliveryNumber(inspection.deliveryId)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {inspection.sampleSize}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                          {inspection.passedCount}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-red-600">
                          {inspection.defectiveCount}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[inspection.status]}`}
                          >
                            {inspection.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${decisionStyles[inspection.decision]}`}
                          >
                            {inspection.decision.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredInspections.length === 0 && (
                      <EmptyTableRow
                        message="No inspection history found."
                      />
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Workflow note */}
          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-blue-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#243B64]">
                  Quality decision is calculated automatically
                </h3>
                <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-600">
                  Record the results for all sampled units. SupplySense AI
                  calculates the final QC decision using the rejection
                  threshold configured by the backend. Inspectors cannot
                  manually override the final decision.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Start inspection modal */}
      {selectedDelivery && (
        <Modal onClose={closeModals} title="Start Quality Inspection">
          <div className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Delivery Number</p>
              <p className="mt-1 font-bold text-[#243B64]">
                {selectedDelivery.deliveryNumber}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                PO: {getPONumber(selectedDelivery.purchaseOrderId)}
              </p>
              <p className="text-sm text-slate-600">
                Supplier: {getSupplierName(selectedDelivery.supplierId)}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Total received:{" "}
                {selectedDelivery.items.reduce(
                  (sum, item) => sum + (item.deliveredQuantity || 0),
                  0
                )}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Sample size
              </label>
              <input
                type="number"
                min={1}
                max={selectedDelivery.items.reduce(
                  (sum, item) => sum + (item.deliveredQuantity || 0),
                  0
                )}
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Choose how many units you want to inspect.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModals}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startInspection}
                disabled={startingInspection}
                className="rounded-lg bg-[#243B64] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172B4D] disabled:opacity-50"
              >
                {startingInspection ? "Starting..." : "Start Inspection"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record sample results modal */}
      {selectedInspection && (
        <Modal
          onClose={closeModals}
          title="Record Inspection Results"
          wide
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm font-bold text-[#243B64]">
                {selectedInspection.inspectionNumber ||
                  `Inspection ${selectedInspection._id.slice(-8)}`}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Record the result for each of the {selectedInspection.sampleSize} sampled units.
              </p>
            </div>

            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {unitResults.map((unit, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#243B64]">
                      Sample Unit {index + 1}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {index + 1} / {unitResults.length}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-slate-600">
                        Product / Unit ID
                      </label>
                      <input
                        value={unit.productId}
                        onChange={(e) =>
                          updateUnit(index, "productId", e.target.value)
                        }
                        placeholder="Enter unique unit ID"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-slate-600">
                        Inspection Result
                      </label>
                      <select
                        value={unit.result}
                        onChange={(e) =>
                          updateUnit(
                            index,
                            "result",
                            e.target.value as SampleResult
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                      >
                        <option value="passed">Passed</option>
                        <option value="defective">Defective</option>
                      </select>
                    </div>

                    {unit.result === "defective" && (
                      <>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-600">
                            Defect Category
                          </label>
                          <input
                            value={unit.defectCategory || ""}
                            onChange={(e) =>
                              updateUnit(index, "defectCategory", e.target.value)
                            }
                            placeholder="e.g. Damaged, Incorrect size"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-600">
                            Defect Description
                          </label>
                          <input
                            value={unit.defectDescription || ""}
                            onChange={(e) =>
                              updateUnit(index, "defectDescription", e.target.value)
                            }
                            placeholder="Describe the defect"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-slate-600">
                        Remarks (optional)
                      </label>
                      <input
                        value={unit.remarks || ""}
                        onChange={(e) =>
                          updateUnit(index, "remarks", e.target.value)
                        }
                        placeholder="Additional observations"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Overall Inspection Notes
              </label>
              <textarea
                rows={3}
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Enter overall observations..."
                className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeModals}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResults}
                disabled={submittingResults}
                className="rounded-lg bg-[#243B64] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172B4D] disabled:opacity-50"
              >
                {submittingResults ? "Submitting..." : "Submit QC Results"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconClass,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-bold tracking-tight text-[#17243D]">
            {value}
          </h3>
          <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function EmptyTableRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={7} className="px-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <FileSearch size={22} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p>
        <p className="mt-1 text-xs text-slate-400">
          New records will appear here when available.
        </p>
      </td>
    </tr>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1730]/60 p-3 backdrop-blur-sm sm:p-6">
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-[#17243D]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <XCircle size={19} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-65px)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
