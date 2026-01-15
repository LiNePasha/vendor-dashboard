// app/api/products/[id]/variations/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

// GET: جلب variations لمنتج محدد
export async function GET(req, { params }) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    const { searchParams } = new URL(req.url);
    const per_page = searchParams.get("per_page") || "100";

    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${id}/variations?per_page=${per_page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Variations API Error: ${res.status}`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch variations: ${res.status}` },
        { status: res.status }
      );
    }

    const variations = await res.json();
    
    // تنسيق الـ variations
    const formatted = variations.map(v => ({
      id: v.id,
      sku: v.sku || '',
      price: v.price || v.regular_price || '0',
      regular_price: v.regular_price || '0',
      sale_price: v.sale_price || '',
      stock_quantity: v.stock_quantity || 0,
      manage_stock: v.manage_stock || false,
      in_stock: v.stock_status === 'instock',
      stock_status: v.stock_status || 'outofstock',
      purchasable: v.purchasable || false,
      attributes: v.attributes || [],
      image: v.image?.src || null,
      description: v.attributes?.map(a => a.option).join(' - ') || '',
      // بيانات إضافية
      weight: v.weight || '',
      dimensions: v.dimensions || {},
      shipping_class: v.shipping_class || '',
      tax_status: v.tax_status || 'taxable',
      tax_class: v.tax_class || ''
    }));

    console.log(`✅ Fetched ${formatted.length} variations for product ${id}`);

    return NextResponse.json({
      success: true,
      product_id: parseInt(id),
      variations: formatted,
      count: formatted.length
    });
  } catch (err) {
    console.error('❌ Variations API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: إنشاء variation جديد
export async function POST(req, { params }) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // التحقق من البيانات المطلوبة
    if (!body.attributes || !Array.isArray(body.attributes) || body.attributes.length === 0) {
      return NextResponse.json(
        { error: "Attributes are required for variation" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${id}/variations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Create Variation Error: ${res.status}`, errorData);
      return NextResponse.json(
        { error: errorData.message || `Failed to create variation: ${res.status}` },
        { status: res.status }
      );
    }

    const variation = await res.json();
    console.log(`✅ Created variation ${variation.id} for product ${id}`);

    return NextResponse.json({
      success: true,
      variation
    });
  } catch (err) {
    console.error('❌ Create Variation Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH: تحديث variation محدد
export async function PATCH(req, { params }) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // variation_id يجي في الـ body
    if (!body.variation_id) {
      return NextResponse.json(
        { error: "variation_id is required" },
        { status: 400 }
      );
    }

    const variationId = body.variation_id;
    delete body.variation_id; // نشيله من الـ body قبل الإرسال

    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${id}/variations/${variationId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Update Variation Error: ${res.status}`, errorData);
      return NextResponse.json(
        { error: errorData.message || `Failed to update variation: ${res.status}` },
        { status: res.status }
      );
    }

    const variation = await res.json();
    console.log(`✅ Updated variation ${variationId} for product ${id}`);

    return NextResponse.json({
      success: true,
      variation
    });
  } catch (err) {
    console.error('❌ Update Variation Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE: حذف variation محدد
export async function DELETE(req, { params }) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const variationId = searchParams.get("variation_id");
    
    if (!variationId) {
      return NextResponse.json(
        { error: "variation_id query parameter is required" },
        { status: 400 }
      );
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${id}/variations/${variationId}?force=true`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`❌ Delete Variation Error: ${res.status}`, errorData);
      return NextResponse.json(
        { error: errorData.message || `Failed to delete variation: ${res.status}` },
        { status: res.status }
      );
    }

    console.log(`✅ Deleted variation ${variationId} for product ${id}`);

    return NextResponse.json({
      success: true,
      message: "Variation deleted successfully"
    });
  } catch (err) {
    console.error('❌ Delete Variation Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
