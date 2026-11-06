
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  SlidersHorizontal,
  CalendarDays,
  MoreHorizontal,
  FileText,
  CheckCircle2,
  Clock3,
  Users,
  Eye,
  Copy,
  Download,
  ArrowUpRight,
  Package,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

// ==========================================
// TYPES
// ==========================================

type RFQStatus = "published" | "draft" | "closed" | "cancelled";

interface RFQItem {
  _id: string;
  productName: string;
  quantity: number;
  unit: string;
}

interface BackendRFQ {
  _id: string;
  rfqNumber: string;
  title: string;
  description: string;
  category: string;
  items: RFQItem[];
  visibility: "open" | "invited";
  invitedSuppliers: string[];
  deliveryLocation: string;
  deliveryDate: string;
  submissionDeadline: string;
  status: RFQStatus;
  createdAt: string;
  updatedAt: string;
}

interface RFQApiResponse {
  success: boolean;
  count: number;
  data: {
    rfqs: BackendRFQ[];
  };
}

interface RFQ {
  id: string;
  rfqNumber: string;
  title: string;
  category: string;
  suppliers: number | null;
  visibility: string;
  quotations: number | null;
  deadline: string;
  created: string;
  estimatedValue: string;
  status: RFQStatus;
  itemCount: number;
}

// ==========================================
// CONSTANTS
// ==========================================

const filters = [
  "All RFQs",
  "Published",
  "Draft",
  "Closed",
  "Cancelled",
];

const statusStyles: Record<RFQStatus, string> = {
  published: "bg-blue-50 text-blue-700 border-blue-100",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
};

const statusLabels: Record<RFQStatus, string> = {
  published: "Published",
  draft: "Draft",
  closed: "Closed",
  cancelled: "Cancelled",
};

// ==========================================
// DATE FORMATTER
// ==========================================

function formatDate(dateString: string): string {
  if (!dateString) return "—";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

// ==========================================
// COMPONENT
// ==========================================

export default function RFQManagement() {
  const navigate = useNavigate();

  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All RFQs");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  // ==========================================
  // FETCH RFQS FROM BACKEND
  // ==========================================

  const fetchRFQs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest<RFQApiResponse>("/rfqs");

      if (!response.success) {
        throw new Error("Unable to retrieve RFQs.");
      }

      const formattedRFQs: RFQ[] = response.data.rfqs.map((item) => ({
        id: item._id,
        rfqNumber: item.rfqNumber,
        title: item.title,
        category: item.category,
        suppliers:
          item.visibility === "invited"
            ? item.invitedSuppliers.length
            : null,
        visibility:
          item.visibility === "open"
            ? "Open to eligible suppliers"
            : "Invited suppliers",
        quotations: null,
        deadline: formatDate(item.submissionDeadline),
        created: formatDate(item.createdAt),
        estimatedValue: "Not specified",
        status: item.status,
        itemCount: item.items.length,
      }));

      setRfqs(formattedRFQs);
    } catch (err) {
      console.error("RFQ fetch error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading RFQs."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRFQs();
  }, [fetchRFQs]);

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================

  const filteredRFQs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        rfq.title.toLowerCase().includes(searchValue) ||
        rfq.rfqNumber.toLowerCase().includes(searchValue) ||
        rfq.category.toLowerCase().includes(searchValue);

      const matchesStatus =
        activeFilter === "All RFQs" ||
        statusLabels[rfq.status] === activeFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rfqs, search, activeFilter]);

  // ==========================================
  // PAGINATION
  // ==========================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRFQs.length / pageSize)
  );

  const paginatedRFQs = filteredRFQs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ==========================================
  // STATISTICS
  // ==========================================

  const stats = [
    {
      label: "Total RFQs",
      value: rfqs.length.toString().padStart(2, "0"),
      icon: FileText,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Published RFQs",
      value: rfqs
        .filter((r) => r.status === "published")
        .length.toString()
        .padStart(2, "0"),
      icon: ArrowUpRight,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Draft RFQs",
      value: rfqs
        .filter((r) => r.status === "draft")
        .length.toString()
        .padStart(2, "0"),
      icon: Clock3,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Closed RFQs",
      value: rfqs
        .filter((r) => r.status === "closed")
        .length.toString()
        .padStart(2, "0"),
      icon: CheckCircle2,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  // ==========================================
  // HANDLERS
  // ==========================================

  function changeFilter(filter: string) {
    setActiveFilter(filter);
    setCurrentPage(1);
  }

  function resetSearch() {
    setSearch("");
    setActiveFilter("All RFQs");
    setCurrentPage(1);
  }

  async function copyRFQId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setMenuOpen(null);
    } catch {
      setError("Unable to copy RFQ ID. Please copy it manually.");
    }
  }

  function exportRFQs() {
    const headers = [
      "RFQ Number",
      "Title",
      "Category",
      "Status",
      "Deadline",
      "Created",
      "Visibility",
      "Products",
    ];

    const rows = filteredRFQs.map((rfq) => [
      rfq.rfqNumber,
      rfq.title,
      rfq.category,
      statusLabels[rfq.status],
      rfq.deadline,
      rfq.created,
      rfq.visibility,
      rfq.itemCount.toString(),
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "SupplySense-RFQs.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1600px] space-y-6 p-5 md:p-8">

        {/* PAGE HEADING */}

        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Procurement</span>
              <span>/</span>
              <span className="font-medium text-blue-600">
                RFQ Management
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Request for Quotations
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create, manage and monitor your procurement requests.
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

        {/* STATISTICS */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">
                    {stat.label}
                  </p>

                  <div className={`rounded-lg p-2.5 ${stat.color}`}>
                    <Icon size={19} />
                  </div>
                </div>

                <h2 className="mt-4 text-2xl font-bold text-slate-900">
                  {loading ? "—" : stat.value}
                </h2>
              </div>
            );
          })}
        </section>

        {/* MAIN LISTING */}

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">

          {/* LISTING HEADING */}

          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                All Requests for Quotations
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                View and manage your organization's procurement requests.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportRFQs}
                disabled={filteredRFQs.length === 0}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Download size={15} />
                Export
              </button>

              <button
                onClick={resetSearch}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <SlidersHorizontal size={15} />
                Reset Filters
              </button>

              <button
                onClick={() => void fetchRFQs()}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* FILTERS */}

          <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => changeFilter(filter)}
                    className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold transition ${
                      activeFilter === filter
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 md:w-[260px]">
                <Search size={16} className="text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search RFQ or category..."
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* ERROR MESSAGE */}

          {error && (
            <div className="m-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <div className="flex-1">
                <p className="text-xs font-semibold text-red-700">
                  Unable to load RFQs
                </p>
                <p className="mt-1 text-xs text-red-600">{error}</p>
              </div>

              <button
                onClick={() => void fetchRFQs()}
                className="text-xs font-semibold text-red-700 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-50/80">
                <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-4">RFQ Details</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Products</th>
                  <th className="px-5 py-4">Supplier Access</th>
                  <th className="px-5 py-4">Quotations</th>
                  <th className="px-5 py-4">Deadline</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {/* LOADING */}

                {loading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <Loader2
                        size={26}
                        className="mx-auto animate-spin text-blue-600"
                      />
                      <p className="mt-3 text-xs text-slate-500">
                        Loading your RFQs...
                      </p>
                    </td>
                  </tr>
                )}

                {/* DATA */}

                {!loading &&
                  !error &&
                  paginatedRFQs.map((rfq) => (
                    <tr
                      key={rfq.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileText size={17} />
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-slate-800">
                              {rfq.title}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {rfq.rfqNumber}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        {rfq.category}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Package size={14} className="text-slate-400" />
                          {rfq.itemCount} items
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Users size={14} className="text-slate-400" />
                          {rfq.suppliers === null
                            ? "Open"
                            : `${rfq.suppliers} invited`}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {rfq.visibility}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        Not available
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <CalendarDays
                            size={14}
                            className="text-slate-400"
                          />
                          {rfq.deadline}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyles[rfq.status]}`}
                        >
                          {statusLabels[rfq.status]}
                        </span>
                      </td>

                      <td className="relative px-5 py-4">
                        <button
                          onClick={() =>
                            setMenuOpen(
                              menuOpen === rfq.id ? null : rfq.id
                            )
                          }
                          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${rfq.rfqNumber}`}
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {menuOpen === rfq.id && (
                          <div className="absolute right-8 top-10 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                            <button
                              onClick={() => {
                                navigate(`/procurement/rfqs/${rfq.id}`);
                                setMenuOpen(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={14} />
                              View Details
                            </button>

                            <button
                              onClick={() => {
                                void copyRFQId(rfq.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Copy size={14} />
                              Copy MongoDB ID
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                {/* EMPTY STATE */}

                {!loading &&
                  !error &&
                  paginatedRFQs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Package size={22} />
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          {rfqs.length === 0
                            ? "No RFQs created yet"
                            : "No RFQs found"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {rfqs.length === 0
                            ? "Create your first procurement request to get started."
                            : "Try changing your search or status filter."}
                        </p>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-[11px] text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredRFQs.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
                {" - "}
                {Math.min(
                  currentPage * pageSize,
                  filteredRFQs.length
                )}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {filteredRFQs.length}
              </span>{" "}
              RFQs
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage((page) => page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                    currentPage === page
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages || loading}
                onClick={() => setCurrentPage((page) => page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}

        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 text-[10px] text-slate-400">
          <p>SupplySense AI · Procurement Management</p>
          <p>Live data from your organization</p>
        </div>
      </div>
    </div>
  );
}
