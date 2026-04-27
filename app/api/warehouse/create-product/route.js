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
 *   type?: 'simple' | 'variable', // نوع المنتج
 *   sellingPrice?: number, // للمنتجات البسيطة فقط
 *   purchasePrice?: number,
 *   stock?: number, // للمنتجات البسيطة فقط
 *   categories?: number[], // array of category IDs
 *   imageUrl?: string, // رابط صورة من Cloudinary
 *   attributes?: array // للمنتجات المتعددة: [{name, options, visible, variation}]
 * }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const userRoleCookie = cookieStore.get('userRole')?.value;

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
    const ownVendorId = decoded?.data?.user?.id;
    const roles = decoded?.data?.user?.roles || [];

    const body = await req.json();
    const { name, sku, type = 'simple', sellingPrice, salePrice, purchasePrice, stock, categories, images, attributes, vendor_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // ✅ كشف الأدمن والحصول على vendor_id النهائي
    const isAdmin = userRoleCookie === 'admin' ||
      roles.includes('administrator') ||
      roles.includes('shop_manager');

    let vendorId = ownVendorId;
    if (isAdmin && vendor_id) {
      vendorId = vendor_id;
      console.log(`👑 Admin creating product for vendor: ${vendor_id}`);
    }

    // Validation for simple products
    if (type === 'simple' && !sellingPrice) {
      return NextResponse.json({ error: 'Selling price is required for simple products' }, { status: 400 });
    }

    // Validation for variable products
    if (type === 'variable' && (!attributes || attributes.length === 0)) {
      return NextResponse.json({ error: 'Attributes are required for variable products' }, { status: 400 });
    }

    // 2. إنشاء المنتج في WooCommerce API
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const productPayload = {
      name,
      type: type, // 'simple' or 'variable'
      status: 'publish',
      meta_data: [
        { key: '_wcfm_product_author', value: vendorId },
        { key: '_purchase_price', value: String(purchasePrice || 0) }
      ]
    };

    // إضافة SKU إذا كان موجود
    if (sku) {
      productPayload.sku = sku;
    }

    // إضافة الصور إذا تم رفعها - 🆕 دعم multiple images
    if (images && Array.isArray(images) && images.length > 0) {
      productPayload.images = images.map(url => ({ src: url }));
    }

    // إضافة التصنيفات
    if (categories && Array.isArray(categories) && categories.length > 0) {
      productPayload.categories = categories.map(catId => ({ id: parseInt(catId) }));
      console.log('✅ Categories added to product:', productPayload.categories);
    }

    // Settings specific to product type
    if (type === 'simple') {
      productPayload.regular_price = String(sellingPrice);
      // Add sale price if provided
      if (salePrice !== undefined && salePrice !== null && String(salePrice).trim() !== '') {
        productPayload.sale_price = String(salePrice);
      }
      productPayload.manage_stock = true;
      productPayload.stock_quantity = Number(stock) || 0;
    } else if (type === 'variable') {
      // For variable products, add attributes
      productPayload.attributes = attributes.map(attr => ({
        name: attr.name,
        options: attr.options,
        visible: attr.visible !== false,
        variation: attr.variation !== false
      }));
    }

    // 3. إنشاء المنتج
    // ✅ لما الأدمن يضيف لتاجر معين، استخدم consumer key عشان WooCommerce
    //    لا يسجل المنتج باسم الأدمن (JWT) بل يعتمد على _wcfm_product_author
    let createHeaders = { 'Content-Type': 'application/json' };
    let createUrl = `${API_BASE}/wp-json/wc/v3/products`;
    
    if (isAdmin && vendor_id) {
      // استخدام consumer key auth لتجاوز تسجيل user الـ JWT
      createUrl += `?consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;
    } else {
      createHeaders['Authorization'] = `Bearer ${token}`;
    }

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify(productPayload),
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(errorData.message || `API Error: ${createRes.status}`);
    }

    const newProduct = await createRes.json();

    // ✅ لما الأدمن يضيف لتاجر معين، نحدث post_author عبر WP REST API
    // WCFM بيعتمد على post_author مش بس _wcfm_product_author
    if (isAdmin && vendor_id && newProduct.id) {
      try {
        const wpUrl = `${API_BASE}/wp-json/wp/v2/product/${newProduct.id}?consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;
        await fetch(wpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: parseInt(vendor_id) })
        });
        console.log(`✅ Set post_author=${vendor_id} for product ${newProduct.id}`);
      } catch (e) {
        console.error('⚠️ Failed to set post_author:', e);
      }
    }

    return NextResponse.json({
      success: true,
      product: newProduct,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
