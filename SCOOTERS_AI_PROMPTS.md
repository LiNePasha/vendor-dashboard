# Scooters AI Prompts

## 1) Prompt عام (أي AI Builder)

أنشئ لي صفحة Frontend احترافية باسم **"الإسكوترات"** باللغة العربية (RTL) لعرض نوعين من البيانات:
1) إسكوترات جديدة
2) إسكوترات مستعملة

مصدر البيانات WordPress REST API:
- `/wp-json/wp/v2/new_scooter`
- `/wp-json/wp/v2/used_scooter`

كل عنصر يحتوي على:
- `title` (اسم الإعلان)
- `content` (الوصف)
- `acf.brand` (الماركة)
- `acf.model` (الموديل)
- `acf.year` (السنة)
- `acf.price` (السعر)
- `acf.color` (اللون)
- `acf.engine_cc` (حجم المحرك)
- `acf.mileage` (الكيلومترات - للمستعمل)
- `acf.images` (مصفوفة روابط صور JSON string أو Array)
- `status`

المطلوب في الصفحة:
- تصميم Modern responsive (موبايل أولًا) + RTL
- Tabs أعلى الصفحة: **"إسكوترات جديدة"** و **"إسكوترات مستعملة"**
- شريط فلاتر:
  - بحث بالاسم/الموديل
  - فلتر ماركة
  - نطاق سعر (من/إلى)
  - سنة الصنع
  - ترتيب حسب: الأحدث / السعر الأقل / السعر الأعلى
- عرض العناصر كـ Cards:
  - صورة رئيسية
  - اسم الإعلان
  - الماركة + الموديل + السنة
  - السعر بشكل واضح
  - Badge للحالة
  - للمستعمل أظهر الكيلومترات
- عند الضغط على Card:
  - افتح صفحة تفاصيل أو Modal فيها:
    - Gallery صور
    - كل المواصفات
    - الوصف الكامل
    - زر CTA **"تواصل واتساب"**
- Pagination أو Load More
- Skeleton loading أثناء التحميل
- Empty state إذا لا توجد نتائج
- Error state برسالة واضحة وزر إعادة المحاولة
- Lazy loading للصور + تحسين الأداء
- SEO:
  - Title + Meta description ديناميكية
  - Open Graph أساسي
- Accessibility:
  - تباين ألوان جيد
  - Alt text للصور
  - Keyboard navigation

قواعد البيانات:
- إذا `acf.images` نص JSON، قم بعمل parse آمن
- إذا لا توجد صورة، استخدم placeholder افتراضي
- لو `acf.mileage` غير موجودة، لا تعرضها في الجديد
- نسق السعر بصيغة عربية (EGP)

النتيجة المطلوبة:
- كود إنتاجي نظيف ومنظم
- Components واضحة (Filters, Card, Details, Pagination)
- State management بسيط وواضح
- جاهز للربط المباشر مع WordPress API

---

## 2) Prompt مخصص لمشروعك (Next.js App Router + Tailwind)

أنشئ لي ميزة كاملة في مشروع **Next.js App Router (JavaScript)** مع **Tailwind CSS** لعرض صفحة **"الإسكوترات"** بالعربي RTL.
المشروع يستخدم نفس أسلوب الواجهة الموجود في dashboard (ألوان داكنة، cards، badges، loading skeleton).

### الهدف
إنشاء صفحة Frontend لعرض:
1) إسكوترات جديدة (`new_scooter`)
2) إسكوترات مستعملة (`used_scooter`)

مع فلاتر، بحث، ترتيب، pagination، وصفحة تفاصيل.

### مصدر البيانات
WordPress REST API base:
- `process.env.NEXT_PUBLIC_API_BASE_URL` (مثال: `https://api.spare2app.com`)

Endpoints:
- `GET /wp-json/wp/v2/new_scooter`
- `GET /wp-json/wp/v2/used_scooter`

استخدم query params:
- `page`
- `per_page`
- `search`
- `orderby`
- `order`
- `status=publish`
- `_fields=id,date,title,content,acf,featured_media,slug,status`

### بنية البيانات المتوقعة لكل عنصر
- `id`
- `title.rendered`
- `content.rendered`
- `acf.brand`
- `acf.model`
- `acf.year`
- `acf.price`
- `acf.color`
- `acf.engine_cc`
- `acf.mileage` (للمستعمل)
- `acf.images` (قد تكون JSON string أو Array)
- `slug`
- `date`

### متطلبات التنفيذ (ملفات واضحة)
أنشئ الملفات التالية:

1) `app/scooters-market/page.js`
- الصفحة الرئيسية للسوق
- RTL
- Tabs: “إسكوترات جديدة” / “إسكوترات مستعملة”
- فلاتر + Grid cards + Pagination
- Loading / Empty / Error states

2) `components/scooters/ScooterFilters.js`
- بحث نصي
- فلتر ماركة (يتم اشتقاق القيم من النتائج الحالية)
- نطاق سعر (min/max)
- سنة
- ترتيب: الأحدث / السعر الأقل / السعر الأعلى

3) `components/scooters/ScooterCard.js`
- صورة رئيسية
- اسم الإعلان
- brand/model/year
- السعر بشكل واضح EGP
- mileage يظهر فقط في المستعمل
- زر “عرض التفاصيل”

4) `components/scooters/ScooterDetailsModal.js`
- Modal أو Drawer
- Gallery للصور
- كل المواصفات
- الوصف الكامل (sanitize render)
- زر CTA واتساب:
  - `https://wa.me/201012345678?text=...` (ضع placeholder number في `const`)

5) `app/api/public-scooters/route.js`
- Proxy API من Next server إلى WP
- يقبل params: `type(new|used), page, search, orderBy, order`
- يحول type:
  - `new => new_scooter`
  - `used => used_scooter`
- يرجع:
```json
{
  "items": [],
  "total": 0,
  "total_pages": 1,
  "page": 1
}
```
- `cache: no-store`
- معالجة أخطاء واضحة

6) `app/lib/scooters-utils.js`
- `parseImages(acf.images)`: يدعم JSON string أو array
- `formatPriceEGP(value)`
- `normalizeScooter(item)`
- `applyClientFilters(items, {brand, minPrice, maxPrice, year, q, sort})`

### قواعد مهمة
- استخدم JavaScript فقط (ليس TypeScript)
- التزم بأسلوب Tailwind الداكن المشابه:
  - خلفية page: `#181f2a`
  - card: `#232b3b`
- RTL كامل
- لا تعتمد على أي مكتبة جديدة إلا لو ضرورية جدًا
- لا تستخدم `dangerouslySetInnerHTML` مباشرة بدون sanitize بسيط
- لو لا توجد صور استخدم placeholder
- lazy loading للصور
- accessible labels للأزرار والinputs
- دعم الموبايل أولاً

### السلوك الوظيفي
- عند تغيير التاب يتم reset للفلاتر والصفحة
- البحث live مع debounce 300ms
- pagination server-side
- الفلاتر (brand/price/year) client-side على items الحالية
- عرض total results
- skeleton أثناء التحميل
- رسالة عربية عند الخطأ + زر إعادة المحاولة

### المطلوب في الإخراج
- اكتب الكود كامل لكل ملف
- كود نظيف قابل للتشغيل مباشرة
- ثم أضف قسم "How to use" قصير:
  - route
  - أي env مطلوب
  - كيفية اختبار endpoint

---

## 3) Prompt Premium (اختياري)

أنشئ نفس ميزة صفحة **سوق الإسكوترات** السابقة في Next.js App Router + Tailwind،
لكن أضف كذلك:
- SEO schema.org (Product/Vehicle)
- Infinite scroll بدل pagination التقليدية (مع fallback)
- مقارنة بين إسكوترين (Compare drawer)
- حفظ الفلاتر في query params
- مشاركة رابط نتيجة الفلترة
- تحسين Core Web Vitals (LCP/CLS) بوضوح
