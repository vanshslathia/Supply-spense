
import { useEffect, useState } from "react";
import {
  Truck,
  ShieldCheck,
  BriefcaseBusiness,
  Wallet,
  ChartNoAxesCombined,
  ShoppingCart,
  FileText,
  ArrowRight,
  Check,
  Box,
  Users,
  Package,
  Warehouse,
  ClipboardCheck,
} from "lucide-react";

import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Link,
  Navigate,
} from "react-router-dom";
import { ApiError, apiRequest } from "./lib/api";

import LoginPage from "./features/auth/pages/LoginPage";
import SupplierDashboard from "./features/supplier/pages/SupplierDashboard";
import ProcurementDashboard from "./features/procurement/pages/ProcurementDashboard";
import RFQManagement from "./features/procurement/pages/RFQManagement";
import CreateRFQ from "./features/procurement/pages/CreateRFQ";
import RFQDetails from "./features/procurement/pages/RFQDetails";
import QuotationComparison from "./features/procurement/pages/QuotationComparison";
import PurchaseOrders from "./features/procurement/pages/PurchaseOrders";
import SupplierRFQs from "./features/supplier/pages/SupplierRFQs";
import SupplierRFQDetails from "./features/supplier/pages/SupplierRFQDetails";
import SupplierPurchaseOrders from "./features/supplier/pages/SupplierPurchaseOrders";
import Quotations from "./features/procurement/pages/Quotations";
import WarehouseDashboard from "./features/warehouse/pages/WarehouseDashboard";
import ProcurementDeliveries from "./features/procurement/pages/ProcurementDeliveries";
import AdminDashboard from "./features/admin/pages/AdminDashboard";
import AdminOverview from "./features/admin/pages/AdminOverview";
import UserManagement from "./features/admin/pages/UserManagement";
import OrganizationManagement from "./features/admin/pages/OrganizationManagement";
import QCInspectorDashboard from "./features/qc-inspector/pages/QCInspectorDashboard";
import InventoryDashboard from "./features/inventory/pages/InventoryDashboard";





import "./App.css";

// ==========================================
// ROLE CONFIGURATION
// ==========================================

const roles = [
  {
    id: "supplier",
    title: "Supplier",
    description: "Manage your business and grow with us",
    icon: Truck,
    color: "blue",
    features: [
      "Manage Bids & RFQs",
      "Track Orders & Deliveries",
      "Upload Invoices",
      "View Performance",
    ],
  },
  {
    id: "admin",
    title: "Admin",
    description: "Manage system and platform operations",
    icon: Users,
    color: "purple",
    features: [
      "User & Role Management",
      "System Configuration",
      "Analytics Dashboard",
      "Audit & Compliance",
    ],
  },
  {
    id: "procurement",
    title: "Procurement Manager",
    description: "Oversee procurement operations and team performance",
    icon: BriefcaseBusiness,
    color: "green",
    features: [
      "Create & Approve Requests",
      "Monitor Orders & Suppliers",
      "Track Spend & Savings",
      "View Reports & Insights",
    ],
  },
  {
    id: "finance",
    title: "Finance Manager",
    description: "Manage invoices, payments, and financial records",
    icon: Wallet,
    color: "orange",
    features: [
      "Verify & Process Invoices",
      "Track Payments & Dues",
      "Manage Supplier Settlements",
      "Generate Financial Reports",
    ],
  },
  {
    id: "analyst",
    title: "Supply Chain Analyst",
    description: "Monitor supply chain risks and operational performance",
    icon: ChartNoAxesCombined,
    color: "cyan",
    features: [
      "Monitor Supply Chain Risks",
      "Analyze Inventory",
      "Evaluate Supplier Performance",
      "Track Logistics",
    ],
  },
  {
    id: "warehouse",
    title: "Warehouse Staff",
    description: "Manage incoming deliveries and goods receiving",
    icon: Warehouse,
    color: "orange",
    features: [
      "Record Incoming Deliveries",
      "Verify Purchase Orders",
      "Check Received Quantities",
      "Submit Goods for Quality Inspection",
    ],
  },
  {
    id: "qc_inspector",
    title: "Quality Control Inspector",
    description: "Inspect incoming goods and manage quality checks",
    icon: ClipboardCheck,
    color: "green",
    features: [
      "Conduct Random Sampling",
      "Record Product Defects",
      "Upload Inspection Evidence",
      "Submit Quality Reports",
    ],
  },
];

// ==========================================
// LANDING PAGE
// ==========================================

function LandingPage() {
  const navigate = useNavigate();

  const handleRoleSelection = (role: string) => {
    navigate(`/auth/${role}/login`);
  };

  return (
    <main className="landing-page">

      {/* LEFT BRANDING PANEL */}
      <section className="brand-panel">
        <header className="brand-header">
          <div className="brand-logo">
            <Box size={29} strokeWidth={2.5} />
          </div>

          <span className="brand-name">SupplySense AI</span>

          <span className="brand-divider" />

          <span className="brand-subtitle">
            Procurement & Supplier Intelligence
          </span>
        </header>

        <div className="illustration-area">
          <div className="outer-orbit" />
          <div className="glow-circle" />

          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />

          <div className="floating-icon truck-icon">
            <Truck size={29} />
          </div>

          <div className="floating-icon document-icon">
            <FileText size={29} />
          </div>

          <div className="floating-icon chart-icon">
            <ChartNoAxesCombined size={29} />
          </div>

          <div className="floating-icon package-icon">
            <Package size={29} />
          </div>

          <div className="center-platform">
            <div className="platform-layer platform-top">
              <ShoppingCart size={57} strokeWidth={2.2} />
            </div>

            <div className="platform-layer platform-middle" />
            <div className="platform-layer platform-bottom" />
          </div>

          <div className="platform-shadow" />
        </div>

        <div className="brand-message">
          <h2>
            Smarter Procurement.
            <br />
            <span>Stronger Decisions.</span>
          </h2>

          <p>
            Connect teams, suppliers, and business intelligence
            through one intelligent procurement platform.
          </p>
        </div>
      </section>

      {/* RIGHT ROLE SELECTION PANEL */}
      <section className="selection-panel">
        <div className="selection-content">

          <div className="heading-section">
            <h1>
              Let's <span>get started</span>
            </h1>

            <p>Select your role to continue to the platform</p>
          </div>

          <div className="roles-grid">
            {roles.map((role) => {
              const Icon = role.icon;

              return (
                <button
                  key={role.id}
                  type="button"
                  className={`role-card ${role.color}`}
                  onClick={() => handleRoleSelection(role.id)}
                  aria-label={`Continue as ${role.title}`}
                >
                  <div className="role-card-header">
                    <div className="role-icon">
                      <Icon size={34} strokeWidth={2.1} />
                    </div>

                    <div className="role-information">
                      <h2>{role.title}</h2>
                      <p>{role.description}</p>
                    </div>
                  </div>

                  <ul className="role-features">
                    {role.features.map((feature) => (
                      <li key={feature}>
                        <span className="check-icon">
                          <Check size={13} strokeWidth={3} />
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <span className="role-arrow">
                    <ArrowRight size={22} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="security-message">
            <ShieldCheck size={25} />

            <span>
              Your data is safe with enterprise-grade security
            </span>
          </div>

          <footer className="selection-footer">
            © 2026 SupplySense AI. All rights reserved.
          </footer>

        </div>
      </section>
    </main>
  );
}

// ==========================================
// 404 PAGE
// ==========================================

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-slate-900">
        404
      </h1>

      <p className="text-slate-500">
        Page not found
      </p>

      <Link
        to="/"
        className="font-semibold text-blue-600 hover:underline"
      >
        Return to SupplySense AI
      </Link>
    </div>
  );
}

// ==========================================
// MAIN APPLICATION
// ==========================================

function QCInspectorRoute({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<
    "checking" | "allowed" | "unauthenticated" | "forbidden" | "error"
  >("checking");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    const verifyRole = async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data?: { user?: { role?: string } };
        }>("/auth/me");

        if (!active) return;
        if (!response.success || !response.data?.user?.role) {
          setAccess("error");
          return;
        }

        setAccess(response.data.user.role === "qc_inspector" ? "allowed" : "forbidden");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setAccess("unauthenticated");
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setAccess("forbidden");
          return;
        }
        setAccess("error");
      }
    };

    setAccess("checking");
    void verifyRole();

    return () => {
      active = false;
    };
  }, [retry]);

  if (access === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Verifying QC Inspector access...
      </div>
    );
  }
  if (access === "unauthenticated") {
    return <Navigate to="/auth/qc_inspector/login" replace />;
  }
  if (access === "forbidden") {
    return <Navigate to="/" replace />;
  }
  if (access === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <p>Unable to verify QC Inspector access. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => setRetry((attempt) => attempt + 1)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function WarehouseRoute({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<
    "checking" | "allowed" | "unauthenticated" | "forbidden" | "error"
  >("checking");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    const verifyRole = async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data?: { user?: { role?: string } };
        }>("/auth/me");

        if (!active) return;
        if (!response.success || !response.data?.user?.role) {
          setAccess("error");
          return;
        }

        setAccess(response.data.user.role === "warehouse" ? "allowed" : "forbidden");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setAccess("unauthenticated");
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setAccess("forbidden");
          return;
        }
        setAccess("error");
      }
    };

    setAccess("checking");
    void verifyRole();

    return () => {
      active = false;
    };
  }, [retry]);

  if (access === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Verifying Warehouse access...
      </div>
    );
  }
  if (access === "unauthenticated") {
    return <Navigate to="/auth/warehouse/login" replace />;
  }
  if (access === "forbidden") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Warehouse access required</h1>
        <p className="max-w-md text-sm text-slate-600">
          This workspace requires a Warehouse employee session. Your current account has not been changed.
        </p>
        <Link
          to="/auth/warehouse/login"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in as Warehouse
        </Link>
      </main>
    );
  }
  if (access === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <p>Unable to verify Warehouse access. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => setRetry((attempt) => attempt + 1)}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function InventoryRoute({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<
    "checking" | "allowed" | "unauthenticated" | "forbidden" | "error"
  >("checking");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const verifyRole = async () => {
      try {
        const response = await apiRequest<{
          success: boolean;
          data?: { user?: { role?: string } };
        }>("/auth/me");
        if (!active) return;
        const role = response.data?.user?.role;
        if (!response.success || !role) {
          setAccess("error");
          return;
        }
        setAccess(["admin", "procurement", "warehouse"].includes(role) ? "allowed" : "forbidden");
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setAccess("unauthenticated");
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setAccess("forbidden");
          return;
        }
        setAccess("error");
      }
    };
    setAccess("checking");
    void verifyRole();
    return () => {
      active = false;
    };
  }, [retry]);

  if (access === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Verifying inventory access…</div>;
  }
  if (access === "unauthenticated") return <Navigate to="/" replace />;
  if (access === "forbidden") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Inventory access required</h1>
        <p className="max-w-md text-sm text-slate-600">This workspace is available to authorized procurement, warehouse, and admin accounts.</p>
        <Link to="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Return to sign in</Link>
      </main>
    );
  }
  if (access === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <p>Unable to verify inventory access. Check your connection and try again.</p>
        <button type="button" onClick={() => setRetry((attempt) => attempt + 1)} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Retry</button>
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* MAIN LANDING PAGE */}
        <Route
          path="/"
          element={<LandingPage />}
        />

        {/* ROLE-SPECIFIC LOGIN */}
        <Route
          path="/auth/:role/login"
          element={<LoginPage />}
        />

        {/* SUPPLIER DASHBOARD */}
        <Route
          path="/supplier/dashboard"
          element={<SupplierDashboard />}
        />

        {/* PROCUREMENT DASHBOARD */}
        <Route
          path="/procurement/dashboard"
          element={<ProcurementDashboard />}
        />

        <Route
          path="/procurement/rfqs"
          element={<RFQManagement />}
        />

        <Route
          path="/procurement/rfqs/create"
          element={<CreateRFQ />}
        />

        <Route
          path="/procurement/rfqs/:rfqId"
          element={<RFQDetails />}
        />

        <Route
          path="/procurement/rfqs/:rfqId/quotations/compare"
          element={<QuotationComparison />}
        />

        <Route
          path="/procurement/purchase-orders"
          element={<PurchaseOrders />}
        />

        <Route
          path="/procurement/quotations"
          element={<Quotations />}
        />

        {/* SUPPLIER MODULE */}
        <Route
          path="/supplier/rfqs"
          element={<SupplierRFQs />}
        />

        <Route
          path="/supplier/rfqs/:rfqId"
          element={<SupplierRFQDetails />}
        />

        <Route
          path="/supplier/purchase-orders"
          element={<SupplierPurchaseOrders />}
        />

        <Route
          path="/warehouse/dashboard"
          element={
            <WarehouseRoute>
              <WarehouseDashboard />
            </WarehouseRoute>
          }
        />
        <Route
          path="/warehouse/incoming-deliveries"
          element={
            <WarehouseRoute>
              <WarehouseDashboard />
            </WarehouseRoute>
          }
        />
        <Route
          path="/warehouse/goods-receiving"
          element={
            <WarehouseRoute>
              <WarehouseDashboard />
            </WarehouseRoute>
          }
        />
        <Route
          path="/warehouse/qc-handover"
          element={
            <WarehouseRoute>
              <WarehouseDashboard />
            </WarehouseRoute>
          }
        />

        <Route
          path="/inventory/overview"
          element={<InventoryRoute><InventoryDashboard /></InventoryRoute>}
        />
        <Route
          path="/inventory/stock"
          element={<InventoryRoute><InventoryDashboard /></InventoryRoute>}
        />
        <Route
          path="/inventory/ledger"
          element={<InventoryRoute><InventoryDashboard /></InventoryRoute>}
        />

        <Route
          path="/qc-inspector/dashboard"
          element={
            <QCInspectorRoute>
              <QCInspectorDashboard />
            </QCInspectorRoute>
          }
        />
        <Route
          path="/qc-inspector/inspections"
          element={
            <QCInspectorRoute>
              <QCInspectorDashboard />
            </QCInspectorRoute>
          }
        />
        <Route
          path="/qc-inspector/incoming-lots"
          element={
            <QCInspectorRoute>
              <QCInspectorDashboard />
            </QCInspectorRoute>
          }
        />

<Route
  path="/procurement/deliveries"
  element={<ProcurementDeliveries />}
/>

<Route path="/admin" element={<AdminDashboard />}>
  <Route index element={<Navigate to="dashboard" replace />} />
  <Route path="dashboard" element={<AdminOverview />} />
  <Route path="users" element={<UserManagement />} />
  <Route path="organizations" element={<OrganizationManagement />} />
</Route>


        {/* 404 PAGE */}
        <Route
          path="*"
          element={<NotFoundPage />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
