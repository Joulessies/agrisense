"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useStore, Role } from "@/store/useStore";

// ── Password strength checker ─────────────────────────────────────────────────

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters",              test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)",             test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)",             test: (p) => /[a-z]/.test(p) },
  { label: "Number (0–9)",                       test: (p) => /[0-9]/.test(p) },
  { label: "Special character (!@#$%^&*)",       test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function getStrengthLabel(passed: number): { label: string; color: string; bar: string } {
  if (passed <= 1) return { label: "Very weak",  color: "text-rose-600",  bar: "bg-rose-500" };
  if (passed === 2) return { label: "Weak",       color: "text-orange-500", bar: "bg-orange-400" };
  if (passed === 3) return { label: "Fair",       color: "text-amber-500", bar: "bg-amber-400" };
  if (passed === 4) return { label: "Strong",     color: "text-agri-600",  bar: "bg-agri-500" };
  return              { label: "Very strong", color: "text-agri-700",  bar: "bg-agri-600" };
}

function PasswordStrength({ password }: { password: string }) {
  const results = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) }));
  const passedCount = results.filter((r) => r.passed).length;
  const strength = getStrengthLabel(passedCount);
  const barWidth = `${(passedCount / PASSWORD_RULES.length) * 100}%`;

  if (!password) return null;

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500">Password strength</span>
        <span className={`text-[11px] font-semibold ${strength.color}`}>{strength.label}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strength.bar}`}
          style={{ width: barWidth }}
        />
      </div>

      {/* Rules checklist */}
      <ul className="space-y-1 pt-1">
        {results.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[11px]">
            <i className={`fa-solid ${r.passed ? "fa-circle-check text-agri-500" : "fa-circle-xmark text-slate-300"} text-xs`}></i>
            <span className={r.passed ? "text-slate-600" : "text-slate-400"}>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── AuthOverlay ───────────────────────────────────────────────────────────────

export function AuthOverlay({ initialIsRegistering = false }: { initialIsRegistering?: boolean }) {
  const setSession = useStore((state) => state.setSession);
  const [role, setRole] = useState<Role>("farmer");
  const [isRegistering, setIsRegistering] = useState(initialIsRegistering);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if all password rules pass
  const allRulesPassed = useMemo(
    () => isRegistering && PASSWORD_RULES.every((r) => r.test(password)),
    [password, isRegistering]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Block submission if password doesn't meet requirements during registration
    if (isRegistering && !allRulesPassed) {
      setError("Password does not meet the security requirements. Please check the checklist below.");
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } },
        });
        if (signUpError) throw signUpError;
        if (data.user && !data.session) {
          setInfo("Account created! Check your email to confirm your address before signing in.");
        } else if (data.user && data.session) {
          const profile = data.user.user_metadata;
          setSession({
            id: data.user.id,
            email: data.user.email ?? email,
            name: profile?.name ?? name,
            role: profile?.role ?? role,
          });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        // Fetch role from profiles table (authoritative source)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('id', data.user.id)
          .single();

        setSession({
          id: data.user.id,
          email: data.user.email ?? email,
          name: profileData?.name ?? data.user.user_metadata?.name ?? email.split('@')[0],
          role: profileData?.role ?? data.user.user_metadata?.role ?? 'farmer',
        });
      }
    } catch (err: any) {
      console.error('[AuthOverlay] Sign-in/up failed:', err);
      const status = err?.status ?? err?.code;
      const msg = err?.message ?? '';

      if (status === 400 || status === 401 || msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("invalid credentials")) {
        setError("Invalid email or password. Please check your credentials.");
      } else if (status === 422 || msg.toLowerCase().includes("already registered")) {
        setError("This email is already registered. Try signing in instead.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Please check your email and click the confirmation link before signing in.");
      } else {
        const displayMsg = process.env.NODE_ENV === 'development'
          ? `${msg} (Status: ${status})`
          : "An unexpected error occurred. Please try again or contact support.";
        setError(displayMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md">
              <i className="fa-solid fa-leaf text-white text-lg"></i>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-agri-700 to-agri-500 bg-clip-text text-transparent tracking-tight">
              AgriSense
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error / Info banners */}
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 flex items-start gap-2">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0"></i>
                <span>{info}</span>
              </div>
            )}

            {/* Registration-only fields */}
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegistering ? "Min. 8 characters" : "Your password"}
                  className="w-full px-4 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
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

              {/* Live password strength — only shown during registration */}
              {isRegistering && <PasswordStrength password={password} />}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (isRegistering && password.length > 0 && !allRulesPassed)}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : isRegistering
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          {/* Toggle sign-in / register */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
                setInfo(null);
                setPassword("");
              }}
              className="text-sm text-slate-500 hover:text-agri-600 font-medium transition"
            >
              {isRegistering
                ? "Already have an account? Sign in"
                : "Need an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
