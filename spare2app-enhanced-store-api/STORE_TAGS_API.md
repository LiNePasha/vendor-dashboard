# Store Tags API Documentation

## Overview
تم إضافة 3 endpoints جديدة لدعم نظام التاجز (Tags) في المتاجر، مشابهة لنظام التاجز الموجود في الـ Categories العادية.

## API Endpoints

### 1. Get Store Category Tags
**الهدف:** جلب جميع التاجز المستخدمة في منتجات category معين داخل متجر محدد

**Endpoint:**
```
GET /wp-json/spare2app/v2/store/{vendor_id}/category/{category_id}/tags
```

**Parameters:**
- `vendor_id` (required): معرف المتجر/البائع
- `category_id` (required): معرف الفئة

**Response:**
```json
{
  "vendor_id": 3,
  "category_id": 25,
  "category_name": "قطع غيار هوندا",
  "category_slug": "honda-parts",
  "tags": [
    {
      "id": 12,
      "name": "هوندا CB",
      "slug": "honda-cb",
      "description": "",
      "count": 15
    },
    {
      "id": 18,
      "name": "موديل 2023",
      "slug": "model-2023",
      "description": "",
      "count": 8
    }
  ],
  "total_tags": 5,
  "total_products": 23
}
```

**مثال استخدام:**
```javascript
// Get tags for category 25 in store 3
const response = await fetch('/api/store-category-tags/3/25')
const data = await response.json()
```

---

### 2. Get Store Tag Products
**الهدف:** جلب جميع المنتجات التي تحمل تاج معين في متجر محدد

**Endpoint:**
```
GET /wp-json/spare2app/v2/store/{vendor_id}/tag/{tag_slug}/products
```

**Parameters:**
- `vendor_id` (required): معرف المتجر/البائع
- `tag_slug` (required): slug الخاص بالتاج (مثل: honda-cb)
- `page` (optional): رقم الصفحة (default: 1)
- `per_page` (optional): عدد المنتجات في الصفحة (default: 12, max: 100)
- `sort` (optional): طريقة الترتيب
  - `date` (default): الأحدث
  - `price`: السعر من الأقل للأعلى
  - `price-desc`: السعر من الأعلى للأقل
  - `popularity`: الأكثر مبيعاً
  - `rating`: الأعلى تقييماً

**Response:**
```json
{
  "vendor_id": 3,
  "tag_id": 12,
  "tag_name": "هوندا CB",
  "tag_slug": "honda-cb",
  "products": [
    {
      "id": 456,
      "name": "فلتر هواء هوندا CB 500",
      "slug": "honda-cb-500-air-filter",
      "price": "150.00",
      "regular_price": "200.00",
      "sale_price": "150.00",
      "on_sale": true,
      "stock_status": "instock",
      "in_stock": true,
      "images": [...],
      "categories": [...],
      "vendor": {
        "id": 3,
        "name": "محمد أحمد",
        "shop_name": "متجر قطع غيار الشرق"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 12,
    "total": 15,
    "total_pages": 2,
    "has_more": true
  }
}
```

**مثال استخدام:**
```javascript
// Get products with tag "honda-cb" from store 3, page 1
const response = await fetch('/api/store-tag-products/3/honda-cb?page=1&per_page=12&sort=price')
const data = await response.json()
```

---

### 3. Get Store Category Tag Products
**الهدف:** جلب المنتجات التي تحمل تاج معين داخل category محدد في متجر محدد (الأكثر تحديداً)

**Endpoint:**
```
GET /wp-json/spare2app/v2/store/{vendor_id}/category/{category_id}/tag/{tag_slug}/products
```

**Parameters:**
- `vendor_id` (required): معرف المتجر/البائع
- `category_id` (required): معرف الفئة
- `tag_slug` (required): slug الخاص بالتاج
- `page` (optional): رقم الصفحة (default: 1)
- `per_page` (optional): عدد المنتجات في الصفحة (default: 12, max: 100)
- `sort` (optional): طريقة الترتيب (نفس الخيارات السابقة)

**Response:**
```json
{
  "vendor_id": 3,
  "category_id": 25,
  "category_name": "قطع غيار هوندا",
  "category_slug": "honda-parts",
  "tag_id": 12,
  "tag_name": "هوندا CB",
  "tag_slug": "honda-cb",
  "products": [...],
  "pagination": {
    "page": 1,
    "per_page": 12,
    "total": 8,
    "total_pages": 1,
    "has_more": false
  }
}
```

**مثال استخدام:**
```javascript
// Get products in category 25 with tag "honda-cb" from store 3
const response = await fetch('/api/store-category-tag-products/3/25/honda-cb?page=1')
const data = await response.json()
```

---

## Use Cases

### Case 1: Store Category Page with Tags Filter
```
صفحة: /stores/[slug]/category/[categorySlug]

1. عرض جميع منتجات المتجر في هذه الفئة
2. عرض قائمة التاجز المتاحة (Endpoint #1)
3. عند اختيار تاج → عرض المنتجات المفلترة (Endpoint #3)
```

### Case 2: Store Tag Page
```
صفحة: /stores/[slug]/tag/[tagSlug]

1. عرض جميع منتجات المتجر التي تحمل هذا التاج (Endpoint #2)
2. يمكن الفلترة حسب السعر أو التقييم
```

### Case 3: Store All Tags Page
```
صفحة: /stores/[slug]/tags

1. جمع جميع التاجز من كل الفئات في المتجر
2. عرضها في grid أو قائمة
3. كل تاج يؤدي لصفحة التاج (Case 2)
```

---

## Frontend Implementation

### Next.js API Routes

#### 1. Store Category Tags Route
```typescript
// app/api/store-category-tags/[vendorId]/[categoryId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string; categoryId: string }> }
) {
  const { vendorId, categoryId } = await params
  
  const response = await fetch(
    `https://api.spare2app.com/wp-json/spare2app/v2/store/${vendorId}/category/${categoryId}/tags`,
    { next: { revalidate: 300 } }
  )
  
  return NextResponse.json(await response.json())
}
```

#### 2. Store Tag Products Route
```typescript
// app/api/store-tag-products/[vendorId]/[tagSlug]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string; tagSlug: string }> }
) {
  const { vendorId, tagSlug } = await params
  const searchParams = request.nextUrl.searchParams
  
  const queryString = new URLSearchParams({
    page: searchParams.get('page') || '1',
    per_page: searchParams.get('per_page') || '12',
    sort: searchParams.get('sort') || 'date',
  }).toString()
  
  const response = await fetch(
    `https://api.spare2app.com/wp-json/spare2app/v2/store/${vendorId}/tag/${encodeURIComponent(tagSlug)}/products?${queryString}`,
    { next: { revalidate: 60 } }
  )
  
  return NextResponse.json(await response.json())
}
```

#### 3. Store Category Tag Products Route
```typescript
// app/api/store-category-tag-products/[vendorId]/[categoryId]/[tagSlug]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string; categoryId: string; tagSlug: string }> }
) {
  const { vendorId, categoryId, tagSlug } = await params
  const searchParams = request.nextUrl.searchParams
  
  const queryString = new URLSearchParams({
    page: searchParams.get('page') || '1',
    per_page: searchParams.get('per_page') || '12',
    sort: searchParams.get('sort') || 'date',
  }).toString()
  
  const response = await fetch(
    `https://api.spare2app.com/wp-json/spare2app/v2/store/${vendorId}/category/${categoryId}/tag/${encodeURIComponent(tagSlug)}/products?${queryString}`,
    { next: { revalidate: 60 } }
  )
  
  return NextResponse.json(await response.json())
}
```

---

## Component Example

### StoreTagsFilter Component
```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  vendorId: number
  categoryId?: number
  storeSlug: string
  categorySlug?: string
  selectedTag?: string | null
}

export default function StoreTagsFilter({ 
  vendorId, 
  categoryId, 
  storeSlug,
  categorySlug,
  selectedTag 
}: Props) {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const url = categoryId 
          ? `/api/store-category-tags/${vendorId}/${categoryId}`
          : `/api/store-tags/${vendorId}` // إذا أردنا جلب كل التاجز من المتجر
        
        const response = await fetch(url)
        const data = await response.json()
        setTags(data.tags || [])
      } catch (error) {
        console.error('Error fetching tags:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTags()
  }, [vendorId, categoryId])

  if (loading || tags.length === 0) return null

  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
      <div className="flex gap-2 overflow-x-auto">
        {tags.map((tag) => {
          const isSelected = selectedTag === tag.slug
          const href = categorySlug
            ? `/stores/${storeSlug}/category/${categorySlug}/tag/${tag.slug}`
            : `/stores/${storeSlug}/tag/${tag.slug}`
          
          return (
            <Link
              key={tag.id}
              href={href}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                ${isSelected 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {tag.name} ({tag.count})
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

---

## URL Structure

```
# Store homepage
/stores/[slug]

# Store category
/stores/[slug]/category/[categorySlug]

# Store category with tag filter
/stores/[slug]/category/[categorySlug]/tag/[tagSlug]

# Store tag (all products with this tag)
/stores/[slug]/tag/[tagSlug]

# Store all tags page (optional)
/stores/[slug]/tags
```

---

## Notes

1. **URL Encoding**: تأكد من عمل `encodeURIComponent()` للـ tag_slug عند إرساله في الـ URL
2. **Caching**: يفضل استخدام revalidation مدة 5 دقائق للتاجز و 1 دقيقة للمنتجات
3. **Performance**: الـ API يستخدم `posts_per_page = -1` لجلب التاجز (لأنها عادة قليلة)
4. **Sorting**: التاجز مرتبة حسب عدد الاستخدام (الأكثر استخداماً أولاً)
5. **Vendor Verification**: جميع الـ endpoints تتحقق من وجود البائع قبل المعالجة

---

## Testing

### Test in Browser
```
# Get tags for category 25 in store 3
https://api.spare2app.com/wp-json/spare2app/v2/store/3/category/25/tags

# Get products with tag "honda-cb" from store 3
https://api.spare2app.com/wp-json/spare2app/v2/store/3/tag/honda-cb/products?page=1&per_page=12

# Get products in category 25 with tag "honda-cb" from store 3
https://api.spare2app.com/wp-json/spare2app/v2/store/3/category/25/tag/honda-cb/products
```

### Test with cURL
```bash
# Get store category tags
curl "https://api.spare2app.com/wp-json/spare2app/v2/store/3/category/25/tags"

# Get store tag products with pagination
curl "https://api.spare2app.com/wp-json/spare2app/v2/store/3/tag/honda-cb/products?page=1&per_page=12&sort=price"

# Get store category tag products
curl "https://api.spare2app.com/wp-json/spare2app/v2/store/3/category/25/tag/honda-cb/products"
```
