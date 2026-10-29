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

  // Allow an explicit visit to login to escape any restricted app mode.
  // Clear the old session/mode so the user can authenticate again; successful
  // login will issue a fresh token and reset appMode to owner.
  if (pathname === "/login") {
    const response = NextResponse.next();
    for (const cookieName of ["token", "userRole", "isWholesale", "appMode", "isCashierMode"]) {
      response.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    }
    return response;
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

  // Scooters page protection: only admin OR vendor 5453
  if (token && pathname.startsWith("/scooters")) {
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
      return NextResponse.redirect(new URL("/?blocked=scooters", request.url));
    }
  }

  // Role-mode page protection (menus are not the only permission check).
  const appMode = request.cookies.get("appMode")?.value ||
    (request.cookies.get("isCashierMode")?.value === "true" ? "cashier" : "owner");
  const isUnderPrefix = (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const isAssistantDeductionPath = /^\/employees\/[^/]+\/deductions\/add$/.test(pathname);
  const isAllowedForMode = appMode === "owner" || pathname === "/" ||
    (appMode === "cashier" && !["warehouse", "suppliers", "creditors", "employees"].includes(pathname.split("/")[1])) ||
    (appMode === "assistant_manager" && (isUnderPrefix("/pos/invoices") || pathname === "/employees" || isAssistantDeductionPath)) ||
    (appMode === "manager" && (isUnderPrefix("/pos/invoices") || isUnderPrefix("/employees")));

  if (!isAllowedForMode) {
    return NextResponse.redirect(new URL("/?blocked=app-mode", request.url));
  }

  return NextResponse.next();
}

// Apply to all paths except the listed ones (negative lookahead)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|images|uploads|manifest.json|api).*)",
  ],
};
