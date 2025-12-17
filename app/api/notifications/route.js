import { cookies } from "next/headers";

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';
    const perPage = searchParams.get('per_page') || '20';
    const notificationType = searchParams.get('notification_type') || 'order';
    const notificationStatus = searchParams.get('notification_status') || 'unread';
    const order = searchParams.get('order') || 'DESC';
    const orderby = searchParams.get('orderby') || 'created';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const apiUrl = `${API_BASE}/wp-json/wcfmmp/v1/notifications/?page=${page}&per_page=${perPage}&notification_type=${notificationType}&notification_status=${notificationStatus}&order=${order}&orderby=${orderby}`;

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

    const notifications = await res.json();
    
    // Parse order IDs from notification messages
    const enrichedNotifications = notifications.map(notif => {
      // Extract order ID from message like "#274 order status updated" or "Order #274 for Product"
      const orderIdMatch = notif.message?.match(/#(\d+)/);
      return {
        ...notif,
        orderId: orderIdMatch ? parseInt(orderIdMatch[1]) : null,
        isNew: notificationStatus === 'unread',
      };
    });

    return new Response(JSON.stringify({
      notifications: enrichedNotifications,
      total: notifications.length,
      page: parseInt(page),
      per_page: parseInt(perPage),
    }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
