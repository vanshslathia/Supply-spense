
import { useState, type FormEvent } from "react";
import {
  Link,
  useParams,
  useNavigate,
} from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { apiRequest } from "../../../lib/api";

const roleNames: Record<string, string> = {
  admin: "Administrator",
  procurement: "Procurement Manager",
  supplier: "Supplier",
  analyst: "Supply Chain Analyst",
  finance: "Finance Manager",
  warehouse: "Warehouse Staff",
  qc_inspector: "Quality Control Inspector",
};

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
      accountStatus: string;
      supplierApprovalStatus?: string;
      emailVerified: boolean;
    };
  };
}

const dashboardRoutes: Record<string, string> = {
  admin: "/admin/dashboard",
  procurement: "/procurement/dashboard",
  supplier: "/supplier/dashboard",
  analyst: "/analyst/dashboard",
  finance: "/finance/dashboard",
  warehouse: "/warehouse/dashboard",
  qc_inspector: "/qc-inspector/dashboard",
};

export default function LoginPage() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();

  const roleName = role ? roleNames[role] : undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!roleName || !role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Workspace not found</h1>
        <Link to="/" className="text-blue-600">
          Return to role selection
        </Link>
      </div>
    );
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const user = response.data.user;

      // Prevent users from entering another role's workspace
      if (user.role !== role) {
        setError(
          `This account belongs to the ${
            roleNames[user.role] || user.role
          } workspace.`
        );

        await apiRequest("/auth/logout", {
          method: "POST",
        });

        return;
      }

      // Redirect according to authenticated backend role
      const dashboardRoute = dashboardRoutes[user.role];

      if (!dashboardRoute) {
        setError("No dashboard is configured for this account.");
        await apiRequest("/auth/logout", {
          method: "POST",
        });
        return;
      }

      navigate(dashboardRoute);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">

        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={17} />
          Back to role selection
        </Link>

        <div className="mb-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <ShieldCheck size={27} />
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back
          </h1>

          <p className="mt-2 text-slate-500">
            Sign in to your SupplySense AI workspace.
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-blue-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            Selected workspace
          </p>

          <p className="font-semibold text-blue-700">
            {roleName}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="text-right">
            <Link
              to="/auth/forgot-password"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Your data is protected with enterprise-grade security.
        </p>

      </div>
    </main>
  );
}
