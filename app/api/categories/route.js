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

    // 🆕 جلب كل التصنيفات من الموقع (مش فقط الخاصة بالتاجر)
    // استخدام WooCommerce API مباشرة للحصول على كل الفئات
    let allCategories = [];
    let page = 1;
    let hasMore = true;
    
    // جلب كل الصفحات
    while (hasMore) {
      const categoriesRes = await fetch(
        `${API_BASE}/wp-json/wc/v3/products/categories?per_page=100&page=${page}&consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!categoriesRes.ok) {
        if (page === 1) {
          // لو أول صفحة فشلت، نرجع error
          const errorText = await categoriesRes.text();
          return NextResponse.json(
            { error: `Categories API Error: ${categoriesRes.status} - ${errorText}` }, 
            { status: categoriesRes.status }
          );
        }
        // لو مش أول صفحة، يبقى خلصنا
        break;
      }

      const pageData = await categoriesRes.json();
      
      if (Array.isArray(pageData) && pageData.length > 0) {
        allCategories = [...allCategories, ...pageData];
        page++;
        
        // لو جابنا أقل من 100، يبقى دي آخر صفحة
        if (pageData.length < 100) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    if (allCategories.length === 0) {
      return NextResponse.json({ 
        success: true,
        categories: [],
        total: 0
      });
    }
    
    // Debug: شوف أول item
    console.log('📦 Total Categories Loaded:', allCategories.length);
    console.log('📦 Sample Category:', JSON.stringify(allCategories[0], null, 2));
    
    // 🆕 إرجاع كل الـ data بدون filtering
    const formattedCategories = allCategories.map(cat => ({
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
      sample: allCategories[0] || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' }, 
      { status: 500 }
    );
  }
}
