import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/api/", "/_next/", "/__", "/favicon", "/icon.svg", "/sw.js", "/manifest.json"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for a Supabase auth session cookie
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (!hasSession) {
    // No session — redirect to root (AppWrapper will show AuthOverlay)
    const url = request.nextUrl.clone();
    url.pathname = "/";
    // Avoid redirect loop on the root page
    if (pathname === "/") return NextResponse.next();
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|__turbopack|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
