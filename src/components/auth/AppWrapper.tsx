"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { AuthOverlay } from "@/components/auth/AuthOverlay";

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  // Mount realtime sync only when the user is logged in
  useRealtimeSync();
  return <>{children}</>;
}

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((state) => state.auth.isAuthenticated);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate a brief loading state, bypassing real Supabase Auth
    const timer = setTimeout(() => setIsLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  // Show a spinner while Supabase resolves the initial session
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md animate-pulse">
            <i className="fa-solid fa-leaf text-white text-lg"></i>
          </div>
          <p className="text-sm text-slate-500">Loading AgriSense…</p>
        </div>
      </div>
    );
  }

  // Show sign-in modal if not authenticated
  if (!isAuthenticated) return <AuthOverlay />;

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
