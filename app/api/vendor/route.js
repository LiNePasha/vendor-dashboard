import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = decodeToken(token);
    const vendorId = decoded?.data?.user?.id;

    if (!vendorId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // Get vendor details from WCFM API
    const vendorRes = await fetch(
      `${API_BASE}/wp-json/wcfmmp/v1/settings/id/${vendorId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!vendorRes.ok) {
      // Fallback to basic user info
      const userRes = await fetch(
        `${API_BASE}/wp-json/wp/v2/users/${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (userRes.ok) {
        const userData = await userRes.json();
        return NextResponse.json({
          id: vendorId,
          name: userData.name || decoded.data?.user?.display_name,
          logo: userData.avatar_urls?.['96'] || null,
          email: userData.email || decoded.data?.user?.user_email,
        });
      }

      return NextResponse.json({ error: 'Failed to fetch vendor info' }, { status: 500 });
    }

    const vendorData = await vendorRes.json();
    
    // 🔍 Debug: طباعة بيانات الـ vendor
    console.log('===== VENDOR DATA =====');
    console.log(JSON.stringify(vendorData, null, 2));
    console.log('=======================');

    // Get actual logo URL if logo is an ID
    let logoUrl = null;
    if (vendorData.gravatar) {
      logoUrl = vendorData.gravatar;
    } else if (vendorData.logo) {
      // Check if logo is a number (attachment ID) or URL
      if (typeof vendorData.logo === 'number' || !isNaN(vendorData.logo)) {
        // Fetch the actual image URL from media endpoint
        try {
          const mediaRes = await fetch(
            `${API_BASE}/wp-json/wp/v2/media/${vendorData.logo}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            logoUrl = mediaData.source_url || mediaData.media_details?.sizes?.thumbnail?.source_url;
          }
        } catch (err) {
          }
      } else {
        logoUrl = vendorData.logo;
      }
    }

    return NextResponse.json({
      id: vendorId,
      name: vendorData.store_name || decoded.data?.user?.display_name,
      logo: logoUrl,
      email: vendorData.store_email || decoded.data?.user?.user_email,
      phone: vendorData.phone || null,
      address: vendorData.address || null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
