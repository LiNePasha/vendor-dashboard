import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  
  // Clear authentication cookies
  res.cookies.set("token", "", { path: "/", maxAge: 0 });
  res.cookies.set("isWholesale", "", { path: "/", maxAge: 0 });
  
  return res;
}
