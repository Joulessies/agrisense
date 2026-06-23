"use client";

import React, { useState } from "react";
import { Role } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

export function AuthOverlay() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("farmer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        // Password Security Features
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,12}$/;
        if (!passwordRegex.test(password)) {
          setError("Password must be 8-12 characters, include uppercase, lowercase, numbers, and special characters (!@#$%^&*).");
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
            },
          },
        });
        if (signUpError) throw signUpError;
        // Depending on email confirmation settings, they might be logged in automatically,
        // or they might need to check their email.
        if (email) {
          // Attempt to login directly if email confirmation is disabled
          await supabase.auth.signInWithPassword({ email, password });
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      console.error("Auth Error (full):", err);
      console.error("Auth Error name:", err?.name);
      console.error("Auth Error message:", err?.message);
      console.error("Auth Error status:", err?.status);
      console.error("Auth Error cause:", err?.cause);

      if (typeof err?.status === 'number') {
        if (err.status === 401) {
          setError("Invalid email or password. Please check your credentials.");
        } else if (err.status === 422) {
          setError("Email already registered or invalid input. Please try again.");
        } else {
          setError(`Error ${err.status}: ${err.message || "Authentication failed."}`);
        }
      } else {
        // For other errors, try to show a clean message
        setError(err?.message || "An unexpected error occurred. Please try again or contact support.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md">
              <i className="fa-solid fa-leaf text-white text-lg"></i>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-agri-700 to-agri-500 bg-clip-text text-transparent tracking-tight">
              AgriSense
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                required
              />
              {isRegistering && (
                <ul className="text-[11px] text-slate-500 mt-2 list-disc list-inside space-y-0.5">
                  <li>8-12 characters</li>
                  <li>Mix of uppercase & lowercase</li>
                  <li>At least one number (0-9)</li>
                  <li>Special character (!@#$%^&*)</li>
                </ul>
              )}
            </div>



            <button
              type="submit"
              disabled={loading}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Please wait..." : (isRegistering ? "Create Account" : "Sign In")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-sm text-slate-500 hover:text-agri-600 font-medium transition"
            >
              {isRegistering ? "Already have an account? Sign in" : "Need an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
