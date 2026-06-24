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
    // Restore session from Supabase on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('[AppWrapper] Failed to get session:', error);
        setIsLoaded(true);
        return;
      }

      if (session?.user) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('[AppWrapper] Failed to fetch profile:', profileError);
          }

          useStore.getState().setSession({
            id: session.user.id,
            email: session.user.email ?? '',
            name: profileData?.name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User',
            role: profileData?.role ?? session.user.user_metadata?.role ?? 'farmer',
          });
        } catch (err) {
          console.error('[AppWrapper] Error processing session:', err);
        }
      }
      setIsLoaded(true);
    });

    // Listen for auth state changes (sign-in / sign-out from other tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        useStore.getState().clearSession();
      } else if (event === 'SIGNED_IN' && session) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', session.user.id)
            .single();

          useStore.getState().setSession({
            id: session.user.id,
            email: session.user.email ?? '',
            name: profileData?.name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User',
            role: profileData?.role ?? session.user.user_metadata?.role ?? 'farmer',
          });
        } catch (err) {
          console.error('[AppWrapper] Error on auth state change:', err);
        }
      }
    });

    return () => subscription.unsubscribe();
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
