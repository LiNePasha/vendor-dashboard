# 🚀 Cashier System - Integration Guide

## ✅ اللي اتعمل:

### 1️⃣ Backend (WordPress Plugin):
- ✅ `spare2app-cashier-plugin` - Plugin كامل جاهز
- ✅ Full Sync API: `/wp-json/cashier/v1/store/{vendor_id}/pos-initial?all=true`
- ✅ Delta Sync API: `/wp-json/cashier/v1/store/{vendor_id}/pos-changes?since={timestamp}`
- ✅ Smart caching (10 minutes)
- ✅ Database change tracking
- ✅ Load time: **~973ms** للـ 686 منتج

### 2️⃣ Frontend (Next.js):
- ✅ API Routes:
  - `/api/cashier/initial` - Full sync proxy
  - `/api/cashier/changes` - Delta sync proxy
- ✅ Store Updates:
  - `syncAllProducts()` - تحميل كل المنتجات مرة واحدة
  - `syncChanges()` - جلب التغييرات فقط
  - `setAutoSync()` - تفعيل/إيقاف التزامن التلقائي
- ✅ Custom Hook:
  - `useCashierSync()` - Auto-sync كل 30 ثانية

---

## 📋 كيفية الاستخدام في POS Page:

### مثال بسيط:

```javascript
'use client';
import { useEffect } from 'react';
import { usePOSStore } from '@/app/stores/pos-store';
import { useCashierSync } from '@/app/hooks/useCashierSync';

export default function POSPage() {
  const products = usePOSStore(state => state.products);
  const categories = usePOSStore(state => state.categories);
  const loading = usePOSStore(state => state.loading);
  const lastSync = usePOSStore(state => state.lastSync);
  
  // 🚀 Auto-sync كل 30 ثانية
  const { syncNow } = useCashierSync();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>نقطة البيع</h1>
        <div className="text-sm text-gray-500">
          آخر تزامن: {lastSync ? new Date(lastSync).toLocaleTimeString('ar-EG') : 'لم يتم التزامن'}
        </div>
        <button 
          onClick={syncNow}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {loading ? 'جاري التحميل...' : 'تحديث يدوي'}
        </button>
      </div>

      {loading && <div>جاري تحميل المنتجات...</div>}

      <div className="grid grid-cols-4 gap-4">
        {products.map(product => (
          <div key={product.id} className="border p-4">
            <h3>{product.name}</h3>
            <p>{product.price} جنيه</p>
            <p className="text-sm text-gray-500">
              المخزون: {product.stock_quantity}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## ⚡ Features:

### 1. Initial Load (أول مرة):
- ✅ يحمل كل الـ 686 منتج في **~1 ثانية**
- ✅ يخزنهم في IndexedDB
- ✅ يشتغل offline بعد كده

### 2. Auto-Sync (كل 30 ثانية):
- ✅ يجيب التغييرات بس (delta sync)
- ✅ لو منتج اتعدل → يحدثه
- ✅ لو منتج اتمسح → يمسحه
- ✅ لو منتج جديد → يضيفه

### 3. Smart Caching:
- ✅ Backend cache (10 دقائق)
- ✅ Frontend cache (IndexedDB)
- ✅ بدون internet بيشتغل عادي

### 4. Manual Sync:
```javascript
const syncNow = usePOSStore(state => state.syncAllProducts);
syncNow(); // تزامن يدوي كامل
```

---

## 🎯 Performance:

| Metric | Value |
|--------|-------|
| Initial Load | ~973ms |
| Delta Sync | ~50-200ms |
| Products | 686 |
| Categories | 75 |
| Offline | ✅ Full support |
| Auto-sync | Every 30 sec |

---

## 🔧 Configuration:

### تعطيل Auto-Sync:
```javascript
const setAutoSync = usePOSStore(state => state.setAutoSync);
setAutoSync(false);
```

### تغيير فترة Auto-Sync:
عدّل في `useCashierSync.js`:
```javascript
setInterval(() => {
  syncChanges();
}, 60000); // 60 seconds بدل 30
```

---

## 📊 State Management:

```javascript
{
  products: [],           // كل المنتجات
  categories: [],         // كل الكاتجوريز
  lastSync: null,         // آخر تزامن (ISO timestamp)
  syncInProgress: false,  // جاري التزامن؟
  autoSyncEnabled: true,  // Auto-sync مفعّل؟
  syncError: null         // آخر خطأ
}
```

---

## 🚀 الخطوات التالية:

1. ارفع الـ Plugin على WordPress
2. فعّل الـ Plugin
3. استخدم الـ hook في POS page
4. اختبر النظام!

---

Made with ⚡ by Spare2App - **أسرع نظام كاشير في مصر**
