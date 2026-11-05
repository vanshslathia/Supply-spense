import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  RefreshCw,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  FileText,
  MapPin,
  CalendarDays,
  ChevronRight,
  Package,
  AlertCircle,
  Loader2,
  Send,
  X,
  PackageCheck,
  CircleAlert,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

type POStatus =
  | "draft"
  | "issued"
  | "acknowledged"
  | "rejected"
  | "in_progress"
  | "partially_delivered"
  | "delivered"
  | "cancelled";

type DeliveryStatus =
  | "planned"
  | "dispatched"
  | "in_transit"
  | "partially_delivered"
  | "delivered"
  | "delayed"
  | "cancelled";

interface Supplier {
  _id: string;
  fullName: string;
  email: string;
  companyName?: string;
}

interface RFQ {
  _id: string;
  rfqNumber?: string;
  title?: string;
}

interface Quotation {
  _id: string;
  quotationNumber?: string;
  status?: string;
}

interface POItem {
  rfqItemId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: Supplier;
  rfqId: RFQ;
  quotationId: Quotation;
  items: POItem[];
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  deliveryCharges: number;
  totalAmount: number;
  deliveryLocation: string;
  deliveryDate: string;
  deliveryTimeline: number;
  paymentTerms?: string;
  notes?: string;
  status: POStatus;
  issuedAt?: string;
  acknowledgedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseOrderResponse {
  success: boolean;
  count: number;
  data: {
    purchaseOrders: PurchaseOrder[];
  };
}

interface DeliveryItem {
  rfqItemId: string;
  productName: string;
  orderedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  unit: string;
}

interface DeliveryHistory {
  status: DeliveryStatus;
  note?: string;
  changedAt: string;
  role?: string;
}

interface Delivery {
  _id: string;
  deliveryNumber: string;
  purchaseOrderId:
    | string
    | {
        _id: string;
        poNumber: string;
      };
  supplierId?: Supplier;
  items: DeliveryItem[];
  trackingNumber?: string;
  transporterName?: string;
  vehicleNumber?: string;
  deliveryAddress?: string;
  expectedDeliveryDate: string;
  status: DeliveryStatus;
  statusHistory: DeliveryHistory[];
  notes?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface BuyerDeliveriesResponse {
  success: boolean;
  message?: string;
  data: {
    deliveries: Delivery[];
  };
}

const statusConfig: Record<
  POStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700",
  },
  issued: {
    label: "Issued",
    className: "bg-blue-100 text-blue-700",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-emerald-100 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-indigo-100 text-indigo-700",
  },
  partially_delivered: {
    label: "Partially Delivered",
    className: "bg-amber-100 text-amber-700",
  },
  delivered: {
    label: "Delivered",
    className: "bg-green-100 text-green-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700",
  },
};

const deliveryStatusConfig: Record<
  DeliveryStatus,
  { label: string; className: string }
> = {
  planned: {
    label: "Planned",
    className: "bg-slate-100 text-slate-700",
  },
  dispatched: {
    label: "Dispatched",
    className: "bg-blue-100 text-blue-700",
  },
  in_transit: {
    label: "In Transit",
    className: "bg-indigo-100 text-indigo-700",
  },
  partially_delivered: {
    label: "Partially Delivered",
    className: "bg-amber-100 text-amber-700",
  },
  delivered: {
    label: "Delivered",
    className: "bg-green-100 text-green-700",
  },
  delayed: {
    label: "Delayed",
    className: "bg-red-100 text-red-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700",
  },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (date?: string) => {
  if (!date) return "Not specified";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not specified";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date?: string) => {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDeliveryPOId = (delivery: Delivery): string => {
  return typeof delivery.purchaseOrderId === "string"
    ? delivery.purchaseOrderId
    : delivery.purchaseOrderId?._id || "";
};

const PurchaseOrders = () => {
  const navigate = useNavigate();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const [issuingPOId, setIssuingPOId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<
    Record<string, string>
  >({});
  const [confirmingDeliveryId, setConfirmingDeliveryId] = useState<
    string | null
  >(null);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSuccess, setReceiptSuccess] = useState("");

  // Fetch purchase orders
  const fetchPurchaseOrders = useCallback(async (showRefresh = false): Promise<PurchaseOrder[]> => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response =
        await apiRequest<PurchaseOrderResponse>("/purchase-orders");

      const orders = response.data?.purchaseOrders || [];
      setPurchaseOrders(orders);
      return orders;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load purchase orders."
      );
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch buyer deliveries
  const fetchBuyerDeliveries = useCallback(async () => {
    try {
      setDeliveryLoading(true);
      setDeliveryError("");

      const response =
        await apiRequest<BuyerDeliveriesResponse>("/deliveries/buyer");

      setDeliveries(response.data?.deliveries || []);
    } catch (err) {
      setDeliveryError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery information."
      );
    } finally {
      setDeliveryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  useEffect(() => {
    void fetchBuyerDeliveries();
  }, [fetchBuyerDeliveries]);

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const supplierName =
        po.supplierId?.companyName ||
        po.supplierId?.fullName ||
        "";

      const searchValue = search.toLowerCase();

      const matchesSearch =
        po.poNumber?.toLowerCase().includes(searchValue) ||
        supplierName.toLowerCase().includes(searchValue) ||
        po.supplierId?.email?.toLowerCase().includes(searchValue) ||
        po.rfqId?.rfqNumber?.toLowerCase().includes(searchValue) ||
        po.rfqId?.title?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || po.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, search, statusFilter]);

  // Statistics
  const statistics = useMemo(() => {
    const totalValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.totalAmount || 0),
      0
    );

    return {
      total: purchaseOrders.length,
      draft: purchaseOrders.filter((po) => po.status === "draft").length,
      issued: purchaseOrders.filter((po) => po.status === "issued").length,
      acknowledged: purchaseOrders.filter(
        (po) => po.status === "acknowledged"
      ).length,
      delivered: purchaseOrders.filter(
        (po) => po.status === "delivered"
      ).length,
      partiallyDelivered: purchaseOrders.filter(
        (po) => po.status === "partially_delivered"
      ).length,
      totalValue,
    };
  }, [purchaseOrders]);

  // Issue purchase order
  const handleIssuePO = async (po: PurchaseOrder) => {
    const confirmed = window.confirm(
      `Are you sure you want to issue purchase order ${po.poNumber}?`
    );

    if (!confirmed) return;

    try {
      setIssuingPOId(po._id);
      setActionError("");

      await apiRequest(`/purchase-orders/${po._id}/issue`, {
        method: "PATCH",
      });

      await fetchPurchaseOrders(true);

      setSelectedPO((current) =>
        current?._id === po._id
          ? { ...current, status: "issued" }
          : current
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to issue purchase order."
      );
    } finally {
      setIssuingPOId(null);
    }
  };

  // Confirm quantities received by procurement
  const handleConfirmReceipt = async (delivery: Delivery) => {
    try {
      setConfirmingDeliveryId(delivery._id);
      setReceiptError("");
      setReceiptSuccess("");

      const itemsToReceive = delivery.items.map((item) => {
        const key = `${delivery._id}:${item.rfqItemId}`;
        const rawValue = receivedQuantities[key] ?? "";
        const receivedQuantity =
          rawValue.trim() === "" ? 0 : Number(rawValue);
        const remainingQuantity = Math.max(
          0,
          item.dispatchedQuantity - item.deliveredQuantity
        );

        return {
          rfqItemId: item.rfqItemId,
          productName: item.productName,
          receivedQuantity,
          remainingQuantity,
        };
      });

      for (const item of itemsToReceive) {
        if (!Number.isFinite(item.receivedQuantity) || item.receivedQuantity < 0) {
          throw new Error(
            `Enter a valid received quantity for ${item.productName}.`
          );
        }

        if (item.receivedQuantity > item.remainingQuantity) {
          throw new Error(
            `Received quantity for ${item.productName} cannot exceed ${item.remainingQuantity}.`
          );
        }
      }

      const items = itemsToReceive
        .filter((item) => item.receivedQuantity > 0)
        .map(({ rfqItemId, receivedQuantity }) => ({
          rfqItemId,
          receivedQuantity,
        }));

      if (items.length === 0) {
        throw new Error("Enter at least one quantity received.");
      }

      await apiRequest(`/deliveries/${delivery._id}/confirm-receipt`, {
        method: "PATCH",
        body: JSON.stringify({ items }),
      });

      setReceivedQuantities((current) => {
        const updated = { ...current };
        delivery.items.forEach((item) => {
          delete updated[`${delivery._id}:${item.rfqItemId}`];
        });
        return updated;
      });

      const [updatedOrders] = await Promise.all([
        fetchPurchaseOrders(true),
        fetchBuyerDeliveries(),
      ]);

      const updatedPO = updatedOrders.find(
        (po) => po._id === getDeliveryPOId(delivery)
      );

      if (updatedPO) {
        setSelectedPO(updatedPO);
      }

      setReceiptSuccess(
        `Receipt confirmed successfully for ${delivery.deliveryNumber}.`
      );
    } catch (err) {
      setReceiptError(
        err instanceof Error
          ? err.message
          : "Unable to confirm delivery receipt."
      );
    } finally {
      setConfirmingDeliveryId(null);
    }
  };

  // Statistics card
  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
  }: {
    title: string;
    value: string | number;
    icon: typeof ShoppingCart;
    color: string;
    subtitle?: string;
  }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon size={19} />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );

  // Delivery progress component
  const DeliveryProgress = ({
    purchaseOrder,
  }: {
    purchaseOrder: PurchaseOrder;
  }) => {
    const poDeliveries = deliveries.filter(
      (delivery) => getDeliveryPOId(delivery) === purchaseOrder._id
    );

    const activeDeliveries = poDeliveries.filter(
      (delivery) => delivery.status !== "cancelled"
    );

    const totalOrdered = purchaseOrder.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const totalDispatched = activeDeliveries.reduce(
      (sum, delivery) =>
        sum +
        delivery.items.reduce(
          (itemSum, item) => itemSum + item.dispatchedQuantity,
          0
        ),
      0
    );

    const totalDelivered = activeDeliveries.reduce(
      (sum, delivery) =>
        sum +
        delivery.items.reduce(
          (itemSum, item) => itemSum + item.deliveredQuantity,
          0
        ),
      0
    );

    const totalPending = Math.max(0, totalOrdered - totalDelivered);

    const progress =
      totalOrdered > 0
        ? Math.min(100, (totalDelivered / totalOrdered) * 100)
        : 0;

    return (
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">
            Delivery Progress
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Track dispatched and procurement-confirmed quantities.
          </p>
        </div>

        {deliveryLoading ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading delivery information...
          </div>
        ) : deliveryError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <CircleAlert size={18} className="shrink-0" />
              <div>
                <p>{deliveryError}</p>
                <button
                  onClick={() => void fetchBuyerDeliveries()}
                  className="mt-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : poDeliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Truck size={30} className="mx-auto text-slate-400" />

            <p className="mt-3 font-semibold text-slate-800">
              No deliveries created yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Delivery records will appear here once the supplier creates a
              shipment.
            </p>
          </div>
        ) : (
          <>
            {/* Overall delivery progress */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Overall Delivery Progress
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Based on confirmed received quantity
                  </p>
                </div>

                <span className="text-xl font-bold text-blue-600">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Ordered</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {totalOrdered}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Dispatched</p>
                  <p className="mt-1 font-bold text-blue-600">
                    {totalDispatched}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Received</p>
                  <p className="mt-1 font-bold text-green-600">
                    {totalDelivered}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Pending</p>
                  <p className="mt-1 font-bold text-amber-600">
                    {totalPending}
                  </p>
                </div>
              </div>
            </div>

            {/* Product-wise progress */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-800">
                Product-wise Progress
              </h4>

              <div className="space-y-3">
                {purchaseOrder.items.map((poItem, index) => {
                  const dispatched = activeDeliveries.reduce(
                    (sum, delivery) =>
                      sum +
                      delivery.items
                        .filter(
                          (item) => item.rfqItemId === poItem.rfqItemId
                        )
                        .reduce(
                          (itemSum, item) =>
                            itemSum + item.dispatchedQuantity,
                          0
                        ),
                    0
                  );

                  const delivered = activeDeliveries.reduce(
                    (sum, delivery) =>
                      sum +
                      delivery.items
                        .filter(
                          (item) => item.rfqItemId === poItem.rfqItemId
                        )
                        .reduce(
                          (itemSum, item) =>
                            itemSum + item.deliveredQuantity,
                          0
                        ),
                    0
                  );

                  const pending = Math.max(
                    0,
                    poItem.quantity - delivered
                  );

                  const itemProgress =
                    poItem.quantity > 0
                      ? Math.min(
                          100,
                          (delivered / poItem.quantity) * 100
                        )
                      : 0;

                  return (
                    <div
                      key={`${poItem.rfqItemId}-${index}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {poItem.productName}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">
                            Ordered
                          </p>
                          <p className="mt-1 font-semibold">
                            {poItem.quantity} {poItem.unit}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Dispatched
                          </p>
                          <p className="mt-1 font-semibold text-blue-600">
                            {dispatched} {poItem.unit}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Received
                          </p>
                          <p className="mt-1 font-semibold text-green-600">
                            {delivered} {poItem.unit}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${itemProgress}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {pending} {poItem.unit} pending
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shipment information */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-800">
                Shipment Details
              </h4>

              <div className="space-y-3">
                {poDeliveries.map((delivery) => {
                  const status = deliveryStatusConfig[delivery.status];

                  return (
                    <div
                      key={delivery._id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {delivery.deliveryNumber}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Expected:{" "}
                            {formatDate(delivery.expectedDeliveryDate)}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            status?.className ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {status?.label || delivery.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-500">
                            Tracking Number
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {delivery.trackingNumber || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Transporter
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {delivery.transporterName || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Vehicle Number
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {delivery.vehicleNumber || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Shipment Items
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {delivery.items.length} products
                          </p>
                        </div>
                      </div>

                      {/* Delivery status history */}
                      {delivery.statusHistory?.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-3 text-sm font-semibold text-slate-800">
                            Delivery History
                          </p>

                          <div className="space-y-3">
                            {[...delivery.statusHistory]
                              .sort(
                                (a, b) =>
                                  new Date(b.changedAt).getTime() -
                                  new Date(a.changedAt).getTime()
                              )
                              .map((history, index) => {
                                const historyStatus =
                                  deliveryStatusConfig[history.status];

                                return (
                                  <div
                                    key={`${history.changedAt}-${index}`}
                                    className="flex gap-3"
                                  >
                                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />

                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-800">
                                        {historyStatus?.label ||
                                          history.status}
                                      </p>

                                      <p className="mt-1 text-xs text-slate-500">
                                        {formatDate(history.changedAt)}
                                        {" · "}
                                        {formatTime(history.changedAt)}
                                      </p>

                                      {history.note && (
                                        <p className="mt-1 text-sm text-slate-600">
                                          {history.note}
                                        </p>
                                      )}

                                      {history.role && (
                                        <p className="mt-1 text-xs capitalize text-slate-400">
                                          Updated by {history.role}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {delivery.notes && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-600">
                            Shipment Notes
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {delivery.notes}
                          </p>
                        </div>
                      )}

                      {/* Procurement receipt confirmation */}
                      {["in_transit", "partially_delivered"].includes(
                        delivery.status
                      ) &&
                        delivery.items.some(
                          (item) =>
                            item.dispatchedQuantity > item.deliveredQuantity
                        ) && (
                          <div className="mt-4 border-t border-slate-100 pt-4">
                            <h4 className="font-semibold text-slate-900">
                              Confirm Received Quantities
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              Enter the actual quantity received for each product.
                            </p>

                            <div className="mt-3 space-y-3">
                              {delivery.items
                                .filter(
                                  (item) =>
                                    item.dispatchedQuantity > item.deliveredQuantity
                                )
                                .map((item) => {
                                  const key = `${delivery._id}:${item.rfqItemId}`;
                                  const remaining =
                                    item.dispatchedQuantity - item.deliveredQuantity;

                                  return (
                                    <div
                                      key={key}
                                      className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 sm:items-center"
                                    >
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                          {item.productName}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          Remaining dispatched: {remaining} {item.unit}
                                        </p>
                                      </div>

                                      <input
                                        type="number"
                                        min="0"
                                        max={remaining}
                                        step="any"
                                        value={receivedQuantities[key] ?? ""}
                                        onChange={(event) =>
                                          setReceivedQuantities((current) => ({
                                            ...current,
                                            [key]: event.target.value,
                                          }))
                                        }
                                        placeholder={`Max ${remaining}`}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                                        aria-label={`Received quantity for ${item.productName}`}
                                      />
                                    </div>
                                  );
                                })}
                            </div>

                            {receiptError && (
                              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                                {receiptError}
                              </p>
                            )}

                            {receiptSuccess && (
                              <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                                {receiptSuccess}
                              </p>
                            )}

                            <button
                              onClick={() => void handleConfirmReceipt(delivery)}
                              disabled={confirmingDeliveryId === delivery._id}
                              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {confirmingDeliveryId === delivery._id ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  Confirming...
                                </>
                              ) : (
                                <>
                                  <PackageCheck size={16} />
                                  Confirm Receipt
                                </>
                              )}
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <button
                onClick={() => navigate("/procurement/dashboard")}
                className="hover:text-blue-600"
              >
                Procurement
              </button>

              <ChevronRight size={14} />

              <span className="text-slate-800">Purchase Orders</span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              Purchase Orders
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage and track purchase orders across your organization.
            </p>
          </div>

          <button
            onClick={() => {
              void fetchPurchaseOrders(true);
              void fetchBuyerDeliveries();
            }}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <StatCard
            title="Total Orders"
            value={statistics.total}
            icon={ShoppingCart}
            color="bg-blue-50 text-blue-600"
          />

          <StatCard
            title="Draft"
            value={statistics.draft}
            icon={FileText}
            color="bg-slate-100 text-slate-600"
          />

          <StatCard
            title="Issued"
            value={statistics.issued}
            icon={Send}
            color="bg-blue-50 text-blue-600"
          />

          <StatCard
            title="Acknowledged"
            value={statistics.acknowledged}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600"
          />

          <StatCard
            title="Partially Delivered"
            value={statistics.partiallyDelivered}
            icon={PackageCheck}
            color="bg-amber-50 text-amber-600"
          />

          <StatCard
            title="Delivered"
            value={statistics.delivered}
            icon={Truck}
            color="bg-green-50 text-green-600"
          />

          <StatCard
            title="Total PO Value"
            value={formatCurrency(statistics.totalValue)}
            icon={Package}
            color="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Main content */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  All Purchase Orders
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredOrders.length} purchase orders found
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search PO, supplier, RFQ..."
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 sm:w-72"
                  />
                </div>

                <div className="relative">
                  <Filter
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm outline-none focus:border-blue-500 sm:w-48"
                  >
                    <option value="all">All Statuses</option>

                    {Object.entries(statusConfig).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="m-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold">
                  Unable to load purchase orders
                </p>

                <p className="mt-1">{error}</p>

                <button
                  onClick={() => void fetchPurchaseOrders()}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {actionError && (
            <div className="mx-5 mt-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span>{actionError}</span>

              <button onClick={() => setActionError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 size={30} className="animate-spin text-blue-600" />

              <p className="mt-3 text-sm">
                Loading purchase orders...
              </p>
            </div>
          ) : !error && filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <ShoppingCart size={30} className="text-slate-400" />
              </div>

              <h3 className="mt-4 font-semibold text-slate-800">
                No purchase orders found
              </h3>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {search || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Purchase orders generated from accepted quotations will appear here."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">
                        PO Number
                      </th>

                      <th className="px-6 py-4 font-semibold">
                        Supplier
                      </th>

                      <th className="px-6 py-4 font-semibold">
                        RFQ
                      </th>

                      <th className="px-6 py-4 font-semibold">
                        Amount
                      </th>

                      <th className="px-6 py-4 font-semibold">
                        Delivery Date
                      </th>

                      <th className="px-6 py-4 font-semibold">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((po) => {
                      const supplierName =
                        po.supplierId?.companyName ||
                        po.supplierId?.fullName ||
                        "Unknown Supplier";

                      const status =
                        statusConfig[po.status] || statusConfig.draft;

                      return (
                        <tr
                          key={po._id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">
                              {po.poNumber}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Created {formatDate(po.createdAt)}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-800">
                              {supplierName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {po.supplierId?.email || "No email"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-800">
                              {po.rfqId?.rfqNumber || "N/A"}
                            </p>

                            <p className="mt-1 max-w-44 truncate text-xs text-slate-500">
                              {po.rfqId?.title || "RFQ"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">
                              {formatCurrency(po.totalAmount)}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDate(po.deliveryDate)}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              {po.status === "draft" && (
                                <button
                                  onClick={() => void handleIssuePO(po)}
                                  disabled={issuingPOId === po._id}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  {issuingPOId === po._id
                                    ? "Issuing..."
                                    : "Issue PO"}
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedPO(po)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 lg:hidden">
                {filteredOrders.map((po) => {
                  const supplierName =
                    po.supplierId?.companyName ||
                    po.supplierId?.fullName ||
                    "Unknown Supplier";

                  const status =
                    statusConfig[po.status] || statusConfig.draft;

                  return (
                    <div
                      key={po._id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">
                            {po.poNumber}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {supplierName}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">
                            Amount
                          </p>

                          <p className="mt-1 font-semibold">
                            {formatCurrency(po.totalAmount)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Delivery
                          </p>

                          <p className="mt-1 font-medium">
                            {formatDate(po.deliveryDate)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {po.status === "draft" && (
                          <button
                            onClick={() => void handleIssuePO(po)}
                            disabled={issuingPOId === po._id}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {issuingPOId === po._id
                              ? "Issuing..."
                              : "Issue PO"}
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedPO(po)}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Purchase Order Details Modal */}
      {selectedPO && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPO(null);
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Purchase Order
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedPO.poNumber}
                </h2>
              </div>

              <button
                onClick={() => setSelectedPO(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* Status */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    statusConfig[selectedPO.status]?.className ||
                    statusConfig.draft.className
                  }`}
                >
                  {statusConfig[selectedPO.status]?.label ||
                    selectedPO.status}
                </span>

                <p className="text-sm text-slate-500">
                  Created {formatDate(selectedPO.createdAt)}
                </p>
              </div>

              {/* Supplier and RFQ */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Supplier
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {selectedPO.supplierId?.companyName ||
                      selectedPO.supplierId?.fullName ||
                      "Unknown Supplier"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPO.supplierId?.fullName || ""}
                  </p>

                  <p className="mt-1 break-all text-sm text-slate-500">
                    {selectedPO.supplierId?.email || "No email"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Related RFQ
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {selectedPO.rfqId?.rfqNumber || "N/A"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPO.rfqId?.title || "RFQ details unavailable"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Quotation:{" "}
                    {selectedPO.quotationId?.quotationNumber || "N/A"}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="mb-3 font-semibold text-slate-900">
                  Order Items
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          Product
                        </th>

                        <th className="px-4 py-3 text-right">
                          Quantity
                        </th>

                        <th className="px-4 py-3 text-right">
                          Unit Price
                        </th>

                        <th className="px-4 py-3 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {selectedPO.items?.map((item, index) => (
                        <tr key={`${item.productName}-${index}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.productName}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.quantity} {item.unit}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(item.unitPrice)}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery Information and Order Summary */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold text-slate-900">
                    Delivery Information
                  </h3>

                  <div className="space-y-3 text-sm">
                    <p className="flex items-start gap-2 text-slate-600">
                      <MapPin size={17} className="mt-0.5 shrink-0" />
                      {selectedPO.deliveryLocation}
                    </p>

                    <p className="flex items-center gap-2 text-slate-600">
                      <CalendarDays size={17} className="shrink-0" />
                      {formatDate(selectedPO.deliveryDate)}
                    </p>

                    <p className="flex items-center gap-2 text-slate-600">
                      <Clock size={17} className="shrink-0" />
                      {selectedPO.deliveryTimeline} days delivery timeline
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="mb-3 font-semibold text-slate-900">
                    Order Summary
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedPO.subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Tax ({selectedPO.taxPercentage}%)</span>
                      <span>{formatCurrency(selectedPO.taxAmount)}</span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Charges</span>
                      <span>
                        {formatCurrency(selectedPO.deliveryCharges)}
                      </span>
                    </div>

                    <div className="my-2 border-t border-slate-200" />

                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Total Amount</span>
                      <span>{formatCurrency(selectedPO.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW: Delivery Progress */}
              <DeliveryProgress purchaseOrder={selectedPO} />

              {/* Payment Terms */}
              {selectedPO.paymentTerms && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">
                    Payment Terms
                  </h3>

                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {selectedPO.paymentTerms}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedPO.notes && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">
                    Notes
                  </h3>

                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {selectedPO.notes}
                  </p>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedPO.status === "rejected" &&
                selectedPO.rejectionReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 font-semibold text-red-800">
                      <XCircle size={17} />
                      Rejection Reason
                    </div>

                    <p className="mt-2 text-sm text-red-700">
                      {selectedPO.rejectionReason}
                    </p>
                  </div>
                )}

              {/* Modal Actions */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() => setSelectedPO(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

                {selectedPO.status === "draft" && (
                  <button
                    onClick={() => void handleIssuePO(selectedPO)}
                    disabled={issuingPOId === selectedPO._id}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Send size={16} />

                    {issuingPOId === selectedPO._id
                      ? "Issuing..."
                      : "Issue Purchase Order"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;