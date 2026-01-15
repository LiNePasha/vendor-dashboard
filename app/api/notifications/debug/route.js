import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://spare2app.com";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // جلب notification واحدة كـ sample
    const notifRes = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/notifications?per_page=1`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!notifRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch notifications: ${notifRes.statusText}` },
        { status: notifRes.status }
      );
    }

    const notifications = await notifRes.json();

    return NextResponse.json({
      success: true,
      message: 'Check the notification structure - usually WCFM stores notifications in wp_wcfm_messages or wp_wcfm_messages_stat table',
      sample: notifications[0] || null,
      hints: {
        possibleTables: [
          'wp_wcfm_messages',
          'wp_wcfm_messages_stat', 
          'wp_wcfm_marketplace_vendor_notifications'
        ],
        checkInPhpMyAdmin: [
          '1. افتح phpMyAdmin',
          '2. دور على tables اللي اسمها بيبدأ بـ wcfm',
          '3. شوف wp_wcfm_messages_stat - غالباً فيها is_read column',
          '4. جرب: UPDATE wp_wcfm_messages_stat SET is_read = 1 WHERE ID = {notification_id}',
          '5. أو: UPDATE wp_wcfm_messages SET is_read = 1 WHERE ID = {notification_id}'
        ],
        nextSteps: [
          'لو لقيت الـ table والـ column، ابعتلي structure',
          'هعملك custom API endpoint يعمل UPDATE في الـ database مباشرة',
          'نستخدم WordPress $wpdb عشان نعمل الـ query بأمان'
        ]
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
