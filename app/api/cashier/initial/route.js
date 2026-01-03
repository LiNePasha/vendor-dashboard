import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cashier API Proxy - Initial Sync
 * 
 * Fetches all products from the new ultra-fast Cashier API
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
    const all = searchParams.get('all') || 'true'; // Default to all=true
    const page = searchParams.get('page') || '1';
    const per_page = searchParams.get('per_page') || '100';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // 🚀 استخدام الـ Cashier API الجديد مع all=true
    const url = `${API_BASE}/wp-json/cashier/v1/store/${vendorId}/pos-initial?all=${all}&page=${page}&per_page=${per_page}`;
    
    console.log(`⚡ Fetching from Cashier API: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      cache: 'no-store', // 🔥 منع Next.js من عمل cache
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Cashier API Error: ${res.status}`, errorText);
      return NextResponse.json(
        { error: `API Error: ${res.status}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    
    console.log(`✅ Cashier API Success: ${data.products?.length || 0} products (Cache: ${data.metadata?.cache})`);
    
    // 🔥 إرجاع response مع headers لمنع الـ cache
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (err) {
    console.error('❌ Cashier Initial Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
