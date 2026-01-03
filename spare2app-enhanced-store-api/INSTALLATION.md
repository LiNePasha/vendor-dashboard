# Spare2App Enhanced Store API - Smart Product Filtering

## 📋 Overview

هذا التحديث يضيف ميزات احترافية لتوزيع المنتجات بشكل عادل بين التجار المختلفين ويخفي المنتجات التي ليس لها بائع.

## 🎯 المشاكل التي يحلها

1. **إخفاء المنتجات بدون بائع** - المنتجات النموذجية (placeholder) لن تظهر للعملاء
2. **توزيع عادل للمنتجات** - كل تاجر يحصل على فرصة عرض منتجاته
3. **ترتيب ذكي** - المنتجات تظهر بشكل عشوائي لكن متسق خلال اليوم

## 📁 الملفات المضافة

```
spare2app-enhanced-store-api/
├── includes/
│   ├── class-api-filters.php           ← فلترة المنتجات + ترتيب ذكي
│   └── class-diverse-products-endpoint.php  ← endpoint للتنوع بين التجار
└── spare2app-enhanced-store-api.php    ← تحديث الملف الرئيسي
```

## 🚀 طريقة التثبيت

### الخطوة 1: رفع الملفات

1. افتح FTP أو File Manager في cPanel
2. اذهب إلى: `wp-content/plugins/spare2app-enhanced-store-api/includes/`
3. ارفع الملفين:
   - `class-api-filters.php`
   - `class-diverse-products-endpoint.php`

### الخطوة 2: تحديث الملف الرئيسي

افتح ملف `spare2app-enhanced-store-api.php` وأضف هذه الأسطر **قبل** نهاية الملف:

```php
// Load API Filters
require_once plugin_dir_path(__FILE__) . 'includes/class-api-filters.php';

// Load Diverse Products Endpoint  
require_once plugin_dir_path(__FILE__) . 'includes/class-diverse-products-endpoint.php';
```

### الخطوة 3: التفعيل

1. اذهب إلى WordPress Admin → Plugins
2. Deactivate البلاجن ثم Activate مرة أخرى
3. أو ببساطة انتظر - الملفات ستعمل تلقائياً

## ✅ التأكد من التثبيت

### اختبار 1: Statistics Endpoint

افتح في المتصفح:
```
https://spare2app.com/wp-json/spare2app/v1/products/stats
```

**المفروض تشوف:**
```json
{
  "total_products": 570,
  "products_with_vendors": 550,
  "products_without_vendors": 20,
  "vendors_count": 45,
  "top_vendors": [...]
}
```

### اختبار 2: Diverse Products Endpoint

افتح في المتصفح:
```
https://spare2app.com/wp-json/spare2app/v1/products/diverse?per_page=12&page=1
```

**المفروض تشوف:**
```json
{
  "data": [...منتجات من تجار مختلفين...],
  "pagination": {
    "page": 1,
    "per_page": 12,
    "total": 550,
    "total_pages": 46
  },
  "vendors_count": 45,
  "algorithm": "round-robin-daily-shuffle"
}
```

## 🔧 الإعدادات المتقدمة

### تغيير Vendor Meta Key

إذا كنت تستخدم plugin غير WCFM، عدّل في `class-api-filters.php`:

```php
// WCFM (default)
private $vendor_meta_key = '_wcfm_product_author';

// أو Dokan
private $vendor_meta_key = '_dokan_vendor_id';

// أو WC Vendors
private $vendor_meta_key = '_vendor_id';
```

### تعطيل الفلتر مؤقتاً (للاختبار)

أضف `?_disable_vendor_filter=true` لأي API request:
```
https://spare2app.com/wp-json/wc/v3/products?_disable_vendor_filter=true
```

## 📊 كيف يعمل النظام؟

### 1. API Filters (class-api-filters.php)

- **يفلتر تلقائياً** كل طلبات `/wc/v3/products`
- **يخفي المنتجات** التي ليس لها vendor
- **يضيف خيارات ترتيب ذكية:**
  - `orderby=smart` - ترتيب ذكي (متوفر + جديد + عشوائي)
  - `orderby=random_daily` - عشوائي لكن ثابت طوال اليوم
  - `orderby=vendor_random` - عشوائي حسب التاجر

### 2. Diverse Products Endpoint (class-diverse-products-endpoint.php)

**الخوارزمية:**

1. **يجلب كل التجار النشطين** (الذين لديهم منتجات)
2. **يأخذ منتجات من كل تاجر بالتناوب** (Round-Robin)
3. **يخلط النتائج بشكل عشوائي** لكن ثابت خلال اليوم نفسه
4. **يطبق الفلاتر** (category, price, stock, etc.)

**مثال:**
- التاجر A: منتج 1، منتج 2
- التاجر B: منتج 3، منتج 4  
- التاجر C: منتج 5، منتج 6
- النتيجة: [1, 3, 5, 2, 4, 6] (بعد الخلط العشوائي)

## 🔌 API Endpoints الجديدة

### 1. Get Diverse Products
```
GET /wp-json/spare2app/v1/products/diverse
```

**Parameters:**
- `page` - رقم الصفحة (default: 1)
- `per_page` - عدد المنتجات (default: 12, max: 100)
- `category` - تصفية حسب الفئة (slug)
- `search` - بحث في الاسم
- `min_price` - الحد الأدنى للسعر
- `max_price` - الحد الأقصى للسعر
- `in_stock` - فقط المتوفر (true/false)
- `on_sale` - فقط المخفض (true/false)
- `featured` - فقط المميز (true/false)

**مثال:**
```
https://spare2app.com/wp-json/spare2app/v1/products/diverse?per_page=12&category=motorcycle-parts&in_stock=true
```

### 2. Get Statistics
```
GET /wp-json/spare2app/v1/products/stats
```

**Response:**
```json
{
  "total_products": 570,
  "products_with_vendors": 550,
  "products_without_vendors": 20,
  "vendors_count": 45,
  "top_vendors": [
    {
      "vendor_id": "123",
      "product_count": "45"
    }
  ],
  "vendor_meta_key": "_wcfm_product_author"
}
```

## 🐛 Troubleshooting

### المنتجات لا تزال تظهر بدون vendor

1. تأكد أن الفلاتر مفعلة:
   ```
   /wp-json/spare2app/v1/products/stats
   ```
   شوف `products_without_vendors` - المفروض يكون 0

2. امسح الـ Cache:
   - WP Cache
   - Browser Cache
   - CDN Cache (if any)

### Endpoint يرجع 404

1. اذهب إلى: WordPress Admin → Settings → Permalinks
2. اضغط "Save Changes" (حتى لو مغيرتش حاجة)
3. ده بيعمل flush للـ rewrite rules

### Performance بطيء

الـ diverse endpoint بيعمل queries كتيرة. للتحسين:

1. استخدم caching plugin (Redis/Memcached)
2. قلل `per_page` لو ممكن
3. استخدم الـ standard API للصفحات الداخلية

## 📈 Next Steps

بعد التثبيت، روح على Frontend وحدث الكود عشان يستخدم الـ endpoint الجديد.

**ملف التحديث القادم:**
- `app/api/products/route.ts` - استخدام diverse endpoint
- `lib/api/woocommerce.ts` - إضافة getDiverseProducts method

## 📞 Support

إذا واجهت أي مشاكل:
1. شغل WP_DEBUG في `wp-config.php`
2. شوف error logs في `/wp-content/debug.log`
3. استخدم `/products/stats` endpoint للتشخيص

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-08  
**Compatible with:** WooCommerce 8.0+, WCFM 6.0+
