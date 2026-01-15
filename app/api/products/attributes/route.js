import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET: جلب جميع الـ Attributes المتاحة من WooCommerce
 * يسترجع كل attribute مع terms الخاصة بها
 */
export async function GET(req) {
  try {
    console.log('🔵 [API] Fetching attributes from WooCommerce...');
    
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      console.error('❌ [API] No token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const { searchParams } = new URL(req.url);
    const includeTerms = searchParams.get('include_terms') === 'true';
    
    console.log('📡 [API] Include terms:', includeTerms);

    // 1. جلب جميع الـ attributes
    const attributesRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/attributes?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!attributesRes.ok) {
      console.error('❌ [API] Failed to fetch attributes:', attributesRes.status);
      throw new Error('Failed to fetch attributes');
    }

    let attributes = await attributesRes.json();
    console.log('✅ [API] Fetched', attributes.length, 'attributes');

    // 2. إذا طُلب جلب الـ terms لكل attribute
    if (includeTerms && attributes.length > 0) {
      // جلب terms لكل attribute بالتوازي
      const attributesWithTerms = await Promise.all(
        attributes.map(async (attr) => {
          try {
            const termsRes = await fetch(
              `${API_BASE}/wp-json/wc/v3/products/attributes/${attr.id}/terms?per_page=100`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (termsRes.ok) {
              const terms = await termsRes.json();
              return {
                ...attr,
                terms: terms.map(t => ({
                  id: t.id,
                  name: t.name,
                  slug: t.slug,
                  count: t.count
                }))
              };
            }

            return { ...attr, terms: [] };
          } catch (err) {
            console.error(`Error fetching terms for attribute ${attr.id}:`, err);
            return { ...attr, terms: [] };
          }
        })
      );

      attributes = attributesWithTerms;
    }

    // 3. تنسيق النتيجة
    const formattedAttributes = attributes.map(attr => ({
      id: attr.id,
      name: attr.name,
      slug: attr.slug,
      type: attr.type, // 'select' or 'text'
      order_by: attr.order_by,
      has_archives: attr.has_archives,
      terms: attr.terms || []
    }));

    console.log('📤 [API] Returning', formattedAttributes.length, 'formatted attributes');

    return NextResponse.json({
      success: true,
      attributes: formattedAttributes,
      count: formattedAttributes.length
    });

  } catch (error) {
    console.error('Error fetching attributes:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch attributes' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST: إنشاء attribute جديد في WooCommerce
 * Body: { name: string, slug?: string, type?: 'select' | 'text' }
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, type = 'select' } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const attributePayload = {
      name,
      type,
      order_by: 'menu_order',
      has_archives: false
    };

    if (slug) {
      attributePayload.slug = slug;
    }

    const createRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/attributes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(attributePayload)
    });

    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(errorData.message || 'Failed to create attribute');
    }

    const newAttribute = await createRes.json();

    return NextResponse.json({
      success: true,
      attribute: {
        id: newAttribute.id,
        name: newAttribute.name,
        slug: newAttribute.slug,
        type: newAttribute.type,
        terms: []
      }
    });

  } catch (error) {
    console.error('Error creating attribute:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to create attribute' 
      },
      { status: 500 }
    );
  }
}
