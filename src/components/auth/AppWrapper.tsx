"use client";

import React, { useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/lib/supabase";

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  // Mount realtime sync only when the user is logged in
  useRealtimeSync();
  return <>{children}</>;
}

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { setSession, clearSession } = useStore();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      // Push Clerk user info into the Zustand store
      setSession({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        name: user.fullName ?? user.firstName ?? "User",
        role: (user.publicMetadata?.role as string) ?? "farmer",
      });

      // Auto-create a Supabase profile row if one doesn't exist yet
      const email = user.primaryEmailAddress?.emailAddress ?? "";
      const name = user.fullName ?? user.firstName ?? "User";
      supabase
        .from("profiles")
        .upsert(
          { id: user.id, name, role: (user.publicMetadata?.role as string) ?? "farmer" },
          { onConflict: "id", ignoreDuplicates: true }
        )
        .then(({ error }) => {
          if (error) console.warn("Profile upsert error:", error.message);
        });
    } else {
      clearSession();
    }
  }, [isLoaded, isSignedIn, user, setSession, clearSession]);

  // Wait for Clerk to finish loading
  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    // Clerk middleware will redirect to /sign-in, but show nothing in the meantime
    return null;
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
