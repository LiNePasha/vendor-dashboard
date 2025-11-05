import { NextResponse } from "next/server";

export async function POST(req) {
  const { username, password } = await req.json();

  const res = await fetch("https://spare2app.com/wp-json/jwt-auth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!data.token) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  // ✅ حفظ التوكن
  response.cookies.set("token", data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // يوم
  });

  // ✅ لو عنده الدور wholesale_vendor نحفظها في كوكي تانية
  if (data.roles?.includes("wholesale_vendor")) {
    response.cookies.set("isWholesale", "true", {
      httpOnly: false, // عشان تقدر تقراها من client
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}
