import { cookies } from "next/headers";

export async function POST(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const productData = await req.json();
    
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // تحضير بيانات المنتج للـ WooCommerce
    const wooProduct = {
      name: productData.name,
      type: productData.type || 'simple',
      regular_price: String(productData.regular_price || '0'),
      sale_price: productData.sale_price ? String(productData.sale_price) : '',
      description: productData.description || '',
      short_description: productData.short_description || '',
      sku: productData.sku || '',
      manage_stock: productData.manage_stock !== false,
      stock_quantity: parseInt(productData.stock_quantity) || 0,
      in_stock: productData.in_stock !== false,
      status: 'publish',
      categories: [],
      images: productData.images || [],
    };

    // معالجة الفئات
    if (productData.categories && productData.categories.length > 0) {
      // البحث عن الفئات أو إنشاؤها
      for (const catName of productData.categories) {
        if (catName && catName !== 'Uncategorized') {
          // محاولة البحث عن الفئة أولاً
          const searchRes = await fetch(
            `${API_BASE}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(catName)}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (searchRes.ok) {
            const categories = await searchRes.json();
            if (categories.length > 0) {
              wooProduct.categories.push({ id: categories[0].id });
            } else {
              // إنشاء فئة جديدة
              const createCatRes = await fetch(
                `${API_BASE}/wp-json/wc/v3/products/categories`,
                {
                  method: 'POST',
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ name: catName }),
                }
              );
              
              if (createCatRes.ok) {
                const newCat = await createCatRes.json();
                wooProduct.categories.push({ id: newCat.id });
              }
            }
          }
        }
      }
    }

    // إنشاء المنتج في WooCommerce
    const res = await fetch(`${API_BASE}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(wooProduct),
    });

    if (!res.ok) {
      const error = await res.json();
      return new Response(
        JSON.stringify({ 
          error: error.message || "فشل إنشاء المنتج",
          details: error
        }), 
        { status: res.status }
      );
    }

    const product = await res.json();
    return new Response(JSON.stringify({ success: true, product }), { status: 200 });
  } catch (err) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "حدث خطأ أثناء الاستيراد" }), 
      { status: 500 }
    );
  }
}
