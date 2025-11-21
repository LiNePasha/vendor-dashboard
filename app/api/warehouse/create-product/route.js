import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v2 as cloudinary } from 'cloudinary';

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST: إضافة منتج جديد من الـ warehouse إلى WooCommerce API
 * Body: {
 *   name: string,
 *   sku?: string,
 *   sellingPrice: number,
 *   purchasePrice?: number,
 *   stock: number,
 *   category?: string,
 *   imageBase64?: string (صورة بصيغة base64)
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
    const { name, sku, sellingPrice, purchasePrice, stock, category, imageBase64, imageUrl } = body;

    if (!name || !sellingPrice) {
      return NextResponse.json({ error: 'Name and selling price are required' }, { status: 400 });
    }

    let finalImageUrl = imageUrl; // استخدام imageUrl المرسل مباشرة (من Cloudinary)

    // 1. رفع الصورة لـ Cloudinary إذا كانت موجودة كـ base64 (للتوافق مع الكود القديم)
    if (!finalImageUrl && imageBase64) {
      try {
        const result = await cloudinary.uploader.upload(imageBase64, {
          folder: 'products',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        finalImageUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // نكمل بدون صورة بدل ما نفشل الطلب كله
      }
    }

    // 2. إنشاء المنتج في WooCommerce API
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const productPayload = {
      name,
      type: 'simple',
      regular_price: String(sellingPrice),
      status: 'publish',
      manage_stock: true,
      stock_quantity: Number(stock) || 0,
      meta_data: [
        { key: '_wcfm_product_author', value: vendorId },
        // حفظ سعر الشراء في meta_data للاستخدام لاحقاً
        { key: '_purchase_price', value: String(purchasePrice || 0) }
      ]
    };

    // إضافة SKU إذا كان موجود
    if (sku) {
      productPayload.sku = sku;
    }

    // إضافة الصورة إذا تم رفعها
    if (finalImageUrl) {
      productPayload.images = [{ src: finalImageUrl }];
    }

    // إضافة التصنيف إذا كان موجود
    if (category) {
      // البحث عن التصنيف أو إنشاؤه
      const categoriesRes = await fetch(
        `${API_BASE}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(category)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (categoriesRes.ok) {
        const categories = await categoriesRes.json();
        const existingCategory = categories.find(c => c.name === category);

        if (existingCategory) {
          productPayload.categories = [{ id: existingCategory.id }];
        } else {
          // إنشاء تصنيف جديد
          const createCatRes = await fetch(
            `${API_BASE}/wp-json/wc/v3/products/categories`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ name: category }),
            }
          );

          if (createCatRes.ok) {
            const newCategory = await createCatRes.json();
            productPayload.categories = [{ id: newCategory.id }];
          }
        }
      }
    }

    // 3. إنشاء المنتج
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
      throw new Error(errorData.message || `API Error: ${createRes.status}`);
    }

    const newProduct = await createRes.json();

    return NextResponse.json({
      success: true,
      product: newProduct,
      imageUrl: finalImageUrl,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
