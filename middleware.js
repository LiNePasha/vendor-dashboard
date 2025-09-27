import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // جلب الكوكي بشكل آمن
  const tokenCookie = request.cookies.get("token");
  const token = tokenCookie ? tokenCookie.value : null;

  // redirect لو فعلاً مفيش token
  if (!token && (pathname.startsWith("/orders") || pathname.startsWith("/products"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // لو متسجل دخول وما ينفعش login
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*", "/products/:path*", "/login"],
};
