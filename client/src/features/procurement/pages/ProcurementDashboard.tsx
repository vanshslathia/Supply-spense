
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  ShoppingCart,
  Truck,
  Receipt,
  BarChart3,
  Settings,
  HelpCircle,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  CalendarDays,
  Clock3,
  CheckCircle2,
  CircleAlert,
  Package,
  Wallet,
  Plus,
  Boxes,
} from "lucide-react";

// ==========================================
// NAVIGATION
// ==========================================

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "RFQ Management", icon: FileText },
  { label: "Suppliers", icon: Users },
  { label: "Quotations", icon: ClipboardList, count: "8" },
  { label: "Purchase Orders", icon: ShoppingCart },
  { label: "Deliveries", icon: Truck },
  { label: "Inventory", icon: Boxes },
  { label: "Invoices", icon: Receipt },
  { label: "Reports & Analytics", icon: BarChart3 },
];

// ==========================================
// DASHBOARD DATA
// ==========================================

const kpis = [
  {
    title: "Total Procurement Spend",
    value: "₹24.8L",
    change: "+12.8%",
    description: "vs. last month",
    positive: true,
    icon: Wallet,
    color: "blue",
  },
  {
    title: "Active RFQs",
    value: "24",
    change: "+8.2%",
    description: "vs. last month",
    positive: true,
    icon: FileText,
    color: "violet",
  },
  {
    title: "Pending Quotations",
    value: "08",
    change: "-4.5%",
    description: "vs. last month",
    positive: true,
    icon: ClipboardList,
    color: "orange",
  },
  {
    title: "Active Purchase Orders",
    value: "36",
    change: "+6.3%",
    description: "vs. last month",
    positive: true,
    icon: ShoppingCart,
    color: "green",
  },
];

const rfqs = [
  {
    id: "RFQ-2026-024",
    title: "Stainless Steel Sheets",
    supplier: "12 Suppliers",
    deadline: "06 Nov 2026",
    quotations: "8 / 12",
    status: "Published",
  },
  {
    id: "RFQ-2026-023",
    title: "Industrial Bearings",
    supplier: "8 Suppliers",
    deadline: "08 Nov 2026",
    quotations: "5 / 8",
    status: "Published",
  },
  {
    id: "RFQ-2026-022",
    title: "Copper Wire Rolls",
    supplier: "10 Suppliers",
    deadline: "10 Nov 2026",
    quotations: "3 / 10",
    status: "Under Review",
  },
  {
    id: "RFQ-2026-021",
    title: "Hydraulic Pumps",
    supplier: "6 Suppliers",
    deadline: "12 Nov 2026",
    quotations: "6 / 6",
    status: "Completed",
  },
];

const purchaseOrders = [
  {
    id: "PO-2026-184",
    supplier: "Tata Industrial Supplies",
    amount: "₹4,85,000",
    status: "In Progress",
  },
  {
    id: "PO-2026-183",
    supplier: "ABC Steel Industries",
    amount: "₹2,40,000",
    status: "Awaiting Delivery",
  },
  {
    id: "PO-2026-182",
    supplier: "Global Components",
    amount: "₹1,75,000",
    status: "Delivered",
  },
];

const spendData = [
  { month: "May", value: 42 },
  { month: "Jun", value: 58 },
  { month: "Jul", value: 47 },
  { month: "Aug", value: 73 },
  { month: "Sep", value: 62 },
  { month: "Oct", value: 88 },
];

const statusStyles: Record<string, string> = {
  Published: "bg-blue-50 text-blue-700",
  "Under Review": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  "In Progress": "bg-blue-50 text-blue-700",
  "Awaiting Delivery": "bg-amber-50 text-amber-700",
  Delivered: "bg-emerald-50 text-emerald-700",
};

// ==========================================
// COMPONENT
// ==========================================

export default function ProcurementDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine active sidebar item from current URL
  const activePage = location.pathname.startsWith("/procurement/rfqs")
    ? "RFQ Management"
    : location.pathname.startsWith("/procurement/quotations")
      ? "Quotations"
      : location.pathname.startsWith("/procurement/purchase-orders")
        ? "Purchase Orders"
        : location.pathname.startsWith("/procurement/deliveries")
          ? "Deliveries"
          : location.pathname.startsWith("/inventory/")
            ? "Inventory"
          : location.pathname === "/procurement/dashboard"
            ? "Overview"
            : "Overview";

  // ==========================================
  // NAVIGATION HANDLER
  // ==========================================

  const handleNavigation = (label: string) => {
    setSidebarOpen(false);

    switch (label) {
      case "Overview":
        navigate("/procurement/dashboard");
        break;

      case "RFQ Management":
        navigate("/procurement/rfqs");
        break;

      case "Quotations":
        navigate("/procurement/quotations");
        break;

      case "Purchase Orders":
        navigate("/procurement/purchase-orders");
        break;

      case "Deliveries":
        navigate("/procurement/deliveries");
        break;

      case "Inventory":
        navigate("/inventory/overview");
        break;

      default:
        // Other sections will be connected when their routes are implemented.
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800">

      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col bg-[#111D35] text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[82px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
            <Package size={23} />
          </div>

          <div>
            <h1 className="text-[17px] font-bold tracking-tight">
              SupplySense <span className="text-blue-400">AI</span>
            </h1>

            <p className="text-[10px] tracking-[2px] text-slate-400">
              PROCUREMENT PLATFORM
            </p>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pt-7">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[1.8px] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.label;

              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] transition ${
                    active
                      ? "bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.8} />

                  <span className="flex-1">{item.label}</span>

                  {item.count && (
                    <span className="rounded-md bg-blue-400/20 px-2 py-0.5 text-[10px] text-blue-300">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}

        <div className="mt-auto px-5 pb-5">
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2">
              <HelpCircle size={17} className="text-blue-400" />
              <p className="text-xs font-semibold">Need assistance?</p>
            </div>

            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              Get help with your procurement operations.
            </p>

            <button className="text-xs font-semibold text-blue-400 hover:text-blue-300">
              Contact Support →
            </button>
          </div>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
            <Settings size={18} />
            Settings
          </button>

          <div className="mt-3 border-t border-white/10 pt-4 text-center text-[10px] text-slate-500">
            SupplySense AI · Version 1.0
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}

      <main className="min-h-screen lg:ml-[255px]">

        {/* TOP NAVIGATION */}

        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="text-xs text-slate-400">
                Workspace / {activePage}
              </p>

              <h2 className="text-sm font-bold text-slate-800">
                Procurement Workspace
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden h-10 w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 md:flex">
              <Search size={16} className="text-slate-400" />

              <input
                placeholder="Search anything..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
              />

              <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400">
                /
              </span>
            </div>

            <button
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Bell size={19} />

              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>

            <div className="hidden h-8 border-l border-slate-200 sm:block" />

            <button className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                VM
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold">Vansh Manager</p>
                <p className="text-[10px] text-slate-400">
                  Procurement Manager
                </p>
              </div>

              <ChevronDown
                size={15}
                className="hidden text-slate-400 sm:block"
              />
            </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}

        <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">

          {/* PAGE HEADING */}

          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">
                Tuesday, November 4, 2026
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[27px]">
                Good morning, Vansh <span>👋</span>
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Here's what's happening with your procurement operations.
              </p>
            </div>

            <button
              onClick={() => navigate("/procurement/rfqs/create")}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Create New RFQ
            </button>
          </section>

          {/* KPI CARDS */}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon;

              const colors: Record<string, string> = {
                blue: "bg-blue-50 text-blue-600",
                violet: "bg-violet-50 text-violet-600",
                orange: "bg-orange-50 text-orange-600",
                green: "bg-emerald-50 text-emerald-600",
              };

              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      {item.title}
                    </p>

                    <div className={`rounded-lg p-2.5 ${colors[item.color]}`}>
                      <Icon size={19} />
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <h3 className="text-[27px] font-bold tracking-tight text-slate-900">
                      {item.value}
                    </h3>

                    <span className="mb-1 flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
                      {item.positive ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <ArrowDownRight size={14} />
                      )}

                      {item.change}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </section>

          {/* ANALYTICS AND ACTION REQUIRED */}

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Procurement Spend Overview
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Monthly procurement expenditure
                  </p>
                </div>

                <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600">
                  <CalendarDays size={14} />
                  Last 6 months
                  <ChevronDown size={13} />
                </button>
              </div>

              <div className="flex h-[220px]">
                <div className="flex flex-col justify-between pb-7 pr-3 text-[10px] text-slate-400">
                  <span>₹100L</span>
                  <span>₹75L</span>
                  <span>₹50L</span>
                  <span>₹25L</span>
                  <span>₹0</span>
                </div>

                <div className="relative flex flex-1 flex-col justify-between pb-7">
                  <div className="absolute inset-0 bottom-7 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((line) => (
                      <div
                        key={line}
                        className="border-t border-dashed border-slate-100"
                      />
                    ))}
                  </div>

                  <div className="relative z-10 flex h-full items-end justify-around gap-3">
                    {spendData.map((item) => (
                      <div
                        key={item.month}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <div
                          className="group relative w-full max-w-[42px] rounded-t-md bg-blue-500 transition hover:bg-blue-700"
                          style={{ height: `${item.value * 0.82}%` }}
                        >
                          <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[9px] text-white group-hover:block">
                            {item.value}L
                          </span>
                        </div>

                        <span className="absolute bottom-0 text-[10px] text-slate-400">
                          {item.month}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION REQUIRED */}

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Action Required
                  </h3>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Items requiring your attention
                  </p>
                </div>

                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">
                  5 Pending
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <Clock3 size={17} />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      Quotations awaiting review
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      3 quotations need comparison
                    </p>
                  </div>

                  <span className="text-xs font-bold text-orange-600">
                    3
                  </span>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <CircleAlert size={17} />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      RFQs closing soon
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      2 RFQs close within 48 hours
                    </p>
                  </div>

                  <span className="text-xs font-bold text-red-600">
                    2
                  </span>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Receipt size={17} />
                  </div>

                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      Invoice verification
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      No new invoices pending
                    </p>
                  </div>

                  <CheckCircle2
                    size={16}
                    className="text-emerald-500"
                  />
                </div>
              </div>

              <button className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                View All Activities
              </button>
            </div>
          </section>

          {/* RFQ TABLE */}

          <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Request for Quotations
                </h3>

                <p className="mt-1 text-[11px] text-slate-400">
                  Monitor your latest procurement requests
                </p>
              </div>

              <button
                onClick={() => navigate("/procurement/rfqs")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All RFQs →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">RFQ Details</th>
                    <th className="px-5 py-3 font-semibold">Suppliers</th>
                    <th className="px-5 py-3 font-semibold">Deadline</th>
                    <th className="px-5 py-3 font-semibold">Quotations</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rfqs.map((rfq) => (
                    <tr
                      key={rfq.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold text-slate-800">
                          {rfq.title}
                        </p>

                        <p className="mt-1 text-[10px] text-slate-400">
                          {rfq.id}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {rfq.supplier}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {rfq.deadline}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-slate-700">
                        {rfq.quotations}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[rfq.status]}`}
                        >
                          {rfq.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => navigate("/procurement/rfqs")}
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`View ${rfq.id}`}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* PURCHASE ORDERS */}

          <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Purchase Orders
                </h3>

                <p className="mt-1 text-[11px] text-slate-400">
                  Track your latest supplier orders
                </p>
              </div>

              <button
                onClick={() => navigate("/procurement/purchase-orders")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => (
                <div
                  key={po.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <ShoppingCart size={18} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {po.id}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        {po.supplier}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-slate-800">
                    {po.amount}
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold ${statusStyles[po.status]}`}
                  >
                    {po.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* FOOTER */}

          <footer className="flex flex-wrap items-center justify-between gap-2 py-2 text-[10px] text-slate-400">
            <p>© 2026 SupplySense AI. All rights reserved.</p>
            <p>Procurement Management Platform</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
