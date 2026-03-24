import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const {
      orderId,
      shipping,
      billingPhone,
      shippingAddressIndex,
      shippingCityName,
      shippingDistrictName,
      shippingCityId,
      shippingDistrictId,
      shippingZoneId,
    } = await request.json();

    if (!orderId || !shipping) {
      return NextResponse.json(
        { error: 'يجب إرسال رقم الطلب وبيانات عنوان الشحن' },
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

    // تحقق صلاحية الوصول للطلب
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

    const currentOrder = await checkResponse.json();

    const mergedShipping = {
      first_name: shipping.first_name ?? currentOrder.shipping?.first_name ?? '',
      last_name: shipping.last_name ?? currentOrder.shipping?.last_name ?? '',
      company: shipping.company ?? currentOrder.shipping?.company ?? '',
      address_1: shipping.address_1 ?? currentOrder.shipping?.address_1 ?? '',
      address_2: shipping.address_2 ?? currentOrder.shipping?.address_2 ?? '',
      city: shipping.city ?? currentOrder.shipping?.city ?? '',
      state: shipping.state ?? currentOrder.shipping?.state ?? '',
      postcode: shipping.postcode ?? currentOrder.shipping?.postcode ?? '',
      country: shipping.country ?? currentOrder.shipping?.country ?? 'EG',
      phone: shipping.phone ?? currentOrder.shipping?.phone ?? currentOrder.billing?.phone ?? '',
    };

    const mergedBilling = {
      ...currentOrder.billing,
      phone: billingPhone ?? shipping.phone ?? currentOrder.billing?.phone ?? ''
    };

    const metaDataUpdates = [];

    if (typeof shippingAddressIndex === 'string') {
      metaDataUpdates.push({ key: '_shipping_address_index', value: shippingAddressIndex });
    }

    const cityNameValue = shippingCityName ?? mergedShipping.city;
    if (typeof cityNameValue === 'string' && cityNameValue.trim()) {
      metaDataUpdates.push({ key: '_shipping_city_name', value: cityNameValue.trim() });
      metaDataUpdates.push({ key: '_shipping_city', value: cityNameValue.trim() });
    }

    const districtNameValue = shippingDistrictName ?? mergedShipping.state;
    if (typeof districtNameValue === 'string' && districtNameValue.trim()) {
      metaDataUpdates.push({ key: '_shipping_district_name', value: districtNameValue.trim() });
      metaDataUpdates.push({ key: '_shipping_state', value: districtNameValue.trim() });
    }

    if (typeof mergedShipping.address_1 === 'string') {
      metaDataUpdates.push({ key: '_shipping_address_1', value: mergedShipping.address_1 });
    }

    if (typeof mergedShipping.address_2 === 'string') {
      metaDataUpdates.push({ key: '_shipping_area', value: mergedShipping.address_2 });
    }

    if (typeof shippingCityId === 'string' && shippingCityId.trim()) {
      metaDataUpdates.push({ key: '_shipping_city_id', value: shippingCityId.trim() });
    }

    if (typeof shippingDistrictId === 'string' && shippingDistrictId.trim()) {
      metaDataUpdates.push({ key: '_shipping_district_id', value: shippingDistrictId.trim() });
    }

    if (typeof shippingZoneId === 'string' && shippingZoneId.trim()) {
      metaDataUpdates.push({ key: '_shipping_zone_id', value: shippingZoneId.trim() });
    }

    const wcResponse = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipping: mergedShipping,
        billing: mergedBilling,
        ...(metaDataUpdates.length > 0 ? { meta_data: metaDataUpdates } : {})
      })
    });

    if (!wcResponse.ok) {
      const error = await wcResponse.text();
      console.error('WooCommerce Shipping Address Update Error:', error);
      return NextResponse.json(
        { error: 'فشل تحديث عنوان الشحن', details: error },
        { status: wcResponse.status }
      );
    }

    const updatedOrder = await wcResponse.json();

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update Shipping Address Error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث عنوان الشحن' },
      { status: 500 }
    );
  }
}
