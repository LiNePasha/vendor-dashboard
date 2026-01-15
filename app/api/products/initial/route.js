import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Products API - Initial Sync
 * 
 * Fetches all products from the ultra-fast Products API
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
    const includeVariations = searchParams.get('include_variations') === 'true';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // 🚀 استخدام الـ Products API مع all=true لجلب كل المنتجات والكاتجوريز
    const url = `${API_BASE}/wp-json/spare2app/v2/store/${vendorId}/products?per_page=9999`;
    
    console.log(`⚡ Fetching ALL products from Products API: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Products API Error: ${res.status}`, errorText);
      return NextResponse.json(
        { success: false, error: `API Error: ${res.status}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    
    // تنسيق الـ response ليطابق التوقعات
    const response = {
      success: true,
      products: data.products || [],
      categories: data.categories || [],
      metadata: data.metadata || {}
    };
    
    console.log(`✅ Products API Success: ${response.products.length} products, ${response.categories.length} categories`);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (err) {
    console.error('❌ Products Initial Sync Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
