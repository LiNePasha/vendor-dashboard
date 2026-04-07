import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { orderId, lineItems } = await request.json();

    if (!orderId || !lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'يجب إرسال رقم الطلب والمنتجات' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'غير مصرح - يجب تسجيل الدخول' },
        { status: 401 }
      );
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // 🔥 استخدام endpoint الجديد اللي بيعمل WCFM sync تلقائي
    const updateResponse = await fetch(`${API_BASE}/wp-json/spare2app/v1/vendor-orders/${orderId}/update-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        line_items: lineItems
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('Vendor Orders API Error:', errorData);
      return NextResponse.json(
        { error: 'فشل تحديث المنتجات', details: errorData },
        { status: updateResponse.status }
      );
    }

    const result = await updateResponse.json();

    return NextResponse.json({
      success: true,
      order: result.order
    });

  } catch (error) {
    console.error('Error updating order items:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث المنتجات', details: error.message },
      { status: 500 }
    );
  }
}
