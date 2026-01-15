import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { updates } = body;
    if (!Array.isArray(updates)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const results = await Promise.all(updates.map(async ({ productId, expectedQuantity }) => {
      try {
        const res = await fetch(`${API_BASE}/wp-json/wc/v3/products/${productId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        const text = await res.text().catch(() => null);
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch(e) { json = null; }

        return {
          productId,
          ok: res.ok,
          status: res.status,
          body: json,
          matches: json && typeof json.stock_quantity !== 'undefined' ? Number(json.stock_quantity) === Number(expectedQuantity) : false
        };
      } catch (err) {
        return { productId, ok: false, error: err.message };
      }
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
