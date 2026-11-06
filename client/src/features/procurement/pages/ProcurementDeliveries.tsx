
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Eye,
  ClipboardCheck,
  X,
  FileText,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";
import DeliveryNotifications from "../../delivery/components/DeliveryNotifications";

interface PurchaseOrder {
  _id?: string;
  poNumber?: string;
  totalAmount?: number;
  status?: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  createdAt?: string;
  issuedAt?: string;
  acknowledgedAt?: string;
}

interface Supplier {
  _id?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
}

interface UserReference {
  fullName?: string;
  email?: string;
}

interface DeliveryItem {
  _id?: string;
  rfqItemId?: string;
  productName: string;
  orderedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  damagedQuantity?: number;
  missingQuantity?: number;
  acceptedForQcQuantity?: number;
  unit?: string;
}

interface Inspection {
  _id: string;
  inspectionNumber?: string;
  status: string;
  decision: string;
  sampleSize: number;
  passedCount: number;
  defectiveCount: number;
  holdReason?: string;
  inspectionNotes?: string;
  productDispositions?: {
    productId: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    onHoldQuantity: number;
    remarks?: string;
  }[];
  inspectedUnits?: {
    productId: string;
    result: string;
    defectCategory?: string;
    defectDescription?: string;
    severity?: string;
    evidenceUrls?: string[];
    remarks?: string;
  }[];
  history?: { action: string; note?: string; changedAt: string }[];
  completedAt?: string;
}

interface Delivery {
  _id: string;
  deliveryNumber: string;
  purchaseOrderId?: PurchaseOrder | string;
  supplierId?: Supplier | string;
  items: DeliveryItem[];
  status: string;
  expectedDeliveryDate?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  receivingStatus?: string;
  vehicleNumber?: string;
  transporterName?: string;
  trackingNumber?: string;
  challanNumber?: string;
  challanUrl?: string;
  deliveryAddress?: string;
  createdAt?: string;
  arrivalAt?: string;
  receivedAt?: string;
  receivedBy?: UserReference | string;
  arrivalRecordedBy?: UserReference | string;
  arrivalChallanNumber?: string;
  packagingCondition?: string;
  sealCondition?: string;
  arrivalRemarks?: string;
  receivingNotes?: string;
  statusHistory?: { status: string; role: string; note?: string; changedAt: string }[];
  receivingHistory?: { status: string; role: string; note?: string; changedAt: string }[];
  warehouseReceipts?: {
    recordedAt: string;
    notes?: string;
    items: { productName?: string; receivedQuantity: number; damagedQuantity: number; missingQuantity: number; acceptedForQcQuantity: number }[];
  }[];
  inspections?: Inspection[];
  inventoryTransactions?: { productName: string; quantity: number; postedAt: string }[];
  exceptions?: { _id: string; type: string; status: string; reason: string; createdAt: string; resolvedAt?: string; resolutionHistory?: { action: string; note?: string; changedAt: string }[]; items: { productName: string; damagedQuantity: number; missingQuantity: number; rejectedQuantity: number; onHoldQuantity: number }[] }[];
}

interface BuyerDeliveriesResponse {
  success: boolean;
  message: string;
  data: {
    deliveries: Delivery[];
  };
}

const getObject = <T,>(value: T | string | undefined): T | undefined => {
  return typeof value === "object" && value !== null ? value : undefined;
};

const getPO = (delivery: Delivery) =>
  getObject(delivery.purchaseOrderId);

const getSupplier = (delivery: Delivery) =>
  getObject(delivery.supplierId);

const getLatestInspection = (delivery: Delivery) => delivery.inspections?.[0];

const getUserName = (value?: UserReference | string): string => {
  if (typeof value === "string") {
    return value || "—";
  }

  return value?.fullName || value?.email || "—";
};

const shipmentColors: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600",
  dispatched: "bg-blue-50 text-blue-700",
  in_transit: "bg-indigo-50 text-indigo-700",
  delayed: "bg-red-50 text-red-700",
  partially_delivered: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

const receivingColors: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  arrived: "bg-blue-50 text-blue-700",
  receiving_in_progress: "bg-amber-50 text-amber-700",
  received: "bg-emerald-50 text-emerald-700",
  submitted_for_qc: "bg-violet-50 text-violet-700",
};

const formatStatus = (status?: string) => {
  if (!status) return "Not available";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (date?: string) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to retrieve deliveries.";

export default function ProcurementDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null
  );

  const loadDeliveries = useCallback(async () => {
    const response = await apiRequest<BuyerDeliveriesResponse>(
      "/deliveries/buyer"
    );
    return response.data.deliveries || [];
  }, []);

  const fetchDeliveries = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      setError("");
      setDeliveries(await loadDeliveries());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDeliveries]);

  useEffect(() => {
    let active = true;

    const loadInitialDeliveries = async () => {
      try {
        const initialDeliveries = await loadDeliveries();
        if (active) setDeliveries(initialDeliveries);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialDeliveries();

    return () => {
      active = false;
    };
  }, [loadDeliveries]);

  const totalDeliveries = deliveries.length;

  const inTransit = deliveries.filter((delivery) =>
    ["dispatched", "in_transit"].includes(delivery.status)
  ).length;

  const received = deliveries.filter(
    (delivery) =>
      delivery.receivingStatus === "received" ||
      delivery.receivingStatus === "submitted_for_qc"
  ).length;

  const awaitingQC = deliveries.filter(
    (delivery) => delivery.receivingStatus === "submitted_for_qc"
  ).length;
  const qcPassed = deliveries.filter((delivery) =>
    getLatestInspection(delivery)?.decision === "passed"
  ).length;
  const qcRejected = deliveries.filter((delivery) =>
    getLatestInspection(delivery)?.decision === "rejected"
  ).length;
  const delayed = deliveries.filter((delivery) => delivery.status === "delayed").length;

  const filteredDeliveries = useMemo(() => {
    const query = search.toLowerCase();

    return deliveries.filter((delivery) => {
      const supplier = getSupplier(delivery);
      const po = getPO(delivery);

      const matchesSearch =
        delivery.deliveryNumber?.toLowerCase().includes(query) ||
        po?.poNumber?.toLowerCase().includes(query) ||
        supplier?.companyName?.toLowerCase().includes(query) ||
        supplier?.fullName?.toLowerCase().includes(query) ||
        delivery.vehicleNumber?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        delivery.status === statusFilter ||
        delivery.receivingStatus === statusFilter ||
        getLatestInspection(delivery)?.decision === statusFilter;
      const supplierId = typeof delivery.supplierId === "object"
        ? delivery.supplierId?._id
        : delivery.supplierId;
      const matchesSupplier = supplierFilter === "all" || supplierId === supplierFilter;
      const parsedExpectedDate = delivery.expectedDeliveryDate
        ? new Date(delivery.expectedDeliveryDate)
        : null;
      const expectedDate = parsedExpectedDate &&
        !Number.isNaN(parsedExpectedDate.getTime())
        ? parsedExpectedDate.toISOString().slice(0, 10)
        : "";
      const matchesDateFrom = !dateFrom || (expectedDate && expectedDate >= dateFrom);
      const matchesDateTo = !dateTo || (expectedDate && expectedDate <= dateTo);

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateFrom && matchesDateTo;
    });
  }, [deliveries, search, statusFilter, supplierFilter, dateFrom, dateTo]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDeliveries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageDeliveries = filteredDeliveries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">
            Loading procurement deliveries...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800">
      <main className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">

        {/* Page heading */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
              Procurement Workspace / Deliveries
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">
              Delivery Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor incoming shipments, goods receipt and quality inspection progress.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DeliveryNotifications />
            <button
              type="button"
              onClick={() => fetchDeliveries(false)}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* KPI cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total Deliveries"
            value={totalDeliveries}
            description="All recorded deliveries"
            icon={<Package size={20} />}
            color="blue"
          />

          <KpiCard
            title="In Transit"
            value={inTransit}
            description="Shipments on the way"
            icon={<Truck size={20} />}
            color="violet"
          />

          <KpiCard
            title="Goods Received"
            value={received}
            description="Physically received or handed to QC"
            icon={<CheckCircle2 size={20} />}
            color="green"
          />

          <KpiCard
            title="Awaiting QC"
            value={awaitingQC}
            description="Submitted by warehouse"
            icon={<ClipboardCheck size={20} />}
            color="orange"
          />
          <KpiCard
            title="QC Passed"
            value={qcPassed}
            description="At least one completed inspection passed"
            icon={<CheckCircle2 size={20} />}
            color="green"
          />
          <KpiCard
            title="QC Rejected"
            value={qcRejected}
            description="Requires exception handling"
            icon={<AlertCircle size={20} />}
            color="orange"
          />
          <KpiCard
            title="Delayed"
            value={delayed}
            description="Shipment marked delayed"
            icon={<AlertCircle size={20} />}
            color="violet"
          />
        </section>

        {/* Delivery table */}
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                All Deliveries
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Track shipments and receiving progress
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search delivery, PO, supplier..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 sm:w-[260px]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-400"
              >
                <option value="all">All statuses</option>
                <option value="planned">Planned</option>
                <option value="dispatched">Dispatched</option>
                <option value="in_transit">In Transit</option>
                <option value="delayed">Delayed</option>
                <option value="partially_delivered">Partially Delivered</option>
                <option value="delivered">Delivered</option>
                <option value="arrived">Warehouse Arrived</option>
                <option value="receiving_in_progress">Receiving In Progress</option>
                <option value="received">Goods Received</option>
                <option value="submitted_for_qc">Awaiting QC</option>
                <option value="passed">QC Passed</option>
                <option value="rejected">QC Rejected</option>
                <option value="on_hold">QC On Hold</option>
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-400"
              >
                <option value="all">All suppliers</option>
                {[...new Map(deliveries.map((delivery) => {
                  const supplier = getSupplier(delivery);
                  return [supplier?._id || "", supplier?.companyName || supplier?.fullName || "Supplier"];
                })).entries()].filter(([id]) => id).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
                From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs text-slate-700 outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
                To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs text-slate-700 outline-none" />
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Delivery Details</th>
                  <th className="px-5 py-4 font-semibold">Purchase Order</th>
                  <th className="px-5 py-4 font-semibold">Supplier</th>
                  <th className="px-5 py-4 font-semibold">Expected Date</th>
                  <th className="px-5 py-4 font-semibold">Shipment Status</th>
                  <th className="px-5 py-4 font-semibold">Receiving Status</th>
                  <th className="px-5 py-4 font-semibold">QC Status</th>
                  <th className="px-5 py-4 font-semibold">Items</th>
                  <th className="px-5 py-4 font-semibold">Created</th>
                  <th className="px-5 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pageDeliveries.map((delivery) => {
                  const supplier = getSupplier(delivery);
                  const po = getPO(delivery);

                  return (
                    <tr
                      key={delivery._id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-[#243B64]">
                          {delivery.deliveryNumber}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {delivery.trackingNumber || "No tracking number"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(delivery.expectedDeliveryDate)}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-700">
                          {po?.poNumber || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {getLatestInspection(delivery)
                          ? <StatusBadge status={getLatestInspection(delivery)!.decision} styles={{
                              pending: "bg-slate-100 text-slate-600",
                              passed: "bg-emerald-50 text-emerald-700",
                              rejected: "bg-red-50 text-red-700",
                              on_hold: "bg-amber-50 text-amber-700",
                            }} />
                          : <span className="text-[10px] text-slate-400">Not inspected</span>}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-700">
                          {supplier?.companyName || supplier?.fullName || "—"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {supplier?.email || ""}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={delivery.status}
                          styles={shipmentColors}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={delivery.receivingStatus || "pending"}
                          styles={receivingColors}
                        />
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {delivery.items?.length || 0} items
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(delivery.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedDelivery(delivery)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Truck size={23} />
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        No deliveries found
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Deliveries will appear here when suppliers create them.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <p className="text-[11px] text-slate-400">
              Showing {pageDeliveries.length} of {filteredDeliveries.length} matching deliveries
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, Math.min(current, totalPages) - 1))} className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] disabled:opacity-40">Previous</button>
              <span className="text-[11px] text-slate-500">Page {currentPage} of {totalPages}</span>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, Math.min(current, totalPages) + 1))} className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>

        {/* Workflow information */}
        <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex items-start gap-3">
            <ClipboardCheck size={21} className="mt-0.5 text-blue-700" />
            <div>
              <h3 className="text-sm font-bold text-[#243B64]">
                Delivery and Quality Control Workflow
              </h3>
              <p className="mt-1 text-xs leading-6 text-slate-600">
                Procurement can monitor shipment progress, warehouse receipt
                and QC handover. Physical receipt and quality acceptance are
                separate stages. A delivery submitted for QC has not yet
                necessarily passed inspection.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-2 py-2 text-[10px] text-slate-400">
          <p>© 2026 SupplySense AI. All rights reserved.</p>
          <p>Procurement Management Platform</p>
        </footer>
      </main>

      {/* Delivery details modal */}
      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onRefresh={() => fetchDeliveries(false)}
        />
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon,
  color,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2.5 ${colors[color]}`}>
          {icon}
        </div>
      </div>

      <h3 className="text-[27px] font-bold tracking-tight text-slate-900">
        {value}
      </h3>

      <p className="mt-1 text-[10px] text-slate-400">{description}</p>
    </div>
  );
}

function StatusBadge({
  status,
  styles,
}: {
  status: string;
  styles: Record<string, string>;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-semibold ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function DeliveryDetailsModal({
  delivery,
  onClose,
  onRefresh,
}: {
  delivery: Delivery;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [resolvingExceptionId, setResolvingExceptionId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolutionError, setResolutionError] = useState("");
  const supplier = getSupplier(delivery);
  const po = getPO(delivery);

  const totalOrdered = delivery.items.reduce(
    (sum, item) => sum + (item.orderedQuantity || 0),
    0
  );

  const totalDispatched = delivery.items.reduce(
    (sum, item) => sum + (item.dispatchedQuantity || 0),
    0
  );

  const totalReceived = delivery.items.reduce(
    (sum, item) => sum + (item.deliveredQuantity || 0),
    0
  );
  const totalDamaged = delivery.items.reduce(
    (sum, item) => sum + (item.damagedQuantity || 0),
    0
  );
  const totalMissing = delivery.items.reduce(
    (sum, item) => sum + (item.missingQuantity || 0),
    0
  );
  const latestInspection = getLatestInspection(delivery);
  const timeline = [
    ...(po?.createdAt ? [{
      date: po.createdAt,
      title: "Purchase order created",
      detail: po.poNumber || "Purchase order",
    }] : []),
    ...(po?.issuedAt ? [{
      date: po.issuedAt,
      title: "Purchase order issued",
      detail: po.poNumber || "Purchase order",
    }] : []),
    ...(po?.acknowledgedAt ? [{
      date: po.acknowledgedAt,
      title: "Supplier acknowledged purchase order",
      detail: po.poNumber || "Purchase order",
    }] : []),
    ...(delivery.createdAt ? [{
      date: delivery.createdAt,
      title: "Delivery record created",
      detail: delivery.deliveryNumber,
    }] : []),
    ...(delivery.statusHistory || []).map((event) => ({
      date: event.changedAt,
      title: `Shipment ${formatStatus(event.status)}`,
      detail: event.note || `Updated by ${event.role}.`,
    })),
    ...(delivery.receivingHistory || []).map((event) => ({
      date: event.changedAt,
      title: `Receiving ${formatStatus(event.status)}`,
      detail: event.note || `Updated by ${event.role}.`,
    })),
    ...(delivery.warehouseReceipts || []).map((receipt) => ({
      date: receipt.recordedAt,
      title: "Warehouse goods receipt recorded",
      detail: receipt.notes || `${receipt.items.length} product lines reconciled.`,
    })),
    ...(delivery.inspections || []).flatMap((inspection) =>
      (inspection.history || []).map((event) => ({
        date: event.changedAt,
        title: formatStatus(event.action),
        detail: event.note || inspection.inspectionNumber || "QC activity",
      }))
    ),
    ...(delivery.inventoryTransactions || []).map((entry) => ({
      date: entry.postedAt,
      title: "QC-accepted stock posted",
      detail: `${entry.productName}: ${entry.quantity}`,
    })),
    ...(delivery.exceptions || []).map((exception) => ({
      date: exception.createdAt,
      title: `Exception: ${formatStatus(exception.type)}`,
      detail: exception.reason,
    })),
    ...(delivery.exceptions || []).flatMap((exception) =>
      (exception.resolutionHistory || []).map((event) => ({
        date: event.changedAt,
        title: `Exception ${formatStatus(event.action)}`,
        detail: event.note || exception.type,
      }))
    ),
  ].filter((event) => !Number.isNaN(new Date(event.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const resolveException = async (exceptionId: string) => {
    try {
      setResolvingExceptionId(exceptionId);
      setResolutionError("");
      await apiRequest(`/deliveries/exceptions/${exceptionId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ note: resolutionNotes[exceptionId]?.trim() || undefined }),
      });
      onRefresh();
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : "Unable to resolve exception.");
    } finally {
      setResolvingExceptionId("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
              Delivery Details
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#17243D]">
              {delivery.deliveryNumber}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Basic details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Purchase Order" value={po?.poNumber} />
            <Detail label="PO Status" value={po?.status ? formatStatus(po.status) : undefined} />
            <Detail label="PO Value" value={po?.totalAmount ? formatCurrency(po.totalAmount) : undefined} />
            <Detail label="PO Delivery Deadline" value={formatDate(po?.deliveryDate)} />
            <Detail
              label="Supplier"
              value={supplier?.companyName || supplier?.fullName}
            />
            <Detail label="Supplier Email" value={supplier?.email} />
            <Detail label="Vehicle Number" value={delivery.vehicleNumber} />
            <Detail label="Transporter" value={delivery.transporterName} />
            <Detail label="Tracking Number" value={delivery.trackingNumber} />
            <Detail label="Delivery Challan" value={delivery.challanNumber} />
            <Detail label="Expected Arrival" value={formatDate(delivery.expectedDeliveryDate)} />
            <Detail label="Dispatched On" value={formatDate(delivery.dispatchedAt)} />
            <Detail label="Delivered On" value={formatDate(delivery.deliveredAt)} />
            <Detail label="Created On" value={formatDate(delivery.createdAt)} />
            <Detail label="Arrival Date" value={formatDate(delivery.arrivalAt)} />
            <Detail label="Arrival Recorded By" value={getUserName(delivery.arrivalRecordedBy)} />
            <Detail label="Arrival Challan" value={delivery.arrivalChallanNumber} />
            <Detail label="Packaging Condition" value={delivery.packagingCondition ? formatStatus(delivery.packagingCondition) : undefined} />
            <Detail label="Seal Condition" value={delivery.sealCondition ? formatStatus(delivery.sealCondition) : undefined} />
            <Detail label="Received Date" value={formatDate(delivery.receivedAt)} />
            <Detail label="Received By" value={getUserName(delivery.receivedBy)} />
            <Detail label="Warehouse Notes" value={delivery.receivingNotes} />
            <Detail label="Delivery Address" value={delivery.deliveryAddress} />
            <Detail label="PO Payment Terms" value={po?.paymentTerms} />
            <Detail label="PO Shipping Address" value={po?.deliveryLocation} />
          </div>
          {delivery.challanUrl && (
            <a href={delivery.challanUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs font-semibold text-blue-700 underline">
              Open delivery challan document
            </a>
          )}

          {/* Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">
                Shipment Status
              </p>
              <StatusBadge
                status={delivery.status}
                styles={shipmentColors}
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">
                Warehouse Receiving Status
              </p>
              <StatusBadge
                status={delivery.receivingStatus || "pending"}
                styles={receivingColors}
              />
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <QuantityCard label="Ordered" value={totalOrdered} />
            <QuantityCard label="Dispatched" value={totalDispatched} />
            <QuantityCard label="Received" value={totalReceived} />
            <QuantityCard label="Damaged" value={totalDamaged} />
            <QuantityCard label="Missing" value={totalMissing} />
          </div>

          {/* Items */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText size={17} className="text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Delivery Items
              </h3>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[550px] text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Ordered</th>
                    <th className="px-4 py-3">Dispatched</th>
                    <th className="px-4 py-3">Received</th>
                    <th className="px-4 py-3">Damaged</th>
                    <th className="px-4 py-3">Missing</th>
                    <th className="px-4 py-3">QC Eligible</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {delivery.items.map((item, index) => (
                    <tr key={item._id || index}>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                        {item.productName}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.orderedQuantity} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.dispatchedQuantity} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-emerald-700">
                        {item.deliveredQuantity} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600">
                        {item.damagedQuantity || 0} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-amber-700">
                        {item.missingQuantity || 0} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-700">
                        {item.acceptedForQcQuantity ?? Math.max(0, item.deliveredQuantity - (item.damagedQuantity || 0))} {item.unit || ""}
                      </td>
                    </tr>
                  ))}

                  {delivery.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-xs text-slate-400"
                      >
                        No delivery items available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {latestInspection && (
            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Latest inspection</p>
                  <h3 className="mt-1 text-sm font-bold text-slate-800">{latestInspection.inspectionNumber || "Inspection"}</h3>
                  <p className="mt-1 text-xs text-slate-500">{latestInspection.sampleSize} sampled · {latestInspection.passedCount} passed · {latestInspection.defectiveCount} defective</p>
                </div>
                <StatusBadge status={latestInspection.decision} styles={{
                  pending: "bg-slate-100 text-slate-600",
                  passed: "bg-emerald-50 text-emerald-700",
                  rejected: "bg-red-50 text-red-700",
                  on_hold: "bg-amber-50 text-amber-700",
                }} />
              </div>
              {latestInspection.holdReason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Hold reason: {latestInspection.holdReason}</p>}
              {latestInspection.inspectionNotes && <p className="mt-3 text-xs text-slate-600">Inspector notes: {latestInspection.inspectionNotes}</p>}
              {latestInspection.productDispositions?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase text-slate-400"><tr><th className="py-2">Product</th><th>Accepted</th><th>Rejected</th><th>On hold</th></tr></thead>
                    <tbody>{latestInspection.productDispositions.map((entry) => {
                      const productName = delivery.items.find((item) =>
                        String(item.rfqItemId) === entry.productId
                      )?.productName || entry.productId;
                      return <tr key={entry.productId} className="border-t border-slate-100"><td className="py-2">{productName}</td><td>{entry.acceptedQuantity}</td><td>{entry.rejectedQuantity}</td><td>{entry.onHoldQuantity}</td></tr>;
                    })}</tbody>
                  </table>
                </div>
              ) : null}
              {latestInspection.inspectedUnits?.flatMap((unit) => unit.evidenceUrls || []).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-2 mr-3 inline-block text-xs text-blue-700 underline">Open QC evidence</a>
              ))}
            </section>
          )}

          {delivery.exceptions?.length ? (
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800">Delivery exceptions</h3>
              {delivery.exceptions.map((exception) => (
                <div key={exception._id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">{formatStatus(exception.type)} · {formatStatus(exception.status)}</p>
                  <p className="mt-1 text-xs text-amber-800">{exception.reason}</p>
                  <p className="mt-1 text-[10px] text-amber-700">{exception.items.map((item) => `${item.productName}: ${item.damagedQuantity} damaged, ${item.missingQuantity} missing, ${item.rejectedQuantity} QC rejected, ${item.onHoldQuantity} on hold`).join(" · ")}</p>
                  {exception.resolvedAt && <p className="mt-2 text-[10px] text-emerald-700">Resolved on {formatDate(exception.resolvedAt)}</p>}
                  {exception.status === "open" && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={resolutionNotes[exception._id] || ""}
                        onChange={(event) => setResolutionNotes((current) => ({
                          ...current,
                          [exception._id]: event.target.value,
                        }))}
                        placeholder="Resolution note (optional)"
                        className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        disabled={resolvingExceptionId === exception._id}
                        onClick={() => void resolveException(exception._id)}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
                      >
                        {resolvingExceptionId === exception._id ? "Saving..." : "Resolve tracking record"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {resolutionError && <p className="text-xs text-red-700">{resolutionError}</p>}
            </section>
          ) : null}

          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-800">Activity timeline</h3>
            {timeline.length ? (
              <ol className="space-y-3">
                {timeline.map((event, index) => (
                  <li key={`${event.title}-${event.date}-${index}`} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
                      <time className="mt-1 block text-[10px] text-slate-400">{new Date(event.date).toLocaleString()}</time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="text-xs text-slate-400">No persisted workflow events.</p>}
          </section>

          {delivery.inventoryTransactions?.length ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-bold text-emerald-900">Inventory ledger</h3>
              <ul className="mt-2 space-y-1 text-xs text-emerald-800">
                {delivery.inventoryTransactions.map((entry, index) => <li key={`${entry.productName}-${entry.postedAt}-${index}`}>{entry.productName}: {entry.quantity} posted on {formatDate(entry.postedAt)}</li>)}
              </ul>
            </section>
          ) : null}

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <ClipboardCheck
                size={18}
                className="mt-0.5 shrink-0 text-blue-700"
              />
              <div>
                <p className="text-xs font-bold text-blue-900">
                  Quality inspection tracking
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  {delivery.receivingStatus === "submitted_for_qc"
                    ? "Warehouse has submitted this delivery for quality inspection. The final QC decision is maintained separately from physical receipt."
                    : delivery.receivingStatus === "received"
                      ? "Goods have been physically received. The delivery has not yet been marked as submitted for QC."
                      : "Procurement can monitor the receiving process. The warehouse team is responsible for recording physical quantities."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#243B64] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#172B4D]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-medium text-slate-700">
        {value || "—"}
      </p>
    </div>
  );
}

function QuantityCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#243B64]">{value}</p>
    </div>
  );
}
