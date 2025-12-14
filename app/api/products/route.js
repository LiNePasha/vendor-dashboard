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
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
  
  try {
    // 🆕 استخدام API المخصص للتصنيفات
    // فك التوكن لجلب vendor ID
    function decodeToken(token) {
      try {
        const payload = token.split('.')[1];
        return JSON.parse(Buffer.from(payload, 'base64').toString());
      } catch {
        return null;
      }
    }

    const decoded = decodeToken(token);
    const vendorId = decoded?.data?.user?.id;

    if (!vendorId) {
      throw new Error('Vendor ID not found in token');
    }

    // جلب التصنيفات من الـ API المخصص
    const categoriesRes = await fetch(
      `${API_BASE}/wp-json/spare2app/v2/store/${vendorId}/categories?consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!categoriesRes.ok) {
      throw new Error(`Categories API Error: ${categoriesRes.status}`);
    }

    const categories = await categoriesRes.json();
    
    // التصنيفات جاهزة مع عدد المنتجات
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count || 0
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
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

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

  // 1. Fetch products
  const res = await fetch(
    `${API_BASE}/wp-json/wc/v3/products?${query.toString()}`,
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
  
  return { 
    products,
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
    const { name, price, salePrice, imageUrl, whatsapp, type, sku } = body;

    let payload = {
      name,
      sku: sku || "",
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
      }
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const res = await fetch(`${API_BASE}/wp-json/wc/v3/products`, {
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
    const { id, name, price, status, sale_price, manage_stock, stock_quantity, sku, imageUrl } = body;

    // 🆕 بناء بيانات المنتج
    const productData = {
      name,
      sku: sku || "",
      price,
      regular_price: price,   // السعر الأساسي
      sale_price: sale_price || "", // لو محدد سعر عرض
      status,
      manage_stock: manage_stock || false,
      stock_quantity: manage_stock ? stock_quantity : null,
    };

    // 🆕 إضافة الصورة لو موجودة
    if (imageUrl) {
      productData.images = [{ src: imageUrl }];
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const res = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(productData),
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const updatedProduct = await res.json();
    return NextResponse.json(updatedProduct);
  } catch (err) {
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}
