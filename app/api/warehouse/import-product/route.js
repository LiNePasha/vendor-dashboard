import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST: استيراد منتج من CSV إلى WooCommerce (بدون categories)
 * يستقبل بيانات كاملة من CSV ويحولها لمنتج WooCommerce
 * Body: {
 *   name: string,
 *   sku?: string,
 *   price: number,
 *   stock?: number,
 *   description?: string,
 *   shortDescription?: string,
 *   images?: string[] (URLs)
 * }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // فك تشفير التوكن لجلب vendor ID
    function decodeToken(token) {
      try {
        const payload = token.split('.')[1];
        return JSON.parse(Buffer.from(payload, 'base64').toString());
      } catch {
        return null;
      }
    }

    const decoded = decodeToken(token);
    const vendorId = decoded?.data?.user?.id;

    const body = await req.json();
    const { 
      name, 
      sku, 
      price, 
      stock, 
      description, 
      shortDescription,
      images 
    } = body;

    if (!name || !price) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // بناء payload المنتج (بدون categories)
    const productPayload = {
      name,
      type: 'simple',
      regular_price: String(price),
      status: 'publish',
      manage_stock: true,
      stock_quantity: Number(stock) || 0,
      description: description || '',
      short_description: shortDescription || '',
      meta_data: [
        { key: '_wcfm_product_author', value: vendorId }
      ]
    };

    // إضافة SKU
    if (sku) {
      productPayload.sku = sku;
    }

    // إضافة الصور من URLs مباشرة
    if (images && images.length > 0) {
      productPayload.images = images.map(url => ({ src: url }));
    }

    // إنشاء المنتج في WCFM
    const createRes = await fetch(`${API_BASE}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productPayload),
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      console.error('WCFM API Error:', errorData);
      throw new Error(errorData.message || `API Error: ${createRes.status}`);
    }

    const newProduct = await createRes.json();

    return NextResponse.json({
      success: true,
      product: newProduct,
    });
  } catch (error) {
    console.error('Import product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import product' },
      { status: 500 }
    );
  }
}
