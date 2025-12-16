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
      console.error('Categories API Error:', categoriesRes.status);
      return [];
    }

    const rawData = await categoriesRes.json();
    
    // 🔧 التعامل مع response format المختلف
    let categoriesArray = [];
    
    if (Array.isArray(rawData)) {
      categoriesArray = rawData;
    } else if (rawData.categories && Array.isArray(rawData.categories)) {
      categoriesArray = rawData.categories;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      categoriesArray = rawData.data;
    } else {
      console.error('Invalid categories response format:', typeof rawData);
      return [];
    }
    
    // التصنيفات جاهزة مع عدد المنتجات
    const formattedCategories = categoriesArray.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count || 0,
      // 🔧 إصلاح: تحويل image object إلى string URL
      image: typeof cat.image === 'object' && cat.image?.src ? cat.image.src : (cat.image || null)
    }));
    
    console.log(`✅ Products API: Loaded ${formattedCategories.length} categories`);
    return formattedCategories;
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return [];
  }
}

// جلب المنتجات من WooCommerce (مع دعم pagination للأرقام الكبيرة)
async function fetchProducts({ page = 1, per_page = 12, search = "", status = "all", category = "" }) {
  const token = await getToken();
  if (!token) throw new Error("Unauthorized");

  // 🔧 WooCommerce API الحد الأقصى لـ per_page هو 100
  const maxPerPage = 100;
  const requestedPerPage = parseInt(per_page);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
  
  // إذا الطلب أكبر من 100، نستخدم pagination
  if (requestedPerPage > maxPerPage) {
    console.log(`📊 Requested ${requestedPerPage} products, fetching via pagination...`);
    
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("per_page", maxPerPage.toString());
    if (search) query.set("search", search);
    if (status !== "all") query.set("status", status);
    if (category) query.set("category", category);

    // جلب الصفحة الأولى
    const firstRes = await fetch(
      `${API_BASE}/wp-json/wc/v3/products?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!firstRes.ok) {
      const errorText = await firstRes.text();
      console.error(`❌ WooCommerce API Error: ${firstRes.status}`, errorText);
      throw new Error(`API Error: ${firstRes.status}`);
    }

    const firstPageProducts = await firstRes.json();
    const totalProducts = parseInt(firstRes.headers.get("X-WP-Total") || "0");
    const totalPages = parseInt(firstRes.headers.get("X-WP-TotalPages") || "1");
    
    console.log(`📈 Total products: ${totalProducts}, Total pages: ${totalPages}`);
    
    let allProducts = [...firstPageProducts];
    
    // حساب عدد الصفحات المطلوبة
    const pagesNeeded = Math.min(Math.ceil(requestedPerPage / maxPerPage), totalPages);
    
    // جلب باقي الصفحات
    if (pagesNeeded > 1) {
      console.log(`🔄 Fetching ${pagesNeeded - 1} more pages...`);
      
      const pagePromises = [];
      for (let p = 2; p <= pagesNeeded; p++) {
        const pageQuery = new URLSearchParams();
        pageQuery.set("page", p.toString());
        pageQuery.set("per_page", maxPerPage.toString());
        if (search) pageQuery.set("search", search);
        if (status !== "all") pageQuery.set("status", status);
        if (category) pageQuery.set("category", category);
        
        pagePromises.push(
          fetch(`${API_BASE}/wp-json/wc/v3/products?${pageQuery.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }).then(res => res.ok ? res.json() : [])
        );
      }
      
      const remainingPages = await Promise.all(pagePromises);
      remainingPages.forEach(pageData => {
        allProducts = [...allProducts, ...pageData];
      });
      
      console.log(`✅ Fetched ${allProducts.length} products from ${pagesNeeded} pages`);
    }
    
    // قص النتائج للعدد المطلوب بالضبط
    const finalProducts = allProducts.slice(0, requestedPerPage);
    
    return {
      products: finalProducts,
      pagination: { 
        totalPages: Math.ceil(totalProducts / requestedPerPage),
        totalProducts: totalProducts,
        returnedCount: finalProducts.length
      }
    };
  }
  
  // للطلبات 100 أو أقل، استخدام الطريقة العادية
  const query = new URLSearchParams();
  query.set("page", page);
  query.set("per_page", per_page);
  if (search) query.set("search", search);
  if (status !== "all") query.set("status", status);
  if (category) query.set("category", category);

  const res = await fetch(
    `${API_BASE}/wp-json/wc/v3/products?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ WooCommerce API Error: ${res.status}`, errorText);
    throw new Error(`API Error: ${res.status}`);
  }
  
  const products = await res.json();
  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");
  
  return { 
    products,
    pagination: { totalPages } 
  };
}

// 🆕 جلب variations للمنتج المتغير
async function fetchVariations(productId, token) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
  
  try {
    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${productId}/variations?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error(`❌ Error fetching variations for product ${productId}:`, res.status);
      return [];
    }

    const variations = await res.json();
    
    // تنسيق الـ variations لسهولة الاستخدام
    return variations.map(v => ({
      id: v.id,
      sku: v.sku || '',
      price: v.price || v.regular_price || '0',
      regular_price: v.regular_price || '0',
      sale_price: v.sale_price || '',
      stock_quantity: v.stock_quantity || 0,
      manage_stock: v.manage_stock || false,
      in_stock: v.stock_status === 'instock',
      purchasable: v.purchasable || false,
      attributes: v.attributes || [], // [{name: "اللون", option: "أحمر"}]
      image: v.image?.src || null,
      // نص وصفي للـ variation (مثل: "أحمر - M")
      description: v.attributes?.map(a => a.option).join(' - ') || ''
    }));
  } catch (error) {
    console.error(`❌ Error fetching variations for product ${productId}:`, error);
    return [];
  }
}

// GET: جلب المنتجات والتصنيفات
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const per_page = parseInt(searchParams.get("per_page") || "12");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  // دائماً نجلب المنتجات المنشورة فقط
  const status = "publish";

  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // جلب المنتجات والتصنيفات معاً
    const [data, categories] = await Promise.all([
      fetchProducts({ page, per_page, search, status, category }),
      fetchCategories(token)
    ]);

    // 🆕 جلب variations للمنتجات المتغيرة
    const includeVariations = searchParams.get("include_variations") === "true";
    
    if (includeVariations && data.products) {
      console.log(`🔀 Fetching variations for ${data.products.length} products...`);
      
      // جلب variations للمنتجات من نوع variable فقط
      const variableProducts = data.products.filter(p => p.type === 'variable');
      
      if (variableProducts.length > 0) {
        const variationsPromises = variableProducts.map(product =>
          fetchVariations(product.id, token).then(variations => ({
            productId: product.id,
            variations
          }))
        );
        
        const variationsResults = await Promise.all(variationsPromises);
        
        // إضافة variations لكل منتج
        const variationsMap = {};
        variationsResults.forEach(result => {
          variationsMap[result.productId] = result.variations;
        });
        
        data.products = data.products.map(product => {
          if (product.type === 'variable' && variationsMap[product.id]) {
            return {
              ...product,
              variations: variationsMap[product.id],
              variations_count: variationsMap[product.id].length
            };
          }
          return product;
        });
        
        console.log(`✅ Added variations for ${variableProducts.length} variable products`);
      }
    }

    console.log(`📦 Products API Response: ${data.products?.length || 0} products, ${categories?.length || 0} categories`);

    return NextResponse.json({
      ...data,
      categories
    });
  } catch (err) {
    console.error('❌ Products API Error:', err);
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
