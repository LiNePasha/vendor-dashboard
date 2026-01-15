import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET: جلب جميع terms لـ attribute معين
 * /api/products/attributes/[id]/terms
 */
export async function GET(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const termsRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/attributes/${id}/terms?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!termsRes.ok) {
      throw new Error('Failed to fetch terms');
    }

    const terms = await termsRes.json();

    return NextResponse.json({
      success: true,
      terms: terms.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        count: t.count
      }))
    });

  } catch (error) {
    console.error('Error fetching terms:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch terms' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST: إضافة term جديد لـ attribute
 * Body: { name: string, slug?: string }
 */
export async function POST(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const termPayload = { name };
    if (slug) {
      termPayload.slug = slug;
    }

    const createRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/attributes/${id}/terms`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(termPayload)
      }
    );

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(errorData.message || 'Failed to create term');
    }

    const newTerm = await createRes.json();

    return NextResponse.json({
      success: true,
      term: {
        id: newTerm.id,
        name: newTerm.name,
        slug: newTerm.slug
      }
    });

  } catch (error) {
    console.error('Error creating term:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to create term' 
      },
      { status: 500 }
    );
  }
}
