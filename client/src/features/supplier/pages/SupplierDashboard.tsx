
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Bell,
  Box,
  Building2,
  CalendarDays,
  ChartColumnIncreasing,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

interface CurrentUserResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
      companyName?: string;
      accountStatus: string;
      supplierApprovalStatus?: string;
    };
  };
}

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "RFQs", icon: FileText },
  { label: "Quotations", icon: ClipboardCheck },
  { label: "Purchase Orders", icon: ShoppingCart },
  { label: "Deliveries", icon: Truck },
  { label: "Invoices", icon: Wallet },
  { label: "My Catalog", icon: Package },
  { label: "Communications", icon: MessageCircle },
  { label: "Performance", icon: ChartNoAxesCombined },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Documents", icon: FileText },
];

const kpis = [
  {
    label: "Active RFQs",
    value: "5",
    detail: "2 new this week",
    icon: FileText,
    color: "blue",
    trend: "up",
  },
  {
    label: "Quotations Submitted",
    value: "8",
    detail: "3 pending response",
    icon: ClipboardCheck,
    color: "purple",
    trend: "up",
  },
  {
    label: "Purchase Orders",
    value: "6",
    detail: "3 in progress",
    icon: CreditCard,
    color: "green",
    trend: "neutral",
  },
  {
    label: "Deliveries",
    value: "4",
    detail: "1 pending",
    icon: Truck,
    color: "orange",
    trend: "neutral",
  },
  {
    label: "Invoices",
    value: "7",
    detail: "2 overdue",
    icon: FileText,
    color: "red",
    trend: "down",
  },
];

const rfqs = [
  {
    id: "RFQ-2026-001",
    title: "Laptops for New Joiners",
    buyer: "ABC Technologies",
    category: "IT Equipment",
    due: "Oct 28, 2026",
  },
  {
    id: "RFQ-2026-002",
    title: "Office Chairs",
    buyer: "Global Retail Ltd",
    category: "Office Furniture",
    due: "Oct 30, 2026",
  },
  {
    id: "RFQ-2026-003",
    title: "Network Switches",
    buyer: "TechCorp",
    category: "IT Hardware",
    due: "Nov 02, 2026",
  },
  {
    id: "RFQ-2026-004",
    title: "CCTV Cameras",
    buyer: "InfraBuild Ltd",
    category: "Security Equipment",
    due: "Nov 05, 2026",
  },
  {
    id: "RFQ-2026-005",
    title: "Monitors (Bulk)",
    buyer: "Sunrise Enterprises",
    category: "IT Equipment",
    due: "Nov 07, 2026",
  },
];

const actions = [
  {
    title: "Submit quotation for RFQ-2026-001",
    due: "Due in 2 days",
    icon: ClipboardCheck,
    urgent: true,
  },
  {
    title: "Provide clarification for RFQ-2026-003",
    due: "Due in 3 days",
    icon: CircleHelp,
    urgent: false,
  },
  {
    title: "Upload delivery documents for PO-2026-045",
    due: "Due in 1 day",
    icon: FileText,
    urgent: true,
  },
  {
    title: "Invoice INV-2026-017 is overdue",
    due: "Due 5 days ago",
    icon: AlertCircle,
    urgent: true,
  },
  {
    title: "Update compliance documents",
    due: "Due in 7 days",
    icon: ClipboardCheck,
    urgent: false,
  },
];

const purchaseOrders = [
  { id: "PO-2026-045", item: 'MacBook Pro 14"', qty: 5, date: "Oct 28, 2026", status: "In Transit" },
  { id: "PO-2026-042", item: "Office Chairs", qty: 10, date: "Oct 25, 2026", status: "Delivered" },
  { id: "PO-2026-038", item: 'Monitors (24")', qty: 15, date: "Oct 22, 2026", status: "Delivered" },
  { id: "PO-2026-035", item: "Network Switch", qty: 3, date: "Nov 02, 2026", status: "Preparing" },
  { id: "PO-2026-033", item: "CCTV Cameras", qty: 6, date: "Nov 05, 2026", status: "Pending" },
];

const invoices = [
  { id: "INV-2026-017", po: "PO-2026-038", amount: "₹4,75,000", status: "Overdue" },
  { id: "INV-2026-016", po: "PO-2026-036", amount: "₹2,10,000", status: "Paid" },
  { id: "INV-2026-015", po: "PO-2026-032", amount: "₹3,80,000", status: "Paid" },
  { id: "INV-2026-014", po: "PO-2026-028", amount: "₹1,25,000", status: "Processing" },
  { id: "INV-2026-013", po: "PO-2026-020", amount: "₹6,40,000", status: "Paid" },
];

const buyers = [
  { name: "ABC Technologies", amount: "₹18,20,000", orders: 12, width: "100%", color: "bg-blue-600" },
  { name: "Global Retail Ltd", amount: "₹8,50,000", orders: 8, width: "55%", color: "bg-blue-500" },
  { name: "TechCorp", amount: "₹6,40,000", orders: 6, width: "40%", color: "bg-blue-500" },
  { name: "InfraBuild Ltd", amount: "₹5,20,000", orders: 5, width: "32%", color: "bg-blue-500" },
  { name: "Sunrise Enterprises", amount: "₹3,10,000", orders: 4, width: "22%", color: "bg-blue-500" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-emerald-100 text-emerald-700",
    "In Transit": "bg-blue-100 text-blue-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Preparing: "bg-amber-100 text-amber-700",
    Pending: "bg-red-100 text-red-700",
    Paid: "bg-emerald-100 text-emerald-700",
    Overdue: "bg-red-100 text-red-700",
    Processing: "bg-amber-100 text-amber-700",
  };

  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function SupplierDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState<CurrentUserResponse["data"]["user"] | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeNavigation, setActiveNavigation] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const response = await apiRequest<CurrentUserResponse>("/auth/me");
        const currentUser = response.data.user;

        if (!active) return;

        if (
          currentUser.role !== "supplier" ||
          currentUser.supplierApprovalStatus !== "approved"
        ) {
          navigate("/auth/supplier/login", { replace: true });
          return;
        }

        setUser(currentUser);
        setCheckingSession(false);
      } catch {
        if (active) {
          navigate("/auth/supplier/login", { replace: true });
        }
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    setLogoutLoading(true);

    try {
      await apiRequest("/auth/logout", { method: "POST" });
      navigate("/", { replace: true });
    } catch {
      setLogoutLoading(false);
    }
  };

  if (checkingSession || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-sm text-slate-500">Loading your supplier workspace...</p>
        </div>
      </div>
    );
  }

  const companyName = user.companyName || user.fullName;
  const initials = companyName.slice(0, 2).toUpperCase();

  const filteredRfqs = rfqs.filter((rfq) =>
    `${rfq.id} ${rfq.title} ${rfq.buyer} ${rfq.category}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const navItems = (
    <>
      <div className="mb-4 px-3">
        <button className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-white/10">
          <span className="flex items-center gap-2.5">
            <Search size={17} />
            Supplier Portal
          </span>
          <ChevronDown size={15} />
        </button>
      </div>

      <nav className="space-y-0.5 px-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const selected = activeNavigation === item.label;

          return (
            <button
              key={item.label}
              onClick={() => {
                setMobileSidebar(false);

                if (item.label === "Dashboard") {
                  setActiveNavigation("Dashboard");
                  navigate("/supplier/dashboard");
                } else if (item.label === "RFQs") {
                  setActiveNavigation("RFQs");
                  navigate("/supplier/rfqs");
                } else if (item.label === "Purchase Orders") {
                  setActiveNavigation("Purchase Orders");
                  navigate("/supplier/purchase-orders");
                } else {
                  setActiveNavigation(item.label);
                }
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                selected
                  ? "bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-0.5 px-2 pb-3 pt-5">
        <button
          onClick={() => setActiveNavigation("Settings")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Settings size={19} />
          Settings
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <LogOut size={19} />
          {logoutLoading ? "Logging out..." : "Logout"}
        </button>
      </div>
    </>
  );

  const viewAllButton = (
    <button className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
      View All
    </button>
  );

  const rfqViewAllButton = (
    <button
      onClick={() => navigate("/supplier/rfqs")}
      className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
    >
      View All
    </button>
  );

  const purchaseOrderViewAllButton = (
    <button
      onClick={() => navigate("/supplier/purchase-orders")}
      className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
    >
      View All
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-slate-900 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* DESKTOP SIDEBAR */}
      <aside className="sticky top-0 z-30 hidden h-screen min-h-0 w-[240px] flex-col bg-[#071827] text-white lg:flex">
        <div className="flex h-[68px] items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Box size={23} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            SupplySense <span className="text-blue-400">AI</span>
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4">
          {navItems}
        </div>
      </aside>

      {/* MOBILE SIDEBAR */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebar(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[270px] flex-col bg-[#071827] text-white">
            <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-5">
              <span className="font-bold">SupplySense <span className="text-blue-400">AI</span></span>
              <button onClick={() => setMobileSidebar(false)}><X size={21} /></button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto py-5">{navItems}</div>
          </aside>
        </div>
      )}

      {/* MAIN AREA */}
      <div className="min-w-0">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setMobileSidebar(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div className="relative hidden w-full max-w-[600px] sm:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search RFQs, POs, quotations, messages..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-16 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-400">
                Ctrl K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <Bell size={21} />
                <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold leading-4 text-white">3</span>
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-12 z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="font-semibold">Notifications</p>
                  <p className="mt-3 text-sm text-slate-500">You have 3 pending supplier actions.</p>
                  <button onClick={() => setNotificationOpen(false)} className="mt-3 text-xs font-semibold text-blue-600">Close</button>
                </div>
              )}
            </div>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <button className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {initials}
              </div>

              <div className="hidden sm:block">
                <p className="max-w-[180px] truncate text-sm font-semibold">{companyName}</p>
                <p className="text-xs text-slate-500">Supplier</p>
              </div>
              <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
            </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-5 xl:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
                Supplier Workspace
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]">
                Welcome back, {companyName}!
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Here's an overview of your active opportunities and performance.
              </p>
            </div>

            <button
              onClick={() => setActiveNavigation("Company Profile")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Building2 size={17} />
              View My Company Profile
            </button>
          </div>

          {/* KPI CARDS */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;

              const colors: Record<string, string> = {
                blue: "bg-blue-50 text-blue-600",
                purple: "bg-purple-50 text-purple-600",
                green: "bg-emerald-50 text-emerald-600",
                orange: "bg-orange-50 text-orange-600",
                red: "bg-red-50 text-red-600",
              };

              return (
                <div key={kpi.label} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${colors[kpi.color]}`}>
                      <Icon size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{kpi.label}</p>
                      <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
                    </div>
                  </div>
                  <p className={`mt-2 text-xs ${
                    kpi.trend === "down" ? "text-red-600" :
                    kpi.trend === "up" ? "text-emerald-600" : "text-blue-600"
                  }`}>
                    {kpi.trend === "up" ? "↑ " : ""}
                    {kpi.detail}
                  </p>
                </div>
              );
            })}
          </div>

          {/* RFQ TABLE + ACTION REQUIRED */}
          <div className="mb-5 grid grid-cols-1 gap-4 2xl:grid-cols-[1.8fr_1fr]">
            <Panel
              title="Recent RFQs"
              subtitle="Latest requests from buyers. Submit your quotations before the deadline."
              action={rfqViewAllButton}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      {["RFQ No.", "Title", "Buyer", "Category", "Response Due Date", "Status", "Action"].map((heading) => (
                        <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRfqs.map((rfq) => (
                      <tr key={rfq.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-blue-600">{rfq.id}</td>
                        <td className="whitespace-nowrap px-3 py-3">{rfq.title}</td>
                        <td className="whitespace-nowrap px-3 py-3">{rfq.buyer}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{rfq.category}</td>
                        <td className="whitespace-nowrap px-3 py-3">{rfq.due}</td>
                        <td className="px-3 py-3"><StatusBadge status="Open" /></td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => navigate("/supplier/rfqs")}
                            className="rounded-md border border-blue-200 px-3 py-1 text-blue-600 hover:bg-blue-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRfqs.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-500">No matching RFQs found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Action Required" subtitle="Tasks that need your attention">
              <div className="divide-y divide-slate-100">
                {actions.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.title}
                      onClick={() => navigate("/supplier/rfqs")}
                      className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
                    >
                      <div className={`rounded-lg p-2 ${item.urgent ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-5 text-slate-800">{item.title}</p>
                        <p className={`mt-0.5 text-[11px] ${item.urgent ? "text-red-600" : "text-slate-400"}`}>{item.due}</p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-blue-600" />
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* PURCHASE ORDERS, DELIVERIES, INVOICES */}
          <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title="Purchase Order Status" subtitle="Overview of your current purchase orders." action={purchaseOrderViewAllButton}>
              <div className="flex flex-wrap items-center justify-center gap-5 py-3">
                <div
                  className="flex h-40 w-40 items-center justify-center rounded-full"
                  style={{
                    background: "conic-gradient(#3b82f6 0% 33%, #10b981 33% 66%, #fbbf24 66% 83%, #ef4444 83% 100%)",
                  }}
                >
                  <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-3xl font-bold">6</span>
                    <span className="text-xs text-slate-500">Total POs</span>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    ["bg-blue-500", "2 In Progress", "33%"],
                    ["bg-emerald-500", "2 Delivered", "33%"],
                    ["bg-amber-400", "1 Partially Delivered", "17%"],
                    ["bg-red-500", "1 Cancelled", "17%"],
                  ].map(([color, label, percentage]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${color}`} />
                      <span className="text-slate-600">{label}</span>
                      <span className="ml-auto font-medium">{percentage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Deliveries" subtitle="Track your upcoming and completed deliveries." action={viewAllButton}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[350px] text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2">PO No.</th>
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-2 py-3 font-medium text-blue-600">{po.id}</td>
                        <td className="whitespace-nowrap px-2 py-3">{po.item}</td>
                        <td className="px-2 py-3">{po.qty}</td>
                        <td className="px-2 py-3"><StatusBadge status={po.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Invoices" subtitle="Recent invoices and payment status." action={viewAllButton}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[330px] text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2">Invoice No.</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-2 py-3 font-medium text-blue-600">{invoice.id}</td>
                        <td className="whitespace-nowrap px-2 py-3">{invoice.amount}</td>
                        <td className="px-2 py-3"><StatusBadge status={invoice.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ANALYTICS */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel
              title="Spend Trend"
              subtitle="Purchase order value over the last 6 months."
              action={
                <select className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none">
                  <option>Last 6 Months</option>
                  <option>Last 12 Months</option>
                </select>
              }
            >
              <div className="flex h-48 items-end justify-between gap-3 border-b border-l border-slate-200 px-3 pb-2 pt-5">
                {[
                  ["May", 25],
                  ["Jun", 38],
                  ["Jul", 45],
                  ["Aug", 58],
                  ["Sep", 72],
                  ["Oct", 88],
                ].map(([month, height]) => (
                  <div key={month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div
                      className="w-full max-w-10 rounded-t-sm bg-blue-500 transition hover:bg-blue-700"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] text-slate-500">{month}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Top Buyers" subtitle="Your key customers by purchase value." action={viewAllButton}>
              <div className="space-y-4">
                {buyers.map((buyer, index) => (
                  <div key={buyer.name} className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      {buyer.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium">{buyer.name}</span>
                        <span className="whitespace-nowrap text-slate-500">{buyer.amount}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${buyer.color}`} style={{ width: buyer.width }} />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-[10px] text-slate-500">{buyer.orders} POs</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Supplier Performance"
              subtitle="Your performance with buyers."
              action={
                <select className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none">
                  <option>Last 6 Months</option>
                  <option>Last 12 Months</option>
                </select>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "On-Time Delivery", value: "92%", detail: "Excellent", icon: Truck, color: "emerald" },
                  { label: "Quality Rating", value: "4.8 / 5.0", detail: "Excellent", icon: Star, color: "amber" },
                  { label: "Response Rate", value: "96%", detail: "Excellent", icon: ClipboardCheck, color: "emerald" },
                  { label: "Repeat Orders", value: "78%", detail: "Good", icon: ChartColumnIncreasing, color: "blue" },
                ].map((metric) => {
                  const Icon = metric.icon;

                  return (
                    <div key={metric.label} className="rounded-lg border border-slate-100 p-3">
                      <div className={`mb-2 inline-flex rounded-lg p-2 ${
                        metric.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                        metric.color === "amber" ? "bg-amber-50 text-amber-600" :
                        "bg-blue-50 text-blue-600"
                      }`}>
                        <Icon size={19} />
                      </div>
                      <p className="text-[10px] text-slate-500">{metric.label}</p>
                      <p className="mt-1 text-lg font-bold">{metric.value}</p>
                      <p className="text-[10px] font-medium text-emerald-600">{metric.detail}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <span>© 2026 SupplySense AI. All rights reserved.</span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} />
              Secure Supplier Workspace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
