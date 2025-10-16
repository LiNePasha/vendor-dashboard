import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("isWholesale", "");
  res.cookies.set("token", "","isWholesale", "", { path: "/", maxAge: 0 });
  return res;
}
