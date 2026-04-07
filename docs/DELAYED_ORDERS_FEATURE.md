# ميزة تمييز الأوردرات المتأخرة لبوسطة

## الوصف

تمييز الأوردرات التي تأخرت أكثر من 5 أيام ولم يتم إرسالها لبوسطة بعد، مع تنبيه واضح في:
1. **صفحة الأوردرات** - Table & Grid View
2. **صفحة الطباعة** - بانر تحذير كبير

## الشروط للأوردر المتأخر

الأوردر يعتبر **متأخر** إذا كانت:
1. ✅ **بوسطة مفعلة** (Bosta enabled in settings)
2. ✅ **الأوردر عمره أكتر من 5 أيام** (من تاريخ الإنشاء)
3. ✅ **لم يتم إرساله لبوسطة بعد** (`_bosta_sent !== 'yes'`)
4. ✅ **نوع التوصيل: Delivery** (مش Store Pickup)
5. ✅ **الحالة ليست مكتملة** (not completed/cancelled/refunded/failed)

## الميزات المضافة

### 1️⃣ في صفحة الأوردرات (`app/orders/page.js`)

#### Table View:
- **تمييز الصف بالكامل:**
  - خلفية حمراء فاتحة: `bg-red-50/80`
  - Border أحمر بسُمك 2px: `border-red-200 border-2`
  - تغيير لون Hover: `hover:bg-red-100`

- **باج تنبيه:**
  ```jsx
  ⚠️ متأخر +5 أيام
  ```
  - لون: أحمر غامق `bg-red-600`
  - متحرك: `animate-pulse`
  - Border: `border-red-800`

#### Grid View:
- **تمييز الكارد:**
  - Border أحمر: `border-red-600`
  - Ring تأثير: `ring-4 ring-red-200`
  - خلفية خفيفة: `bg-red-50/30`
  - Shadow أحمر: `shadow-red-300/50`

- **نفس الباج في الهيدر**

### 2️⃣ في صفحة الطباعة (`app/pos/invoices/print/page.js`)

**بانر تحذير كبير ومميز:**

```jsx
⚠️⚠️⚠️
طلب متأخر - أكثر من 5 أيام
يجب إرساله لبوسطة فوراً!
```

**التصميم:**
- خلفية حمراء فاتحة: `#fee2e2`
- Border سميك 3px: `#991b1b`
- خط عريض وكبير: `font-weight: bold, fontSize: 12px`
- أيقونات تحذير متعددة: `⚠️⚠️⚠️`
- موضوع فوق ملاحظات العميل مباشرة

## الملفات المعدلة

### 1. `app/lib/bosta-helpers.js`
**إضافة Function جديدة:**
```javascript
export function isOrderDelayed(order, bostaEnabled)
```

**المنطق:**
- فحص Bosta enabled
- فحص نوع التوصيل (Delivery only)
- فحص حالة الإرسال لبوسطة
- حساب عمر الأوردر بالأيام
- Return true إذا > 5 أيام

### 2. `app/orders/page.js`
**التعديلات:**
- Import: `isOrderDelayed` من bosta-helpers
- حساب `orderIsDelayed` لكل أوردر
- إضافة conditional styling للـ rows/cards
- إضافة باج تحذير في Table & Grid

**الكود المضاف:**
```javascript
const orderIsDelayed = isOrderDelayed(order, bostaEnabled);

// Table Row className
className={`... ${orderIsDelayed ? 'bg-red-50/80 hover:bg-red-100 border-red-200 border-2' : '...'}`}

// Grid Card className
className={`... ${orderIsDelayed ? 'border-red-600 ring-4 ring-red-200 shadow-red-300/50 bg-red-50/30' : '...'}`}

// Badge
{orderIsDelayed && (
  <span className="bg-red-600 text-white ... animate-pulse ...">
    ⚠️ متأخر +5 أيام
  </span>
)}
```

### 3. `app/pos/invoices/print/page.js`
**التعديلات:**
- Import: `isOrderDelayed, getBostaSettings` من bosta-helpers
- State: `bostaEnabled` مع useEffect لجلب الإعدادات
- بناء `orderObj` من invoice data
- عرض بانر تحذير كبير قبل الملاحظات

**الكود المضاف:**
```javascript
{(() => {
  const orderObj = {
    status: invoice.status || 'processing',
    date_created: invoice.date || new Date().toISOString(),
    meta_data: [
      { key: '_bosta_sent', value: invoice.bosta?.sent ? 'yes' : 'no' },
      { key: '_is_store_pickup', value: invoice.orderType === 'delivery' ? 'no' : 'yes' }
    ],
    bosta: invoice.bosta
  };
  
  const orderDelayed = isOrderDelayed(orderObj, bostaEnabled);
  
  if (!orderDelayed) return null;
  
  return (
    <div style={{ /* تصميم البانر الأحمر */ }}>
      ⚠️⚠️⚠️
      طلب متأخر - أكثر من 5 أيام
      يجب إرساله لبوسطة فوراً!
    </div>
  );
})()}
```

## أمثلة الاستخدام

### مثال 1: أوردر متأخر في Table View
- الصف بيظهر بخلفية حمراء
- باج "⚠️ متأخر +5 أيام" بيتحرك (pulse)
- واضح جداً بين الأوردرات العادية

### مثال 2: أوردر متأخر في Grid View
- الكارد له border أحمر سميك
- Ring effect حول الكارد
- باج التحذير في أعلى الكارد

### مثال 3: طباعة أوردر متأخر
- بانر كبير أحمر في أول الفاتورة
- 3 أيقونات تحذير ⚠️
- نص واضح: "يجب إرساله لبوسطة فوراً!"
- يظهر حتى لو طبعت أكتر من فاتورة مرة واحدة

## السيناريو الكامل

**موقف:**
- عميل طلب منتجات في 1 مارس
- اليوم 8 مارس (7 أيام مرت)
- الأوردر لسه status: `processing`
- مفيش `_bosta_sent` = yes في metadata
- Bosta enabled في الإعدادات

**النتيجة:**
1. **في صفحة الأوردرات:** الأوردر يظهر بصف/كارد أحمر + باج "متأخر +5 أيام"
2. **عند الطباعة:** بانر أحمر كبير: "طلب متأخر - يجب إرساله لبوسطة فوراً!"
3. **التنبيه:** الفريق يشوف التحذير ويعرف لازم يشتغل على الأوردر ده فوراً

## الملاحظات التقنية

- **Performance:** Function `isOrderDelayed()` lightweight - مجرد calculations بسيطة
- **Caching:** بتستخدم `bostaEnabled` state اللي موجود في الصفحة
- **Print:** بتجلب Bosta settings مرة واحدة عند load الصفحة
- **Responsive:** البواج responsive وبتظهر كويس في Mobile/Desktop
- **Animation:** Pulse animation لجذب الانتباه بدون إزعاج

## التحسينات المستقبلية (اختياري)

- [ ] إضافة فلتر للأوردرات المتأخرة في صفحة الأوردرات
- [ ] إحصائية في الدashboard: "عندك X أوردرات متأخرة"
- [ ] تنبيه notification عند فتح الصفحة لو في أوردرات متأخرة
- [ ] Auto-send لبوسطة بعد 7 أيام (إذا Auto-send enabled)
- [ ] Email/SMS تنبيه للفريق عن الأوردرات المتأخرة
