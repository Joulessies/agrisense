"use client";

import { AuthOverlay } from "@/components/auth/AuthOverlay";

export default function SignUpPage() {
  return <AuthOverlay initialIsRegistering={true} />;
}
