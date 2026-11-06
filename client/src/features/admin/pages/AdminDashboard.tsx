import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Building,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";

const navigation = [
  { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users", icon: Users },
  { label: "Organizations", path: "/admin/organizations", icon: Building },
];

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [workspaceToOpen, setWorkspaceToOpen] = useState<{
    label: string;
    loginPath: string;
  } | null>(null);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage =
    location.pathname === "/admin/users"
      ? "User Management"
      : location.pathname.startsWith("/admin/organizations")
        ? "Organizations"
        : "Overview";

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      navigate("/");
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out."
      );
    }
  };

  const switchToWorkspaceLogin = async () => {
    if (!workspaceToOpen) return;
    setSignOutError(null);
    setSwitchingWorkspace(true);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      navigate(workspaceToOpen.loginPath, { replace: true });
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to end the Admin session."
      );
    } finally {
      setSwitchingWorkspace(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-800">
      {sidebarOpen && (
        <button
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col bg-[#111D35] text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold">
              SupplySense <span className="text-blue-400">AI</span>
            </h1>
            <p className="text-[10px] tracking-[2px] text-slate-400">
              ADMIN PLATFORM
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
            Administration
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] transition ${
                      isActive
                        ? "bg-blue-600 font-semibold text-white shadow-lg"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[1.8px] text-slate-500">
              Workspaces
            </p>
            {[
              { label: "Procurement", loginPath: "/auth/procurement/login" },
              { label: "Warehouse", loginPath: "/auth/warehouse/login" },
            ].map((item) => (
              <button
                key={item.loginPath}
                type="button"
                onClick={() => setWorkspaceToOpen(item)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          {signOutError && (
            <p role="alert" className="mb-3 text-xs text-rose-300">
              {signOutError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          <p className="mt-4 text-center text-[10px] text-slate-500">
            SupplySense AI · Version 1.0
          </p>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[255px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur-md md:px-8">
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
                Administration / {currentPage}
              </p>
              <h2 className="text-sm font-bold text-slate-800">
                Administrator Workspace
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 sm:flex">
              <ShieldCheck size={16} className="text-blue-600" />
              <span className="text-xs font-semibold text-slate-600">
                Administrator
              </span>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-700">
              <Building2 size={17} />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-8">
          <Outlet />
        </div>
      </main>

      {workspaceToOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-switch-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="workspace-switch-title" className="text-lg font-bold text-slate-900">
              Sign in to {workspaceToOpen.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Employee workspaces use the employee&apos;s own organization-scoped session. Your Admin account will be signed out, then you can sign in with a {workspaceToOpen.label} employee account. Your role will not be changed.
            </p>
            {signOutError && (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {signOutError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!switchingWorkspace) setWorkspaceToOpen(null);
                }}
                disabled={switchingWorkspace}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void switchToWorkspaceLogin()}
                disabled={switchingWorkspace}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {switchingWorkspace ? "Signing out..." : "Sign out and continue"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
