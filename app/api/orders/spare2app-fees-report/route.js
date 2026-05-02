import { cookies } from "next/headers";

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";
    const sourceFilter = searchParams.get("source_filter") || "spare2app";
    const vendorId = searchParams.get("vendor_id") || "";
    const after = searchParams.get("after") || "";
    const before = searchParams.get("before") || "";

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";

    const params = new URLSearchParams({ period, source_filter: sourceFilter });
    if (vendorId) params.set("vendor_id", vendorId);
    if (after) params.set("after", after);
    if (before) params.set("before", before);

    const apiUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-orders/spare2app-fees-report?${params.toString()}`;

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      return new Response(
        JSON.stringify({
          error: `API Error ${res.status}`,
          details,
        }),
        { status: res.status }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
