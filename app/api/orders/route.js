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
    const status = searchParams.get('status') || '';
    const perPage = searchParams.get('per_page') || '20';
    const page = searchParams.get('page') || '1';

    // بناء URL مع الـ parameters
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    let apiUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders?per_page=${perPage}&page=${page}`;
    
    if (status) {
      apiUrl += `&status=${status}`;
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
    
    // إضافة معلومات إضافية للـ response
    const response = {
      orders: Array.isArray(data) ? data : [],
      total: totalCount ? parseInt(totalCount) : (Array.isArray(data) ? data.length : 0),
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

  const { orderId, status } = await req.json();

  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const res = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
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
