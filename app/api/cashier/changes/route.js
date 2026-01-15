import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cashier API Proxy - Delta Changes
 * 
 * Fetches only changed products since last sync
 */

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = decodeToken(token);
    const vendorId = decoded?.data?.user?.id;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    if (!since) {
      return NextResponse.json({ error: 'Missing "since" parameter' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // 🔄 استخدام Delta Sync API
    const url = `${API_BASE}/wp-json/cashier/v1/store/${vendorId}/pos-changes?since=${encodeURIComponent(since)}`;
    
    console.log(`🔄 Fetching changes from Cashier API since: ${since}`);
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Cashier Changes API Error: ${res.status}`, errorText);
      return NextResponse.json(
        { error: `API Error: ${res.status}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    
    console.log(`✅ Cashier Changes: ${data.updates?.length || 0} changes found`);
    
    return NextResponse.json(data);
    
  } catch (err) {
    console.error('❌ Cashier Changes Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
