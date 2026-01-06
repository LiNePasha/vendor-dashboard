# 🔧 إصلاح: رفع المنتجات من الفاتورة

## 🐛 المشكلة
عند رفع فاتورة واستخراج المنتجات (الأسماء والكميات صح)، لما المستخدم يضغط "استيراد"، كان بينزل منتج واحد فقط اسمه "المنتج" بدل كل المنتجات اللي استخرجها الـ AI.

## 🔍 السبب
`InvoiceUploadModal` كان بيبعت البيانات لـ `/api/products` بصيغة غلط، بينما `BulkUploadModal` بيستخدم `/api/warehouse/bulk-create` بصيغة صحيحة.

## ✅ الحل

### 1. تحديث `InvoiceUploadModal.js`

**قبل (غلط):**
```javascript
const res = await fetch('/api/products', {
  method: 'POST',
  body: JSON.stringify({ products }),
});
```

**بعد (صح):**
```javascript
const res = await fetch('/api/warehouse/bulk-create', {
  method: 'POST',
  body: JSON.stringify({
    products: products.map(p => ({
      name: p.name,
      sellingPrice: parseFloat(p.price) || 0,
      purchasePrice: 0,
      stock: parseInt(p.quantity) || 0, // quantity من الفاتورة
      sku: p.sku || '',
      imageUrl: ''
    }))
  }),
});
```

### 2. تحديث `app/products/page.js`

تغيير callback عشان يتعامل مع كل منتج على حدة (زي `BulkUploadModal`):

```javascript
onSuccess={(product) => {
  // Called for each product
  handleQuickAddSuccess(product);
}}
```

## 📊 الفرق

| قبل | بعد |
|-----|-----|
| ❌ API: `/api/products` | ✅ API: `/api/warehouse/bulk-create` |
| ❌ صيغة خاطئة | ✅ نفس صيغة BulkUpload |
| ❌ `quantity` → مش موجود | ✅ `quantity` → `stock` |
| ❌ منتج واحد فقط | ✅ كل المنتجات |

## 🧪 التجربة الآن

1. افتح `/products`
2. اضغط "📸 رفع فاتورة"
3. ارفع صورة فاتورة
4. انتظر الاستخراج
5. راجع المنتجات في الجدول
6. اضغط "استيراد X منتج"
7. ✅ **يجب أن تضاف كل المنتجات الآن!**

## 🎯 النتيجة
الآن `InvoiceUploadModal` بيستخدم نفس API والصيغة زي `BulkUploadModal` بالضبط، وهيضيف كل المنتجات اللي الـ AI استخرجها من الفاتورة!
