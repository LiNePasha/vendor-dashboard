# 📦 خطة تكامل بوسطة (Bosta Integration Plan)

## 📋 نظرة عامة على المشروع

### الهدف الرئيسي
ربط نظام الـ POS بـ Bosta API لإرسال طلبات التوصيل تلقائياً أو يدوياً وتتبع حالة الشحنات.

### النطاق (Scope)
- ✅ إنشاء صفحة إعدادات لتفعيل بوسطة وحفظ API Key
- ✅ تحسين نموذج إدخال العنوان ليتوافق مع متطلبات Bosta
- ✅ إنشاء API wrapper لـ Bosta
- ✅ إضافة زر "إرسال لبوسطة" في صفحة الأوردرات
- ✅ حفظ Tracking Numbers وربطها بالفواتير
- ✅ عرض حالة الشحنة في واجهة الأوردرات
- ⏭️ (مستقبلي) Webhook لتحديث حالة الشحنات

---

## 🏗️ البنية الحالية للنظام

### ملفات POS الحالية
```
app/
├── pos/
│   ├── page.js              # صفحة POS الرئيسية
│   ├── InvoiceModal.js      # عرض الفاتورة
│   └── invoices/page.js     # صفحة الفواتير
├── orders/page.js           # صفحة الأوردرات (Website + System)
├── stores/
│   └── pos-store.js         # Zustand store للـ POS
├── lib/
│   └── localforage.js       # LocalForage للتخزين المحلي
└── api/
    └── pos/                 # POS APIs
```

### هيكل Invoice الحالي
```javascript
{
  id: "1736004567890",
  date: "2026-01-04T10:30:00.000Z",
  items: [
    {
      id: 123,
      name: "منتج",
      price: 100,
      quantity: 2,
      totalPrice: 200
    }
  ],
  services: [
    {
      id: "456",
      description: "خدمة",
      amount: 50
    }
  ],
  orderType: "delivery",  // أو "pickup"
  delivery: {
    customer: {
      id: "customer_id",
      name: "أحمد محمد",
      phone: "01012345678",
      email: "customer@email.com",
      address: {
        street: "شارع الجامعة",
        building: "12",
        floor: "3",
        apartment: "5",
        area: "المعادي",
        city: "القاهرة",
        state: "القاهرة",
        district: "المعادي",  // ❌ غير موجود حالياً
        landmark: "بجوار المدرسة"
      }
    },
    fee: 30,
    notes: "ملاحظات التوصيل"
  },
  summary: {
    total: 280,
    productsSubtotal: 200,
    servicesTotal: 50,
    deliveryFee: 30,
    discount: { amount: 0 }
  },
  paymentMethod: "cash",
  paymentStatus: "paid_full",
  synced: false
}
```

### نقاط القوة
✅ البيانات الأساسية متوفرة (اسم، هاتف، عنوان)
✅ نظام LocalForage قوي للتخزين
✅ معلومات المنتجات والخدمات كاملة
✅ حساب المبلغ الإجمالي دقيق

### النقاط الناقصة
❌ لا يوجد `districtId` أو `zoneId` من Bosta
❌ لا يوجد `cityId` من Bosta
❌ لا يوجد حفظ لـ Tracking Number
❌ لا يوجد حفظ لـ Bosta Order Status

---

## 📐 تحليل Bosta API

### Endpoint
```
POST https://app.bosta.co/api/v2/deliveries?apiVersion=1
```

### Authentication
```javascript
Headers: {
  "Authorization": "YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

### البيانات المطلوبة (Required Fields)

#### 1. Package Info (معلومات الشحنة) ⭐ REQUIRED
```javascript
{
  "type": 10,  // Fixed value
  "specs": {
    "packageType": "Parcel",  // أو "Document"
    "size": "SMALL | MEDIUM | LARGE",
    "packageDetails": {
      "itemsCount": 2,
      "description": "وصف المنتجات"
    }
  }
}
```

#### 2. COD (Cash on Delivery) ⭐ REQUIRED
```javascript
{
  "cod": 280  // المبلغ المطلوب تحصيله
}
```

#### 3. Drop-off Address ⭐ REQUIRED
```javascript
{
  "dropOffAddress": {
    "city": "Cairo",  // ⭐ REQUIRED
    "districtId": "aiJudRHeOt",  // ⭐ REQUIRED (أو districtName + cityId)
    "zoneId": "NQz5sDOeG",  // Optional
    "firstLine": "شارع الجامعة مبنى 12",  // ⭐ REQUIRED (> 5 حروف)
    "secondLine": "بجوار المدرسة",  // Optional
    "buildingNumber": "12",  // Optional
    "floor": "3",  // Optional
    "apartment": "5"  // Optional
  }
}
```

#### 4. Receiver (معلومات المستلم) ⭐ REQUIRED
```javascript
{
  "receiver": {
    "firstName": "أحمد",  // ⭐ REQUIRED
    "lastName": "محمد",  // Optional
    "phone": "01012345678",  // ⭐ REQUIRED
    "email": "customer@email.com"  // Optional
  }
}
```

#### 5. Optional Fields
```javascript
{
  "notes": "ملاحظات الطلب",
  "allowToOpenPackage": true,
  "businessReference": "INV-1736004567890",  // رقم الفاتورة عندك
  "businessLocationId": "pickup_location_id"  // مكان الاستلام
}
```

### Response المتوقع
```javascript
{
  "success": true,
  "data": {
    "trackingNumber": "BOS123456789",
    "orderId": "order_id_from_bosta",
    "state": "created",
    // ... المزيد من البيانات
  }
}
```

---

## 🎯 الخطة التنفيذية (Implementation Plan)

---

## المرحلة 1️⃣: إعداد صفحة الإعدادات (Settings Page)

### الهدف
إنشاء صفحة إعدادات لتفعيل Bosta وحفظ الـ API Key والإعدادات الأساسية.

### الملفات المطلوبة

#### 1.1 صفحة الإعدادات
**الملف:** `app/settings/page.js`

**المحتوى:**
```javascript
"use client";
import { useState, useEffect } from 'react';
import localforage from 'localforage';

export default function SettingsPage() {
  const [bostaSettings, setBostaSettings] = useState({
    enabled: false,
    apiKey: '',
    businessLocationId: '',
    autoSend: false,
    defaultPackageType: 'Parcel',
    defaultSize: 'MEDIUM',
    allowToOpenPackage: false
  });

  // تحميل الإعدادات
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const saved = await localforage.getItem('bosta_settings');
    if (saved) setBostaSettings(saved);
  };

  const handleSave = async () => {
    await localforage.setItem('bosta_settings', bostaSettings);
    // عرض toast نجاح
  };

  return (
    // واجهة الإعدادات
  );
}
```

**المميزات:**
- ✅ تفعيل/إيقاف Bosta
- ✅ حفظ API Key (مخفي بـ password input)
- ✅ حفظ Business Location ID
- ✅ خيار الإرسال التلقائي (auto-send)
- ✅ إعدادات افتراضية للشحنة (Package Type, Size)
- ✅ خيار السماح بفتح الطرد
- ✅ زر "اختبار الاتصال" للتحقق من API Key

#### 1.2 API للإعدادات
**الملف:** `app/api/settings/route.js`

**الغرض:**
- حفظ الإعدادات في قاعدة بيانات أو ملف config (اختياري)
- التحقق من صحة API Key

```javascript
export async function POST(request) {
  // حفظ الإعدادات
}

export async function GET(request) {
  // جلب الإعدادات
}
```

**ملاحظة:** يمكن الاستغناء عن هذا API والاعتماد على LocalForage فقط.

---

## المرحلة 2️⃣: تحسين نموذج العنوان

### الهدف
إضافة حقول District و City IDs من Bosta في نموذج إدخال العنوان.

### التحدي
Bosta يطلب `districtId` أو (`districtName` + `cityId`). نحتاج:
1. قائمة المدن من Bosta API
2. قائمة المناطق (Districts) لكل مدينة
3. قائمة الـ Zones (اختياري)

### الحلول المقترحة

#### الحل 1: جلب المدن من Bosta API ⭐ (الأفضل)
**API Endpoint:** `GET https://app.bosta.co/api/v2/cities`

**الخطوات:**
1. إنشاء ملف: `app/lib/bosta-cities.js`
2. جلب المدن والمناطق عند تحميل الصفحة
3. حفظها في LocalForage كـ cache
4. إضافة Dropdown في نموذج العنوان

```javascript
// app/lib/bosta-cities.js
export async function fetchBostaCities() {
  const apiKey = await localforage.getItem('bosta_settings').apiKey;
  const res = await fetch('https://app.bosta.co/api/v2/cities', {
    headers: { 'Authorization': apiKey }
  });
  const cities = await res.json();
  await localforage.setItem('bosta_cities_cache', cities);
  return cities;
}
```

#### الحل 2: Static List (قائمة ثابتة)
إنشاء ملف JSON بالمدن الشائعة:
```javascript
// app/lib/bosta-cities-static.json
{
  "Cairo": { "cityId": "xxx", "districts": [...] },
  "Giza": { "cityId": "yyy", "districts": [...] }
}
```

**الاختيار:** نبدأ بالحل 1 (Dynamic) ثم نضيف fallback للحل 2.

### الملفات المطلوبة

#### 2.1 مكتبة جلب المدن
**الملف:** `app/lib/bosta-api.js`

```javascript
export class BostaAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://app.bosta.co/api/v2';
  }

  async getCities() {
    const res = await fetch(`${this.baseURL}/cities`, {
      headers: { 'Authorization': this.apiKey }
    });
    return await res.json();
  }

  async getDistricts(cityId) {
    // جلب المناطق لمدينة معينة
  }

  async createDelivery(data) {
    // إنشاء طلب توصيل
  }
}
```

#### 2.2 تحديث نموذج العنوان في POS
**الملف:** `app/pos/page.js` (أو component منفصل)

**التعديلات:**
- إضافة Dropdown للمدن (City)
- إضافة Dropdown للمناطق (District) بناءً على المدينة المختارة
- إضافة Dropdown للـ Zones (اختياري)
- حفظ `cityId`, `districtId`, `zoneId` في عنوان العميل

```javascript
// في نموذج العنوان
const [cities, setCities] = useState([]);
const [districts, setDistricts] = useState([]);
const [selectedCity, setSelectedCity] = useState(null);
const [selectedDistrict, setSelectedDistrict] = useState(null);

// عند اختيار مدينة
const handleCitySelect = async (city) => {
  setSelectedCity(city);
  const districts = await bostaAPI.getDistricts(city.id);
  setDistricts(districts);
};
```

---

## المرحلة 3️⃣: إنشاء Bosta API Wrapper

### الهدف
إنشاء دالات للتعامل مع Bosta API بشكل منظم.

### الملف الرئيسي
**الملف:** `app/lib/bosta-api.js`

```javascript
export class BostaAPI {
  constructor(apiKey, businessLocationId = null) {
    this.apiKey = apiKey;
    this.businessLocationId = businessLocationId;
    this.baseURL = 'https://app.bosta.co/api/v2';
  }

  // 1️⃣ جلب المدن
  async getCities() {
    try {
      const res = await fetch(`${this.baseURL}/cities`, {
        headers: { 'Authorization': this.apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch cities');
      return await res.json();
    } catch (error) {
      console.error('Bosta API Error:', error);
      return null;
    }
  }

  // 2️⃣ إنشاء طلب توصيل
  async createDelivery(invoice) {
    try {
      // تحويل Invoice → Bosta Format
      const payload = this.convertInvoiceToBosta(invoice);
      
      const res = await fetch(`${this.baseURL}/deliveries?apiVersion=1`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create delivery');
      }

      return await res.json();
    } catch (error) {
      console.error('Bosta Create Delivery Error:', error);
      return { error: error.message };
    }
  }

  // 3️⃣ تحويل Invoice → Bosta Format
  convertInvoiceToBosta(invoice) {
    const customer = invoice.delivery?.customer;
    const address = customer?.address || {};
    
    // تقسيم الاسم
    const nameParts = customer.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // تجميع وصف المنتجات
    const itemsDescription = invoice.items
      .map(item => `${item.name} (${item.quantity})`)
      .join(', ');

    const payload = {
      type: 10,
      specs: {
        packageType: invoice.bostaPackageType || 'Parcel',
        size: invoice.bostaSize || 'MEDIUM',
        packageDetails: {
          itemsCount: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
          description: itemsDescription.substring(0, 200) // Max 200 chars
        }
      },
      cod: invoice.summary.total,
      notes: invoice.orderNotes || invoice.delivery?.notes || '',
      dropOffAddress: {
        city: address.city,
        districtId: address.districtId,  // ⭐ مهم
        zoneId: address.zoneId || undefined,
        firstLine: this.buildFirstLine(address),  // ⭐ يجب > 5 حروف
        secondLine: address.landmark || '',
        buildingNumber: address.building || '',
        floor: address.floor || '',
        apartment: address.apartment || ''
      },
      receiver: {
        firstName: firstName,
        lastName: lastName,
        phone: customer.phone,
        email: customer.email || undefined
      },
      businessReference: invoice.id,  // رقم الفاتورة
      businessLocationId: this.businessLocationId || undefined,
      allowToOpenPackage: invoice.allowToOpenPackage || false
    };

    return payload;
  }

  // 4️⃣ بناء firstLine (يجب > 5 حروف)
  buildFirstLine(address) {
    const parts = [
      address.street,
      address.area
    ].filter(Boolean);
    
    const firstLine = parts.join(', ');
    
    // التحقق من الطول
    if (firstLine.length < 5) {
      return `${firstLine} - ${address.city || 'مصر'}`;
    }
    
    return firstLine;
  }

  // 5️⃣ جلب تفاصيل الشحنة
  async getDelivery(trackingNumber) {
    try {
      const res = await fetch(`${this.baseURL}/deliveries/${trackingNumber}`, {
        headers: { 'Authorization': this.apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch delivery');
      return await res.json();
    } catch (error) {
      console.error('Bosta Get Delivery Error:', error);
      return null;
    }
  }

  // 6️⃣ اختبار الاتصال (للإعدادات)
  async testConnection() {
    try {
      const res = await fetch(`${this.baseURL}/cities`, {
        headers: { 'Authorization': this.apiKey }
      });
      return res.ok;
    } catch (error) {
      return false;
    }
  }
}
```

### دالات مساعدة
**الملف:** `app/lib/bosta-helpers.js`

```javascript
// التحقق من صحة البيانات قبل الإرسال
export function validateInvoiceForBosta(invoice) {
  const errors = [];

  // التحقق من نوع الطلب
  if (invoice.orderType !== 'delivery') {
    errors.push('الطلب ليس توصيل');
  }

  // التحقق من بيانات العميل
  const customer = invoice.delivery?.customer;
  if (!customer) {
    errors.push('بيانات العميل غير موجودة');
  } else {
    if (!customer.name) errors.push('اسم العميل مطلوب');
    if (!customer.phone) errors.push('رقم هاتف العميل مطلوب');
  }

  // التحقق من العنوان
  const address = customer?.address;
  if (!address) {
    errors.push('العنوان غير موجود');
  } else {
    if (!address.city) errors.push('المدينة مطلوبة');
    if (!address.districtId && !address.district) {
      errors.push('المنطقة (District) مطلوبة');
    }
    if (!address.street && !address.area) {
      errors.push('العنوان التفصيلي مطلوب');
    }
  }

  // التحقق من المبلغ
  if (!invoice.summary?.total || invoice.summary.total <= 0) {
    errors.push('المبلغ الإجمالي غير صحيح');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// الحصول على Bosta Settings
export async function getBostaSettings() {
  const settings = await localforage.getItem('bosta_settings');
  return settings || {
    enabled: false,
    apiKey: '',
    businessLocationId: '',
    autoSend: false,
    defaultPackageType: 'Parcel',
    defaultSize: 'MEDIUM'
  };
}
```

---

## المرحلة 4️⃣: تحديث هيكل Invoice

### الهدف
إضافة حقول جديدة لحفظ بيانات Bosta في الفاتورة.

### التعديلات على pos-store.js

**الملف:** `app/stores/pos-store.js`

**في دالة `processCheckout`، إضافة:**

```javascript
// إضافة بيانات Bosta
const invoice = {
  // ... الحقول الحالية
  
  // 🆕 حقول Bosta
  bosta: {
    sent: false,                    // هل تم الإرسال لبوسطة
    trackingNumber: null,           // رقم التتبع
    orderId: null,                  // Order ID من Bosta
    status: null,                   // حالة الشحنة
    sentAt: null,                   // تاريخ الإرسال
    lastUpdated: null,              // آخر تحديث
    error: null                     // آخر خطأ (إن وجد)
  },
  
  // 🆕 إعدادات Bosta للفاتورة
  bostaPackageType: 'Parcel',      // من الإعدادات
  bostaSize: 'MEDIUM',             // من الإعدادات
  allowToOpenPackage: false        // من الإعدادات
};
```

### التعديلات على العنوان

**في نموذج إدخال العنوان، إضافة:**

```javascript
delivery: {
  customer: {
    address: {
      // الحقول الحالية
      street: '',
      building: '',
      floor: '',
      apartment: '',
      area: '',
      city: '',
      state: '',
      landmark: '',
      
      // 🆕 حقول Bosta
      cityId: '',        // City ID من Bosta
      districtId: '',    // District ID من Bosta
      district: '',      // اسم المنطقة (للعرض)
      zoneId: ''         // Zone ID من Bosta (اختياري)
    }
  }
}
```

---

## المرحلة 5️⃣: إضافة زر "إرسال لبوسطة" في صفحة الأوردرات

### الهدف
إضافة إمكانية إرسال الطلبات يدوياً من صفحة الأوردرات.

### الملف
**الملف:** `app/orders/page.js`

### التعديلات

#### 5.1 إضافة State
```javascript
const [sendingToBosta, setSendingToBosta] = useState(false);
const [bostaEnabled, setBostaEnabled] = useState(false);

useEffect(() => {
  // تحميل إعدادات Bosta
  const loadBostaSettings = async () => {
    const settings = await getBostaSettings();
    setBostaEnabled(settings.enabled);
  };
  loadBostaSettings();
}, []);
```

#### 5.2 دالة الإرسال
```javascript
const sendToBosta = async (order) => {
  if (!order.bosta?.sent) {
    setSendingToBosta(order.id);
    
    try {
      // 1. التحقق من صحة البيانات
      const validation = validateInvoiceForBosta(order);
      if (!validation.valid) {
        alert('خطأ: ' + validation.errors.join('\n'));
        return;
      }

      // 2. تحميل الإعدادات
      const settings = await getBostaSettings();
      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);

      // 3. إرسال الطلب
      const result = await bostaAPI.createDelivery(order);
      
      if (result.error) {
        alert('فشل الإرسال: ' + result.error);
        return;
      }

      // 4. تحديث الفاتورة
      order.bosta = {
        sent: true,
        trackingNumber: result.trackingNumber,
        orderId: result._id,
        status: result.state,
        sentAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // 5. حفظ الفاتورة المحدثة
      const allInvoices = await localforage.getItem('invoices') || [];
      const index = allInvoices.findIndex(inv => inv.id === order.id);
      if (index !== -1) {
        allInvoices[index] = order;
        await localforage.setItem('invoices', allInvoices);
      }

      // 6. تحديث العرض
      setSystemOrders(prev => 
        prev.map(o => o.id === order.id ? order : o)
      );

      alert('✅ تم إرسال الطلب لبوسطة بنجاح!\n' + 
            'رقم التتبع: ' + result.trackingNumber);

    } catch (error) {
      console.error('Bosta Send Error:', error);
      alert('حدث خطأ: ' + error.message);
    } finally {
      setSendingToBosta(false);
    }
  }
};
```

#### 5.3 إضافة الزر في UI
```javascript
{/* في بطاقة الطلب */}
{order.orderType === 'delivery' && bostaEnabled && (
  <div className="mt-2">
    {order.bosta?.sent ? (
      // إذا تم الإرسال - عرض معلومات التتبع
      <div className="bg-green-50 border border-green-300 rounded p-2 text-xs">
        <p className="text-green-700 font-bold">
          ✅ تم الإرسال لبوسطة
        </p>
        <p className="text-gray-700 mt-1">
          رقم التتبع: {order.bosta.trackingNumber}
        </p>
        <p className="text-gray-600 text-[10px]">
          الحالة: {order.bosta.status}
        </p>
        <button
          onClick={() => window.open(
            `https://bosta.co/tracking-shipment/?track_id=${order.bosta.trackingNumber}`,
            '_blank'
          )}
          className="mt-2 text-blue-600 hover:underline"
        >
          تتبع الشحنة 🔗
        </button>
      </div>
    ) : (
      // إذا لم يتم الإرسال - زر الإرسال
      <button
        onClick={() => sendToBosta(order)}
        disabled={sendingToBosta === order.id}
        className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 
                   text-white px-3 py-2 rounded text-sm font-bold
                   hover:from-purple-600 hover:to-indigo-700 
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sendingToBosta === order.id ? (
          '⏳ جاري الإرسال...'
        ) : (
          '📦 إرسال لبوسطة'
        )}
      </button>
    )}
  </div>
)}
```

---

## المرحلة 6️⃣: الإرسال التلقائي (Auto-Send)

### الهدف
إرسال الطلبات تلقائياً لبوسطة عند إنشائها إذا كان Auto-Send مفعّل.

### الملف
**الملف:** `app/stores/pos-store.js`

### التعديلات في `processCheckout`

```javascript
// بعد حفظ الفاتورة
await invoiceStorage.saveInvoice(invoice);

// 🆕 الإرسال التلقائي لبوسطة
if (orderType === 'delivery') {
  const bostaSettings = await getBostaSettings();
  
  if (bostaSettings.enabled && bostaSettings.autoSend) {
    try {
      const bostaAPI = new BostaAPI(
        bostaSettings.apiKey,
        bostaSettings.businessLocationId
      );
      
      // التحقق من صحة البيانات
      const validation = validateInvoiceForBosta(invoice);
      
      if (validation.valid) {
        const result = await bostaAPI.createDelivery(invoice);
        
        if (!result.error) {
          // تحديث الفاتورة
          invoice.bosta = {
            sent: true,
            trackingNumber: result.trackingNumber,
            orderId: result._id,
            status: result.state,
            sentAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          
          // إعادة الحفظ
          await invoiceStorage.updateInvoice(invoice);
          
          console.log('✅ Auto-sent to Bosta:', result.trackingNumber);
        }
      }
    } catch (error) {
      console.error('❌ Auto-send to Bosta failed:', error);
      // لا نوقف عملية الـ checkout
    }
  }
}
```

---

## المرحلة 7️⃣: واجهة المستخدم - صفحة الإعدادات الكاملة

### التصميم المقترح

**الملف:** `app/settings/page.js`

```javascript
"use client";

import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { BostaAPI } from '@/app/lib/bosta-api';
import { getBostaSettings } from '@/app/lib/bosta-helpers';

export default function SettingsPage() {
  const [bostaSettings, setBostaSettings] = useState({
    enabled: false,
    apiKey: '',
    businessLocationId: '',
    autoSend: false,
    defaultPackageType: 'Parcel',
    defaultSize: 'MEDIUM',
    allowToOpenPackage: false
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getBostaSettings();
    setBostaSettings(settings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await localforage.setItem('bosta_settings', bostaSettings);
      alert('✅ تم حفظ الإعدادات بنجاح');
    } catch (error) {
      alert('❌ فشل حفظ الإعدادات: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!bostaSettings.apiKey) {
      alert('⚠️ أدخل API Key أولاً');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const bostaAPI = new BostaAPI(bostaSettings.apiKey);
      const success = await bostaAPI.testConnection();
      
      setTestResult({
        success,
        message: success 
          ? '✅ الاتصال ناجح - API Key صحيح'
          : '❌ فشل الاتصال - تحقق من API Key'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: '❌ خطأ: ' + error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ الإعدادات</h1>
          <p className="text-gray-600">إدارة إعدادات النظام والتكاملات الخارجية</p>
        </div>

        {/* Bosta Settings Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Bosta Integration</h2>
                <p className="text-sm text-gray-600">ربط النظام مع بوسطة للشحن</p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bostaSettings.enabled}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 
                            peer-focus:ring-purple-300 rounded-full peer 
                            peer-checked:after:translate-x-full peer-checked:after:border-white 
                            after:content-[''] after:absolute after:top-0.5 after:left-[4px] 
                            after:bg-white after:border-gray-300 after:border after:rounded-full 
                            after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600">
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {bostaSettings.enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </label>
          </div>

          {/* Settings Form */}
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={bostaSettings.apiKey}
                  onChange={(e) => setBostaSettings({
                    ...bostaSettings,
                    apiKey: e.target.value
                  })}
                  placeholder="أدخل API Key من حساب Bosta"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={!bostaSettings.enabled}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 
                           hover:text-gray-700"
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                احصل على API Key من 
                <a href="https://business.bosta.co" target="_blank" 
                   className="text-purple-600 hover:underline mx-1">
                  حساب Bosta
                </a>
              </p>
            </div>

            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={!bostaSettings.enabled || !bostaSettings.apiKey || testing}
              className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg font-bold
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              {testing ? '⏳ جاري الاختبار...' : '🔍 اختبار الاتصال'}
            </button>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg ${
                testResult.success 
                  ? 'bg-green-50 border border-green-300 text-green-700'
                  : 'bg-red-50 border border-red-300 text-red-700'
              }`}>
                {testResult.message}
              </div>
            )}

            {/* Business Location ID */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Business Location ID
              </label>
              <input
                type="text"
                value={bostaSettings.businessLocationId}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  businessLocationId: e.target.value
                })}
                placeholder="اختياري - ID مكان الاستلام"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={!bostaSettings.enabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                مكان استلام الطلبات (اختياري)
              </p>
            </div>

            {/* Auto Send */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-bold text-gray-800">إرسال تلقائي</p>
                <p className="text-sm text-gray-600">
                  إرسال الطلبات تلقائياً لبوسطة عند إنشائها
                </p>
              </div>
              <input
                type="checkbox"
                checked={bostaSettings.autoSend}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  autoSend: e.target.checked
                })}
                disabled={!bostaSettings.enabled}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </div>

            {/* Default Package Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                نوع الشحنة الافتراضي
              </label>
              <select
                value={bostaSettings.defaultPackageType}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  defaultPackageType: e.target.value
                })}
                disabled={!bostaSettings.enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Parcel">Parcel (طرد)</option>
                <option value="Document">Document (مستند)</option>
              </select>
            </div>

            {/* Default Size */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                الحجم الافتراضي
              </label>
              <select
                value={bostaSettings.defaultSize}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  defaultSize: e.target.value
                })}
                disabled={!bostaSettings.enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="SMALL">صغير (SMALL)</option>
                <option value="MEDIUM">متوسط (MEDIUM)</option>
                <option value="LARGE">كبير (LARGE)</option>
              </select>
            </div>

            {/* Allow To Open Package */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-bold text-gray-800">السماح بفتح الطرد</p>
                <p className="text-sm text-gray-600">
                  السماح للعميل بفتح الطرد قبل الدفع
                </p>
              </div>
              <input
                type="checkbox"
                checked={bostaSettings.allowToOpenPackage}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  allowToOpenPackage: e.target.checked
                })}
                disabled={!bostaSettings.enabled}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 
                       text-white px-6 py-4 rounded-lg text-lg font-bold
                       hover:from-purple-600 hover:to-indigo-700 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all shadow-lg"
            >
              {saving ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-6 text-center">
          <a
            href="https://docs.bosta.co"
            target="_blank"
            className="text-purple-600 hover:underline"
          >
            📚 وثائق Bosta API
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎯 خطة التنفيذ بالترتيب

### الأولوية 1️⃣: إعداد الأساسيات (1-2 يوم)
- ✅ إنشاء صفحة الإعدادات
- ✅ إنشاء Bosta API Wrapper
- ✅ إضافة زر اختبار الاتصال

### الأولوية 2️⃣: تحسين العنوان (1-2 يوم)
- ✅ جلب المدن والمناطق من Bosta API
- ✅ تحديث نموذج العنوان في POS
- ✅ حفظ cityId, districtId, zoneId

### الأولوية 3️⃣: الإرسال اليدوي (1 يوم)
- ✅ إضافة زر "إرسال لبوسطة" في صفحة الأوردرات
- ✅ تحديث Invoice structure
- ✅ حفظ Tracking Number

### الأولوية 4️⃣: الإرسال التلقائي (نصف يوم)
- ✅ إضافة Auto-Send في processCheckout
- ✅ معالجة الأخطاء

### الأولوية 5️⃣: عرض حالة الشحنة (1 يوم)
- ✅ إضافة دالة جلب حالة الشحنة
- ✅ عرض Tracking info في واجهة الأوردرات
- ✅ رابط تتبع الشحنة

### الأولوية 6️⃣ (مستقبلي): Webhook & Advanced Features
- ⏭️ Webhook لتحديث حالة الشحنات تلقائياً
- ⏭️ طباعة Label من Bosta
- ⏭️ إلغاء الشحنات
- ⏭️ تقارير الشحن

---

## 📊 الجدول الزمني المتوقع

| المرحلة | المدة | الصعوبة |
|---------|-------|---------|
| صفحة الإعدادات | يوم واحد | سهلة ⭐ |
| Bosta API Wrapper | يوم واحد | متوسطة ⭐⭐ |
| تحسين العنوان | يومين | صعبة ⭐⭐⭐ |
| الإرسال اليدوي | يوم واحد | متوسطة ⭐⭐ |
| الإرسال التلقائي | نصف يوم | سهلة ⭐ |
| عرض الحالة | يوم واحد | سهلة ⭐ |

**الإجمالي:** 5-7 أيام عمل

---

## ⚠️ التحديات المتوقعة

### 1. جلب المدن والمناطق من Bosta
**المشكلة:** قد يكون API المدن محدود أو يحتاج authentication خاص.

**الحل:**
- البدء بـ Static List للمدن الشائعة
- إضافة Dynamic Fetch لاحقاً

### 2. تطابق المدن بين النظامين
**المشكلة:** العميل قد يدخل "القاهرة" بينما Bosta يستخدم "Cairo".

**الحل:**
- Mapping table للمدن الشائعة
- Auto-suggest من قائمة Bosta

### 3. معالجة الأخطاء
**المشكلة:** قد يفشل الإرسال لأسباب كثيرة (API Key خاطئ، عنوان غير صحيح، etc).

**الحل:**
- Validation قبل الإرسال
- عرض رسائل خطأ واضحة
- إمكانية إعادة المحاولة

### 4. الإرسال التلقائي والأخطاء
**المشكلة:** إذا فشل الإرسال التلقائي، قد لا يلاحظ التاجر.

**الحل:**
- عدم إيقاف عملية Checkout عند فشل الإرسال
- عرض notification للفشل
- إمكانية الإرسال اليدوي لاحقاً

---

## 🔄 Flow Chart

```
┌─────────────────┐
│  POS Checkout   │
└────────┬────────┘
         │
         ▼
    Order Type?
    ┌────┴────┐
    │ Pickup  │  Delivery
    └─────────┘     │
                    ▼
           ┌──────────────────┐
           │ Customer Details │
           │   + Address      │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ Save Invoice     │
           └────────┬─────────┘
                    │
                    ▼
         Bosta Enabled & Auto-Send?
         ┌────────┴────────┐
         │ No              │ Yes
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌──────────────┐
    │  Done   │      │ Validate     │
    └─────────┘      │ Invoice      │
                     └──────┬───────┘
                            │
                            ▼
                      Valid?
                      ┌─────┴─────┐
                      │ No        │ Yes
                      │           │
                      ▼           ▼
                 ┌──────────┐  ┌────────────────┐
                 │  Log     │  │ Send to Bosta  │
                 │  Error   │  └───────┬────────┘
                 └──────────┘          │
                                       ▼
                                  Success?
                                  ┌─────┴─────┐
                                  │ No        │ Yes
                                  │           │
                                  ▼           ▼
                             ┌──────────┐  ┌────────────────┐
                             │  Log     │  │ Save Tracking  │
                             │  Error   │  │    Number      │
                             └──────────┘  └────────────────┘
```

---

## 📝 Checklist للمطور

### قبل البدء
- [ ] قراءة [Bosta API Documentation](https://docs.bosta.co)
- [ ] الحصول على Test API Key من Bosta
- [ ] اختبار Bosta API بـ Postman أو cURL
- [ ] فهم هيكل Invoice الحالي

### المرحلة 1: الإعدادات
- [ ] إنشاء `app/settings/page.js`
- [ ] تصميم واجهة الإعدادات
- [ ] حفظ/تحميل الإعدادات من LocalForage
- [ ] إضافة زر "اختبار الاتصال"
- [ ] اختبار حفظ الإعدادات

### المرحلة 2: Bosta API
- [ ] إنشاء `app/lib/bosta-api.js`
- [ ] دالة `testConnection()`
- [ ] دالة `getCities()`
- [ ] دالة `createDelivery()`
- [ ] دالة `convertInvoiceToBosta()`
- [ ] دالة `getDelivery()`
- [ ] إنشاء `app/lib/bosta-helpers.js`
- [ ] دالة `validateInvoiceForBosta()`
- [ ] دالة `getBostaSettings()`

### المرحلة 3: تحسين العنوان
- [ ] جلب المدن من Bosta API
- [ ] حفظ المدن في LocalForage cache
- [ ] إضافة Dropdown للمدن في POS
- [ ] إضافة Dropdown للمناطق
- [ ] حفظ cityId, districtId في العنوان
- [ ] اختبار إدخال عنوان كامل

### المرحلة 4: تحديث Invoice
- [ ] إضافة حقل `bosta` في Invoice structure
- [ ] إضافة cityId, districtId في address
- [ ] تحديث `pos-store.js`
- [ ] اختبار حفظ Invoice جديد

### المرحلة 5: الإرسال اليدوي
- [ ] إضافة زر "إرسال لبوسطة" في Orders page
- [ ] دالة `sendToBosta()`
- [ ] تحديث Invoice بعد الإرسال
- [ ] عرض Tracking Number
- [ ] عرض حالة الشحنة
- [ ] رابط تتبع الشحنة
- [ ] اختبار الإرسال بـ Test API

### المرحلة 6: الإرسال التلقائي
- [ ] إضافة Auto-Send في `processCheckout()`
- [ ] معالجة الأخطاء
- [ ] اختبار Auto-Send
- [ ] التأكد من عدم إيقاف Checkout عند فشل الإرسال

### المرحلة 7: الاختبار النهائي
- [ ] اختبار سيناريو كامل (POS → Checkout → Auto-Send)
- [ ] اختبار الإرسال اليدوي من Orders
- [ ] اختبار تتبع الشحنة
- [ ] اختبار معالجة الأخطاء
- [ ] اختبار مع Production API Key

---

## 🚀 Next Steps (ماذا بعد؟)

### بعد اكتمال التكامل الأساسي
1. **Webhook Integration**
   - استقبال تحديثات حالة الشحنة من Bosta
   - تحديث Invoice تلقائياً

2. **Advanced Features**
   - طباعة Label من Bosta
   - إلغاء الشحنات
   - تعديل الشحنات

3. **Analytics & Reports**
   - تقارير الشحن
   - إحصائيات الشحنات الناجحة/الفاشلة
   - تكلفة الشحن vs. الإيرادات

4. **Bulk Operations**
   - إرسال عدة طلبات دفعة واحدة
   - تصدير CSV للشحنات

---

## 📞 الدعم والمساعدة

- **Bosta Support:** [support@bosta.co](mailto:support@bosta.co)
- **Bosta Docs:** [https://docs.bosta.co](https://docs.bosta.co)
- **Bosta Dashboard:** [https://business.bosta.co](https://business.bosta.co)

---

## ✅ تم إنشاء الخطة بتاريخ: 2026-01-04

**الحالة:** جاهز للتنفيذ 🚀

**الأولوية التالية:** البدء بالمرحلة 1️⃣ (صفحة الإعدادات)
