// app/api/products/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// وظيفة لجلب التوكن من الكوكيز
async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

// جلب المنتجات من WooCommerce
async function fetchProducts({ page = 1, per_page = 12, search = "", status = "all" }) {
  const token = await getToken();
  if (!token) throw new Error("Unauthorized");

  const query = new URLSearchParams();
  query.set("page", page);
  query.set("per_page", per_page);
  if (search) query.set("search", search);
  if (status !== "all") query.set("status", status);

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
  const data = await res.json();
  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");
  return { products: data, totalPages };
}

// GET: جلب المنتجات
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const per_page = parseInt(searchParams.get("per_page") || "12");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";

  try {
    const data = await fetchProducts({ page, per_page, search, status });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: إضافة منتج جديد
export async function POST(req) {
  try {
    const token = await getToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, price, salePrice, imageUrl, status } = body;

    const res = await fetch("https://spare2app.com/wp-json/wc/v3/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        price,
        regular_price: price,
        sale_price: salePrice || "",
        status: status || "publish",
        images: imageUrl ? [{ src: imageUrl }] : [],
      }),
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const newProduct = await res.json();
    return NextResponse.json(newProduct);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل إضافة المنتج" }, { status: 500 });
  }
}

// PATCH: تعديل منتج (الاسم، السعر، الحالة)
export async function PATCH(req) {
  try {
    const token = await getToken();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, price, status, sale_price } = body;

    const res = await fetch(`https://spare2app.com/wp-json/wc/v3/products/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        regular_price: price,   // السعر الأساسي
        price,                  // بيتساوي مع الريجولار
        sale_price: sale_price || "", // لو محدد سعر عرض
        status,
      }),
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const updatedProduct = await res.json();
    return NextResponse.json(updatedProduct);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}
