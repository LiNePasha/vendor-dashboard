// app/api/products/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// وظيفة لجلب التوكن من الكوكيز
async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

// جلب التصنيفات من WooCommerce
async function fetchCategories(token) {
  // جلب المنتجات المتاحة أولاً
  const productsRes = await fetch(
    `https://spare2app.com/wp-json/wc/v3/products?status=publish&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!productsRes.ok) throw new Error(`API Error: ${productsRes.status}`);
  const products = await productsRes.json();

  // استخراج معرفات التصنيفات من المنتجات
  const categoryIds = new Set();
  products.forEach(product => {
    if (product.categories && Array.isArray(product.categories)) {
      product.categories.forEach(cat => categoryIds.add(cat.id));
    }
  });

  // جلب تفاصيل التصنيفات المستخدمة فقط
  if (categoryIds.size === 0) return [];

  const categoriesQuery = new URLSearchParams();
  categoriesQuery.set('include', Array.from(categoryIds).join(','));

  const res = await fetch(
    `https://spare2app.com/wp-json/wc/v3/products/categories?${categoriesQuery.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const categories = await res.json();
  
  // إضافة عدد المنتجات لكل تصنيف
  return categories.map(cat => ({
    ...cat,
    count: products.filter(p => 
      p.categories && 
      p.categories.some(c => c.id === cat.id)
    ).length
  }));
}

// جلب المنتجات من WooCommerce
async function fetchProducts({ page = 1, per_page = 12, search = "", status = "all", category = "" }) {
  const token = await getToken();
  if (!token) throw new Error("Unauthorized");

  const query = new URLSearchParams();
  query.set("page", page);
  query.set("per_page", per_page);
  if (search) query.set("search", search);
  if (status !== "all") query.set("status", status);
  if (category) query.set("category", category);

  // 1. Fetch products
  const res = await fetch(
    `https://spare2app.com/wp-json/wc/v3/products?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const products = await res.json();
  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");
  
  // 2. Fetch categories on first page only
  let categories = [];
  if (page === 1) {
    categories = await fetchCategories(token);
  }

  return { 
    products,
    categories,
    pagination: { totalPages } 
  };
}

// GET: جلب المنتجات
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const per_page = parseInt(searchParams.get("per_page") || "12");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  // دائماً نجلب المنتجات المنشورة فقط
  const status = "publish";

  try {
    const data = await fetchProducts({ page, per_page, search, status, category });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: إضافة منتج جديد
export async function POST(req) {
  try {
    const token = await getToken();
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    function decodeToken(token) {
      try {
        const payload = token.split(".")[1];
        return JSON.parse(Buffer.from(payload, "base64").toString());
      } catch {
        return null;
      }
    }

    const decoded = decodeToken(token);
    const vendorId = decoded?.data?.user?.id;
    const roles = decoded?.data?.user?.roles || [];

    const body = await req.json();
    const { name, price, salePrice, imageUrl, whatsapp, type } = body;

    let payload = {
      name,
      status: "publish",
      images: imageUrl ? [{ src: imageUrl }] : [],
      meta_data: [{ key: "_wcfm_product_author", value: vendorId }],
    };

    // ✅ لو التاجر جملة
    if (roles.includes("wholesale_vendor") || type === "external") {
      payload = {
        ...payload,
        type: "external",
        external_url: `https://wa.me/+2${whatsapp}`,
        button_text: "تواصل على الواتساب",
      };
    } else {
      payload = {
        ...payload,
        regular_price: price,
        sale_price: salePrice || "",
        type: "simple",
      };
    }

    const res = await fetch("https://spare2app.com/wp-json/wc/v3/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const newProduct = await res.json();
    return NextResponse.json(newProduct);
  } catch (err) {
    return NextResponse.json({ error: "فشل إضافة المنتج" }, { status: 500 });
  }
}

// PATCH: تعديل منتج (الاسم، السعر، الحالة)
export async function PATCH(req) {
  try {
    const token = await getToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, price, status, sale_price, manage_stock, stock_quantity } = body;

    const res = await fetch(`https://spare2app.com/wp-json/wc/v3/products/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        price,
        regular_price: price,   // السعر الأساسي
        sale_price: sale_price || "", // لو محدد سعر عرض
        status,
        manage_stock: manage_stock || false,
        stock_quantity: manage_stock ? stock_quantity : null,
      }),
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const updatedProduct = await res.json();
    return NextResponse.json(updatedProduct);
  } catch (err) {
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}
