import { cookies } from "next/headers";

// POST - تحديث meta_data لطلب معين
export async function POST(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { orderId, metaData } = body;

    if (!orderId || !metaData || !metaData.key) {
      return new Response(JSON.stringify({ error: "orderId and metaData.key are required" }), { 
        status: 400 
      });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // تحديث meta_data للطلب
    const updateUrl = `${API_BASE}/wp-json/wc/v3/orders/${orderId}`;
    
    const res = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        meta_data: [
          {
            key: metaData.key,
            value: metaData.value
          }
        ]
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error('WooCommerce API Error:', errorData);
      return new Response(JSON.stringify({ 
        error: `API Error ${res.status}`,
        details: errorData 
      }), {
        status: res.status,
      });
    }

    const updatedOrder = await res.json();

    return new Response(JSON.stringify({ 
      success: true,
      order: updatedOrder 
    }), { status: 200 });

  } catch (err) {
    console.error('Error updating order meta:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
