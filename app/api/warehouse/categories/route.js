import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET: جلب كل التصنيفات من WooCommerce (ليس فقط الخاصة بالـ vendor)
 * هذا الـ API مخصص لصفحة warehouse/add لإضافة منتجات جديدة
 */
export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // 🔥 جلب كل التصنيفات من WooCommerce (بدون فلترة vendor)
    // المرحلة 1: جلب الصفحة الأولى لمعرفة عدد الصفحات الإجمالي
    const firstPageRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/categories?per_page=100&page=1&orderby=name&order=asc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!firstPageRes.ok) {
      const errorText = await firstPageRes.text();
      console.error('❌ WooCommerce API Error:', firstPageRes.status, errorText);
      return NextResponse.json(
        { error: `WooCommerce API Error: ${firstPageRes.status}` },
        { status: firstPageRes.status }
      );
    }

    const firstPageData = await firstPageRes.json();
    const totalPages = parseInt(firstPageRes.headers.get('X-WP-TotalPages') || '1');
    const totalCategories = parseInt(firstPageRes.headers.get('X-WP-Total') || '0');
    
    let allCategories = [...firstPageData];

    // المرحلة 2: جلب باقي الصفحات إذا وجدت
    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          fetch(
            `${API_BASE}/wp-json/wc/v3/products/categories?per_page=100&page=${page}&orderby=name&order=asc`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          ).then(res => res.ok ? res.json() : [])
        );
      }

      const remainingPages = await Promise.all(pagePromises);
      remainingPages.forEach(pageData => {
        allCategories = [...allCategories, ...pageData];
      });
    }

    const rawCategories = allCategories;
    
    // تنسيق البيانات
    const formattedCategories = rawCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parent: cat.parent || 0,
      description: cat.description || '',
      count: cat.count || 0,
      image: cat.image?.src || null,
      menu_order: cat.menu_order || 0
    }));

    // 🔍 تحليل الشجرة
    const parentCats = formattedCategories.filter(c => c.parent === 0);
    const childCats = formattedCategories.filter(c => c.parent !== 0);
    
    // حساب عمق الشجرة
    const getDepth = (catId, depth = 0) => {
      const children = formattedCategories.filter(c => c.parent === catId);
      if (children.length === 0) return depth;
      return Math.max(...children.map(c => getDepth(c.id, depth + 1)));
    };
    
    const maxDepth = Math.max(...parentCats.map(c => getDepth(c.id, 1)));

    return NextResponse.json({
      success: true,
      categories: formattedCategories,
      stats: {
        total: formattedCategories.length,
        parents: parentCats.length,
        children: childCats.length,
        maxDepth: maxDepth
      }
    });
  } catch (error) {
    console.error('❌ Error fetching WooCommerce categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
