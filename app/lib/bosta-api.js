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

      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ Bosta Error Response:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to create delivery');
      }

      const data = await res.json();
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
    
    if (deliveryPayment) {
      if (deliveryPayment.status === 'cash_on_delivery') {
        // دفع عند الاستلام - كامل المبلغ
        codAmount = totalAmount;
      } else if (deliveryPayment.status === 'half_paid') {
        // نصف المبلغ مدفوع - الباقي COD
        const paidAmount = Math.round(deliveryPayment.paidAmount || 0);
        codAmount = Math.max(0, totalAmount - paidAmount);
      } else if (deliveryPayment.status === 'fully_paid_no_delivery') {
        // 🚧 مدفوع كامل بدون توصيل - المتبقي = رسوم التوصيل فقط
        codAmount = Math.round(deliveryPayment.remainingAmount || invoice.delivery?.fee || 0);
      } else if (deliveryPayment.status === 'fully_paid') {
        // ✅ مدفوع كامل - لا يوجد COD
        codAmount = 0;
      }
    } else {
      // لو مفيش deliveryPayment، افتراضي COD = 0
      codAmount = 0;
    }

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
        city: address.city || '',
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

    // إضافة districtId أو districtName
    if (address.districtId) {
      payload.dropOffAddress.districtId = address.districtId;
    } else if (address.district && address.cityId) {
      payload.dropOffAddress.districtName = address.district;
      payload.dropOffAddress.cityId = address.cityId;
    }

    // إضافة zoneId إذا موجود
    if (address.zoneId) {
      payload.dropOffAddress.zoneId = address.zoneId;
    }

    // إضافة businessLocationId إذا موجود
    if (this.businessLocationId) {
      payload.businessLocationId = this.businessLocationId;
    }

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
   * 5️⃣ تتبع الشحنة
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
