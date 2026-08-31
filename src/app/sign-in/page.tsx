"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { AuthOverlay } from "@/components/auth/AuthOverlay";

export default function SignInPage() {
  const isAuthenticated = useStore((s) => s.auth.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <AuthOverlay initialIsRegistering={false} />
    </div>
  );
}
