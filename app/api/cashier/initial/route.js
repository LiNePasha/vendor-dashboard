import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cashier API Proxy - Initial Sync
 * 
 * Fetches all products from the new ultra-fast Cashier API
 */

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

function getProductPurchasePrice(product) {
  const purchasePriceMeta = product.meta_data?.find(meta =>
    meta.key === 'purchase_price' || meta.key === '_purchase_price'
  );
  const purchasePrice = purchasePriceMeta?.value ?? product.purchase_price;
  const numericPrice = Number(purchasePrice);
  return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null;
}

async function addPurchasePrices(products, API_BASE) {
  const productsWithPriceStatus = products.map(product => {
    const purchasePrice = getProductPurchasePrice(product);
    return {
      ...product,
      ...(purchasePrice !== null ? { purchase_price: purchasePrice } : {}),
      purchase_price_checked: purchasePrice !== null || product.purchase_price_checked === true,
    };
  });
  const productsNeedingPrice = productsWithPriceStatus.filter(product =>
    !product.purchase_price_checked && product.id
  );

  for (let index = 0; index < productsNeedingPrice.length; index += 100) {
    const batch = productsNeedingPrice.slice(index, index + 100);
    const query = new URLSearchParams({
      include: batch.map(product => product.id).join(','),
      per_page: String(batch.length),
      status: 'any',
      consumer_key: process.env.WC_CONSUMER_KEY || '',
      consumer_secret: process.env.WC_CONSUMER_SECRET || '',
    });

    try {
      const response = await fetch(`${API_BASE}/wp-json/wc/v3/products?${query}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`WooCommerce purchase price lookup failed: ${response.status}`);
      }

      const productsWithMetadata = await response.json();
      const metadataById = new Map(
        productsWithMetadata.map(product => [String(product.id), getProductPurchasePrice(product)])
      );
      batch.forEach(product => {
        const purchasePrice = metadataById.get(String(product.id));
        product.purchase_price_checked = true;
        if (purchasePrice !== null && purchasePrice !== undefined) {
          product.purchase_price = purchasePrice;
        }
      });
    } catch (error) {
      console.error('Failed to preload product purchase prices:', error);
      batch.forEach(product => {
        product.purchase_price_lookup_error = true;
      });
    }
  }

  return productsWithPriceStatus;
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = decodeToken(token);
    const ownVendorId = decoded?.data?.user?.id;
    const roles = decoded?.data?.user?.roles || [];

    if (!ownVendorId) {
      return NextResponse.json({ error: 'Vendor ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') || 'true';
    const page = searchParams.get('page') || '1';
    const per_page = searchParams.get('per_page') || '100';
    const requestedVendorId = searchParams.get('vendor_id') || '';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // ✅ كشف الأدمن
    const userRoleCookie = cookieStore.get('userRole')?.value;
    const isAdmin = userRoleCookie === 'admin' ||
      roles.includes('administrator') ||
      roles.includes('shop_manager');

    // الأدمن بدون تاجر محدد → جلب كل المنتجات عبر wc/v3/products مع pagination
    if (isAdmin && !requestedVendorId) {
      const pageNum = parseInt(page) || 1;
      const perPageNum = Math.min(parseInt(per_page) || 50, 100);
      
      const wcUrl = `${API_BASE}/wp-json/wc/v3/products?page=${pageNum}&per_page=${perPageNum}&status=any&consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;
      const wcRes = await fetch(wcUrl, { headers: { "Content-Type": "application/json" } });
      
      if (!wcRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: wcRes.status });
      }
      
      const products = await wcRes.json();
      const productsWithPurchasePrices = await addPurchasePrices(products, API_BASE);
      const totalPages = parseInt(wcRes.headers.get('X-WP-TotalPages') || '1');
      const totalProducts = parseInt(wcRes.headers.get('X-WP-Total') || '0');

      console.log(`⚡ Admin: Fetched page ${pageNum} - ${productsWithPurchasePrices.length} products (${totalProducts} total)`);

      return NextResponse.json({ 
        products: productsWithPurchasePrices,
        categories: [],
        pagination: {
          page: pageNum,
          per_page: perPageNum,
          total: totalProducts,
          totalPages: totalPages
        }
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // الأدمن مع تاجر محدد OR تاجر عادي
    const vendorId = (isAdmin && requestedVendorId) ? requestedVendorId : ownVendorId;
    
    // 🚀 استخدام الـ Cashier API الجديد مع all=true
    const url = `${API_BASE}/wp-json/cashier/v1/store/${vendorId}/pos-initial?all=${all}&page=${page}&per_page=${per_page}`;
    
    console.log(`⚡ Fetching from Cashier API: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      cache: 'no-store', // 🔥 منع Next.js من عمل cache
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Cashier API Error: ${res.status}`, errorText);
      return NextResponse.json(
        { error: `API Error: ${res.status}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    if (Array.isArray(data.products)) {
      data.products = await addPurchasePrices(data.products, API_BASE);
    }
    
    console.log(`✅ Cashier API Success: ${data.products?.length || 0} products (Cache: ${data.metadata?.cache})`);
    
    // 🔥 إرجاع response مع headers لمنع الـ cache
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (err) {
    console.error('❌ Cashier Initial Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
