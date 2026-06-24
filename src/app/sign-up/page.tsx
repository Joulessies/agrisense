"use client";

import { AuthOverlay } from "@/components/auth/AuthOverlay";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <AuthOverlay initialIsRegistering={true} />
    </div>
  );
}
