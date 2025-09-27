import { NextResponse } from "next/server";

export async function POST(req) {
  const { username, password } = await req.json();

  // نكلم API بتاع ووردبريس
  const res = await fetch("https://spare2app.com/wp-json/jwt-auth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  if (!data.token) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  // خزن التوكن في كوكي HttpOnly
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", data.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // يوم
  });

  return response;
}
