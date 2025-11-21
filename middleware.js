import { NextResponse } from "next/server";

// Global auth protection middleware
// - Redirects unauthenticated users to /login for all app pages
// - Skips public assets, images, and API routes (APIs handle auth themselves)
// - Blocks cashier mode from accessing restricted pages
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
    pathname.manifest === "/manifest.json" ||
    pathname.startsWith("/api");

  // إذا مفيش توكن ومش داخل مسار عام -> رجّعه للّوجين
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // لو مسجل دخول وداخل /login رجّعه للرئيسية
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Cashier Mode Protection
  // الصفحات الممنوعة على الكاشير
  const cashierBlockedPages = ['warehouse', 'suppliers', 'creditors', 'employees'];
  const pageName = pathname.split('/')[1];
  
  // فحص لو في وضع الكاشير (من cookie أو header)
  const isCashierMode = request.cookies.get("isCashierMode")?.value === "true";
  
  if (isCashierMode && cashierBlockedPages.includes(pageName)) {
    // إعادة توجيه للرئيسية مع رسالة
    const response = NextResponse.redirect(new URL("/?blocked=true", request.url));
    return response;
  }

  return NextResponse.next();
}

// Apply to all paths except the listed ones (negative lookahead)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|images|uploads|manifest.json|api).*)",
  ],
};
