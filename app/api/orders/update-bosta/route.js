import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { orderId, bostaData, clearBosta } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'يجب إرسال رقم الطلب' },
        { status: 400 }
      );
    }

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'غير مصرح - يجب تسجيل الدخول' },
        { status: 401 }
      );
    }

    // Get API base URL
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    let metaData;
    
    if (clearBosta) {
      // مسح بيانات بوسطة - حذف كل الـ meta data المتعلقة ببوسطة
      metaData = [
        { key: '_bosta_sent', value: '' },
        { key: '_bosta_tracking_number', value: '' },
        { key: '_bosta_order_id', value: '' },
        { key: '_bosta_status', value: '' },
        { key: '_bosta_status_code', value: '' },
        { key: '_bosta_sent_at', value: '' },
        { key: '_bosta_last_updated', value: '' }
      ];
    } else if (bostaData) {
      // إضافة/تحديث بيانات بوسطة
      metaData = [
        { key: '_bosta_sent', value: 'yes' },
        { key: '_bosta_tracking_number', value: bostaData.trackingNumber },
        { key: '_bosta_order_id', value: bostaData.orderId },
        { key: '_bosta_status', value: bostaData.status },
        { key: '_bosta_status_code', value: String(bostaData.statusCode) },
        { key: '_bosta_sent_at', value: bostaData.sentAt },
        { key: '_bosta_last_updated', value: bostaData.lastUpdated }
      ];
    } else {
      return NextResponse.json(
        { error: 'يجب إرسال بيانات بوسطة أو clearBosta' },
        { status: 400 }
      );
    }

    // Update order meta data via WooCommerce API
    const wcResponse = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        meta_data: metaData
      })
    });

    if (!wcResponse.ok) {
      const error = await wcResponse.text();
      console.error('WooCommerce API Error:', error);
      return NextResponse.json(
        { error: 'فشل تحديث بيانات بوسطة في الطلب' },
        { status: wcResponse.status }
      );
    }

    const updatedOrder = await wcResponse.json();

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });

  } catch (error) {
    console.error('Update Bosta Data Error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث بيانات بوسطة' },
      { status: 500 }
    );
  }
}
