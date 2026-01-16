import { cookies } from "next/headers";

// GET - جلب ملاحظات طلب معين
export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id is required" }), { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // جلب جميع الملاحظات الخاصة بالطلب
    const notesUrl = `${API_BASE}/wp-json/wc/v3/orders/${orderId}/notes?per_page=100`;
    
    const res = await fetch(notesUrl, {
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

    const notes = await res.json();
    
    // فلترة الملاحظات الخاصة (private) فقط
    // نبحث عن الملاحظة اللي عندها customer_note = false
    const privateNotes = notes.filter(note => !note.customer_note);
    
    // نرجع آخر ملاحظة private (أحدث واحدة)
    const latestNote = privateNotes.length > 0 ? privateNotes[0] : null;

    return new Response(JSON.stringify({ 
      note: latestNote,
      all_notes: privateNotes // في حالة احتجنا كل الملاحظات
    }), { status: 200 });

  } catch (err) {
    console.error('Error fetching order notes:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// POST - إضافة/تحديث ملاحظة على طلب
export async function POST(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await req.json();
    const { order_id, note } = body;

    if (!order_id || !note) {
      return new Response(JSON.stringify({ error: "order_id and note are required" }), { 
        status: 400 
      });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // إضافة ملاحظة private جديدة
    const notesUrl = `${API_BASE}/wp-json/wc/v3/orders/${order_id}/notes`;
    
    const res = await fetch(notesUrl, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        note: note,
        customer_note: false, // ملاحظة خاصة - مش للعميل
        added_by_user: true
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

    const createdNote = await res.json();

    return new Response(JSON.stringify({ 
      success: true,
      note: createdNote 
    }), { status: 200 });

  } catch (err) {
    console.error('Error creating order note:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// DELETE - حذف ملاحظة
export async function DELETE(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');
    const noteId = searchParams.get('note_id');

    if (!orderId || !noteId) {
      return new Response(JSON.stringify({ error: "order_id and note_id are required" }), { 
        status: 400 
      });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // حذف الملاحظة
    const deleteUrl = `${API_BASE}/wp-json/wc/v3/orders/${orderId}/notes/${noteId}?force=true`;
    
    const res = await fetch(deleteUrl, {
      method: 'DELETE',
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

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Error deleting order note:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
