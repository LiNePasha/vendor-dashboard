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
    
    // 🔥 استخدام WCFM API - بيدعم الـ parameters بشكل أفضل
    let apiUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders?per_page=${perPage}&page=${page}`;
    
    // ملحوظة: WCFM مبيدعمش status filter في orders endpoint
    // لكن بيرجع كل الـ orders ونفلترها client-side
    
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
    
    // محاولة الحصول على total من الـ headers
    const totalCount = res.headers.get('X-WP-Total') || res.headers.get('X-Total-Count');
    
    // 🔥 تطبيق فلتر الـ status على client-side (لأن WCFM API مش بيدعمه)
    let filteredOrders = Array.isArray(data) ? data : [];
    if (status && status !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === status);
    }
    
    // إضافة معلومات إضافية للـ response
    const response = {
      orders: filteredOrders,
      total: status && status !== 'all' ? filteredOrders.length : (totalCount ? parseInt(totalCount) : filteredOrders.length),
      page: parseInt(page),
      per_page: parseInt(perPage),
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
