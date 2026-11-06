import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Warehouse,
  Truck,
  PackageCheck,
  ClipboardCheck,
  Search,
  RefreshCw,
  AlertCircle,
  Clock3,
  CheckCircle2,
  MapPin,
  CalendarDays,
  Boxes,
  X,
  Save,
  Send,
  Eye,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { apiRequest } from "../../../lib/api";
import DeliveryNotifications from "../../delivery/components/DeliveryNotifications";

type PopulatedRef =
  | string
  | {
      _id?: string;
      poNumber?: string;
      fullName?: string;
      companyName?: string;
      email?: string;
    }
  | null;

type DeliveryItem = {
  rfqItemId: string;
  productName: string;
  orderedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  damagedQuantity?: number;
  missingQuantity?: number;
  acceptedForQcQuantity?: number;
  unit: string;
};

type Delivery = {
  _id: string;
  deliveryNumber: string;
  purchaseOrderId: PopulatedRef;
  supplierId: PopulatedRef;
  items: DeliveryItem[];
  status: string;
  receivingStatus:
    | "pending"
    | "arrived"
    | "receiving_in_progress"
    | "received"
    | "submitted_for_qc";
  expectedDeliveryDate?: string;
  arrivalAt?: string;
  receivedAt?: string;
  vehicleNumber?: string;
  transporterName?: string;
  deliveryAddress?: string;
  trackingNumber?: string;
  challanNumber?: string;
  challanUrl?: string;
  receivingNotes?: string;
  createdAt?: string;
};

type WarehouseResponse = {
  success: boolean;
  message?: string;
  data?: {
    deliveries?: Delivery[];
  };
};

const receivingStatusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  arrived: "bg-blue-50 text-blue-700",
  receiving_in_progress: "bg-amber-50 text-amber-700",
  received: "bg-emerald-50 text-emerald-700",
  submitted_for_qc: "bg-violet-50 text-violet-700",
};

const receivingStatusLabels: Record<string, string> = {
  pending: "Awaiting arrival",
  arrived: "Arrived",
  receiving_in_progress: "Receiving in progress",
  received: "Received",
  submitted_for_qc: "Submitted for QC",
};

function getReferenceLabel(
  value: PopulatedRef,
  fallback: string
): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value.poNumber || value.companyName || value.fullName || value.email || fallback;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function WarehouseDashboard() {
  const location = useLocation();
  const warehouseView = location.pathname.replace(/\/+$/, "") || "/warehouse/dashboard";
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [actionMode, setActionMode] = useState<"arrival" | "receipt" | "view" | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [arrivalChallanNumber, setArrivalChallanNumber] = useState("");
  const [packagingCondition, setPackagingCondition] = useState("unknown");
  const [sealCondition, setSealCondition] = useState("unknown");
  const [actionNotes, setActionNotes] = useState("");
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [receiptDamagedQuantities, setReceiptDamagedQuantities] = useState<Record<string, string>>({});
  const [finalizeReceipt, setFinalizeReceipt] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<WarehouseResponse>(
        "/deliveries/warehouse"
      );

      if (!response.success) {
        throw new Error(response.message || "Unable to load warehouse deliveries.");
      }

      setDeliveries(response.data?.deliveries || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load warehouse deliveries."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deliveries.filter((delivery) => {
      const supplier = getReferenceLabel(delivery.supplierId, "");
      const poNumber = getReferenceLabel(delivery.purchaseOrderId, "");

      const matchesSearch =
        !query ||
        delivery.deliveryNumber?.toLowerCase().includes(query) ||
        supplier.toLowerCase().includes(query) ||
        poNumber.toLowerCase().includes(query) ||
        delivery.vehicleNumber?.toLowerCase().includes(query) ||
        delivery.trackingNumber?.toLowerCase().includes(query) ||
        delivery.items.some((item) => item.productName.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        delivery.receivingStatus === statusFilter;
      const matchesView =
        warehouseView === "/warehouse/incoming-deliveries"
          ? delivery.receivingStatus === "pending"
          : warehouseView === "/warehouse/goods-receiving"
            ? ["arrived", "receiving_in_progress"].includes(delivery.receivingStatus)
            : warehouseView === "/warehouse/qc-handover"
              ? ["received", "submitted_for_qc"].includes(delivery.receivingStatus)
              : true;

      return matchesSearch && matchesStatus && matchesView;
    });
  }, [deliveries, search, statusFilter, warehouseView]);

  const openAction = (
    delivery: Delivery,
    mode: "arrival" | "receipt" | "view"
  ) => {
    setActiveDelivery(delivery);
    setActionMode(mode);
    setVehicleNumber(delivery.vehicleNumber || "");
    setArrivalChallanNumber("");
    setPackagingCondition("unknown");
    setSealCondition("unknown");
    setActionNotes("");
    setFinalizeReceipt(false);
    setActionError("");
    setReceiptQuantities(
      Object.fromEntries(
        delivery.items.map((item) => [
          String(item.rfqItemId),
          String(Math.max(0, item.dispatchedQuantity - item.deliveredQuantity)),
        ])
      )
    );
    setReceiptDamagedQuantities(
      Object.fromEntries(delivery.items.map((item) => [String(item.rfqItemId), "0"]))
    );
  };

  const closeAction = () => {
    if (savingAction) return;
    setActiveDelivery(null);
    setActionMode(null);
    setActionError("");
  };

  const submitWarehouseAction = async () => {
    if (!activeDelivery || !actionMode) return;
    setSavingAction(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (actionMode === "arrival") {
        await apiRequest(
          `/deliveries/${activeDelivery._id}/arrival`,
          {
            method: "PATCH",
            body: JSON.stringify({
              vehicleNumber: vehicleNumber.trim() || undefined,
              challanNumber: arrivalChallanNumber.trim() || undefined,
              packagingCondition,
              sealCondition,
              notes: actionNotes.trim() || undefined,
            }),
          }
        );
        setActionSuccess("Truck arrival recorded successfully.");
      } else {
        const items = activeDelivery.items
          .map((item) => ({
            rfqItemId: String(item.rfqItemId),
            receivedQuantity: Number(receiptQuantities[String(item.rfqItemId)] || 0),
            damagedQuantity: Number(receiptDamagedQuantities[String(item.rfqItemId)] || 0),
          }));

        if (!finalizeReceipt && !items.some((item) => item.receivedQuantity > 0)) {
          throw new Error("Enter at least one received quantity greater than zero.");
        }
        if (items.some((item) => item.damagedQuantity > item.receivedQuantity)) {
          throw new Error("Damaged quantity cannot exceed received quantity.");
        }

        await apiRequest(
          `/deliveries/${activeDelivery._id}/warehouse-receipt`,
          {
            method: "PATCH",
            body: JSON.stringify({
              items,
              finalizeReceipt,
              notes: actionNotes.trim() || undefined,
            }),
          }
        );
        setActionSuccess(finalizeReceipt
          ? "Physical receipt closed. Any outstanding quantities were recorded as missing."
          : "Physical receipt quantities saved successfully.");
      }

      setActiveDelivery(null);
      setActionMode(null);
      await loadDeliveries();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to save warehouse action.");
    } finally {
      setSavingAction(false);
    }
  };

  const submitForQc = async (delivery: Delivery) => {
    setActionError("");
    setActionSuccess("");
    try {
      await apiRequest(`/deliveries/${delivery._id}/submit-for-qc`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setActionSuccess(`${delivery.deliveryNumber} submitted to QC successfully.`);
      await loadDeliveries();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to submit delivery for QC.");
    }
  };

  const stats = useMemo(
    () => ({
      expected: deliveries.filter((item) => item.receivingStatus === "pending").length,
      arrived: deliveries.filter((item) => item.receivingStatus === "arrived").length,
      receiving: deliveries.filter((item) => item.receivingStatus === "receiving_in_progress").length,
      received: deliveries.filter((item) => item.receivingStatus === "received").length,
      submittedForQc: deliveries.filter(
        (item) => item.receivingStatus === "submitted_for_qc"
      ).length,
    }),
    [deliveries]
  );
  const overdueDeliveries = deliveries.filter((delivery) => {
    if (delivery.receivingStatus !== "pending" || !delivery.expectedDeliveryDate) return false;
    const date = new Date(delivery.expectedDeliveryDate);
    return currentTime > 0 && !Number.isNaN(date.getTime()) && date.getTime() < currentTime;
  });
  const upcomingDeliveries = deliveries.filter((delivery) => {
    if (delivery.receivingStatus !== "pending" || !delivery.expectedDeliveryDate) return false;
    const date = new Date(delivery.expectedDeliveryDate);
    const daysAhead = (date.getTime() - currentTime) / 86_400_000;
    return currentTime > 0 && !Number.isNaN(date.getTime()) && daysAhead >= 0 && daysAhead <= 7;
  });

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-col bg-[#111D35] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
            <Boxes size={21} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide">SupplySense AI</p>
            <p className="mt-0.5 text-[10px] text-slate-400">WAREHOUSE OPERATIONS</p>
          </div>
        </div>

        <nav className="space-y-2 px-4 py-7">
          {[
            { path: "/warehouse/dashboard", label: "Warehouse Overview", icon: Warehouse },
            { path: "/warehouse/incoming-deliveries", label: "Incoming Deliveries", icon: Truck },
            { path: "/warehouse/goods-receiving", label: "Goods Receiving", icon: PackageCheck },
            { path: "/warehouse/qc-handover", label: "QC Handover", icon: ClipboardCheck },
            { path: "/inventory/overview", label: "Inventory Overview", icon: Boxes },
            { path: "/inventory/stock", label: "Stock Management", icon: PackageCheck },
            { path: "/inventory/ledger", label: "Inventory Ledger", icon: ClipboardCheck },
          ].map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/warehouse/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 px-6 py-5">
          <p className="text-xs font-semibold">Warehouse Workspace</p>
          <p className="mt-1 text-[10px] text-slate-400">
            Receiving and inspection coordination
          </p>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[250px]">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
          <div>
            <p className="text-xs text-slate-400">Supply chain operations</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Warehouse Management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DeliveryNotifications />
            <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline-flex">
              Warehouse Staff
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              WH
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[27px]">
                {warehouseView === "/warehouse/incoming-deliveries"
                  ? "Incoming Deliveries"
                  : warehouseView === "/warehouse/goods-receiving"
                    ? "Goods Receiving"
                    : warehouseView === "/warehouse/qc-handover"
                      ? "QC Handover"
                      : "Warehouse Overview"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {warehouseView === "/warehouse/incoming-deliveries"
                  ? "Track dispatched supplier shipments and record their physical arrival."
                  : warehouseView === "/warehouse/goods-receiving"
                    ? "Reconcile dispatched quantities against goods physically received."
                    : warehouseView === "/warehouse/qc-handover"
                      ? "Review completed receipts and submit eligible goods to QC."
                      : "Monitor incoming shipments, record physical receipts, and hand over completed deliveries to QC."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDeliveries()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh Deliveries
            </button>
          </section>

          {warehouseView === "/warehouse/dashboard" && <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                title: "Expected Deliveries",
                value: stats.expected,
                description: "Awaiting physical arrival",
                icon: Truck,
                color: "bg-blue-50 text-blue-600",
              },
              {
                title: "Arrived",
                value: stats.arrived,
                description: "Checked in by warehouse",
                icon: Clock3,
                color: "bg-orange-50 text-orange-600",
              },
              {
                title: "Receiving In Progress",
                value: stats.receiving,
                description: "Receipt reconciliation active",
                icon: PackageCheck,
                color: "bg-amber-50 text-amber-600",
              },
              {
                title: "Received",
                value: stats.received,
                description: "Receipt closed",
                icon: CheckCircle2,
                color: "bg-emerald-50 text-emerald-600",
              },
              {
                title: "Awaiting QC",
                value: stats.submittedForQc,
                description: "Handed over to quality team",
                icon: ClipboardCheck,
                color: "bg-violet-50 text-violet-600",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">{item.title}</p>
                    <div className={`rounded-lg p-2.5 ${item.color}`}>
                      <Icon size={19} />
                    </div>
                  </div>
                  <h3 className="text-[27px] font-bold tracking-tight text-slate-900">
                    {item.value.toString().padStart(2, "0")}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </section>}

          {warehouseView === "/warehouse/dashboard" && (overdueDeliveries.length > 0 || upcomingDeliveries.length > 0) && (
            <section className="grid gap-4 lg:grid-cols-2">
              {overdueDeliveries.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h2 className="text-sm font-bold text-red-800">Overdue shipments</h2>
                  <ul className="mt-2 space-y-1">
                    {overdueDeliveries.map((delivery) => (
                      <li key={delivery._id} className="flex justify-between gap-3 text-xs text-red-700">
                        <span>{delivery.deliveryNumber}</span>
                        <span>{formatDate(delivery.expectedDeliveryDate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {upcomingDeliveries.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <h2 className="text-sm font-bold text-blue-800">Expected this week</h2>
                  <ul className="mt-2 space-y-1">
                    {upcomingDeliveries.map((delivery) => (
                      <li key={delivery._id} className="flex justify-between gap-3 text-xs text-blue-700">
                        <span>{delivery.deliveryNumber}</span>
                        <span>{formatDate(delivery.expectedDeliveryDate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Could not load deliveries</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {warehouseView === "/warehouse/goods-receiving"
                    ? "Goods Receiving Queue"
                    : warehouseView === "/warehouse/qc-handover"
                      ? "QC Handover Queue"
                      : "Incoming Deliveries"}
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Live delivery records assigned to your buyer organization
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search delivery, PO, supplier..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-[260px]"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-blue-400"
                >
                  <option value="all">All receiving statuses</option>
                  <option value="pending">Awaiting arrival</option>
                  <option value="arrived">Arrived</option>
                  <option value="receiving_in_progress">Receiving in progress</option>
                  <option value="received">Received</option>
                  <option value="submitted_for_qc">Submitted for QC</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Delivery</th>
                    <th className="px-5 py-4 font-semibold">Purchase Order</th>
                    <th className="px-5 py-4 font-semibold">Supplier</th>
                    <th className="px-5 py-4 font-semibold">Product / Qty</th>
                    <th className="px-5 py-4 font-semibold">Expected Date</th>
                    <th className="px-5 py-4 font-semibold">Carrier / Tracking</th>
                    <th className="px-5 py-4 font-semibold">Receiving Status</th>
                    <th className="px-5 py-4 font-semibold">Shipment</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center text-xs text-slate-400">
                        Loading warehouse deliveries...
                      </td>
                    </tr>
                  ) : filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Warehouse size={20} />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No deliveries found in this queue
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Only shipments assigned to your purchase order&apos;s buyer organization are shown here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveries.map((delivery) => {
                      const received = delivery.items.reduce(
                        (total, item) => total + (item.deliveredQuantity || 0),
                        0
                      );
                      const dispatched = delivery.items.reduce(
                        (total, item) => total + (item.dispatchedQuantity || 0),
                        0
                      );

                      return (
                        <tr key={delivery._id} className="transition hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <p className="text-xs font-bold text-slate-800">
                              {delivery.deliveryNumber}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {delivery.vehicleNumber || "Vehicle not recorded"}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-xs font-medium text-slate-700">
                            {getReferenceLabel(delivery.purchaseOrderId, "PO —")}
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs font-medium text-slate-700">
                              {getReferenceLabel(delivery.supplierId, "Supplier")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {delivery.items.map((item) => (
                              <p key={String(item.rfqItemId)} className="text-xs font-medium text-slate-700">
                                {item.productName} · {item.dispatchedQuantity} {item.unit}
                              </p>
                            ))}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <CalendarDays size={14} className="text-slate-400" />
                              {formatDate(delivery.expectedDeliveryDate)}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs font-medium text-slate-700">{delivery.transporterName || "—"}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{delivery.trackingNumber || "No tracking number"}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{received} / {dispatched} units received</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-semibold ${receivingStatusStyles[delivery.receivingStatus] || "bg-slate-100 text-slate-600"}`}>
                              {receivingStatusLabels[delivery.receivingStatus] || delivery.receivingStatus}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium capitalize text-slate-600">
                              {delivery.status === "delivered" ? (
                                <CheckCircle2 size={13} className="text-emerald-500" />
                              ) : delivery.status === "delayed" ? (
                                <AlertCircle size={13} className="text-red-500" />
                              ) : (
                                <Truck size={13} className="text-blue-500" />
                              )}
                              {delivery.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex min-w-[170px] flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openAction(delivery, "view")}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                <Eye size={12} /> View
                              </button>
                              {delivery.receivingStatus === "pending" &&
                                ["in_transit", "delayed", "partially_delivered"].includes(delivery.status) && (
                                <button
                                  type="button"
                                  onClick={() => openAction(delivery, "arrival")}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-blue-700"
                                >
                                  Record Arrival
                                </button>
                              )}
                              {delivery.receivingStatus === "pending" &&
                                !["in_transit", "delayed", "partially_delivered"].includes(delivery.status) && (
                                  <span className="self-center text-[10px] text-slate-400">Awaiting in-transit status</span>
                                )}
                              {["arrived", "receiving_in_progress"].includes(delivery.receivingStatus) && (
                                <button
                                  type="button"
                                  onClick={() => openAction(delivery, "receipt")}
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-emerald-700"
                                >
                                  Receive Goods
                                </button>
                              )}
                              {delivery.receivingStatus === "received" && (
                                <button
                                  type="button"
                                  onClick={() => void submitForQc(delivery)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-violet-700"
                                >
                                  <Send size={12} /> Submit for QC
                                </button>
                              )}
                              {delivery.receivingStatus === "submitted_for_qc" && (
                                <span className="text-[10px] font-medium text-violet-700">Handed over to QC</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <p className="text-[10px] text-slate-400">
                Showing {filteredDeliveries.length} of {deliveries.length} deliveries
              </p>
              <p className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                <MapPin size={12} />
                Organization-scoped warehouse records
              </p>
            </div>
          </section>

          {(actionError || actionSuccess) && (
            <div className={`rounded-xl border px-4 py-3 text-xs ${actionError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {actionError || actionSuccess}
            </div>
          )}

          {activeDelivery && actionMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">{actionMode === "arrival" ? "Warehouse check-in" : actionMode === "receipt" ? "Physical goods receipt" : "Shipment details"}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{actionMode === "arrival" ? "Record Truck Arrival" : actionMode === "receipt" ? "Receive Goods" : "Delivery Details"}</h2>
                    <p className="mt-1 text-xs text-slate-500">{activeDelivery.deliveryNumber} · {getReferenceLabel(activeDelivery.purchaseOrderId, "PO —")}</p>
                  </div>
                  <button type="button" onClick={closeAction} disabled={savingAction} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
                </div>

                <div className="space-y-5 px-6 py-5">
                  {actionMode === "view" ? (
                    <div className="space-y-5">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["Delivery", activeDelivery.deliveryNumber],
                          ["Purchase Order", getReferenceLabel(activeDelivery.purchaseOrderId, "—")],
                          ["Supplier", getReferenceLabel(activeDelivery.supplierId, "—")],
                          ["Expected delivery", formatDate(activeDelivery.expectedDeliveryDate)],
                          ["Carrier", activeDelivery.transporterName || "—"],
                          ["Tracking number", activeDelivery.trackingNumber || "—"],
                          ["Shipment status", activeDelivery.status.replaceAll("_", " ")],
                          ["Receiving status", receivingStatusLabels[activeDelivery.receivingStatus] || activeDelivery.receivingStatus],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-slate-50 p-3">
                            <dt className="text-[10px] font-semibold uppercase text-slate-400">{label}</dt>
                            <dd className="mt-1 text-xs font-medium text-slate-700">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        {activeDelivery.items.map((item) => (
                          <div key={String(item.rfqItemId)} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
                            <span className="text-xs font-medium text-slate-700">{item.productName}</span>
                            <span className="text-xs text-slate-600">{item.dispatchedQuantity} {item.unit} dispatched · {item.deliveredQuantity} received</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : actionMode === "arrival" ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">Vehicle number</label>
                          <input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="e.g. KA 03 AB 1234" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">Challan number</label>
                          <input value={arrivalChallanNumber} onChange={(event) => setArrivalChallanNumber(event.target.value)} placeholder="Delivery challan reference" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">Packaging condition</label>
                          <select value={packagingCondition} onChange={(event) => setPackagingCondition(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                            <option value="intact">Intact</option>
                            <option value="damaged">Damaged</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-slate-700">Seal condition</label>
                          <select value={sealCondition} onChange={(event) => setSealCondition(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                            <option value="intact">Intact</option>
                            <option value="damaged">Damaged</option>
                            <option value="missing">Missing</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">This confirms the truck has reached the facility. It does not confirm goods receipt or QC acceptance.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3">
                        <h3 className="text-xs font-bold text-slate-800">Received quantity by item</h3>
                        <p className="mt-1 text-[11px] text-slate-400">Enter the quantity physically received in this delivery. Values cannot exceed the outstanding dispatched quantity.</p>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="grid grid-cols-[1fr_65px_65px_90px_90px] gap-2 bg-slate-50 px-3 py-3 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          <span>Product</span><span>Sent</span><span>Received</span><span>This receipt</span><span>Damaged</span>
                        </div>
                        {activeDelivery.items.map((item) => {
                          const remaining = Math.max(0, item.dispatchedQuantity - item.deliveredQuantity);
                          return (
                            <div key={String(item.rfqItemId)} className="grid grid-cols-[1fr_65px_65px_90px_90px] items-center gap-2 border-t border-slate-100 px-3 py-3">
                              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{item.productName}</p><p className="text-[10px] text-slate-400">{item.unit}</p></div>
                              <span className="text-xs text-slate-600">{item.dispatchedQuantity}</span>
                              <span className="text-xs text-slate-600">{item.deliveredQuantity}</span>
                              <input type="number" min={0} max={remaining} step={1} value={receiptQuantities[String(item.rfqItemId)] ?? "0"} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [String(item.rfqItemId)]: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-400" />
                              <input type="number" min={0} max={Number(receiptQuantities[String(item.rfqItemId)] || 0)} step={1} value={receiptDamagedQuantities[String(item.rfqItemId)] ?? "0"} onChange={(event) => setReceiptDamagedQuantities((current) => ({ ...current, [String(item.rfqItemId)]: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-400" />
                              <p className="col-span-5 -mt-1 text-[9px] text-slate-400">Outstanding: {remaining} {item.unit} · Damaged must be included in this receipt's received quantity.</p>
                            </div>
                          );
                        })}
                      </div>
                      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <input type="checkbox" checked={finalizeReceipt} onChange={(event) => setFinalizeReceipt(event.target.checked)} className="mt-0.5" />
                        <span><strong>Close this receipt.</strong> Any dispatched quantity still outstanding will be recorded as missing and will not be sent to QC.</span>
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">Warehouse notes <span className="font-normal text-slate-400">(optional)</span></label>
                    <textarea value={actionNotes} onChange={(event) => setActionNotes(event.target.value)} rows={3} placeholder={actionMode === "arrival" ? "Arrival condition, gate entry, or observations..." : "Packaging condition, shortages, challan mismatch, or observations..."} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>

                  {actionError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p>}
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                  <button type="button" onClick={closeAction} disabled={savingAction} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{actionMode === "view" ? "Close" : "Cancel"}</button>
                  {actionMode !== "view" && (
                    <button type="button" onClick={() => void submitWarehouseAction()} disabled={savingAction} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                      <Save size={14} /> {savingAction ? "Saving..." : actionMode === "arrival" ? "Confirm Arrival" : "Save Received Quantities"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 py-2 text-[10px] text-slate-400">
            <p>© 2026 SupplySense AI. All rights reserved.</p>
            <p>Warehouse & Receiving Management</p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default WarehouseDashboard;
