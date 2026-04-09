"use client";

import { useState, useEffect, useMemo } from "react";

// 🔧 دالة معالجة الأحرف العربية (نفس الكاشير)
const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ء')
    .replace(/[ة]/g, 'ه')  // تاء مربوطة → هاء
    .replace(/[\u064B-\u065F]/g, ''); // إزالة التشكيل
};
import ProductFormModal from "@/components/ProductFormModal";
import BulkUploadModal from "@/components/BulkUploadModal";
import InvoiceUploadModal from "@/components/InvoiceUploadModal";
import BundleLinkModal from "@/components/BundleLinkModal";
import Link from "next/link";
import { productsCacheStorage } from "@/app/lib/localforage";
import { getVendorLogo } from "@/app/lib/vendor-constants";
import usePOSStore from "@/app/stores/pos-store";

// Simple in-module dedupe to prevent duplicate network calls (e.g., React StrictMode double-mount in dev)
let __products_fetch_in_flight = false;

// Toast Component
function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed px-5 py-3 rounded-xl shadow-2xl text-white z-[100000000000] transition-all animate-slideUp backdrop-blur-sm font-semibold flex items-center gap-3 ${
        type === "success"
          ? "bg-gradient-to-r from-green-500 to-green-600 bottom-5 left-1/2 -translate-x-1/2"
          : "bg-gradient-to-r from-red-500 to-red-600 top-12 left-1/2 -translate-x-1/2"
      }`}
    >
      <span className="text-xl">{type === "success" ? "✓" : "⚠️"}</span>
      <span>{message}</span>
      <button 
        className="ml-2 hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-all" 
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

// Skeleton Loader
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-0 flex flex-col animate-pulse border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-44 w-full" />
      <div className="p-3 space-y-2">
        <div className="bg-gray-200 h-4 w-full rounded" />
        <div className="bg-gray-200 h-4 w-3/4 rounded" />
        <div className="bg-gray-200 h-6 w-1/2 rounded mt-3" />
        <div className="flex gap-2 mt-3">
          <div className="bg-gray-200 h-8 flex-1 rounded-lg" />
          <div className="bg-gray-200 h-8 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Modal تكبير الصورة
function ImageModal({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold backdrop-blur-md transition-all z-10"
      >
        ×
      </button>
      <img
        src={src}
        alt="product"
        className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Main Products Page
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [loading, setLoading] = useState(true); // 🔥 Start true للتحميل الأولي
  const [searching, setSearching] = useState(false); // 🔍 Loading للبحث
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterImages, setFilterImages] = useState("all"); // all, no-images
  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showInvoiceUpload, setShowInvoiceUpload] = useState(false);
  const [showProductLinks, setShowProductLinks] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Get vendor info for logo fallback
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const vendorLogo = getVendorLogo(vendorInfo?.id);

  // Debounce state - يجب أن يكون قبل استخدامه في useMemo
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [searchRequestId, setSearchRequestId] = useState(0);
  const abortControllerRef = useState(() => ({ current: null }))[0];

  // 🔍 Frontend filtering - نظام بحث ذكي مع Scoring (نفس الكاشير)
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // فلترة حسب الكاتجوري
    if (category && category !== 'all') {
      filtered = filtered.filter(product =>
        product.categories?.some(cat => cat.id === parseInt(category))
      );
    }

    // فلترة حسب الحالة
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter(product => product.status === filterStatus);
    }

    // 🖼️ فلترة حسب الصور - المنتجات بدون صور
    if (filterImages === 'no-images') {
      filtered = filtered.filter(product => {
        // تحقق بس من صورة المنتج الأساسية (مش المتغيرات لأنها مش محملة في الليست)
        const hasNoImage = !product.images || 
                         product.images.length === 0 || 
                         !product.images[0]?.src || 
                         product.images[0].src === '';
        
        if (hasNoImage) {
          console.log('✅ منتج بدون صورة:', product.name, product.id, 'type:', product.type);
        }
        
        return hasNoImage;
      });
      console.log(`🖼️ فلتر بدون صور: وجدنا ${filtered.length} منتج`);
    }

    // فلترة حسب البحث - نسخة محسّنة مع Scoring والترتيب حسب الدقة + معالجة الأحرف العربية
    if (debouncedSearch.trim()) {
      const searchWords = normalizeArabic(debouncedSearch.toLowerCase().trim()).split(/\s+/);
      
      filtered = filtered
        .map(product => {
          const productName = normalizeArabic(product.name?.toLowerCase() || '');
          const productSku = normalizeArabic(product.sku?.toLowerCase() || '');
          const productBarcode = normalizeArabic(product.barcode?.toLowerCase() || '');
          const categoryNames = product.categories?.map(c => normalizeArabic(c.name?.toLowerCase() || '')).join(' ') || '';
          
          // أولاً: تحقق إن كل الكلمات موجودة (شرط أساسي)
          const allWordsMatch = searchWords.every(word =>
            productName.includes(word) || productSku.includes(word) || productBarcode.includes(word) || categoryNames.includes(word)
          );
          
          if (!allWordsMatch) {
            return null; // لو مش كل الكلمات موجودة، استبعد المنتج
          }
          
          // حساب Score للترتيب (بس للمنتجات اللي فيها كل الكلمات)
          let score = 0;
          
          searchWords.forEach(word => {
            // بحث في الاسم
            if (productName.includes(word)) {
              score += 10;
              // بونص لو الكلمة في البداية
              if (productName.startsWith(word)) score += 20;
            }
            
            // بحث في SKU (أولوية عالية)
            if (productSku.includes(word)) {
              score += 50;
              if (productSku === word) score += 100; // Match كامل
            }
            
            // بحث في الباركود (أولوية عالية جداً)
            if (productBarcode && productBarcode.includes(word)) {
              score += 200;
              if (productBarcode === word) score += 500; // Match كامل
            }
            
            // بحث في الكاتيجوري (أولوية متوسطة)
            if (categoryNames.includes(word)) {
              score += 5;
            }
          });
          
          // بونص إضافي لو كل الكلمات موجودة في الاسم لوحده
          const allWordsInName = searchWords.every(word => productName.includes(word));
          if (allWordsInName) score += 15;
          
          return { product, score };
        })
        .filter(item => item !== null) // استبعاد المنتجات المرفوضة
        .sort((a, b) => b.score - a.score) // ترتيب حسب الـ Score (الأعلى أولاً)
        .map(item => item.product); // استخراج المنتجات
    }

    return filtered;
  }, [products, category, filterStatus, filterImages, debouncedSearch]);

  // 🔥 إضافة unique keys للمنتجات (مثل الكاشير تماماً)
  const productsWithUniqueKeys = useMemo(() => {
    // أولاً: de-duplication كامل بناءً على ID
    const seen = new Set();
    const uniqueProducts = [];
    
    filteredProducts.forEach((product, index) => {
      if (!seen.has(product.id)) {
        seen.add(product.id);
        uniqueProducts.push({
          ...product,
          uniqueKey: `prod_${product.id}_${index}` // استخدام index للتأكد من uniqueness
        });
      }
    });
    
    console.log(`🔍 Filtered: ${filteredProducts.length} products, Unique: ${uniqueProducts.length} products`);
    
    return uniqueProducts;
  }, [filteredProducts]);

  // ⏱️ Debouncing للبحث - تأخير 300ms بعد توقف الكتابة (نفس الكاشير)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial load only - تحميل كل المنتجات مرة واحدة
  useEffect(() => {
    if (!initialized) {
      fetchProducts();
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // دالة تحميل الفئات من /api/categories
  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch('/api/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل تحميل التصنيفات');
      const data = await res.json();
      let categoriesArray = [];
      if (data && data.categories && Array.isArray(data.categories)) {
        categoriesArray = data.categories;
      } else if (Array.isArray(data)) {
        categoriesArray = data;
      } else {
        throw new Error('البيانات المستلمة غير صالحة');
      }
      setCategories(categoriesArray);
    } catch (error) {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // 🚀 تحميل كل المنتجات مرة واحدة (مثل الكاشير)
  const fetchProducts = async (forceRefresh = false) => {
    if (__products_fetch_in_flight && !forceRefresh) {
      return;
    }
    __products_fetch_in_flight = true;
    try {
      // محاولة تحميل من الكاش أولاً
      if (!forceRefresh) {
        const cache = await productsCacheStorage.getCache();
        if (cache && cache.products && cache.products.length > 0) {
          setProducts(cache.products);
          setCategories(cache.categories || []);
          setLoading(false);
          // تحقق من freshness
          const isStale = await productsCacheStorage.isCacheStale(3 * 60 * 1000);
          if (!isStale) {
            __products_fetch_in_flight = false;
            return;
          }
          // الكاش قديم، استمر في التحميل في الخلفية
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }
      
      // 🚀 استخدام Cashier API مع all=true - أسرع وأكثر كفاءة (نفس الكاشير)
      const timestamp = Date.now();
      const res = await fetch(`/api/cashier/initial?all=true&_t=${timestamp}`, {
        credentials: "include",
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!res.ok) throw new Error("فشل جلب المنتجات");
      const data = await res.json();
      
      // Cashier API بيرجع البيانات مباشرة بدون success flag
      const allProducts = data.products || [];
      const allCategories = data.categories || [];
      
      // 🔥 إزالة المنتجات المكررة بناءً على ID
      const uniqueProducts = Array.from(
        new Map(allProducts.map(p => [p.id, p])).values()
      );
      
      console.log(`✅ تم تحميل ${allProducts.length} منتج (${uniqueProducts.length} منتج فريد) من Cashier API`);
      
      setProducts(uniqueProducts);
      setCategories(allCategories);
      
      // 💾 حفظ في الكاش
      await productsCacheStorage.saveCache(
          uniqueProducts,
          allCategories,
          { totalPages, total: uniqueProducts.length }
      );

      setLoading(false);
    } catch (error) {
      console.error("فشل جلب المنتجات:", error);
      setToast({ message: "فشل تحميل المنتجات", type: "error" });
      setLoading(false);
    } finally {
      __products_fetch_in_flight = false;
    }
  };

  // دالة بتضيف المنتج الجديد على طول في الـ state والـ cache
  const handleAdded = async (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]); // يضيفه أول القائمة
    await productsCacheStorage.addProductToCache(newProduct); // إضافة للـ cache
  };

  const handleUpdateProduct = async (updatedData) => {
    // 1) Optimistic UI update immediately (state + cache)
    const productId = updatedData.id;
    
    // 🔥 الحصول على المنتج الحالي من القائمة
    const currentProduct = products.find(p => p.id === productId);
    if (!currentProduct) return; // لو المنتج مش موجود
    
    const isManageStock = typeof updatedData.manage_stock !== 'undefined' ? !!updatedData.manage_stock : !!currentProduct?.manage_stock;
    const newQty = isManageStock ? Number(updatedData.stock_quantity ?? currentProduct?.stock_quantity ?? 0) : null;

    const optimisticUpdate = (p) => {
      if (p.id !== productId) return p;
      return {
        ...p,
        name: typeof updatedData.name !== 'undefined' ? updatedData.name : p.name,
        sku: typeof updatedData.sku !== 'undefined' ? updatedData.sku : p.sku,
        status: typeof updatedData.status !== 'undefined' ? updatedData.status : p.status,
        price: typeof updatedData.price !== 'undefined' ? updatedData.price : p.price,
        regular_price: typeof updatedData.price !== 'undefined' ? updatedData.price : p.regular_price,
        sale_price: typeof updatedData.sale_price !== 'undefined' ? (updatedData.sale_price || "") : p.sale_price,
        manage_stock: isManageStock,
        stock_quantity: isManageStock ? (newQty ?? 0) : p.stock_quantity,
        images: updatedData.imageUrl ? [{ src: updatedData.imageUrl }] : p.images,
      };
    };

    setProducts((prev) => prev.map(optimisticUpdate));
    
    // Update cache too
    await productsCacheStorage.updateProductInCache(productId, {
      name: updatedData.name,
      sku: updatedData.sku,
      status: updatedData.status,
      price: updatedData.price,
      regular_price: updatedData.price,
      sale_price: updatedData.sale_price,
      manage_stock: isManageStock,
      stock_quantity: isManageStock ? (newQty ?? 0) : undefined,
      images: updatedData.imageUrl ? [{ src: updatedData.imageUrl }] : undefined,
    });

    // Show lightweight toast
    setToast({ message: 'تم حفظ التعديل مؤقتًا وسيتم التحقق خلال 15 ثانية', type: 'success' });
    setTimeout(() => setToast(null), 2500);
    // Do not block UI
    setUpdating(false);

    // 2) Fire-and-forget remote PATCH
    (async () => {
      try {
        const res = await fetch("/api/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...updatedData,
            manage_stock: true // 🆕 تأكيد تفعيل إدارة المخزون
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setToast({ message: data?.error || data?.message || 'تعذر تحديث المنتج على الخادم، سيُعاد التحقق قريبًا', type: 'error' });
          setTimeout(() => setToast(null), 2500);
        } else {
          // 🆕 Re-fetch المنتج من السيرفر بعد نجاح التحديث
          try {
            const fetchRes = await fetch(`/api/products/${productId}`, {
              credentials: "include",
            });
            if (fetchRes.ok) {
              const fetchData = await fetchRes.json();
              const serverProduct = fetchData.product;
              
              // Update state with server data
              setProducts((prev) => prev.map((p) => 
                p.id === productId ? { ...p, ...serverProduct } : p
              ));
              
              // Update cache
              await productsCacheStorage.updateProductInCache(productId, serverProduct);
              
              setToast({ message: 'تم تحديث المنتج بنجاح ✓', type: 'success' });
              setTimeout(() => setToast(null), 2500);
            }
          } catch (fetchErr) {
            console.error('Failed to re-fetch product:', fetchErr);
          }
        }
      } catch (err) {
        setToast({ message: 'حدث خطأ أثناء تحديث الخادم، سيُعاد التحقق قريبًا', type: 'error' });
        setTimeout(() => setToast(null), 2500);
      }
    })();

    // 3) Delayed verification after 15s (like invoices)
    if (isManageStock) {
      setTimeout(async () => {
        try {
          const verifyRes = await fetch('/api/pos/verify-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ updates: [{ productId, expectedQuantity: Number(newQty ?? 0) }] })
          });
          const verifyData = await verifyRes.json();
          const result = Array.isArray(verifyData.results) ? verifyData.results.find(r => r.productId === productId) : null;
          if (result && result.body) {
            const serverQty = typeof result.body.stock_quantity !== 'undefined' ? Number(result.body.stock_quantity) : null;
            if (serverQty !== null && serverQty !== Number(newQty ?? 0)) {
              // Reconcile mismatch from server (state + cache)
              setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, stock_quantity: serverQty } : p));
              await productsCacheStorage.updateProductInCache(productId, { stock_quantity: serverQty });
              setToast({ message: 'تمت مزامنة المخزون مع الخادم', type: 'success' });
              setTimeout(() => setToast(null), 2500);
            }
          }
        } catch (e) {
          // Silently handle verification error
        }
      }, 15000);
    }
  };

  // دالة حذف منتج
  const handleDeleteProduct = async (productId) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || 'فشل حذف المنتج');
      }

      // حذف من الـ state
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      
      // حذف من الـ cache
      await productsCacheStorage.removeProductFromCache(productId);
      
      setToast({ message: '✅ تم حذف المنتج بنجاح', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      setDeletingProduct(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      setToast({ message: `❌ ${error.message}`, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const nextPage = () => page < totalPages && setPage(page + 1);
  const prevPage = () => page > 1 && setPage(page - 1);

  const handleQuickAddSuccess = async (newProduct) => {
    // Add to state and cache
    setProducts((prev) => [newProduct, ...prev]);
    await productsCacheStorage.addProductToCache(newProduct);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">📦 إدارة المنتجات</h1>
              <p className="text-sm text-gray-500">
                {loading ? 'جاري التحميل...' : `${products.length} منتج في الصفحة الحالية`}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-2 flex-wrap">
              <button
                onClick={() => setShowBundleModal(true)}
                className="bg-gradient-to-r from-orange-600 to-red-700 text-white px-3 sm:px-5 py-2.5 rounded-lg hover:from-orange-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2 text-sm"
                title="إنشاء حزمة منتجات أونلاين"
              >
                <span className="text-lg">🔗</span>
                <span className="hidden lg:inline">حزمة منتجات</span>
                <span className="lg:hidden">حزمة</span>
              </button>
              <button
                onClick={() => setShowInvoiceUpload(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-3 sm:px-5 py-2.5 rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2 text-sm"
                title="رفع صورة فاتورة لاستخراج المنتجات تلقائياً بالذكاء الاصطناعي"
              >
                <span className="text-lg">📸</span>
                <span className="hidden lg:inline">رفع فاتورة</span>
                <span className="lg:hidden">فاتورة</span>
              </button>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-3 sm:px-5 py-2.5 rounded-lg hover:from-green-700 hover:to-emerald-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2 text-sm"
              >
                <span className="text-lg">➕</span>
                <span className="hidden lg:inline">إضافة منتج</span>
                <span className="lg:hidden">إضافة</span>
              </button>
              <Link
                href="/warehouse"
                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-3 sm:px-5 py-2.5 rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2 text-sm col-span-2 sm:col-span-1"
              >
                <span className="text-lg">📦</span>
                <span className="hidden lg:inline">إدارة المخزن</span>
                <span className="lg:hidden">مخزن</span>
              </Link>
            </div>
          </div>

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <span className="font-semibold">💡 ملاحظة:</span> المنتجات الجديدة يتم إضافتها وإدارتها من خلال نظام المخزن.
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-col gap-3">
            {/* Search - Full width on mobile */}
            <div className="w-full relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {searching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                ) : (
                  '🔍'
                )}
              </span>
              <input
                type="text"
                placeholder="ابحث بالاسم أو SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-4 pr-10 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searching && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-medium">
                  جاري البحث...
                </span>
              )}
            </div>
            
            {/* Filters Row - 3 selects + refresh button */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <select
                className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium text-sm"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                disabled={loading}
              >
                <option value="all">{loading ? 'جاري التحميل...' : '🏷️ كل الفئات'}</option>
                {Array.isArray(categories) &&
                  categories
                    .filter(c => c.count > 0)
                    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.count ? ` (${c.count})` : ''}</option>
                    ))}
              </select>
              <select
                className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">📊 كل الحالات</option>
                <option value="publish">✓ منشور</option>
                <option value="draft">✎ مسودة</option>
                <option value="pending">⏳ قيد المراجعة</option>
                <option value="private">🔒 خاص</option>
                <option value="future">📅 مجدول</option>
              </select>
              <select
                className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white font-medium text-sm"
                value={filterImages}
                onChange={(e) => setFilterImages(e.target.value)}
              >
                <option value="all">🖼️ كل المنتجات</option>
                <option value="no-images">🚫 بدون صور</option>
              </select>
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setFilterStatus('all');
                  setFilterImages('all');
                  fetchProducts(true); // 🔥 Force refresh
                }}
                disabled={loading}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all font-medium text-sm"
                title="تحديث المنتجات من السيرفر"
              >
                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                <span>تحديث</span>
              </button>
            </div>
          </div>
        </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16">
          {search || category !== 'all' || filterStatus !== 'all' || filterImages !== 'all' ? (
            // رسالة عدم وجود نتائج بحث
            <>
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-700 text-xl font-semibold mb-2">لا توجد نتائج</p>
              <p className="text-gray-500 text-sm mb-4">
                {search && `لم نجد أي منتجات تطابق "${search}"`}
                {!search && 'لا توجد منتجات تطابق الفلاتر المحددة'}
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setFilterStatus('all');
                  setFilterImages('all');
                }}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                🔄 إعادة تعيين البحث
              </button>
            </>
          ) : (
            // رسالة عدم وجود منتجات أصلاً
            <>
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-500 text-lg">لا توجد منتجات حتى الآن</p>
              <Link
                href="/warehouse/add"
                className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                أضف منتج جديد
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {productsWithUniqueKeys.map((product) => {
            // 🎨 حساب المخزون للمنتجات المتعددة (Variable Products)
            let stockQty = product.stock_quantity ?? 0;
            let manageStock = product.manage_stock;
            
            // إذا كان المنتج متعدد (variable) وعنده variations، نجمع المخزون من كل الـ variations
            if (product.type === 'variable' && product.variations && Array.isArray(product.variations)) {
              const totalVariationsStock = product.variations.reduce((total, variation) => {
                // نجمع فقط الـ variations اللي بتدير المخزون
                if (variation.manage_stock && variation.stock_quantity) {
                  return total + (Number(variation.stock_quantity) || 0);
                }
                return total;
              }, 0);
              
              // لو في variations بتدير المخزون، نستخدم المجموع
              const hasStockManagement = product.variations.some(v => v.manage_stock);
              if (hasStockManagement) {
                stockQty = totalVariationsStock;
                manageStock = true;
              }
            }
            
            const isLowStock = manageStock && stockQty > 0 && stockQty <= 5;
            const isOutOfStock = manageStock && stockQty === 0;
            
            return (
              <div
                key={product.uniqueKey}
                className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col border border-gray-100 overflow-hidden group"
              >
                {/* Image Container */}
                <div className="relative w-full h-44 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer">
                  <img
                    src={product.images?.[0]?.src || vendorLogo || "/placeholder.webp"}
                    alt={product.name}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onClick={() => setImageModal(product.images?.[0]?.src || vendorLogo)}
                  />
                  
                  {/* Status Badge - Top Left */}
                  <span
                    className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-white text-[10px] font-bold shadow-lg backdrop-blur-sm ${
                      product.status === "publish"
                        ? "bg-gradient-to-r from-green-500 to-green-600"
                        : product.status === "draft"
                        ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                        : product.status === "pending"
                        ? "bg-gradient-to-r from-orange-500 to-orange-600"
                        : product.status === "private"
                        ? "bg-gradient-to-r from-purple-500 to-purple-600"
                        : product.status === "future"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600"
                        : "bg-gradient-to-r from-gray-500 to-gray-600"
                    }`}
                  >
                    {product.status === "publish"
                      ? "✓ منشور"
                      : product.status === "draft"
                      ? "✎ مسودة"
                      : product.status === "pending"
                      ? "⏳ مراجعة"
                      : product.status === "private"
                      ? "🔒 خاص"
                      : product.status === "future"
                      ? "📅 مجدول"
                      : product.status}
                  </span>

                  {/* Stock Badge - Top Right */}
                  {manageStock && (
                    <div className="absolute top-2 right-2">
                      {isOutOfStock ? (
                        <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg backdrop-blur-sm">
                          نفذ المخزون
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2.5 py-1 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow-lg backdrop-blur-sm">
                          ⚠️ {stockQty} متبقي
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-600/90 text-white text-[10px] font-semibold rounded-full shadow-lg backdrop-blur-sm">
                          📦 {stockQty}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sale Badge - Bottom Right */}
                  {product.sale_price && (
                    <div className="absolute bottom-2 right-2 bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg">
                      🔥 تخفيض
                    </div>
                  )}

                  {/* Variable Product Badge - Bottom Left */}
                  {product.type === 'variable' && (
                    <div className="absolute bottom-2 left-2 bg-purple-600 text-white px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-bold shadow-lg flex items-center gap-1">
                      <span>🎨</span>
                      <span className="hidden sm:inline">متعدد</span>
                      {product.variations_count && (
                        <span className="bg-white/20 px-1.5 py-0.5 rounded-full">
                          {product.variations_count}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3 flex flex-col flex-grow">
                  {/* Product Name */}
                  <h2 
                    className="font-bold text-sm mb-2 line-clamp-2 min-h-[2.5rem] text-gray-800 group-hover:text-blue-600 transition-colors cursor-pointer"
                    onClick={() => setEditingProduct(product.id)}
                    title={product.name}
                  >
                    {product.name}
                  </h2>

                  {/* Categories */}
                  {product.categories && product.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.categories.slice(0, 2).map(cat => (
                        <span 
                          key={cat.id} 
                          className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium"
                        >
                          {cat.name}
                        </span>
                      ))}
                      {product.categories.length > 2 && (
                        <span className="text-[9px] text-gray-400 px-1">
                          +{product.categories.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Price */}
                  <div className="mb-3 flex-grow">
                    {product.sale_price ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600 font-bold text-lg">
                            {product.sale_price} 
                            <span className="text-xs mr-0.5">{product.currency || 'ج.م'}</span>
                          </span>
                          <span className="text-gray-400 line-through text-xs">
                            {product.regular_price}
                          </span>
                        </div>
                        <span className="text-[10px] text-green-600 font-semibold">
                          وفّر {(parseFloat(product.regular_price) - parseFloat(product.sale_price)).toFixed(0)} ج.م
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-900 font-bold text-lg">
                        {product.regular_price || product.price} 
                        <span className="text-xs font-normal text-gray-500 mr-1">
                          {product.currency || 'ج.م'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-gray-100">
                    <div className="flex gap-2">
                      <button
                        className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md"
                        onClick={() => setEditingProduct(product.id)}
                        title="تعديل المنتج"
                      >
                        ✏️ <span>تعديل</span>
                      </button>
                      <button
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md"
                        onClick={() => setDeletingProduct(product)}
                        title="حذف المنتج"
                      >
                        🗑️
                      </button>
                    </div>
                    <select
                      disabled={updating}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-[10px] sm:text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white cursor-pointer"
                      value={product.status}
                      onChange={(e) =>
                        handleUpdateProduct({
                          id: product.id,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="publish">✓ منشور</option>
                      <option value="draft">✎ مسودة</option>
                      <option value="pending">⏳ مراجعة</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {/* عدد المنتجات المعروضة */}
      <div className="flex justify-center items-center gap-4 mt-8 mb-4">
        <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-md">
          📦 عدد المنتجات: {filteredProducts.length} من {products.length}
        </div>
      </div>

      {/* Modals */}
      {imageModal && (
        <ImageModal src={imageModal} onClose={() => setImageModal(null)} />
      )}

      {/* Invoice Upload Modal */}
      <InvoiceUploadModal
        isOpen={showInvoiceUpload}
        onClose={() => setShowInvoiceUpload(false)}
        onSuccess={(product) => {
          // handleQuickAddSuccess is called for each product
          handleQuickAddSuccess(product);
        }}
        setToast={setToast}
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        mode="edit"
        productId={editingProduct}
        onSuccess={(data) => {
          setToast({ message: '✅ تم تعديل المنتج بنجاح', type: 'success' });
          setTimeout(() => setToast(null), 3000);
          // 🔥 Force refresh من السيرفر
          fetchProducts(page, perPage, search, filterStatus, category, true);
        }}
      />

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        mode="create"
        onSuccess={(data) => {
          setToast({ message: '✅ تم إضافة المنتج بنجاح', type: 'success' });
          setTimeout(() => setToast(null), 3000);
          // 🔥 Force refresh من السيرفر
          fetchProducts(page, perPage, search, filterStatus, category, true);
        }}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={handleQuickAddSuccess}
        setToast={setToast}
      />

      {/* Bundle Link Modal - Original from POS */}
      <BundleLinkModal
        isOpen={showBundleModal}
        onClose={() => setShowBundleModal(false)}
        allProducts={products}
        vendorId={vendorInfo?.id}
      />

      {/* Product Links Modal */}
      {showProductLinks && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowProductLinks(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-700 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">🔗 روابط المنتجات</h2>
                <p className="text-blue-100 text-sm">شارك روابط منتجاتك مع العملاء</p>
              </div>
              <button
                onClick={() => setShowProductLinks(false)}
                className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl transition-all"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* Website Link */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl">
                    🌐
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">رابط متجرك الإلكتروني</h3>
                    <p className="text-sm text-gray-600">شارك هذا الرابط لعرض جميع منتجاتك</p>
                  </div>
                </div>
                <div className="bg-white border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://spare2app.com/stores/${vendorInfo?.id || 'your-store'}`}
                    className="flex-1 bg-transparent text-sm font-mono text-gray-700 outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://spare2app.com/stores/${vendorInfo?.id || 'your-store'}`);
                      setToast({ message: '✅ تم نسخ رابط المتجر', type: 'success' });
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all font-semibold text-sm"
                  >
                    📋 نسخ
                  </button>
                </div>
              </div>

              {/* Products API Link */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl">
                    📦
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">API المنتجات (JSON)</h3>
                    <p className="text-sm text-gray-600">للمطورين: استعلام جميع منتجاتك بصيغة JSON</p>
                  </div>
                </div>
                <div className="bg-white border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://api.spare2app.com/wp-json/wc/v3/products?vendor=${vendorInfo?.id || 'your-id'}`}
                    className="flex-1 bg-transparent text-sm font-mono text-gray-700 outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://api.spare2app.com/wp-json/wc/v3/products?vendor=${vendorInfo?.id || 'your-id'}`);
                      setToast({ message: '✅ تم نسخ رابط API', type: 'success' });
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-semibold text-sm"
                  >
                    📋 نسخ
                  </button>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">كيفية الاستخدام:</p>
                    <ul className="text-gray-600 space-y-1 mr-4">
                      <li>• شارك رابط المتجر مع عملائك لتصفح المنتجات</li>
                      <li>• استخدم رابط API لربط منتجاتك مع تطبيقات أخرى</li>
                      <li>• يمكنك فتح الروابط في متصفح للتجربة</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={() => setShowProductLinks(false)}
                className="bg-gray-600 text-white px-6 py-2.5 rounded-lg hover:bg-gray-700 transition-all font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4 animate-fadeIn"
          onClick={() => !deleting && setDeletingProduct(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex items-center gap-4">
              <div className="bg-white/20 rounded-full w-14 h-14 flex items-center justify-center text-3xl">
                ⚠️
              </div>
              <div>
                <h2 className="text-xl font-bold">تأكيد حذف المنتج</h2>
                <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <p className="font-bold text-gray-800 mb-2">المنتج المراد حذفه:</p>
                <p className="text-gray-700 text-lg font-semibold">{deletingProduct.name}</p>
                {deletingProduct.sku && (
                  <p className="text-sm text-gray-500 mt-1">SKU: {deletingProduct.sku}</p>
                )}
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2 text-sm text-red-800">
                  <span className="text-xl">🚨</span>
                  <div>
                    <p className="font-semibold mb-1">تحذير:</p>
                    <ul className="space-y-1 mr-4 text-xs">
                      <li>• سيتم حذف المنتج نهائياً من النظام</li>
                      <li>• لن تتمكن من استعادته بعد الحذف</li>
                      <li>• سيتم حذف جميع البيانات المرتبطة به</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-6">
                هل أنت متأكد من رغبتك في حذف هذا المنتج؟
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => !deleting && setDeletingProduct(null)}
                  disabled={deleting}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDeleteProduct(deletingProduct.id)}
                  disabled={deleting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl hover:from-red-700 hover:to-red-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>جاري الحذف...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>حذف نهائياً</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
