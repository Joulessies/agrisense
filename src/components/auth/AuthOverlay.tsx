"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useStore, Role } from "@/store/useStore";

// ── Password rules ────────────────────────────────────────────────────────────

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters",        test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)",        test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)",        test: (p) => /[a-z]/.test(p) },
  { label: "Number (0–9)",                  test: (p) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%^&*)", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function getStrength(passed: number) {
  if (passed <= 1) return { label: "Very weak",  color: "text-rose-600",   bar: "bg-rose-500",   width: "20%" };
  if (passed === 2) return { label: "Weak",       color: "text-orange-500", bar: "bg-orange-400", width: "40%" };
  if (passed === 3) return { label: "Fair",       color: "text-amber-500",  bar: "bg-amber-400",  width: "60%" };
  if (passed === 4) return { label: "Strong",     color: "text-agri-600",   bar: "bg-agri-500",   width: "80%" };
  return              { label: "Very strong", color: "text-agri-700",   bar: "bg-agri-600",   width: "100%" };
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const results  = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) }));
  const passed   = results.filter((r) => r.passed).length;
  const strength = getStrength(passed);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Password strength</span>
        <span className={`text-[11px] font-semibold ${strength.color}`}>{strength.label}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strength.bar}`}
          style={{ width: strength.width }}
        />
      </div>
      <ul className="space-y-1 pt-1">
        {results.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[11px]">
            <i className={`fa-solid fa-xs ${r.passed ? "fa-circle-check text-agri-500" : "fa-circle-xmark text-slate-300"}`}></i>
            <span className={r.passed ? "text-slate-600" : "text-slate-400"}>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAuthError(err: any): string {
  const status = err?.status ?? err?.code;
  const msg: string = err?.message ?? "";

  if (status === 429 || msg.toLowerCase().includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (status === 400 || status === 401 || msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("invalid credentials"))
    return "Invalid email or password. Please check your credentials.";
  if (status === 422 || msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered"))
    return "This email is already registered. Try signing in instead.";
  if (msg.toLowerCase().includes("email not confirmed"))
    return "Please check your email and click the confirmation link before signing in.";
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch"))
    return "Network error — check your connection and try again.";
  if (msg.toLowerCase().includes("weak password"))
    return "Password is too weak. Please meet all the requirements listed below.";
  // In development show the raw message so it's debuggable
  if (process.env.NODE_ENV === "development")
    return `${msg} (status: ${status})`;
  return "An unexpected error occurred. Please try again.";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthOverlay({ initialIsRegistering = false }: { initialIsRegistering?: boolean }) {
  const setSession = useStore((state) => state.setSession);

  const [isRegistering, setIsRegistering]   = useState(initialIsRegistering);
  const [name, setName]                     = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [info, setInfo]                     = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);

  const allRulesPassed = useMemo(
    () => PASSWORD_RULES.every((r) => r.test(password)),
    [password]
  );

  const passwordsMatch = confirmPassword === "" || password === confirmPassword;
  const canSubmitRegister = allRulesPassed && password === confirmPassword && name.trim().length >= 2 && email.includes("@");
  const canSubmitLogin    = email.includes("@") && password.length > 0;

  const switchMode = () => {
    setIsRegistering((v) => !v);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Client-side guards
    if (isRegistering) {
      if (name.trim().length < 2) { setError("Please enter your full name (at least 2 characters)."); return; }
      if (!allRulesPassed)         { setError("Password does not meet the security requirements below."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim(), role: "farmer" } },
        });
        if (signUpError) throw signUpError;

        if (data.user && !data.session) {
          // Email confirmation required
          setInfo("Account created! Check your email inbox and click the confirmation link before signing in.");
          setPassword("");
          setConfirmPassword("");
        } else if (data.user && data.session) {
          // Auto-confirmed
          setSession({
            id: data.user.id,
            email: data.user.email ?? email,
            name: name.trim(),
            role: "farmer",
          });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;

        // Get role from profiles table — authoritative source
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", data.user.id)
          .single();

        setSession({
          id: data.user.id,
          email: data.user.email ?? email,
          name: profileData?.name ?? data.user.user_metadata?.name ?? email.split("@")[0],
          role: (profileData?.role ?? data.user.user_metadata?.role ?? "farmer") as Role,
        });
      }
    } catch (err: any) {
      console.error("[AuthOverlay] failed:", err);
      setError(parseAuthError(err));
      // Clear password on failed sign-in so user doesn't resubmit wrong one
      if (!isRegistering) setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md mb-3">
            <i className="fa-solid fa-leaf text-white text-xl"></i>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-agri-700 to-agri-500 bg-clip-text text-transparent tracking-tight">
            AgriSense
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isRegistering ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          {/* Message banner — fixed height prevents layout shift */}
          <div className="mb-4 empty:mb-0">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-red-500"></i>
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-start gap-2">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0 text-emerald-500"></i>
                <span>{info}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full name — register only */}
            {isRegistering && (
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
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={isRegistering ? "email" : "username"}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegistering ? "Create a strong password" : "Your password"}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  className="w-full px-4 py-2.5 pr-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                </button>
              </div>
              {/* Live strength meter — register only */}
              {isRegistering && <PasswordStrength password={password} />}
            </div>

            {/* Confirm password — register only */}
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className={`w-full px-4 py-2.5 pr-11 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                      !passwordsMatch
                        ? "border-red-300 focus:ring-red-400/30 focus:border-red-400"
                        : confirmPassword && password === confirmPassword
                        ? "border-agri-300 focus:ring-agri-500/30 focus:border-agri-500"
                        : "border-slate-200 focus:ring-agri-500/30 focus:border-agri-500"
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                  </button>
                </div>
                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${passwordsMatch ? "text-agri-600" : "text-red-500"}`}>
                    <i className={`fa-solid fa-xs ${passwordsMatch ? "fa-circle-check" : "fa-circle-xmark"}`}></i>
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || (isRegistering ? !canSubmitRegister : !canSubmitLogin)}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-rotate animate-spin text-sm"></i>
                  Please wait…
                </>
              ) : isRegistering ? (
                <>
                  <i className="fa-solid fa-user-plus text-sm"></i>
                  Create Account
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket text-sm"></i>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-agri-600 hover:text-agri-700 font-semibold transition"
              >
                {isRegistering ? "Sign in" : "Register"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
