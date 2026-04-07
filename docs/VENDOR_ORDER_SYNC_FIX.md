# حل مشكلة اختفاء الأوردرات من الفيندور بعد تعديل المنتجات

## المشكلة

عند تعديل منتجات الأوردر عبر REST API:
- جدول `wp_wcfm_marketplace_orders` مش بيتحدث تلقائياً
- المنتجات الجديدة المضافة مش بتتسجل للفيندور
- لما أحذف المنتج الأصلي للأوردر، الأوردر كله بيختفي من عند الفيندور

**السبب الرئيسي:**
- WooCommerce REST API بيحدث `line_items` فقط
- WCFM بيعتمد على جدول `wp_wcfm_marketplace_orders` للربط بين الأوردرات والفيندورز  
- لما بنعدل `line_items` مباشرة، الـ hooks اللي بتحدث جدول WCFM مش بتشتغل

## الحل الكامل

### 1️⃣ Endpoint جديد في Plugin مع WCFM Sync

أضفت endpoint جديد في `spare2app-vendor-orders` plugin:

**Route:** `POST /wp-json/spare2app/v1/vendor-orders/{id}/update-items`

**الوظائف:**
```php
public function update_order_items($request) {
    // 1. تحديث line_items في WooCommerce
    // 2. إضافة metadata للمنتجات الجديدة (_wcfm_product_author)
    // 3. Sync جدول WCFM marketplace orders
    // 4. Return الأوردر المحدث
}

private function sync_wcfm_vendor_mapping($order_id) {
    // 1. جمع كل الفيندورز من line_items الحالية
    // 2. مسح الـ mappings القديمة
    // 3. إدراج mappings جديدة لكل فيندور
}
```

### 2️⃣ تحديث Next.js API Route

عدلت `app/api/orders/update-items/route.js` بحيث:
- بدل استخدام `wc/v3/orders/{id}` مباشرة
- استخدام `spare2app/v1/vendor-orders/{id}/update-items`
- الـ endpoint الجديد بيعمل WCFM sync تلقائي

## كيفية الاستخدام

### التفعيل:
1. Upload plugin `spare2app-vendor-orders` على WordPress
2. فعّل الـ plugin من لوحة التحكم
3. هيعمل flush للـ rewrite rules تلقائي

### الكود بيشتغل لوحده:
- لما تعدل منتج من `OrderDetailsModal`
- هيستخدم الـ endpoint الجديد تلقائي
- WCFM sync هيحصل أوتوماتيك

## المزايا

✅ **Auto-sync:** كل تعديل في line_items بيحدث WCFM جدول
✅ **Vendor metadata:** المنتجات الجديدة بيتكتب عليها `_wcfm_product_author`
✅ **Multi-vendor support:** لو الأوردر فيه منتجات من أكتر من فيندور
✅ **Delete tracking:** المنتجات المحذوفة (quantity = 0) مش بتتضاف
✅ **Error logging:** بيسجل كل عملية sync في error_log

## اختبار الحل

```javascript
// المفروض يشتغل من غير تغيير في الكود الحالي
// OrderDetailsModal -> handleSaveItems -> /api/orders/update-items -> plugin endpoint
```

**الـ log المتوقع:**
```
🔄 WCFM sync: Order #12345 mapped to vendors: 2, 5
```

## ملاحظات تقنية

**Schema جدول WCFM:**
```sql
CREATE TABLE wp_wcfm_marketplace_orders (
  ID bigint(20) NOT NULL AUTO_INCREMENT,
  order_id bigint(20) NOT NULL,
  vendor_id bigint(20) NOT NULL,
  created datetime DEFAULT NULL,
  ...
  PRIMARY KEY (ID),
  KEY order_id (order_id),
  KEY vendor_id (vendor_id)
)
```

**Vendor detection priority:**
1. `post_author` من المنتج نفسه (أعلى أولوية)
2. `_wcfm_product_author` من item metadata
3. Fallback على admin إذا مش موجود

## الملفات المعدلة

1. ✅ `spare2app-vendor-orders/includes/class-vendor-orders-endpoint.php`
   - إضافة route جديد: `update-items`
   - إضافة function: `update_order_items()`
   - إضافة function: `sync_wcfm_vendor_mapping()`

2. ✅ `app/api/orders/update-items/route.js`
   - تغيير endpoint من `wc/v3/orders/{id}` إلى `spare2app/v1/vendor-orders/{id}/update-items`

## الاستكمال المستقبلي (اختياري)

- [ ] إضافة webhook للـ sync عند تعديل الأوردر من WP Admin
- [ ] إضافة bulk sync endpoint لتصليح الأوردرات القديمة
- [ ] إضافة validation للـ vendor permissions قبل الحفظ
