import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { orderId, shippingTotal } = await request.json();

    const parsedShippingTotal = Number(shippingTotal);

    if (!orderId || Number.isNaN(parsedShippingTotal) || parsedShippingTotal < 0) {
      return NextResponse.json(
        { error: 'يجب إرسال رقم الطلب وسعر شحن صحيح' },
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

    // نتأكد إن الطلب متاح للتاجر ونجيب بياناته الحالية
    const checkResponse = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!checkResponse.ok) {
      return NextResponse.json(
        { error: 'الطلب غير موجود أو غير مسموح بالوصول إليه' },
        { status: 403 }
      );
    }

    // التحقق تم — الآن نجيب بيانات الطلب الحقيقية من wc/v3 لنضمن الـ shipping_lines بـ IDs صحيحة
    const wcGetResponse = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!wcGetResponse.ok) {
      return NextResponse.json(
        { error: 'فشل جلب بيانات الطلب' },
        { status: wcGetResponse.status }
      );
    }

    const currentOrder = await wcGetResponse.json();
    const existingShippingLines = Array.isArray(currentOrder.shipping_lines) ? currentOrder.shipping_lines : [];

    // نبني الـ shipping_lines: لو في لاينات موجودة نحدث الأولى فقط (بـ id) ونزيرو الباقي
    // لو مفيش نعمل واحدة جديدة
    let updatedShippingLines;
    if (existingShippingLines.length > 0) {
      updatedShippingLines = existingShippingLines.map((line, index) => ({
        id: line.id,
        method_id: line.method_id || 'flat_rate',
        method_title: line.method_title || 'Shipping',
        total: index === 0 ? parsedShippingTotal.toFixed(2) : '0.00',
        total_tax: '0.00'
      }));
    } else {
      updatedShippingLines = [
        {
          method_id: 'flat_rate',
          method_title: 'Shipping',
          total: parsedShippingTotal.toFixed(2),
          total_tax: '0.00'
        }
      ];
    }

    const wcResponse = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipping_lines: updatedShippingLines
      })
    });

    if (!wcResponse.ok) {
      const error = await wcResponse.text();
      console.error('WooCommerce Shipping Update Error:', error);
      return NextResponse.json(
        { error: 'فشل تحديث سعر الشحن', details: error },
        { status: wcResponse.status }
      );
    }

    const updatedOrder = await wcResponse.json();

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update Order Shipping Error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث سعر الشحن' },
      { status: 500 }
    );
  }
}
