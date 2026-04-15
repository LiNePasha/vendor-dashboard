import { buildFirstLine } from './bosta-helpers';

/**
 * Bosta API Wrapper Class
 */
export class BostaAPI {
  constructor(apiKey, businessLocationId = null) {
    // تنظيف الـ API key - إزالة Bearer إذا كان موجود
    this.apiKey = apiKey.trim();
    if (this.apiKey.toLowerCase().startsWith('bearer ')) {
      this.apiKey = this.apiKey.substring(7).trim();
    }
    this.businessLocationId = businessLocationId;
    this.baseURL = 'https://app.bosta.co/api/v2';
  }

  /**
   * 1️⃣ اختبار الاتصال (للإعدادات)
   */
  async testConnection() {
    try {
      const res = await fetch(`${this.baseURL}/cities`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return res.ok;
    } catch (error) {
      console.error('Bosta Test Connection Error:', error);
      return false;
    }
  }

  /**
   * 2️⃣ جلب المدن
   */
  async getCities() {
    try {
      console.log('🔑 Cleaned API Key (first 30 chars):', this.apiKey.substring(0, 30) + '...');
      console.log('📡 Request URL:', `${this.baseURL}/cities?countryId=60e4482c7cb7d4bc4849c4d5`);
      console.log('🔐 Authorization Header:', this.apiKey.substring(0, 30) + '...');
      
      const res = await fetch(`${this.baseURL}/cities?countryId=60e4482c7cb7d4bc4849c4d5`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Response Status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ Error Response:', errorData);
        throw new Error('Failed to fetch cities');
      }
      
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Bosta Get Cities Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 2.1️⃣ جلب المناطق (Districts) لمدينة معينة
   */
  async getDistricts(cityId) {
    try {
      console.log('📡 Fetching districts for city:', cityId);
      const res = await fetch(`${this.baseURL}/cities/${cityId}/districts`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch districts');
      }
      
      const data = await res.json();
      console.log('✅ Districts:', data);
      return data;
    } catch (error) {
      console.error('Bosta Get Districts Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 2.2️⃣ جلب الـ Zones لمدينة معينة
   */
  async getZones(cityId) {
    try {
      console.log('📡 Fetching zones for city:', cityId);
      const res = await fetch(`${this.baseURL}/cities/${cityId}/zones`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch zones');
      }
      
      const data = await res.json();
      console.log('✅ Zones:', data);
      return data;
    } catch (error) {
      console.error('Bosta Get Zones Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 2.5️⃣ جلب أماكن الاستلام (Pickup Locations)
   */
  async getPickupLocations() {
    try {
      console.log('📡 Calling Bosta API: GET /pickup-locations');
      console.log('🔑 Using API Key:', this.apiKey.substring(0, 10) + '...');
      
      const url = `${this.baseURL}/pickup-locations`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch pickup locations: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ Pickup locations data:', data);
      return data;
    } catch (error) {
      console.error('❌ Bosta Get Pickup Locations Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 3️⃣ إنشاء طلب توصيل
   */
  async createDelivery(invoice) {
    try {
      // تحويل Invoice → Bosta Format
      const payload = this.convertInvoiceToBosta(invoice);
      
      console.log('📦 Sending to Bosta:', payload);

      const res = await fetch(`${this.baseURL}/deliveries?apiVersion=1`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await res.text();
      
      if (!res.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText || 'Unknown error' };
        }
        console.error('❌ Bosta Error Response:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to create delivery');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('❌ Failed to parse Bosta response:', responseText);
        throw new Error('Invalid response from Bosta API');
      }
      
      console.log('✅ Bosta Response:', data);
      return data;
      
    } catch (error) {
      console.error('Bosta Create Delivery Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 4️⃣ تحويل Invoice → Bosta Format
   */
  convertInvoiceToBosta(invoice) {
    const customer = invoice.delivery?.customer;
    const address = customer?.address || {};

    // تقسيم الاسم إلى First & Last Name
    const nameParts = (customer?.name || '').trim().split(' ');
    const firstName = nameParts[0] || 'عميل';
    const lastName = nameParts.slice(1).join(' ') || '';

    // تجميع وصف المنتجات
    const itemsDescription = invoice.items
      ?.map(item => `${item.name} (${item.quantity})`)
      .join(', ') || 'منتجات';

    // حساب عدد القطع
    const itemsCount = invoice.items?.reduce((sum, item) => sum + item.quantity, 0) || 1;

    // بناء firstLine
    const firstLine = buildFirstLine(address);

    // 💰 حساب COD بناءً على حالة الدفع
    let codAmount = 0;
    const deliveryPayment = invoice.deliveryPayment;
    const totalAmount = Math.round(invoice.summary?.total || 0);
    const shippingFee = Math.round(invoice.delivery?.fee || invoice.summary?.shipping || 0);
    
    console.log('💰 Payment Calculation:', {
      status: deliveryPayment?.status,
      totalAmount,
      shippingFee,
      paidAmount: deliveryPayment?.paidAmount,
      remainingAmount: deliveryPayment?.remainingAmount
    });
    
    if (deliveryPayment) {
      if (deliveryPayment.status === 'cash_on_delivery') {
        // دفع عند الاستلام - كامل المبلغ + 20 جنيه
        codAmount = totalAmount + 20;
        console.log('💵 COD Mode: Cash on delivery - Total amount + 20:', codAmount);
      } else if (deliveryPayment.status === 'half_paid') {
        // نصف المبلغ مدفوع - الباقي COD + 20 جنيه
        const paidAmount = Math.round(deliveryPayment.paidAmount || 0);
        codAmount = Math.max(0, totalAmount - paidAmount) + 20;
        console.log('💵 COD Mode: Half paid - Remaining + 20:', codAmount);
      } else if (deliveryPayment.status === 'fully_paid_no_delivery') {
        // 🔥 مدفوع كامل بدون توصيل - فقط رسوم التوصيل + 20 جنيه
        codAmount = shippingFee + 20;
        console.log('💵 COD Mode: Fully paid no delivery - Shipping fee + 20:', {
          shippingFee,
          extraFee: 20,
          codAmount
        });
      } else if (deliveryPayment.status === 'fully_paid') {
        // ✅ مدفوع كامل - فقط 20 جنيه
        codAmount = 20;
        console.log('💵 COD Mode: Fully paid - Extra 20 EGP only');
      }
    } else {
      // لو مفيش deliveryPayment، افتراضي COD = 20
      codAmount = 20;
      console.log('💵 COD Mode: No payment info - Default 20');
    }
    
    console.log('💰 Final COD Amount:', codAmount);

    const payload = {
      type: 10, // Fixed value
      specs: {
        packageType: invoice.bostaPackageType || 'Parcel',
        size: invoice.bostaSize || 'MEDIUM',
        packageDetails: {
          itemsCount: itemsCount,
          description: itemsDescription.substring(0, 200) // Max 200 chars
        }
      },
      cod: codAmount, // المبلغ المطلوب تحصيله
      notes: invoice.orderNotes || invoice.delivery?.notes || '',
      dropOffAddress: {
        city: address.city || '', // ✅ اسم المدينة
        firstLine: firstLine, // ⭐ يجب > 5 حروف
        secondLine: address.landmark || '',
        buildingNumber: address.building || '',
        floor: address.floor || '',
        apartment: address.apartment || ''
      },
      receiver: {
        firstName: firstName,
        lastName: lastName,
        phone: customer?.phone || '',
        email: customer?.email || undefined
      },
      businessReference: invoice.id, // رقم الفاتورة
      allowToOpenPackage: invoice.allowToOpenPackage || false
    };

    // إضافة district - نستخدم districtName + cityId فقط (أكثر موثوقية)
    if (address.district && address.cityId) {
      // ✅ استخدام اسم المنطقة مع cityId (بوسطة بتدور بالاسم)
      payload.dropOffAddress.districtName = address.district;
      payload.dropOffAddress.cityId = address.cityId;
      console.log('📍 Using districtName + cityId:', {
        districtName: address.district,
        cityId: address.cityId
      });
    } else if (address.districtId) {
      // ⚠️ عندنا districtId بس (fallback)
      payload.dropOffAddress.districtId = address.districtId;
      console.log('📍 Using districtId only:', address.districtId);
    } else if (address.district && address.cityId) {
      // استخدام districtName مع cityId فقط
      payload.dropOffAddress.districtName = address.district;
      payload.dropOffAddress.cityId = address.cityId;
      console.log('📍 Using districtName + cityId:', address.district, address.cityId);
    } else {
      console.warn('⚠️ No valid district information found');
    }

    // إضافة zoneId إذا موجود
    if (address.zoneId) {
      payload.dropOffAddress.zoneId = address.zoneId;
    }

    // إضافة businessLocationId إذا موجود
    if (this.businessLocationId) {
      payload.businessLocationId = this.businessLocationId;
    }

    // 🔍 Debug: طباعة الـ payload النهائي
    console.log('📦 Final Bosta payload:', JSON.stringify(payload, null, 2));
    console.log('📍 dropOffAddress:', payload.dropOffAddress);

    return payload;
  }

  /**
   * 5️⃣ جلب تفاصيل الشحنة
   */
  async getDelivery(trackingNumber) {
    try {
      const res = await fetch(`${this.baseURL}/deliveries/${trackingNumber}`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch delivery');
      }
      
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Bosta Get Delivery Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 6️⃣ تحديث حالة الشحنة في الفاتورة
   */
  async refreshDeliveryStatus(invoice) {
    if (!invoice.bosta?.trackingNumber) {
      return { error: 'لا يوجد رقم تتبع' };
    }

    try {
      const deliveryData = await this.getDelivery(invoice.bosta.trackingNumber);
      
      if (deliveryData.error) {
        return deliveryData;
      }

      // تحديث بيانات الشحنة
      invoice.bosta.status = deliveryData.state;
      invoice.bosta.lastUpdated = new Date().toISOString();

      return { success: true, data: deliveryData };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 7️⃣ حساب تكلفة الشحن
   */
  async calculateShippingFees({
    cod = 0,
    dropOffCity,
    pickupCity,
    size = 'Normal',
    type = 'SEND'
  }) {
    try {
      const params = new URLSearchParams({
        cod: cod.toString(),
        dropOffCity,
        pickupCity,
        size,
        type
      });

      console.log('💰 Calculating shipping fees:', { cod, dropOffCity, pickupCity, size, type });

      const res = await fetch(`${this.baseURL}/pricing/shipment/calculator?${params}`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to calculate shipping fees');
      }
      
      const data = await res.json();
      console.log('✅ Shipping fees:', data);
      return data;
    } catch (error) {
      console.error('Bosta Calculate Shipping Fees Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 5️⃣ إنشاء شحنة من أوردر الموقع
   */
  async createWebsiteDelivery(order) {
    try {
      const payload = this.convertWebsiteOrderToBosta(order);
      
      console.log('📦 Sending Website Order to Bosta:', payload);

      const res = await fetch(`${this.baseURL}/deliveries?apiVersion=1`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ Bosta Error Response:', errorData);
        
        // 🆕 لو District Not Found أو errorCode 777 - جرب تاني مع districtName
        if ((errorData.errorCode === 3003 || errorData.errorCode === 777) && payload._meta) {
          console.log('⚠️ District Issue - Retrying with districtName instead of districtId');
          
          // حذف districtId واستخدام districtName
          delete payload.dropOffAddress.districtId;
          
          if (payload._meta.districtName) {
            payload.dropOffAddress.districtName = payload._meta.districtName;
            console.log('🔄 Using districtName:', payload._meta.districtName);
          }
          
          if (payload._meta.cityId) {
            payload.dropOffAddress.cityId = payload._meta.cityId;
            console.log('🔄 Using cityId:', payload._meta.cityId);
          }
          
          // حذف _meta قبل الإرسال
          delete payload._meta;
          
          const retryRes = await fetch(`${this.baseURL}/deliveries?apiVersion=1`, {
            method: 'POST',
            headers: {
              'Authorization': this.apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (!retryRes.ok) {
            const retryError = await retryRes.json();
            console.error('❌ Retry Failed:', retryError);
            throw new Error(retryError.message || retryError.error || 'Failed to create delivery');
          }
          
          const retryData = await retryRes.json();
          console.log('✅ Retry Success:', retryData);
          return retryData;
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to create delivery');
      }

      // حذف _meta قبل إرجاع النتيجة
      delete payload._meta;
      
      const data = await res.json();
      console.log('✅ Bosta Response:', data);
      return data;
      
    } catch (error) {
      console.error('Bosta Create Website Delivery Error:', error);
      return { error: error.message };
    }
  }

  /**
   * 6️⃣ تحويل Website Order → Bosta Format
   */
  convertWebsiteOrderToBosta(order) {
    // استخراج البيانات من meta_data
    const getMetaValue = (key) => {
      const meta = order.meta_data?.find(m => m.key === key);
      return meta?.value || '';
    };

    // استخراج المبلغ المدفوع
    const paidAmount = parseFloat(getMetaValue('_instapay_payment_amount') || 0);
    const total = parseFloat(order.total);
    const shippingTotal = parseFloat(order.shipping_total);
    
    // حساب COD = shipping_total (لأن العميل دفع ثمن المنتجات)
    const codAmount = shippingTotal;

    // تقسيم الاسم
    const fullName = `${order.billing.first_name} ${order.billing.last_name}`.trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'عميل';
    const lastName = nameParts.slice(1).join(' ') || '';

    // تجميع وصف المنتجات
    const itemsDescription = order.line_items
      ?.map(item => `${item.name} (${item.quantity})`)
      .join(', ') || 'منتجات';

    // حساب عدد القطع
    const itemsCount = order.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 1;

    // بناء firstLine من العنوان
    const firstLine = order.billing.address_1 || 'عنوان غير محدد';

    const payload = {
      type: 10, // Send
      specs: {
        packageType: 'Parcel',
        size: 'MEDIUM',
        packageDetails: {
          itemsCount: itemsCount,
          description: itemsDescription.substring(0, 200)
        }
      },
      cod: codAmount,
      notes: order.customer_note || '',
      dropOffAddress: {
        city: order.shipping.city || order.billing.city || '',
        firstLine: firstLine,
        secondLine: order.billing.address_2 || '',
        buildingNumber: '',
        floor: '',
        apartment: ''
      },
      receiver: {
        firstName: firstName,
        lastName: lastName,
        phone: order.billing.phone || '',
        email: order.billing.email || undefined
      },
      businessReference: order.id.toString(),
      allowToOpenPackage: false
    };

    // إضافة districtId و cityId و أسمائهم
    const districtId = getMetaValue('_shipping_district_id');
    const districtName = getMetaValue('_shipping_district_name');
    const cityId = getMetaValue('_shipping_city_id');
    const cityName = getMetaValue('_shipping_city_name');
    
    console.log('🔍 District ID from meta:', districtId);
    console.log('🔍 District Name from meta:', districtName);
    console.log('🔍 City ID from meta:', cityId);
    console.log('🔍 City Name from meta:', cityName);
    
    // Strategy: استخدام districtId مع cityId
    if (districtId && cityId) {
      payload.dropOffAddress.districtId = districtId;
      payload.dropOffAddress.cityId = cityId;
      console.log('✅ Using districtId + cityId');
    } else if (cityId) {
      // لو في cityId بس بدون district
      payload.dropOffAddress.cityId = cityId;
      console.log('⚠️ Using cityId only (no district)');
    } else {
      // Fallback: استخدام اسم المدينة
      console.log('⚠️ No cityId/districtId - using city name only');
    }

    // 🆕 حفظ الأسماء للاستخدام في الـ retry
    payload._meta = {
      districtName,
      cityName,
      districtId,
      cityId
    };

    // إضافة businessLocationId إذا موجود
    if (this.businessLocationId) {
      payload.businessLocationId = this.businessLocationId;
    }
    
    console.log('📦 Final Bosta Payload:', JSON.stringify(payload, null, 2));

    return payload;
  }

  /**
   * 7️⃣ تتبع الشحنة
   */
  async getTrackingDetails(trackingNumber) {
    try {
      console.log('📦 Fetching tracking details for:', trackingNumber);
      const res = await fetch(`${this.baseURL}/deliveries/business/${trackingNumber}`, {
        headers: { 
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ Tracking Error Response:', errorData);
        throw new Error(errorData.message || 'Failed to fetch tracking details');
      }
      
      const data = await res.json();
      console.log('✅ Tracking details:', data);
      return data;
    } catch (error) {
      console.error('Bosta Get Tracking Details Error:', error);
      return { error: error.message };
    }
  }
}
