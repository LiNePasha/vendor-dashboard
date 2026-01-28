import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST: إضافة منتجات متعددة دفعة واحدة
 * Body: {
 *   products: [
 *     { name, sellingPrice, purchasePrice, stock, sku, imageUrl },
 *     ...
 *   ]
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
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Products array is required' }, { status: 400 });
    }

    if (products.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 products per request' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // 🔥 إنشاء كل المنتجات بالتوازي
    const createPromises = products.map(async (product) => {
      const { name, sellingPrice, purchasePrice, stock, sku, imageUrl } = product;

      if (!name || sellingPrice === undefined || sellingPrice === null) {
        return { success: false, error: 'Name and price required', product: { name } };
      }

      try {
        const productPayload = {
          name,
          type: 'simple',
          regular_price: String(sellingPrice),
          status: 'publish',
          manage_stock: true,
          stock_quantity: Number(stock) || 0,
          meta_data: [
            { key: '_wcfm_product_author', value: vendorId },
            { key: '_purchase_price', value: String(purchasePrice || 0) }
          ]
        };

        // إضافة SKU إذا كان موجود
        if (sku) {
          productPayload.sku = sku;
        }

        // إضافة الصورة
        if (imageUrl) {
          productPayload.images = [{ src: imageUrl }];
        }

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
          throw new Error(errorData.message || 'Failed to create product');
        }

        const newProduct = await createRes.json();
        return { success: true, product: newProduct };
      } catch (error) {
        console.error('Error creating product:', product.name, error);
        return { success: false, error: error.message, product: { name } };
      }
    });

    // انتظار كل العمليات
    const results = await Promise.all(createPromises);

    // فصل النتائج
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      created: successful.length,
      failed: failed.length,
      total: products.length,
      products: successful.map(r => r.product),
      errors: failed.map(r => ({ name: r.product.name, error: r.error }))
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create products' },
      { status: 500 }
    );
  }
}
