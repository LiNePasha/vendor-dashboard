import { cookies } from "next/headers";

export async function GET(req) {
  // ✅ لازم await هنا
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    // قراءة query parameters
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('id');
    const status = searchParams.get('status') || '';
    const perPage = searchParams.get('per_page') || '20';
    const page = searchParams.get('page') || '1';
    const after = searchParams.get('after') || '';
    const before = searchParams.get('before') || '';
    const search = searchParams.get('search') || '';
    const minTotal = searchParams.get('min_total') || '';
    const maxTotal = searchParams.get('max_total') || '';

    // بناء URL مع الـ parameters
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // 🆕 لو في orderId يبقى نجيب order واحد بس
    if (orderId) {
      const singleOrderUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders/${orderId}`;
      const res = await fetch(singleOrderUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: `API Error ${res.status}` }), {
          status: res.status,
        });
      }

      const order = await res.json();
      return new Response(JSON.stringify(order), { status: 200 });
    }
    
    // 🔥 استخدام Spare2App Enhanced API - بيدعم الفلاتر بشكل كامل ✅
    let apiUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-orders?per_page=${perPage}&page=${page}`;
    
    // ✅ إضافة status filter
    if (status && status !== 'all') {
      apiUrl += `&status=${encodeURIComponent(status)}`;
    }
    
    // 🆕 إضافة فلتر التاريخ (ISO 8601 format)
    if (after) {
      apiUrl += `&after=${encodeURIComponent(after)}`;
    }
    
    if (before) {
      apiUrl += `&before=${encodeURIComponent(before)}`;
    }
    
    // Search filter
    if (search) {
      apiUrl += `&search=${encodeURIComponent(search)}`;
    }
    
    // 🆕 Price filters
    if (minTotal) {
      apiUrl += `&min_total=${encodeURIComponent(minTotal)}`;
    }
    
    if (maxTotal) {
      apiUrl += `&max_total=${encodeURIComponent(maxTotal)}`;
    }

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API Error ${res.status}` }), {
        status: res.status,
      });
    }

    const data = await res.json();
    
    // ✅ الـ API الجديد بيرجع {success, orders, pagination}
    const orders = data.orders || (Array.isArray(data) ? data : []);
    const paginationInfo = data.pagination || {};
    
    console.log('📦 Orders returned from Spare2App API:', {
      count: orders.length,
      requestedStatus: status,
      pagination: paginationInfo,
      firstOrderId: orders[0]?.id,
      firstOrderStatus: orders[0]?.status
    });
    
    // ✅ الـ API بيفلتر كل حاجة صح، مفيش حاجة نعملها هنا
    
    // 🔥 استخدام pagination من الـ API response
    const total = paginationInfo.total || orders.length;
    const totalPages = paginationInfo.total_pages || 1;
    const hasMore = paginationInfo.has_more || false;
    
    const response = {
      orders: orders,
      total: total,
      page: parseInt(page),
      per_page: parseInt(perPage),
      total_pages: totalPages,
      has_more: hasMore,
      status: status || 'all'
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PATCH(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const { orderId, status, meta_data } = body;

  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // Build update payload
    const updateData = {};
    if (status) updateData.status = status;
    if (meta_data) updateData.meta_data = meta_data;
    
    const res = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API Error ${res.status}` }), {
        status: res.status,
      });
    }

    const updatedOrder = await res.json();
    return new Response(JSON.stringify(updatedOrder), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
