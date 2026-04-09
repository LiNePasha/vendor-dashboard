# 📊 ميزة تقرير المبيعات اليومية

## الهدف
إنشاء تقرير يومي شامل لكل الطلبات التي تم تسليمها اليوم عن طريق بوسطة، مع إمكانية طباعتها كـ PDF.

## الميزات الرئيسية

### 1. تتبع تاريخ التسليم
- **Meta Data الجديدة**: `_bosta_delivered_at` - يحفظ تاريخ ووقت تسليم الطلب
- **التحديث التلقائي**: عند مزامنة حالة الطلب من بوسطة، إذا كانت الحالة "delivered"، يتم حفظ التاريخ تلقائياً
- **الدعم الكامل**: يعمل مع Website Orders و System Orders

### 2. فلترة الطلبات المُسلمة اليوم
- **دالة مساعدة**: `getOrdersDeliveredToday(orders)` في `bosta-helpers.js`
- **المعايير**:
  - الطلب تم إرساله لبوسطة
  - حالة الطلب "delivered"
  - تاريخ التسليم في نفس اليوم (من 00:00 إلى 23:59)

### 3. زر تقرير المبيعات اليومية
- **الموقع**: صفحة الأوردرات، بجانب زر "طباعة غير Bosta"
- **الشرط**: يظهر فقط عند تفعيل بوسطة
- **العداد الديناميكي**: يعرض عدد الطلبات المُسلمة اليوم في الوقت الفعلي
- **التصميم**: خلفية بنفسجية-زرقاء مميزة 🎨

### 4. صفحة تقرير المبيعات (PDF)
**المسار**: `/pos/invoices/daily-sales-report?ids=invoice1,invoice2,...`

#### أ) بطاقات الملخص
1. **إجمالي المبيعات**: مجموع قيمة كل الطلبات المُسلمة
2. **عدد الطلبات**: عدد الطلبات التي تم تسليمها اليوم
3. **رسوم التوصيل**: إجمالي رسوم التوصيل

#### ب) ملخص المنتجات المباعة
جدول يعرض:
- صورة المنتج (40x40px)
- اسم المنتج
- إجمالي الكمية المباعة (من كل الطلبات)
- إجمالي المبيعات (بالجنيه)
- **الترتيب**: حسب الكمية (الأكثر مبيعاً أولاً)

#### ج) قائمة الطلبات
عرض كل طلب في كارت صغير يحتوي على:
- رقم الطلب
- اسم العميل
- رقم الهاتف
- وقت التسليم (من `deliveredAt`)
- عدد المنتجات
- إجمالي الطلب

#### د) التصميم
- **حجم الورق**: A4
- **التخطيط**: شبكة responsive (gridTemplateColumns)
- **الألوان**: 
  - أزرق للمبيعات
  - أخضر للطلبات
  - أصفر لرسوم التوصيل
- **الطباعة التلقائية**: ينطلق تلقائياً بعد 500ms

## الملفات المُعدّلة

### 1. `app/api/orders/update-bosta/route.js`
```javascript
// إضافة deliveredAt و pickedUpAt للـ meta_data
if (bostaData.deliveredAt) {
  metaData.push({ key: '_bosta_delivered_at', value: bostaData.deliveredAt });
}
```

### 2. `app/stores/pos-store.js`
```javascript
// قراءة deliveredAt من meta_data
const bostaDeliveredAt = order.meta_data.find(
  m => m.key === '_bosta_delivered_at' || m.key === 'bosta_delivered_at'
)?.value;

order.bosta = {
  // ...
  deliveredAt: bostaDeliveredAt || ''
};
```

### 3. `app/lib/bosta-helpers.js`
```javascript
// دالة جديدة لفلترة الطلبات المُسلمة اليوم
export function getOrdersDeliveredToday(orders) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return orders.filter(order => {
    // التحقق من إرسال بوسطة + حالة delivered + تاريخ التسليم
    // ...
  });
}
```

### 4. `app/orders/page.js`
```javascript
// استيراد الدالة الجديدة
import { getOrdersDeliveredToday } from "@/app/lib/bosta-helpers";

// دالة معالجة التقرير
const handleDailySalesReport = async () => {
  const deliveredToday = getOrdersDeliveredToday(orders);
  // تسجيل الفواتير
  // فتح صفحة التقرير
  window.open(`/pos/invoices/daily-sales-report?ids=${idsParam}`, '_blank');
};

// الزر في UI
<button onClick={handleDailySalesReport}>
  📊 تقرير المبيعات اليومية ({getOrdersDeliveredToday(orders).length})
</button>
```

### 5. `app/pos/invoices/daily-sales-report/page.js` ✨ جديد
صفحة كاملة لطباعة التقرير كـ PDF

## طريقة الاستخدام

### خطوات التشغيل:
1. **تفعيل بوسطة**: من صفحة الإعدادات
2. **إرسال طلبات لبوسطة**: من صفحة الأوردرات
3. **مزامنة الحالات**: الضغط على "مزامنة من بوسطة" بشكل دوري
4. **عند التسليم**: النظام يحفظ تاريخ التسليم تلقائياً في `_bosta_delivered_at`
5. **الطباعة**: الضغط على زر "📊 تقرير المبيعات اليومية"
6. **النتيجة**: فتح صفحة PDF جاهزة للطباعة

### مثال:
- اليوم: 8 أبريل 2026
- الطلبات المُسلمة اليوم: 15 طلب
- عند الضغط على الزر:
  - يتم تسجيل الطلبات كفواتير (لو لم تكن مُسجلة)
  - فتح صفحة التقرير مع ملخص شامل
  - الطباعة تلقائية

## الفوائد

### للبيزنس أونر:
✅ **تقرير يومي سريع** - كل المبيعات في مكان واحد  
✅ **تفاصيل شاملة** - المنتجات، العملاء، الأوقات  
✅ **توفير الوقت** - بدلاً من البحث في كل طلب على حدة  
✅ **تحليل المبيعات** - معرفة المنتجات الأكثر مبيعاً  
✅ **سجل PDF** - حفظ التقرير لمراجعته لاحقاً  

### تقنياً:
✅ **بدون API إضافية** - يعتمد على LocalForage  
✅ **سرعة عالية** - فلترة على مستوى Frontend  
✅ **دقة البيانات** - يستخدم `deliveredAt` من بوسطة  
✅ **تصميم responsive** - يعمل على كل الأجهزة  
✅ **طباعة احترافية** - A4 format مع تنسيق جميل  

## ملاحظات تقنية

### تخزين البيانات
- **Website Orders**: `_bosta_delivered_at` في WooCommerce meta_data
- **System Orders**: `bosta.deliveredAt` في LocalForage invoice
- **الصيغة**: ISO 8601 string (e.g., "2026-04-08T14:30:00.000Z")

### الفلترة
```javascript
// التحقق من تاريخ التسليم
const deliveredAt = new Date(deliveredAtStr);
return deliveredAt >= today && deliveredAt < tomorrow;
```

### الطباعة
- **تأخير 500ms**: لضمان تحميل الصور قبل الطباعة
- **إغلاق تلقائي**: بعد الطباعة (afterprint event)
- **Fallback**: لو مفيش صورة، يتم إخفاءها (onError handler)

## Future Enhancements (مستقبلاً)

1. **تقرير أسبوعي/شهري** - اختيار فترة زمنية
2. **إحصائيات رسومية** - Charts لتطور المبيعات
3. **تصدير Excel** - بالإضافة للـ PDF
4. **مقارنة بأيام سابقة** - "اليوم مقابل الأمس"
5. **إشعار يومي** - تنبيه تلقائي بعدد المبيعات

---

✅ **الميزة جاهزة للاستخدام!**
