
    import { useCallback, useEffect, useMemo, useState } from "react";
    import {
    ArrowLeft,
    RefreshCw,
    ShoppingCart,
    FileText,
    Send,
    CheckCircle2,
    Package,
    Truck,
    Search,
    Eye,
    X,
    MapPin,
    CalendarDays,
    Clock,
    AlertCircle,
    Loader2,
    Building2,
    } from "lucide-react";
    import { useNavigate } from "react-router-dom";
    import { apiRequest } from "../../../lib/api";
    import DeliveryNotifications from "../../delivery/components/DeliveryNotifications";
    import {
        getPurchaseOrderItemProgress,
        getPurchaseOrderProgress,
    } from "../../delivery/utils/purchaseOrderProgress";

    type PurchaseOrderStatus =
    | "draft"
    | "issued"
    | "acknowledged"
    | "in_progress"
    | "partially_delivered"
    | "delivered"
    | "rejected"
    | "cancelled";

    interface PurchaseOrderItem {
    rfqItemId?: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    dispatchedQuantity?: number;
    receivedQuantity?: number;
    }

    interface PurchaseOrderDelivery {
    _id: string;
    deliveryNumber: string;
    status: string;
    trackingNumber?: string;
    transporterName?: string;
    vehicleNumber?: string;
    expectedDeliveryDate?: string;
    dispatchedAt?: string;
    deliveredAt?: string;
    challanNumber?: string;
    challanUrl?: string;
    receivingStatus?: string;
    statusHistory?: {
        status: string;
        note?: string;
        changedAt: string;
    }[];
    receivingHistory?: {
        status: string;
        note?: string;
        changedAt: string;
    }[];
    notes?: string;
    items: {
        rfqItemId: string;
        productName: string;
        orderedQuantity: number;
        dispatchedQuantity: number;
        deliveredQuantity: number;
        unit: string;
    }[];
    }

    interface PurchaseOrder {
    _id: string;
    poNumber?: string;
    purchaseOrderNumber?: string;
    quotationNumber?: string;
    status: PurchaseOrderStatus;
    supplierId?: string;
    buyerOrganizationId?: {
        name?: string;
    } | string;
    rfqId?: {
        rfqNumber?: string;
        title?: string;
    } | string;
    items: PurchaseOrderItem[];
    deliveries?: PurchaseOrderDelivery[];
    subtotal: number;
    taxPercentage: number;
    taxAmount: number;
    deliveryCharges: number;
    totalAmount: number;
    deliveryLocation?: string;
    deliveryDate?: string;
    deliveryTimeline?: number;
    paymentTerms?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    issuedAt?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: {
        fullName?: string;
        email?: string;
    } | string;
    rejectedAt?: string;
    }

    interface PurchaseOrdersResponse {
    success: boolean;
    count?: number;
    data: {
        purchaseOrders?: PurchaseOrder[];
        orders?: PurchaseOrder[];
    };
    }

    const formatCurrency = (amount?: number) =>
    typeof amount === "number" && Number.isFinite(amount)
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        }).format(amount)
        : "Not available";

    const formatDate = (date?: string) => {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    };

    const getStatusLabel = (status: PurchaseOrderStatus) => {
    const labels: Record<PurchaseOrderStatus, string> = {
        draft: "Draft",
        issued: "Issued",
        acknowledged: "Acknowledged",
        in_progress: "In Progress",
        partially_delivered: "Partially Delivered",
        delivered: "Delivered",
        rejected: "Rejected",
        cancelled: "Cancelled",
    };

    return labels[status] || status;
    };

    const getStatusClass = (status: PurchaseOrderStatus) => {
    const classes: Record<PurchaseOrderStatus, string> = {
        draft: "bg-slate-100 text-slate-700",
        issued: "bg-blue-100 text-blue-700",
        acknowledged: "bg-green-100 text-green-700",
        in_progress: "bg-indigo-100 text-indigo-700",
        partially_delivered: "bg-amber-100 text-amber-700",
        delivered: "bg-emerald-100 text-emerald-700",
        rejected: "bg-red-100 text-red-700",
        cancelled: "bg-slate-200 text-slate-600",
    };

    return classes[status] || "bg-slate-100 text-slate-700";
    };

    // Build the order lifecycle from timestamps already returned by the API.
    const getOrderTimeline = (order: PurchaseOrder) => {
    const events: {
        id: string;
        title: string;
        date: string;
        description: string;
    }[] = [];

    const addEvent = (
        id: string,
        title: string,
        date?: string,
        description?: string
    ) => {
        if (date && !Number.isNaN(new Date(date).getTime())) {
        events.push({
            id,
            title,
            date,
            description: description || "",
        });
        }
    };

    addEvent(
        "created",
        "Purchase order created",
        order.createdAt,
        "The purchase order was generated."
    );

    addEvent(
        "issued",
        "Purchase order issued",
        order.issuedAt,
        "The buyer officially issued the purchase order."
    );

    addEvent(
        "acknowledged",
        "Supplier acknowledged",
        order.acknowledgedAt,
        `The purchase order was acknowledged${order.acknowledgedBy && typeof order.acknowledgedBy === "object" ? ` by ${order.acknowledgedBy.fullName || order.acknowledgedBy.email || "the supplier"}` : " by the supplier"}.`
    );

    addEvent(
        "rejected",
        "Purchase order rejected",
        order.rejectedAt,
        "The supplier rejected the purchase order."
    );

    (order.deliveries || []).forEach((delivery) => {
        if (!delivery.statusHistory?.length) {
            addEvent(
                `${delivery._id}-dispatched`,
                `Shipment dispatched · ${delivery.deliveryNumber}`,
                delivery.dispatchedAt,
                delivery.trackingNumber
                    ? `Tracking number: ${delivery.trackingNumber}`
                    : "The shipment was marked as dispatched."
            );

            addEvent(
                `${delivery._id}-delivered`,
                `Shipment delivered · ${delivery.deliveryNumber}`,
                delivery.deliveredAt,
                "The shipment was marked as delivered."
            );
        }

        (delivery.statusHistory || []).forEach((event, index) => {
            addEvent(
                `${delivery._id}-status-${index}`,
                `Shipment ${event.status.replaceAll("_", " ")} · ${delivery.deliveryNumber}`,
                event.changedAt,
                event.note || ""
            );
        });

        (delivery.receivingHistory || []).forEach((event, index) => {
            addEvent(
                `${delivery._id}-receiving-${index}`,
                `Warehouse ${event.status.replaceAll("_", " ")} · ${delivery.deliveryNumber}`,
                event.changedAt,
                event.note || ""
            );
        });
    });

    return events.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    };

    export default function SupplierPurchaseOrders() {
    const navigate = useNavigate();

    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedOrder, setSelectedOrder] =
        useState<PurchaseOrder | null>(null);
    const [showShipmentForm, setShowShipmentForm] = useState(false);
    const [shipmentRequestKey, setShipmentRequestKey] = useState("");
    const [shipmentQuantities, setShipmentQuantities] = useState<Record<string, string>>({});
    const [shipmentDraft, setShipmentDraft] = useState({
        expectedDeliveryDate: "",
        transporterName: "",
        vehicleNumber: "",
        trackingNumber: "",
        challanNumber: "",
        challanUrl: "",
        notes: "",
    });
    const [shipmentError, setShipmentError] = useState("");
    const [savingShipment, setSavingShipment] = useState(false);
    const [acknowledgingOrderId, setAcknowledgingOrderId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState("");

    const fetchPurchaseOrders = useCallback(async (isRefresh = false): Promise<PurchaseOrder[]> => {
        try {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        const response = await apiRequest<PurchaseOrdersResponse>(
            "/purchase-orders/supplier"
        );

        const orders =
            response.data?.purchaseOrders ??
            response.data?.orders ??
            [];

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

    const openShipmentForm = (order: PurchaseOrder) => {
        setSuccessMessage("");
        setShipmentRequestKey(crypto.randomUUID());
        setShipmentQuantities(Object.fromEntries(
            order.items.map((item) => [
                String(item.rfqItemId || ""),
                String(getPurchaseOrderItemProgress(
                    item,
                    order.deliveries || []
                ).pending),
            ])
        ));
        setShipmentDraft({
            expectedDeliveryDate: order.deliveryDate?.slice(0, 10) || "",
            transporterName: "",
            vehicleNumber: "",
            trackingNumber: "",
            challanNumber: "",
            challanUrl: "",
            notes: "",
        });
        setShipmentError("");
        setShowShipmentForm(true);
    };

    const acknowledgeOrder = async (order: PurchaseOrder) => {
        const confirmed = window.confirm(
            `Acknowledge ${getPONumber(order)}?\n\nYou confirm this purchase order and its products, quantities, prices, delivery date, and payment terms.`
        );
        if (!confirmed) return;

        try {
            setAcknowledgingOrderId(order._id);
            setSuccessMessage("");
            setShipmentError("");
            await apiRequest(`/purchase-orders/${order._id}/acknowledge`, {
                method: "PATCH",
            });
            const refreshedOrders = await fetchPurchaseOrders(true);
            const refreshedOrder = refreshedOrders.find(
                (purchaseOrder) => purchaseOrder._id === order._id
            );
            if (refreshedOrder) setSelectedOrder(refreshedOrder);
            setSuccessMessage(
                `${getPONumber(order)} acknowledged. You can now create a shipment.`
            );
        } catch (err) {
            setShipmentError(
                err instanceof Error
                    ? err.message
                    : "Unable to acknowledge purchase order."
            );
        } finally {
            setAcknowledgingOrderId(null);
        }
    };

    const createShipment = async () => {
        if (!selectedOrder) return;
        if (!shipmentDraft.transporterName.trim()) {
            setShipmentError("Enter the carrier name.");
            return;
        }
        if (!shipmentDraft.trackingNumber.trim()) {
            setShipmentError("Enter the tracking number.");
            return;
        }
        const items = selectedOrder.items
            .map((item) => ({
                rfqItemId: String(item.rfqItemId || ""),
                dispatchedQuantity: Number(shipmentQuantities[String(item.rfqItemId || "")] || 0),
            }))
            .filter((item) => item.dispatchedQuantity > 0);
        if (!items.length) {
            setShipmentError("Enter a dispatched quantity for at least one product.");
            return;
        }
        if (!shipmentDraft.expectedDeliveryDate) {
            setShipmentError("Choose an expected delivery date.");
            return;
        }

        try {
            setSavingShipment(true);
            setShipmentError("");
            await apiRequest(`/deliveries/purchase-order/${selectedOrder._id}`, {
                method: "POST",
                body: JSON.stringify({
                    idempotencyKey: shipmentRequestKey,
                    items,
                    ...shipmentDraft,
                    expectedDeliveryDate: new Date(shipmentDraft.expectedDeliveryDate).toISOString(),
                    challanUrl: shipmentDraft.challanUrl.trim() || undefined,
                }),
            });
            setShowShipmentForm(false);
            setSelectedOrder(null);
            setSuccessMessage("Planned shipment created. Open the purchase order to dispatch it.");
            await fetchPurchaseOrders(true);
        } catch (err) {
            setShipmentError(err instanceof Error ? err.message : "Unable to prepare shipment.");
        } finally {
            setSavingShipment(false);
        }
    };

    const updateShipmentStatus = async (deliveryId: string, status: string) => {
        if (
            status === "dispatched" &&
            !window.confirm("Confirm that these goods have physically left your facility?")
        ) {
            return;
        }
        try {
            await apiRequest(`/deliveries/${deliveryId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            const refreshedOrders = await fetchPurchaseOrders(true);
            if (selectedOrder) {
                setSelectedOrder(
                    refreshedOrders.find((order) => order._id === selectedOrder._id) ||
                    null
                );
            }
            setSuccessMessage(
                status === "dispatched"
                    ? "Shipment dispatch confirmed."
                    : `Shipment status updated to ${status.replaceAll("_", " ")}.`
            );
        } catch (err) {
            setShipmentError(err instanceof Error ? err.message : "Unable to update shipment status.");
        }
    };

    useEffect(() => {
        fetchPurchaseOrders();
    }, [fetchPurchaseOrders]);

    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter((order) => {
        const rfqNumber =
            typeof order.rfqId === "object"
            ? order.rfqId?.rfqNumber || ""
            : "";

        const poNumber =
            order.poNumber || order.purchaseOrderNumber || "";

        const buyer =
            typeof order.buyerOrganizationId === "object"
            ? order.buyerOrganizationId?.name || ""
            : "";

        const matchesSearch = [
            poNumber,
            rfqNumber,
            buyer,
            order.quotationNumber || "",
        ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchesStatus =
            statusFilter === "all" ||
            order.status === statusFilter;

        return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, search, statusFilter]);

    const totalValue = purchaseOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
    );

    const statusCount = (status: PurchaseOrderStatus) =>
        purchaseOrders.filter((order) => order.status === status).length;

    const getProgress = (order: PurchaseOrder) =>
        Math.round(
            getPurchaseOrderProgress(
                order.items,
                order.deliveries || []
            ).progress
        );

    const getRFQNumber = (order: PurchaseOrder) =>
        typeof order.rfqId === "object"
        ? order.rfqId?.rfqNumber || "N/A"
        : "N/A";

    const getBuyerName = (order: PurchaseOrder) =>
        typeof order.buyerOrganizationId === "object"
        ? order.buyerOrganizationId?.name || "Buyer"
        : "Buyer";

    const getPONumber = (order: PurchaseOrder) =>
        order.poNumber ||
        order.purchaseOrderNumber ||
        order._id;

    const statCards = [
        {
        label: "Total Orders",
        value: purchaseOrders.length,
        icon: ShoppingCart,
        color: "blue",
        },
        {
        label: "Issued",
        value: statusCount("issued"),
        icon: Send,
        color: "indigo",
        },
        {
        label: "Acknowledged",
        value: statusCount("acknowledged"),
        icon: CheckCircle2,
        color: "green",
        },
        {
        label: "Partially Delivered",
        value: statusCount("partially_delivered"),
        icon: Package,
        color: "amber",
        },
        {
        label: "Delivered",
        value: statusCount("delivered"),
        icon: Truck,
        color: "emerald",
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-6 py-5">
            <button
                onClick={() => navigate("/supplier/dashboard")}
                className="flex items-center gap-2 text-sm text-blue-600 mb-3 hover:underline"
            >
                <ArrowLeft size={17} />
                Supplier Dashboard
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Supplier Workspace
                </p>
                <h1 className="text-2xl font-bold mt-1">
                    Purchase Orders & Deliveries
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    View your orders, commercial terms and delivery progress.
                </p>
                </div>

                <div className="flex items-center gap-2">
                    <DeliveryNotifications />
                    <button
                    onClick={() => fetchPurchaseOrders(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-4 py-2.5 font-medium hover:bg-slate-50 disabled:opacity-60"
                    >
                    <RefreshCw
                        size={17}
                        className={refreshing ? "animate-spin" : ""}
                    />
                    Refresh
                    </button>
                </div>
            </div>
            </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
            {successMessage && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                    {successMessage}
                </div>
            )}
            {shipmentError && !showShipmentForm && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {shipmentError}
                </div>
            )}
            {/* ERROR */}
            {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                <p className="font-semibold">
                    Unable to load purchase orders
                </p>
                <p className="text-sm mt-1">{error}</p>
                </div>
                <button
                onClick={() => fetchPurchaseOrders()}
                className="font-semibold text-sm"
                >
                Retry
                </button>
            </div>
            )}

            {/* LOADING */}
            {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center">
                <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
                <p className="mt-4 text-slate-500">
                Loading your purchase orders...
                </p>
            </div>
            ) : (
            <>
                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-7">
                {statCards.map((card) => {
                    const Icon = card.icon;

                    const colorClasses: Record<string, string> = {
                    blue: "bg-blue-50 text-blue-600",
                    indigo: "bg-indigo-50 text-indigo-600",
                    green: "bg-green-50 text-green-600",
                    amber: "bg-amber-50 text-amber-600",
                    emerald: "bg-emerald-50 text-emerald-600",
                    };

                    return (
                    <div
                        key={card.label}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            {card.label}
                        </p>
                        <div className={`p-2 rounded-lg ${colorClasses[card.color]}`}>
                            <Icon size={20} />
                        </div>
                        </div>
                        <p className="text-3xl font-bold mt-4">
                        {card.value}
                        </p>
                    </div>
                    );
                })}
                </div>

                {/* TOTAL VALUE */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-7">
                <p className="text-sm text-slate-500">
                    Total Purchase Order Value
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-2">
                    {formatCurrency(totalValue)}
                </p>
                </div>

                {/* SEARCH AND FILTER */}
                <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div>
                    <h2 className="text-lg font-bold">
                        All Purchase Orders
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {filteredOrders.length} purchase orders found
                    </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search PO, RFQ..."
                        className="w-full sm:w-64 border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="issued">Issued</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="in_progress">In Progress</option>
                        <option value="partially_delivered">
                        Partially Delivered
                        </option>
                        <option value="delivered">Delivered</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    </div>
                </div>

                {/* EMPTY STATE */}
                {filteredOrders.length === 0 ? (
                    <div className="p-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <FileText size={30} className="text-slate-400" />
                    </div>
                    <h3 className="font-semibold text-lg mt-4">
                        No purchase orders found
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">
                        {search || statusFilter !== "all"
                        ? "Try changing your search or status filter."
                        : "Purchase orders issued by buyers will appear here."}
                    </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="text-left px-5 py-4 font-semibold">
                            PO NUMBER
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            BUYER
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            RFQ
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            AMOUNT
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            DELIVERY DATE
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            STATUS
                            </th>
                            <th className="text-left px-5 py-4 font-semibold">
                            ACTION
                            </th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((order) => (
                            <tr
                            key={order._id}
                            className="hover:bg-slate-50"
                            >
                            <td className="px-5 py-4">
                                <p className="font-semibold text-slate-900">
                                {getPONumber(order)}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                Created {formatDate(order.createdAt)}
                                </p>
                            </td>

                            <td className="px-5 py-4 font-medium">
                                {getBuyerName(order)}
                            </td>

                            <td className="px-5 py-4">
                                {getRFQNumber(order)}
                            </td>

                            <td className="px-5 py-4 font-bold">
                                {formatCurrency(order.totalAmount)}
                            </td>

                            <td className="px-5 py-4">
                                {formatDate(order.deliveryDate)}
                            </td>

                            <td className="px-5 py-4">
                                <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}
                                >
                                {getStatusLabel(order.status)}
                                </span>
                            </td>

                            <td className="px-5 py-4">
                                <button
                                onClick={() => setSelectedOrder(order)}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium hover:bg-blue-50 hover:text-blue-700"
                                >
                                <Eye size={15} />
                                View
                                </button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                )}
                </section>
            </>
            )}
        </main>

        {/* PURCHASE ORDER DETAILS MODAL */}
        {selectedOrder && (
            <div
            className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
            >
            <div
                className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-5 flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                    Purchase Order
                    </p>
                    <h2 className="text-xl font-bold mt-1">
                    {getPONumber(selectedOrder)}
                    </h2>
                </div>

                <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-lg hover:bg-slate-100"
                    aria-label="Close details"
                >
                    <X size={22} />
                </button>
                </div>

                <div className="p-6 space-y-6">
                <div className="flex flex-wrap justify-between gap-3">
                    <span
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${getStatusClass(selectedOrder.status)}`}
                    >
                    {getStatusLabel(selectedOrder.status)}
                    </span>

                    <p className="text-sm text-slate-500">
                    Created {formatDate(selectedOrder.createdAt)}
                    </p>
                </div>

                {selectedOrder.status === "issued" && (
                    <section className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold text-blue-950">
                                Confirm this purchase order
                            </p>
                            <p className="mt-1 text-sm text-blue-800">
                                Acknowledgement confirms the products, quantities, prices and commercial terms.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void acknowledgeOrder(selectedOrder)}
                            disabled={acknowledgingOrderId === selectedOrder._id}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            <CheckCircle2 size={16} />
                            {acknowledgingOrderId === selectedOrder._id
                                ? "Acknowledging..."
                                : "Acknowledge Purchase Order"}
                        </button>
                    </section>
                )}

                {selectedOrder.status === "acknowledged" && (
                    <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Purchase order acknowledged
                        {selectedOrder.acknowledgedAt
                            ? ` on ${formatDate(selectedOrder.acknowledgedAt)}`
                            : ""}
                        . You can now create a shipment.
                    </p>
                )}

                {successMessage && (
                    <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {successMessage}
                    </p>
                )}
                {shipmentError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {shipmentError}
                    </p>
                )}

                {["acknowledged", "in_progress", "partially_delivered"].includes(selectedOrder.status) && (
                    <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => openShipmentForm(selectedOrder)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <Truck size={16} />
                        Create Shipment
                    </button>
                    </div>
                )}

                {showShipmentForm && (
                    <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                        <h3 className="font-bold text-slate-900">Prepare shipment</h3>
                        <p className="mt-1 text-xs text-slate-500">Enter per-item quantities and shipment details. Dispatch is confirmed separately after the shipment is created.</p>
                        </div>
                        <button type="button" onClick={() => setShowShipmentForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white"><X size={17} /></button>
                    </div>
                    <div className="space-y-3">
                        {selectedOrder.items.map((item, index) => {
                        const itemId = String(item.rfqItemId || "");
                        const remaining = Math.max(0, item.quantity - (item.dispatchedQuantity || 0));
                        return (
                            <label key={itemId || index} className="grid items-center gap-3 rounded-lg bg-white p-3 sm:grid-cols-[1fr_110px_130px]">
                            <span className="text-sm font-semibold text-slate-700">{item.productName}<small className="ml-2 text-xs font-normal text-slate-400">{remaining} {item.unit} remaining</small></span>
                            <span className="text-xs text-slate-500">Ordered {item.quantity}</span>
                            <input
                                type="number"
                                min={0}
                                max={remaining}
                                step={1}
                                value={shipmentQuantities[itemId] || "0"}
                                onChange={(event) => setShipmentQuantities((current) => ({ ...current, [itemId]: event.target.value }))}
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                                aria-label={`Dispatched quantity for ${item.productName}`}
                            />
                            </label>
                        );
                        })}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {([
                        ["expectedDeliveryDate", "Expected arrival date", "date"],
                        ["transporterName", "Carrier name", "text"],
                        ["vehicleNumber", "Vehicle number", "text"],
                        ["trackingNumber", "Tracking number", "text"],
                        ["challanNumber", "Delivery challan number", "text"],
                        ["challanUrl", "Challan document URL", "url"],
                        ] as const).map(([field, label, type]) => (
                        <label key={field} className="text-xs font-semibold text-slate-600">
                            {label}
                            <input
                            type={type}
                            required={field === "transporterName" || field === "trackingNumber"}
                            value={shipmentDraft[field]}
                            onChange={(event) => setShipmentDraft((current) => ({ ...current, [field]: event.target.value }))}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                            />
                        </label>
                        ))}
                        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Shipment remarks
                        <textarea
                            rows={2}
                            value={shipmentDraft.notes}
                            onChange={(event) => setShipmentDraft((current) => ({ ...current, notes: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                        />
                        </label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => setShowShipmentForm(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
                        <button type="button" onClick={() => void createShipment()} disabled={savingShipment} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                        <Send size={14} /> {savingShipment ? "Saving..." : "Create planned shipment"}
                        </button>
                    </div>
                    <p className="mt-3 text-right text-[11px] text-slate-500">
                        Dispatch date and actor are recorded when you confirm dispatch.
                    </p>
                    </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Building2 size={17} />
                        Buyer
                    </div>
                    <p className="font-bold mt-2">
                        {getBuyerName(selectedOrder)}
                    </p>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <FileText size={17} />
                        Related RFQ
                    </div>
                    <p className="font-bold mt-2">
                        {getRFQNumber(selectedOrder)}
                    </p>
                    </div>
                </div>

                {/* ORDER ITEMS */}
                <section>
                    <h3 className="font-bold text-lg mb-3">
                    Order Items
                    </h3>

                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="text-left px-4 py-3">Product</th>
                            <th className="text-left px-4 py-3">Quantity</th>
                            <th className="text-left px-4 py-3">Unit Price</th>
                            <th className="text-right px-4 py-3">Total</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items.map((item, index) => (
                            <tr key={item.rfqItemId || index}>
                            <td className="px-4 py-3 font-medium">
                                {item.productName || "Item details unavailable"}
                            </td>
                            <td className="px-4 py-3">
                                {item.quantity ?? "Not available"} {item.unit || ""}
                            </td>
                            <td className="px-4 py-3">
                                {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                                {formatCurrency(item.totalPrice)}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                </section>

                {/* DELIVERY INFORMATION */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                    <h3 className="font-bold text-lg mb-3">
                        Delivery Information
                    </h3>

                    <div className="space-y-3 text-sm">
                        <p className="flex gap-2 items-start">
                        <MapPin size={18} className="text-blue-600 shrink-0" />
                        {selectedOrder.deliveryLocation || "Not specified"}
                        </p>

                        <p className="flex gap-2 items-center">
                        <CalendarDays size={18} className="text-blue-600 shrink-0" />
                        {formatDate(selectedOrder.deliveryDate)}
                        </p>

                        <p className="flex gap-2 items-center">
                        <Clock size={18} className="text-blue-600 shrink-0" />
                        {selectedOrder.deliveryTimeline || "N/A"} days delivery timeline
                        </p>
                    </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-5">
                    <h3 className="font-bold mb-4">Order Summary</h3>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                        <span className="text-slate-500">Subtotal</span>
                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                        </div>

                        <div className="flex justify-between">
                        <span className="text-slate-500">
                            Tax ({selectedOrder.taxPercentage}%)
                        </span>
                        <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                        </div>

                        <div className="flex justify-between">
                        <span className="text-slate-500">
                            Delivery Charges
                        </span>
                        <span>
                            {formatCurrency(selectedOrder.deliveryCharges)}
                        </span>
                        </div>

                        <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-lg">
                        <span>Total Amount</span>
                        <span className="text-blue-700">
                            {formatCurrency(selectedOrder.totalAmount)}
                        </span>
                        </div>
                    </div>
                    </div>
                </section>

                {/* OVERALL DELIVERY PROGRESS */}
                <section className="border border-slate-200 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-3">
                    <div>
                        <h3 className="font-bold">Overall Delivery Progress</h3>
                        <p className="text-xs text-slate-500 mt-1">
                        Based on quantities confirmed by the buyer
                        </p>
                    </div>
                    <span className="text-xl font-bold text-blue-700">
                        {getProgress(selectedOrder)}%
                    </span>
                    </div>

                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${getProgress(selectedOrder)}%` }}
                    />
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-slate-500">Ordered</p>
                        <p className="font-bold">                        {getPurchaseOrderProgress(
                            selectedOrder.items,
                            selectedOrder.deliveries || []
                        ).formatOrdered}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Dispatched</p>
                        <p className="font-bold text-blue-600">
                        {getPurchaseOrderProgress(
                            selectedOrder.items,
                            selectedOrder.deliveries || []
                        ).formatDispatched}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Received</p>
                        <p className="font-bold text-green-600">
                        {getPurchaseOrderProgress(
                            selectedOrder.items,
                            selectedOrder.deliveries || []
                        ).formatReceived}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Pending</p>
                        <p className="font-bold text-amber-600">
                        {getPurchaseOrderProgress(
                            selectedOrder.items,
                            selectedOrder.deliveries || []
                        ).formatPending}
                        </p>
                    </div>
                    </div>
                </section>

                {/* DELIVERY HISTORY & TIMELINE */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                        <h3 className="font-bold text-lg">Delivery History & Timeline</h3>
                        <p className="text-sm text-slate-500 mt-1">
                        Chronological record of purchase order and shipment milestones
                        </p>
                    </div>
                    <span className="text-xs font-semibold rounded-full bg-blue-50 text-blue-700 px-3 py-1.5">
                        {getOrderTimeline(selectedOrder).length} recorded events
                    </span>
                    </div>

                    {getOrderTimeline(selectedOrder).length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
                        <Clock className="mx-auto text-slate-400" size={24} />
                        <p className="font-medium text-slate-700 mt-2">
                        No timeline events available yet
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                        Events will appear here as the purchase order moves through its lifecycle.
                        </p>
                    </div>
                    ) : (
                    <div className="border border-slate-200 rounded-xl p-5">
                        <div className="space-y-0">
                        {getOrderTimeline(selectedOrder).map((event, index, events) => (
                            <div key={event.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className="w-9 h-9 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                                {event.title.toLowerCase().includes("shipment") ? (
                                    <Truck size={17} />
                                ) : (
                                    <CheckCircle2 size={17} />
                                )}
                                </div>
                                {index !== events.length - 1 && (
                                <div className="w-px flex-1 min-h-8 bg-slate-200" />
                                )}
                            </div>

                            <div className={`min-w-0 flex-1 ${index !== events.length - 1 ? "pb-6" : ""}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-slate-900">
                                    {event.title}
                                </p>
                                <time className="text-xs text-slate-500">
                                    {new Date(event.date).toLocaleString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    })}
                                </time>
                                </div>
                                {event.description && (
                                <p className="text-sm text-slate-500 mt-1">
                                    {event.description}
                                </p>
                                )}
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>
                    )}

                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex gap-2">
                    <Clock size={17} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        {selectedOrder.status === "delivered"
                        ? "All purchase order quantities have been delivered."
                        : selectedOrder.status === "partially_delivered"
                            ? "This purchase order is partially delivered. Remaining quantities are still pending."
                            : selectedOrder.status === "rejected"
                            ? "This purchase order was rejected by the supplier."
                            : selectedOrder.status === "cancelled"
                                ? "This purchase order has been cancelled."
                                : "The purchase order is awaiting its next fulfilment milestone."}
                    </p>
                    </div>
                </section>

                {/* PRODUCT-WISE DELIVERY PROGRESS */}
                <section>
                    <h3 className="font-bold text-lg mb-3">
                    Product-wise Progress
                    </h3>
                    <div className="space-y-3">
                    {selectedOrder.items.map((item, index) => {
                        const itemProgress = getPurchaseOrderItemProgress(
                            item,
                            selectedOrder.deliveries || []
                        );

                        return (
                        <div
                            key={item.rfqItemId || index}
                            className="border border-slate-200 rounded-xl p-4"
                        >
                            <h4 className="font-semibold">{item.productName || "Item details unavailable"}</h4>
                            <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                            <div>
                                <p className="text-slate-500">Ordered</p>
                                <p className="font-semibold">{itemProgress.ordered} {item.unit}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Dispatched</p>
                                <p className="font-semibold text-blue-600">{itemProgress.dispatched} {item.unit}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Received</p>
                                <p className="font-semibold text-green-600">{itemProgress.received} {item.unit}</p>
                            </div>
                            </div>
                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-3">
                            <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${itemProgress.progress}%` }}
                            />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                            {itemProgress.pending} {item.unit} not yet dispatched
                            </p>
                        </div>
                        );
                    })}
                    </div>
                </section>

                {/* SHIPMENT DETAILS */}
                <section>
                    <h3 className="font-bold text-lg mb-3">Shipment Details</h3>
                    {!selectedOrder.deliveries?.length ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
                        No shipments have been created for this purchase order yet.
                    </div>
                    ) : (
                    <div className="space-y-3">
                        {selectedOrder.deliveries.map((delivery) => (
                        <div
                            key={delivery._id}
                            className="border border-slate-200 rounded-xl p-4"
                        >
                            <div className="flex flex-wrap justify-between gap-3">
                            <div>
                                <p className="font-bold">{delivery.deliveryNumber}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                Expected: {formatDate(delivery.expectedDeliveryDate)}
                                </p>
                            </div>
                            <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold capitalize">
                                {delivery.status.replaceAll("_", " ")}
                            </span>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                <p>Tracking: {delivery.trackingNumber || "Not supplied"}</p>
                                <p>Vehicle: {delivery.vehicleNumber || "Not supplied"}</p>
                                <p>Transporter: {delivery.transporterName || "Not supplied"}</p>
                                <p>Challan: {delivery.challanNumber || "Not supplied"}</p>
                                <p>Warehouse: {(delivery.receivingStatus || "pending").replaceAll("_", " ")}</p>
                                {delivery.challanUrl && <a className="text-blue-700 underline" href={delivery.challanUrl} target="_blank" rel="noreferrer">Open challan document</a>}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {delivery.status === "planned" && (
                                <button type="button" onClick={() => void updateShipmentStatus(delivery._id, "dispatched")} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white">Confirm Dispatch</button>
                                )}
                                {delivery.status === "dispatched" && (
                                <button type="button" onClick={() => void updateShipmentStatus(delivery._id, "in_transit")} className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white">Mark In Transit</button>
                                )}
                                {["dispatched", "in_transit"].includes(delivery.status) && (
                                <button type="button" onClick={() => void updateShipmentStatus(delivery._id, "delayed")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">Report Delay</button>
                                )}
                                {delivery.status === "delayed" && (
                                <button type="button" onClick={() => void updateShipmentStatus(delivery._id, "in_transit")} className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white">Resume Transit</button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                            <div>
                                <p className="text-slate-500">Tracking Number</p>
                                <p className="font-medium">{delivery.trackingNumber || "Not provided"}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Transporter</p>
                                <p className="font-medium">{delivery.transporterName || "Not provided"}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Vehicle Number</p>
                                <p className="font-medium">{delivery.vehicleNumber || "Not provided"}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Shipment Items</p>
                                <p className="font-medium">{delivery.items.length} products</p>
                            </div>
                            </div>

                            {delivery.notes && (
                            <div className="mt-4 rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold text-slate-500">Shipment Notes</p>
                                <p className="text-sm mt-1">{delivery.notes}</p>
                            </div>
                            )}
                        </div>
                        ))}
                    </div>
                    )}
                </section>

                {selectedOrder.paymentTerms && (
                    <section>
                    <h3 className="font-bold mb-2">Payment Terms</h3>
                    <p className="text-sm text-slate-600">
                        {selectedOrder.paymentTerms}
                    </p>
                    </section>
                )}

                {selectedOrder.notes && (
                    <section>
                    <h3 className="font-bold mb-2">Notes</h3>
                    <p className="text-sm text-slate-600">
                        {selectedOrder.notes}
                    </p>
                    </section>
                )}
                </div>

                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end">
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-5 py-2.5 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50"
                >
                    Close
                </button>
                </div>
            </div>
            </div>
        )}
        </div>
    );
    }
