import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST: نقل مخزون من المحلي إلى WooCommerce API
 * Body: { productId: number, quantity: number }
 * - ينقص من المخزون المحلي
 * - يضيف للمخزون في API
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, quantity } = body;

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // 1. جلب الـ stock الحالي من API
    const getRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${productId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!getRes.ok) {
      const errorText = await getRes.text();
      console.error('Failed to fetch product:', errorText);
      throw new Error(`Failed to fetch product ${productId}: ${getRes.status}`);
    }

    const product = await getRes.json();
    const currentApiStock = Number(product.stock_quantity) || 0;
    const newApiStock = currentApiStock + Number(quantity);

    // 2. تحديث المخزون في API
    const updateRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${productId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stock_quantity: newApiStock,
          manage_stock: true, // تفعيل إدارة المخزون
        }),
      }
    );

    console.log('Update Product Response Status:', updateRes.status);

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error('Failed to update stock:', errorText);
      throw new Error(`Failed to update stock for product ${productId}: ${updateRes.status}`);
    }

    const updatedProduct = await updateRes.json();

    return NextResponse.json({
      success: true,
      oldStock: currentApiStock,
      newStock: newApiStock,
      transferred: quantity,
      product: updatedProduct
    });
  } catch (error) {
    console.error('Transfer stock error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transfer stock' },
      { status: 500 }
    );
  }
}
