import { NextResponse } from "next/server";

function decodeTokenPayload(token) {
  try {
    const payloadBase64Url = token.split(".")[1] || "";
    const payloadBase64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payloadBase64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Global auth protection middleware
// - Redirects unauthenticated users to /login for all app pages
// - Skips public assets, images, and API routes (APIs handle auth themselves)
// - Blocks cashier mode from accessing restricted pages
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const userRole = request.cookies.get("userRole")?.value;

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

  // Webikers videos page protection: only admin OR vendor 5453
  if (token && pathname.startsWith("/webikers-videos")) {
    const decoded = decodeTokenPayload(token);
    const user = decoded?.data?.user || {};
    const userId = Number(user?.id);
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const isAdmin =
      userRole === "admin" ||
      roles.includes("administrator") ||
      roles.includes("shop_manager");
    const isAllowedVendor = userId === 5453;

    if (!isAdmin && !isAllowedVendor) {
      return NextResponse.redirect(new URL("/?blocked=webikers-videos", request.url));
    }
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
