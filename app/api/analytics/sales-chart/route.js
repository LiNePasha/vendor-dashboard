import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    let apiUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-analytics/sales-chart?period=${period}`;
    
    if (startDate) {
      apiUrl += `&start_date=${encodeURIComponent(startDate)}`;
    }
    if (endDate) {
      apiUrl += `&end_date=${encodeURIComponent(endDate)}`;
    }

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API Error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sales Chart API Error:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
