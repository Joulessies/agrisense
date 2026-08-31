"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore, Role } from "@/store/useStore";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { AuthOverlay } from "@/components/auth/AuthOverlay";

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((state) => state.auth.isAuthenticated);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('[AppWrapper] Failed to get session:', error);
        setIsLoaded(true);
        return;
      }

      if (session?.user) {
        let profileName: string = session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User';
        let profileRole: Role = (session.user.user_metadata?.role as Role) ?? 'farmer';

        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileData) {
            profileName = profileData.name || profileName;
            profileRole = (profileData.role as Role) || profileRole;
          }
        } catch (profileError) {
          console.warn('[AppWrapper] Failed to fetch profile:', profileError);
        }

        useStore.getState().setSession({
          id: session.user.id,
          email: session.user.email ?? '',
          name: profileName,
          role: profileRole,
        });
      }
      setIsLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        useStore.getState().clearSession();
      } else if (event === 'SIGNED_IN' && session) {
        let profileName: string = session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'User';
        let profileRole: Role = (session.user.user_metadata?.role as Role) ?? 'farmer';

        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileData) {
            profileName = profileData.name || profileName;
            profileRole = (profileData.role as Role) || profileRole;
          }
        } catch (profileError) {
          console.warn('[AppWrapper] Failed to fetch profile on auth change:', profileError);
        }

        useStore.getState().setSession({
          id: session.user.id,
          email: session.user.email ?? '',
          name: profileName,
          role: profileRole,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (!isAuthenticated) return <AuthOverlay />;

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
