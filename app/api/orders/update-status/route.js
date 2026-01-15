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

    // 🔥 أولاً: نتأكد إن التاجر عنده صلاحية على الطلب ده
    const checkResponse = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!checkResponse.ok) {
      return NextResponse.json(
        { error: 'الطلب غير موجود أو غير مسموح بالوصول إليه' },
        { status: 403 }
      );
    }

    // ✅ Update order status via WooCommerce API directly
    // WCFM مابيدعمش PUT للـ orders، لازم نستخدم WooCommerce API
    // بس محمي بالـ token اللي بيتأكد من الـ vendor_id
    const wcResponse = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        status: status.replace('wc-', '') // إزالة wc- prefix لو موجود
      })
    });

    if (!wcResponse.ok) {
      const error = await wcResponse.text();
      console.error('WooCommerce API Error:', error);
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
