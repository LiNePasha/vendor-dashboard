export function middleware(request) {
  const { pathname } = request.nextUrl;

  // قراءة الكوكي
  const token = request.cookies.get("token")?.value;

  console.log("Token in middleware:", token); // للتأكد على Vercel

  // لو مفيش توكن، اعمل redirect
  if (!token && (pathname.startsWith("/orders") || pathname.startsWith("/products"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // لو مسجل دخول ومش عايز يدخل login
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*", "/products/:path*", "/login"],
};
