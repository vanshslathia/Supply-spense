
import { useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id?: string;
      role?: string;
      fullName?: string;
      email?: string;
    };
    id?: string;
    role?: string;
    fullName?: string;
    email?: string;
  };
}

interface MeResponse {
  success: boolean;
  data?: {
    user?: {
      id?: string;
      role?: string;
      fullName?: string;
      email?: string;
    };
    id?: string;
    role?: string;
    fullName?: string;
    email?: string;
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { role } = useParams<{ role: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = role || "procurement";

  const roleTitle =
    selectedRole === "procurement"
      ? "Procurement Manager"
      : selectedRole === "finance"
        ? "Finance Manager"
        : selectedRole === "supplier"
          ? "Supplier"
          : "Supply Chain Analyst";

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1. Authenticate credentials and establish session cookie
      await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      // 2. Verify the browser session with the backend
      const session = await apiRequest<MeResponse>("/auth/me");

      const currentUser =
        session.data?.user ?? session.data;

      if (!session.success || !currentUser?.role) {
        throw new Error(
          "Login succeeded, but your session could not be verified."
        );
      }

      // 3. Prevent access through the wrong role page
      if (currentUser.role !== selectedRole) {
        await apiRequest("/auth/logout", {
          method: "POST",
        });

        throw new Error(
          `This account is registered as ${currentUser.role}, not ${selectedRole}. Please select the correct role.`
        );
      }

      // 4. Redirect based on authenticated role
      switch (currentUser.role) {
        case "procurement":
          navigate("/procurement/rfqs", { replace: true });
          break;

        case "supplier":
          navigate("/supplier/dashboard", { replace: true });
          break;

        case "finance":
          navigate("/finance/dashboard", { replace: true });
          break;

        default:
          navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">

      {/* LEFT BRAND PANEL */}

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#101D35] p-12 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-white/10" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold">
                SupplySense AI
              </h1>
              <p className="text-xs text-slate-400">
                Intelligent Procurement Platform
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
            Enterprise Procurement
          </p>

          <h2 className="text-5xl font-bold leading-tight">
            Smarter Procurement.
            <span className="block text-blue-400">
              Stronger Decisions.
            </span>
          </h2>

          <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">
            Manage procurement operations, collaborate with
            suppliers, compare quotations and make better
            business decisions with SupplySense AI.
          </p>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © 2026 SupplySense AI. All rights reserved.
        </p>
      </div>

      {/* RIGHT LOGIN PANEL */}

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600"
          >
            <ArrowLeft size={16} />
            Back to role selection
          </Link>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 lg:hidden">
              <ShieldCheck size={25} />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Welcome Back
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Sign in to your account
            </h2>

            <p className="mt-3 text-sm text-slate-500">
              Access your {roleTitle} workspace.
            </p>
          </div>

          {/* SELECTED ROLE */}

          <div className="mb-7 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600">
              <ShieldCheck size={20} />
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Signing in as
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {roleTitle}
              </p>
            </div>
          </div>

          {/* LOGIN FORM */}

          <form onSubmit={handleLogin} className="space-y-5">

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold text-slate-700"
              >
                Business Email
              </label>

              <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Mail size={17} className="text-slate-400" />

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="name@company.com"
                  autoComplete="username"
                  required
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
              </div>

              <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <LockKeyhole
                  size={17}
                  className="text-slate-400"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  className="text-slate-400 hover:text-slate-700"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                {error}
              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-center text-[11px] leading-5 text-slate-400">
              Protected enterprise access.
              <br />
              Your session is secured using HTTP-only cookies.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
