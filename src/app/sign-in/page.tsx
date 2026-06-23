"use client";

import { AuthOverlay } from "@/components/auth/AuthOverlay";

export default function SignInPage() {
  return <AuthOverlay initialIsRegistering={false} />;
}
