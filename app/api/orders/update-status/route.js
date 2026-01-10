import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { orderId, status } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'يجب إرسال رقم الطلب والحالة الجديدة' },
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

    // Update order status via WCFM API
    const wcResponse = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!wcResponse.ok) {
      const error = await wcResponse.text();
      console.error('WCFM API Error:', error);
      return NextResponse.json(
        { error: 'فشل تحديث حالة الطلب' },
        { status: wcResponse.status }
      );
    }

    const updatedOrder = await wcResponse.json();

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });

  } catch (error) {
    console.error('Update Order Status Error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث حالة الطلب' },
      { status: 500 }
    );
  }
}
