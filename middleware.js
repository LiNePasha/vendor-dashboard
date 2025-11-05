import { NextResponse } from "next/server";

// Global auth protection middleware
// - Redirects unauthenticated users to /login for all app pages
// - Skips public assets, images, and API routes (APIs handle auth themselves)
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // Public routes/assets that should bypass auth checks
  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/logos") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/api");

  // إذا مفيش توكن ومش داخل مسار عام -> رجّعه للّوجين
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // لو مسجل دخول وداخل /login رجّعه للرئيسية
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Apply to all paths except the listed ones (negative lookahead)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|images|uploads|manifest.json|api).*)",
  ],
};
