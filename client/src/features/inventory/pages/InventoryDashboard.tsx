import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Warehouse,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { apiRequest } from "../../../lib/api";

type InventoryProduct = {
  productId: string;
  sourceRfqItemId: string;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  locationId: string | null;
  locationName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  rejectedQuantity: number;
  onHoldQuantity: number;
  reorderLevel: number;
  status: "healthy" | "low_stock" | "out_of_stock";
  lastUpdated: string;
  inventoryValue: number | null;
};

type InventoryTransaction = {
  _id: string;
  productName: string;
  quantity: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  onHoldQuantity?: number;
  transactionType: string;
  postedAt: string;
  deliveryId: string;
  purchaseOrderId: string;
  inspectionId: string;
  remarks?: string;
};

type InventorySummary = {
  totalProducts: number;
  totalStockQuantity: number;
  availableStock: number;
  reservedStock: number;
  rejectedStock: number;
  onHoldStock: number;
  lowStockProducts: number;
  inventoryValuation: number | null;
};

type Location = { _id: string; name: string; code: string };
type ApiResponse<T> = { success: boolean; message?: string; data?: T };

const routeTabs = [
  { path: "/inventory/overview", label: "Overview", icon: Boxes },
  { path: "/inventory/stock", label: "Stock Management", icon: PackageCheck },
  { path: "/inventory/ledger", label: "Inventory Ledger", icon: CalendarDays },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);
const formatDate = (value?: string) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString("en-IN")
    : "—";

const statusLabel: Record<InventoryProduct["status"], string> = {
  healthy: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export default function InventoryDashboard() {
  const { pathname } = useLocation();
  const view = pathname.endsWith("/ledger")
    ? "ledger"
    : pathname.endsWith("/stock")
      ? "stock"
      : "overview";
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<InventoryTransaction[]>([]);
  const [ledger, setLedger] = useState<InventoryTransaction[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
  const [productHistory, setProductHistory] = useState<InventoryTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reorderEdits, setReorderEdits] = useState<Record<string, string>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const productQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category !== "all") params.set("category", category);
    if (locationId !== "all") params.set("locationId", locationId);
    if (status !== "all") params.set("status", status);
    return params.toString();
  }, [category, locationId, search, status]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResponse, productsResponse, locationsResponse] = await Promise.all([
        apiRequest<ApiResponse<{
          summary: InventorySummary;
          recentTransactions: InventoryTransaction[];
        }>>("/inventory/overview"),
        apiRequest<ApiResponse<{ products: InventoryProduct[] }>>(
          `/inventory/products${productQuery ? `?${productQuery}` : ""}`
        ),
        apiRequest<ApiResponse<{ locations: Location[] }>>("/inventory/locations"),
      ]);
      if (!overviewResponse.success || !productsResponse.success || !locationsResponse.success) {
        throw new Error(
          overviewResponse.message ||
          productsResponse.message ||
          locationsResponse.message ||
          "Unable to load inventory."
        );
      }
      setSummary(overviewResponse.data?.summary || null);
      setRecentTransactions(overviewResponse.data?.recentTransactions || []);
      setProducts(productsResponse.data?.products || []);
      setLocations(locationsResponse.data?.locations || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [productQuery]);

  const loadLedger = useCallback(async () => {
    if (view !== "ledger") return;
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (startDate) params.set("startDate", new Date(`${startDate}T00:00:00`).toISOString());
    if (endDate) params.set("endDate", new Date(`${endDate}T23:59:59.999`).toISOString());
    try {
      const response = await apiRequest<ApiResponse<{
        transactions: InventoryTransaction[];
        pagination: { totalPages: number };
      }>>(`/inventory/ledger?${params.toString()}`);
      if (!response.success) throw new Error(response.message || "Unable to load inventory ledger.");
      setLedger(response.data?.transactions || []);
      setTotalPages(response.data?.pagination.totalPages || 1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory ledger.");
    }
  }, [endDate, page, startDate, view]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  useEffect(() => {
    if (!selectedProduct) {
      setProductHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    apiRequest<ApiResponse<{ transactions: InventoryTransaction[] }>>(
      `/inventory/ledger?sourceRfqItemId=${encodeURIComponent(selectedProduct.sourceRfqItemId)}&pageSize=100`
    )
      .then((response) => {
        if (!response.success) throw new Error(response.message || "Unable to load stock movement history.");
        if (active) setProductHistory(response.data?.transactions || []);
      })
      .catch((historyError) => {
        if (active) {
          setError(historyError instanceof Error ? historyError.message : "Unable to load stock movement history.");
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedProduct]);

  const saveReorderLevel = async (product: InventoryProduct) => {
    const rawValue = reorderEdits[product.sourceRfqItemId];
    const reorderLevel = Number(rawValue);
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      setError("Reorder level must be a non-negative number.");
      return;
    }
    setSavingProduct(product.sourceRfqItemId);
    setError("");
    try {
      await apiRequest(`/inventory/products/${product.sourceRfqItemId}/reorder-level`, {
        method: "PATCH",
        body: JSON.stringify({ reorderLevel }),
      });
      setReorderEdits((current) => {
        const next = { ...current };
        delete next[product.sourceRfqItemId];
        return next;
      });
      await loadInventory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update reorder level.");
    } finally {
      setSavingProduct(null);
    }
  };

  const categories = [...new Set(products.map((product) => product.category))].sort();
  const pageTitle = view === "stock"
    ? "Stock Management"
    : view === "ledger"
      ? "Inventory Ledger"
      : "Inventory Overview";

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-col bg-[#111D35] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500">
            <Warehouse size={21} />
          </div>
          <div>
            <p className="text-sm font-bold">SupplySense AI</p>
            <p className="mt-0.5 text-[10px] tracking-wide text-slate-400">INVENTORY OPERATIONS</p>
          </div>
        </div>
        <nav className="space-y-2 px-4 py-7">
          {routeTabs.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen lg:ml-[250px]">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
          <div>
            <p className="text-xs text-slate-400">Supply chain operations</p>
            <h1 className="mt-1 text-sm font-semibold text-slate-800">{pageTitle}</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadInventory();
              void loadLedger();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
          <nav className="flex flex-wrap gap-2 lg:hidden">
            {routeTabs.map(({ path, label }) => (
              <NavLink key={path} to={path} className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`
              }>
                {label}
              </NavLink>
            ))}
          </nav>

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button type="button" className="font-semibold underline" onClick={() => {
                void loadInventory();
                void loadLedger();
              }}>Retry</button>
            </div>
          )}

          {view === "overview" && (
            <>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-xl bg-white shadow-sm" />
                  ))}
                </div>
              ) : summary ? (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Products", value: summary.totalProducts, icon: Boxes },
                    { label: "Total stock", value: summary.totalStockQuantity, icon: PackageCheck },
                    { label: "Available", value: summary.availableStock, icon: CheckCircle2 },
                    { label: "Reserved", value: summary.reservedStock, icon: ShieldAlert },
                    { label: "Rejected", value: summary.rejectedStock, icon: AlertCircle },
                    { label: "On hold", value: summary.onHoldStock, icon: ShieldAlert },
                    { label: "Low-stock products", value: summary.lowStockProducts, icon: AlertCircle },
                    { label: "Inventory valuation", value: summary.inventoryValuation === null ? null : `₹${formatNumber(summary.inventoryValuation)}`, icon: CalendarDays },
                  ].map(({ label, value, icon: MetricIcon }) => {
                    return (
                      <article key={String(label)} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">{String(label)}</span>
                          <MetricIcon size={18} className="text-blue-600" />
                        </div>
                        <p className="mt-4 text-2xl font-bold text-slate-900">
                          {value === null ? "Not available" : typeof value === "number" ? formatNumber(value) : value}
                        </p>
                        {label === "Inventory valuation" && value === null && (
                          <p className="mt-1 text-[11px] text-slate-400">Reliable cost data is not available for all accepted stock.</p>
                        )}
                      </article>
                    );
                  })}
                </section>
              ) : !loading && (
                <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">No inventory summary is available.</div>
              )}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-800">Recent stock transactions</h2>
                {loading ? (
                  <p className="mt-4 text-sm text-slate-400">Loading transactions…</p>
                ) : recentTransactions.length ? (
                  <div className="mt-4 divide-y divide-slate-100">
                    {recentTransactions.map((transaction) => (
                      <div key={transaction._id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{transaction.productName}</p>
                          <p className="mt-1 text-slate-500">{transaction.transactionType.replaceAll("_", " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-700">
                            Accepted {formatNumber(transaction.acceptedQuantity ?? transaction.quantity)}
                            {transaction.rejectedQuantity ? ` · Rejected ${formatNumber(transaction.rejectedQuantity)}` : ""}
                            {transaction.onHoldQuantity ? ` · Hold ${formatNumber(transaction.onHoldQuantity)}` : ""}
                          </p>
                          <p className="mt-1 text-slate-400">{formatDate(transaction.postedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                    No QC-approved stock transactions have been posted yet.
                  </p>
                )}
              </section>
            </>
          )}

          {view === "stock" && (
            <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
                <label className="relative min-w-56 flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU or product" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
                </label>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="all">All categories</option>
                  {categories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="all">All locations</option>
                  <option value="unassigned">Unassigned location</option>
                  {locations.map((location) => <option key={location._id} value={location._id}>{location.name} ({location.code})</option>)}
                </select>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="all">All stock statuses</option>
                  <option value="healthy">In stock</option>
                  <option value="low_stock">Low stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading stock records…</div>
              ) : products.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>{["SKU / Product", "Category", "Location", "Total", "Available", "Reserved", "On hold", "Rejected", "Reorder level", "Status", "Last updated"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((product) => (
                        <tr key={product.sourceRfqItemId} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3"><button type="button" onClick={() => setSelectedProduct(product)} className="text-left font-semibold text-blue-700 hover:underline">{product.productName}</button><p className="mt-1 text-[10px] text-slate-400">{product.sku}</p></td>
                          <td className="px-4 py-3 text-slate-600">{product.category}</td>
                          <td className="px-4 py-3 text-slate-600">{product.locationName}</td>
                          <td className="px-4 py-3 font-semibold">{formatNumber(product.totalQuantity)} {product.unit}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">{formatNumber(product.availableQuantity)}</td>
                          <td className="px-4 py-3">{formatNumber(product.reservedQuantity)}</td>
                          <td className="px-4 py-3 text-amber-700">{formatNumber(product.onHoldQuantity)}</td>
                          <td className="px-4 py-3 text-rose-700">{formatNumber(product.rejectedQuantity)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <input aria-label={`Reorder level for ${product.productName}`} type="number" min="0" value={reorderEdits[product.sourceRfqItemId] ?? String(product.reorderLevel)} onChange={(event) => setReorderEdits((current) => ({ ...current, [product.sourceRfqItemId]: event.target.value }))} className="w-20 rounded border border-slate-200 px-2 py-1" />
                              <button type="button" onClick={() => void saveReorderLevel(product)} disabled={savingProduct === product.sourceRfqItemId} className="rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700 disabled:opacity-50">{savingProduct === product.sourceRfqItemId ? "…" : "Save"}</button>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${product.status === "healthy" ? "bg-emerald-50 text-emerald-700" : product.status === "low_stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{statusLabel[product.status]}</span></td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(product.lastUpdated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center">
                  <Boxes size={25} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No inventory records found</p>
                  <p className="mt-1 text-xs text-slate-500">Accepted stock appears here after a completed QC decision.</p>
                </div>
              )}
            </section>
          )}

          {view === "ledger" && (
            <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-end">
                <label className="text-xs font-semibold text-slate-600">From
                  <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-600">To
                  <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                </label>
                <p className="text-xs text-slate-500">Append-only records; corrections should be made with compensating entries.</p>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading ledger…</div>
              ) : ledger.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>{["Date", "Product", "Transaction", "Accepted", "Rejected", "On hold", "References", "Remarks"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry) => (
                        <tr key={entry._id}>
                          <td className="px-4 py-3 text-slate-500">{formatDate(entry.postedAt)}</td>
                          <td className="px-4 py-3 font-semibold">{entry.productName}</td>
                          <td className="px-4 py-3">{entry.transactionType.replaceAll("_", " ")}</td>
                          <td className="px-4 py-3 text-emerald-700">{formatNumber(entry.acceptedQuantity ?? (entry.transactionType === "qc_accepted_receipt" ? entry.quantity : 0))}</td>
                          <td className="px-4 py-3 text-rose-700">{formatNumber(entry.rejectedQuantity || 0)}</td>
                          <td className="px-4 py-3 text-amber-700">{formatNumber(entry.onHoldQuantity || 0)}</td>
                          <td className="px-4 py-3 text-slate-500">
                            <p>Delivery: {entry.deliveryId}</p>
                            <p className="mt-1">PO: {entry.purchaseOrderId}</p>
                            <p className="mt-1">QC: {entry.inspectionId}</p>
                          </td>
                          <td className="max-w-56 truncate px-4 py-3 text-slate-500">{entry.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-4 text-xs">
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={15} /></button>
                    <span>Page {page} of {totalPages}</span>
                    <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={15} /></button>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-slate-500">No inventory transactions match this date range.</div>
              )}
            </section>
          )}

            {selectedProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                <section role="dialog" aria-modal="true" aria-labelledby="inventory-product-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 id="inventory-product-title" className="text-lg font-bold text-slate-900">{selectedProduct.productName}</h2>
                      <p className="mt-1 text-xs text-slate-500">{selectedProduct.sku} · {selectedProduct.category} · {selectedProduct.locationName}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedProduct(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      ["Available", selectedProduct.availableQuantity],
                      ["Reserved", selectedProduct.reservedQuantity],
                      ["Rejected", selectedProduct.rejectedQuantity],
                      ["On hold", selectedProduct.onHoldQuantity],
                      ["Reorder level", selectedProduct.reorderLevel],
                    ].map(([label, amount]) => (
                      <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{formatNumber(Number(amount))}</p>
                      </div>
                    ))}
                  </div>
                  <h3 className="mt-6 text-sm font-bold text-slate-800">Stock movement history</h3>
                  {historyLoading ? (
                    <p className="mt-3 text-xs text-slate-500">Loading movements…</p>
                  ) : productHistory.length ? (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {productHistory.map((entry) => (
                        <li key={entry._id} className="flex flex-wrap justify-between gap-2 py-3 text-xs">
                          <div>
                            <p className="font-semibold text-slate-700">{entry.transactionType.replaceAll("_", " ")}</p>
                            <p className="mt-1 text-slate-500">Delivery {entry.deliveryId} · PO {entry.purchaseOrderId}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-700">
                              Accepted {formatNumber(entry.acceptedQuantity ?? (entry.transactionType === "qc_accepted_receipt" ? entry.quantity : 0))}
                              {" · "}Rejected {formatNumber(entry.rejectedQuantity || 0)}
                              {" · "}Hold {formatNumber(entry.onHoldQuantity || 0)}
                            </p>
                            <p className="mt-1 text-slate-400">{formatDate(entry.postedAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No stock movements are recorded for this product.</p>
                  )}
                </section>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
