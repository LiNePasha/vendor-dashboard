import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const filter = searchParams.get('filter') || 'all';
  const perPage = searchParams.get('per_page') || '20';
  const page = searchParams.get('page') || '1';
  const vendorId = searchParams.get('vendor_id'); // Get vendor_id if provided

  try {
    // Get all cookies from the incoming request
    const cookieHeader = request.headers.get('cookie') || '';

    // Build WordPress API URL with all query params
    let wpApiUrl = `https://api.spare2app.com/wp-json/spare2app/v1/notifications?filter=${filter}&per_page=${perPage}&page=${page}`;
    if (vendorId) {
      wpApiUrl += `&vendor_id=${vendorId}`;
    }

    // Call custom WordPress API
    const response = await fetch(
      wpApiUrl,
      {
        headers: {
          'Cookie': cookieHeader,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: 'Failed to fetch notifications', 
          status: response.status,
          details: errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'mark-all-read' or 'mark-read'
  const notificationId = searchParams.get('id');
  const vendorId = searchParams.get('vendor_id') || '22'; // Get vendor_id

  try {
    // Get all cookies from the incoming request
    const cookieHeader = request.headers.get('cookie') || '';

    let apiUrl = '';
    
    if (action === 'mark-all-read') {
      apiUrl = `https://api.spare2app.com/wp-json/spare2app/v1/notifications/read-all?vendor_id=${vendorId}`;
    } else if (notificationId) {
      apiUrl = `https://api.spare2app.com/wp-json/spare2app/v1/notifications/${notificationId}/read?vendor_id=${vendorId}`;
    } else {
      return NextResponse.json(
        { error: 'Missing action or notification ID' },
        { status: 400 }
      );
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: 'Failed to mark as read', 
          status: response.status,
          details: errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Mark as read API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
