# 📦 خطة Variable Products (المنتجات المتغيرة)

## 🎯 الهدف
إضافة دعم للمنتجات المتغيرة (Variable Products) مثل WooCommerce، بحيث منتج واحد يكون له variations مختلفة (لون، حجم، إلخ)

---

## 🏗️ البنية في WooCommerce

### Product Structure
```json
{
  "id": 100,
  "name": "قميص رجالي",
  "type": "variable",  // ← مش simple
  "price": "100-150",  // Range
  "regular_price": "",
  "stock_quantity": null,
  "manage_stock": false,
  "attributes": [
    {
      "id": 1,
      "name": "اللون",
      "slug": "pa_color",
      "position": 0,
      "visible": true,
      "variation": true,  // ← مستخدم في variations
      "options": ["أحمر", "أزرق", "أخضر"]
    },
    {
      "id": 2,
      "name": "المقاس",
      "slug": "pa_size",
      "position": 1,
      "visible": true,
      "variation": true,
      "options": ["S", "M", "L", "XL"]
    }
  ]
}
```

### Variations Structure
```json
{
  "id": 101,
  "parent_id": 100,
  "sku": "SHIRT-RED-M",
  "regular_price": "120",
  "sale_price": "",
  "stock_quantity": 15,
  "manage_stock": true,
  "attributes": [
    {"id": 1, "name": "اللون", "option": "أحمر"},
    {"id": 2, "name": "المقاس", "option": "M"}
  ],
  "image": {
    "id": 200,
    "src": "https://..."
  }
}
```

---

## 🔍 API Testing Plan

### Phase 1: استكشاف الـ API
1. **جلب منتج variable موجود**
   ```
   GET /wp-json/wc/v3/products/{id}
   ```
   - تحليل البنية
   - فهم الـ attributes
   - فهم العلاقة مع variations

2. **جلب variations المنتج**
   ```
   GET /wp-json/wc/v3/products/{product_id}/variations
   ```
   - عدد variations
   - بنية كل variation
   - الصور والأسعار

3. **جلب الـ Attributes المتاحة**
   ```
   GET /wp-json/wc/v3/products/attributes
   GET /wp-json/wc/v3/products/attributes/{id}/terms
   ```

### Phase 2: إنشاء منتج variable
1. **إنشاء attributes أولاً** (لو مش موجودة)
2. **إنشاء المنتج الأساسي** (type: variable)
3. **إنشاء variations**

---

## 🎨 UI/UX Design Plan

### 1. صفحة إضافة/تعديل منتج

#### Step 1: اختيار نوع المنتج
```
[ ] منتج بسيط (Simple Product)
[ ] منتج متغير (Variable Product) ← NEW
```

#### Step 2: إضافة Attributes (لو variable)
```
┌─────────────────────────────────────────┐
│ السمات (Attributes)                     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🎨 اللون                            │ │
│ │ ┌─────┬─────┬─────┬─────┐          │ │
│ │ │ أحمر│ أزرق│ أخضر│ أسود│ [+ إضافة] │ │
│ │ └─────┴─────┴─────┴─────┘          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📏 المقاس                           │ │
│ │ ┌───┬───┬───┬────┐                 │ │
│ │ │ S │ M │ L │ XL │ [+ إضافة]      │ │
│ │ └───┴───┴───┴────┘                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ إضافة سمة جديدة]                    │
└─────────────────────────────────────────┘
```

#### Step 3: توليد Variations تلقائياً
```
[⚡ توليد كل المتغيرات (12 variation)]
```

#### Step 4: تعديل كل Variation
```
┌────────────────────────────────────────────────────────┐
│ المتغيرات (12)                       [توسيع الكل] [طي الكل]│
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▼ أحمر - S                               [✏️] [🗑️]│ │
│ │   ┌────────────────────────────────────────────┐ │ │
│ │   │ 🖼️ الصورة: [اختر صورة]                   │ │ │
│ │   │ 💰 السعر: [120] ج.م                       │ │ │
│ │   │ 📦 المخزون: [15]                          │ │ │
│ │   │ 🔖 SKU: SHIRT-RED-S                        │ │ │
│ │   │ ☑️ متاح للبيع                              │ │ │
│ │   └────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▶ أحمر - M                               [✏️] [🗑️]│ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▶ أحمر - L                               [✏️] [🗑️]│ │
│ └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### Quick Actions
```
┌────────────────────────────────────────┐
│ إجراءات سريعة على كل المتغيرات:      │
│                                        │
│ • ضبط سعر موحد: [100] ج.م [تطبيق]    │
│ • ضبط مخزون موحد: [20] [تطبيق]       │
│ • نسبة خصم: [10]% [تطبيق]             │
└────────────────────────────────────────┘
```

---

### 2. عرض المنتج في POS

#### Current View (Simple Product)
```
┌─────────────────────┐
│ 🖼️ صورة المنتج      │
│                     │
│ قميص رجالي          │
│ 100 ج.م            │
│ [+ إضافة]          │
└─────────────────────┘
```

#### New View (Variable Product)
```
┌─────────────────────┐
│ 🖼️ صورة المنتج      │
│                     │
│ قميص رجالي          │
│ 100-150 ج.م        │
│ [🎯 اختر المواصفات] │ ← يفتح modal
└─────────────────────┘
```

#### Variation Selector Modal
```
┌──────────────────────────────────────┐
│ اختر مواصفات: قميص رجالي        [✕] │
├──────────────────────────────────────┤
│ 🎨 اللون:                            │
│ ┌─────┬─────┬─────┬─────┐           │
│ │ أحمر│ أزرق│ أخضر│ أسود│           │
│ └─────┴─────┴─────┴─────┘           │
│      ↑ selected                      │
│                                      │
│ 📏 المقاس:                           │
│ ┌───┬───┬───┬────┐                  │
│ │ S │ M │ L │ XL │                  │
│ └───┴───┴───┴────┘                  │
│         ↑ selected                   │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 🖼️  أحمر - M                   │  │
│ │ 💰 السعر: 120 ج.م               │  │
│ │ 📦 المخزون: 15                 │  │
│ │ SKU: SHIRT-RED-M                │  │
│ └────────────────────────────────┘  │
│                                      │
│ [ إلغاء ]      [✓ إضافة للسلة]    │
└──────────────────────────────────────┘
```

---

### 3. عرض المنتج في صفحة المنتجات

#### Card View
```
┌─────────────────────┐
│ 🖼️                  │
│ قميص رجالي          │
│ 100-150 ج.م        │
│ 🔀 12 متغير         │ ← indicator
│ [✏️ تعديل]         │
└─────────────────────┘
```

#### Edit Modal Enhancement
```
• Tab جديد: "المتغيرات"
• عرض كل variations في table
• quick edit لكل variation
```

---

## 🔧 Technical Implementation Plan

### Phase 1: API Layer

#### 1. Create API Routes
- `GET /api/products/:id/variations` - جلب variations
- `POST /api/products/:id/variations` - إنشاء variation
- `PATCH /api/products/:id/variations/:vid` - تحديث variation
- `DELETE /api/products/:id/variations/:vid` - حذف variation
- `GET /api/attributes` - جلب السمات المتاحة
- `POST /api/attributes` - إنشاء سمة جديدة

#### 2. Test Scripts
```javascript
// test-variable-product.js
// 1. Fetch existing variable product
// 2. Fetch its variations
// 3. Create new variation
// 4. Update variation
// 5. Delete variation
```

### Phase 2: Data Layer

#### 1. Cache Structure
```javascript
{
  productId: 100,
  type: 'variable',
  variations: [
    {id: 101, attributes: {...}, ...},
    {id: 102, attributes: {...}, ...}
  ],
  variationsLastFetch: timestamp
}
```

#### 2. LocalForage Enhancement
- `saveVariations(productId, variations)`
- `getVariations(productId)`
- `updateVariation(productId, variationId, data)`

### Phase 3: UI Components

#### 1. New Components
- `VariableProductForm.js` - Form لإضافة variable product
- `AttributeSelector.js` - اختيار/إضافة attributes
- `VariationsManager.js` - إدارة variations
- `VariationSelector.js` - Modal لاختيار variation في POS
- `VariationCard.js` - Card لعرض variation واحد

#### 2. Modified Components
- `AddProductForm.js` - إضافة product type selector
- `EditProductModal.js` - إضافة support للـ variations
- `ProductGrid.js` (POS) - handle variable products
- `products/page.js` - عرض indicator للـ variable products

### Phase 4: Store Enhancement

```javascript
// pos-store.js
addVariationToCart: (product, variationId, selectedAttributes) => {
  // Add specific variation to cart
  // Store variation details with cart item
}
```

---

## 📊 Database Considerations

### Cart Structure Enhancement
```javascript
// Before (Simple Product)
{
  id: 100,
  name: "قميص",
  price: 100,
  quantity: 2
}

// After (Variable Product)
{
  id: 100,
  name: "قميص",
  variationId: 101,  // ← NEW
  variationName: "أحمر - M",  // ← NEW
  selectedAttributes: [  // ← NEW
    {name: "اللون", value: "أحمر"},
    {name: "المقاس", value: "M"}
  ],
  price: 120,
  quantity: 2,
  image: "specific-variation-image.jpg"  // ← can be different
}
```

---

## 🎯 Implementation Phases

### Phase 1: API Testing & Discovery (Week 1)
- [ ] Create test script to fetch variable products
- [ ] Test variations API endpoints
- [ ] Test attributes API endpoints
- [ ] Document API behavior
- [ ] Test creating/updating variations

### Phase 2: Backend APIs (Week 2)
- [ ] Create `/api/products/:id/variations` routes
- [ ] Create `/api/attributes` routes
- [ ] Add variation support to existing APIs
- [ ] Test error handling
- [ ] Add validation

### Phase 3: Data Layer (Week 3)
- [ ] Enhance cache structure
- [ ] Add variations cache methods
- [ ] Update cart storage
- [ ] Test cache invalidation

### Phase 4: UI - Add/Edit (Week 4-5)
- [ ] Create product type selector
- [ ] Build attribute selector
- [ ] Build variations manager
- [ ] Add quick actions
- [ ] Test variation creation flow

### Phase 5: UI - POS (Week 6)
- [ ] Add variation indicator to product cards
- [ ] Build variation selector modal
- [ ] Test add to cart with variations
- [ ] Update cart display to show variation details

### Phase 6: Testing & Refinement (Week 7)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Documentation

---

## 🚀 Quick Win: MVP Approach

### Simplified First Version
1. **Support existing variable products only** (لا إنشاء)
2. **POS variation selector** (أهم feature)
3. **Display variations in products page**
4. **Simple cart handling**

### MVP Timeline: 2 Weeks
- Week 1: API + Data Layer
- Week 2: POS UI + Testing

---

## 📝 API Testing Script (Next Step)

Create: `scripts/test-variable-products.js`
```javascript
// Test fetching variable product
// Test fetching variations
// Test attributes
// Document findings
```

---

## 💡 Benefits

### للتاجر:
- ✅ إدارة سهلة للمنتجات بمواصفات متعددة
- ✅ تقليل التكرار (منتج واحد بدل 12)
- ✅ تتبع مخزون دقيق لكل variation
- ✅ صور مختلفة لكل لون

### للكاشير:
- ✅ اختيار سريع للمواصفات
- ✅ عرض واضح للمخزون المتاح
- ✅ تجربة مستخدم أفضل

### للنظام:
- ✅ متوافق مع WooCommerce
- ✅ إدارة مخزون دقيقة
- ✅ تقارير أفضل

---

## ⚠️ Challenges & Solutions

### Challenge 1: Complex UI
**Solution:** Progressive disclosure - ابدأ بسيط وزود features

### Challenge 2: Cart Complexity
**Solution:** Store variation ID + attributes with each cart item

### Challenge 3: Stock Management
**Solution:** Track stock at variation level, not parent

### Challenge 4: Performance
**Solution:** Lazy load variations, cache aggressively

---

## 🔜 Next Actions

1. **اليوم:** إنشاء test script للـ API
2. **بكرة:** تحليل النتائج وتوثيق API behavior
3. **بعد بكرة:** ابدأ Phase 1 implementation

---

**Status:** 📋 Planning Complete - Ready for API Testing
**Priority:** 🔴 High (Important feature for e-commerce)
**Complexity:** 🟡 Medium-High
**Timeline:** 7 weeks (full) or 2 weeks (MVP)
