import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// وظيفة لجلب التوكن من الكوكيز
async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

// GET: جلب التصنيفات فقط
export async function GET(req) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // فك التوكن لجلب vendor ID
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

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID not found' }, { status: 400 });
    }

    // جلب التصنيفات من الـ API المخصص
    const categoriesRes = await fetch(
      `${API_BASE}/wp-json/spare2app/v2/store/${vendorId}/categories?consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!categoriesRes.ok) {
      const errorText = await categoriesRes.text();
      return NextResponse.json(
        { error: `Categories API Error: ${categoriesRes.status} - ${errorText}` }, 
        { status: categoriesRes.status }
      );
    }

    const rawData = await categoriesRes.json();
    
    // التحقق من نوع الـ response
    let categories = [];
    
    if (Array.isArray(rawData)) {
      // لو array مباشرة
      categories = rawData;
    } else if (rawData.categories && Array.isArray(rawData.categories)) {
      // لو object فيه categories
      categories = rawData.categories;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      // لو object فيه data
      categories = rawData.data;
    } else {
      // الـ response مش معروف
      return NextResponse.json({ 
        error: 'Invalid categories response format',
        received: typeof rawData,
        data: rawData
      }, { status: 500 });
    }
    
    // Debug: شوف أول item
    console.log('📦 Sample Category:', JSON.stringify(categories[0], null, 2));
    
    // 🆕 إرجاع كل الـ data بدون filtering
    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count || 0,
      parent: cat.parent || 0,
      description: cat.description || '',
      // 🔧 إصلاح: تحويل image object إلى string URL
      image: typeof cat.image === 'object' && cat.image?.src ? cat.image.src : (cat.image || null),
      // إضافة أي بيانات إضافية موجودة
      menu_order: cat.menu_order,
      _links: cat._links
    }));

    return NextResponse.json({ 
      success: true,
      categories: formattedCategories,
      total: formattedCategories.length,
      // 🆕 إرجاع أول category كاملة للمعاينة
      sample: categories[0] || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' }, 
      { status: 500 }
    );
  }
}
