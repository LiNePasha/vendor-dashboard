import { cookies } from "next/headers";

// Mark notification as read
export async function POST(req) {
  console.log('🔥 POST /api/notifications/mark-read called');
  
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  console.log('🔥 Token found:', !!token);

  if (!token) {
    console.log('🔥 No token - returning 401');
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('🔥 Request body:', body);
    
    const { notificationId } = body;

    if (!notificationId) {
      return new Response(JSON.stringify({ error: "notificationId is required" }), { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const apiUrl = `${API_BASE}/wp-json/wcfmmp/v1/notifications/${notificationId}/read`;
    
    console.log('🔥 Calling WCFM API:', apiUrl);
    
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('🔥 WCFM Response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.log('🔥 WCFM Error:', errorText);
      return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: errorText }), {
        status: res.status,
      });
    }

    const data = await res.json();
    console.log('🔥 Success - returning 200');
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (err) {
    console.error('🔥 POST Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
