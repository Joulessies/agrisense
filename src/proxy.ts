import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/api/",
  "/_next/",
  "/__",
  "/favicon",
  "/icon.svg",
  "/sw.js",
  "/manifest.json",
  "/sign-in",
  "/sign-up"
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    if (pathname === "/") return NextResponse.next();
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
