"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStore, Role } from "@/store/useStore";

const PASSWORD_RULES = [
  { label: "At least 8 characters",        test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)",        test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)",        test: (p: string) => /[a-z]/.test(p) },
  { label: "Number (0–9)",                  test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%^&*)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function getStrength(n: number) {
  if (n <= 1) return { label: "Very weak",  color: "text-rose-600",   bar: "bg-rose-500",   w: "20%" };
  if (n === 2) return { label: "Weak",       color: "text-orange-500", bar: "bg-orange-400", w: "40%" };
  if (n === 3) return { label: "Fair",       color: "text-amber-500",  bar: "bg-amber-400",  w: "60%" };
  if (n === 4) return { label: "Strong",     color: "text-agri-600",   bar: "bg-agri-500",   w: "80%" };
  return        { label: "Very strong", color: "text-agri-700",   bar: "bg-agri-600",   w: "100%" };
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const results = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const n = results.filter((r) => r.ok).length;
  const s = getStrength(n);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Password strength</span>
        <span className={`text-[11px] font-semibold ${s.color}`}>{s.label}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${s.bar}`} style={{ width: s.w }} />
      </div>
      <ul className="space-y-1 pt-1">
        {results.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[11px]">
            <i className={`fa-solid text-xs ${r.ok ? "fa-circle-check text-agri-500" : "fa-circle-xmark text-slate-300"}`} />
            <span className={r.ok ? "text-slate-600" : "text-slate-400"}>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseError(err: any): string {
  const status = err?.status ?? err?.code ?? 0;
  const msg: string = (err?.message ?? "").toLowerCase();

  if (status === 429 || msg.includes("too many") || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email not confirmed yet. Please check your inbox for the confirmation link.";
  }
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid email or password") ||
    status === 400 ||
    status === 401
  ) {
    return "Invalid email or password. Please verify your credentials.";
  }
  if (msg.includes("already registered") || msg.includes("user already exists") || status === 422) {
    return "This email is already registered. Please sign in instead.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Network error. Please check your internet connection.";
  }
  if (status === 500) {
    return "Server error. Please try again in a few moments.";
  }
  return err?.message || "Authentication failed. Please try again.";
}

export function AuthOverlay({ initialIsRegistering = false }: { initialIsRegistering?: boolean }) {
  const router = useRouter();
  const setSession = useStore((s) => s.setSession);

  const [mode, setMode]         = useState<"login" | "register">(initialIsRegistering ? "register" : "login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const allPwRules = useMemo(() => PASSWORD_RULES.every((r) => r.test(password)), [password]);
  const pwMatch    = confirm === "" || password === confirm;

  const canLogin    = email.includes("@") && password.length > 0;
  const canRegister = name.trim().length >= 2 && email.includes("@") && allPwRules && password === confirm;

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirm("");
    setName("");
    setShowPw(false);
    setShowCf(false);
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (err) {
      setError(parseError(err));
      setPassword("");
      return;
    }

    let profileName: string = data.user.user_metadata?.name ?? cleanEmail.split("@")[0];
    let profileRole: Role = (data.user.user_metadata?.role as Role) ?? "farmer";

    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (p) {
        profileName = p.name ?? profileName;
        profileRole = (p.role as Role) ?? profileRole;
      }
    } catch {
      // Fallbacks used
    }

    setSession({
      id: data.user.id,
      email: data.user.email ?? cleanEmail,
      name: profileName,
      role: profileRole,
    });

    router.push("/");
  };

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create account.");
        return;
      }

      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginErr) {
        setInfo("Account created successfully! Please sign in with your password.");
        switchMode("login");
        setEmail(cleanEmail);
        return;
      }

      if (loginData.user) {
        setSession({
          id: loginData.user.id,
          email: loginData.user.email ?? cleanEmail,
          name: cleanName,
          role: "farmer",
        });

        router.push("/");
      }
    } catch (e: any) {
      setError(e?.message || "Registration failed. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Enter your full name (at least 2 characters).");
        return;
      }
      if (!allPwRules) {
        setError("Password does not meet the requirements below.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[95vh]">

        <div className="px-8 pt-8 pb-5 border-b border-slate-100 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md mb-3">
            <i className="fa-solid fa-leaf text-white text-xl" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-agri-700 to-agri-500 bg-clip-text text-transparent">
            AgriSense
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "register" ? "Create a new account" : "Sign in to your account"}
          </p>
        </div>

        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              mode === "login"
                ? "text-agri-700 border-b-2 border-agri-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <i className="fa-solid fa-right-to-bracket mr-2" />Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              mode === "register"
                ? "text-agri-700 border-b-2 border-agri-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <i className="fa-solid fa-user-plus mr-2" />Register
          </button>
        </div>

        <div className="px-8 py-6">

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-start gap-2">
              <i className="fa-solid fa-circle-check mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  autoComplete="name"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={mode === "register" ? "email" : "username"}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Create a strong password" : "Your password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="w-full px-4 py-2.5 pr-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1} aria-label="Toggle password visibility">
                  <i className={`fa-solid text-sm ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
              {mode === "register" && <PasswordStrength password={password} />}
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCf ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className={`w-full px-4 py-2.5 pr-11 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                      !pwMatch ? "border-red-300 focus:ring-red-300/30" :
                      confirm && pwMatch ? "border-agri-300 focus:ring-agri-500/30" :
                      "border-slate-200 focus:ring-agri-500/30"
                    }`}
                  />
                  <button type="button" onClick={() => setShowCf((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1} aria-label="Toggle confirm password visibility">
                    <i className={`fa-solid text-sm ${showCf ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
                {confirm.length > 0 && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${pwMatch ? "text-agri-600" : "text-red-500"}`}>
                    <i className={`fa-solid fa-xs ${pwMatch ? "fa-circle-check" : "fa-circle-xmark"}`} />
                    {pwMatch ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "login" ? !canLogin : !canRegister)}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><i className="fa-solid fa-rotate animate-spin text-sm" /> Please wait…</>
              ) : mode === "login" ? (
                <><i className="fa-solid fa-right-to-bracket text-sm" /> Sign In</>
              ) : (
                <><i className="fa-solid fa-user-plus text-sm" /> Create Account</>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
