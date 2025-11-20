"use client";

import { useState, useEffect } from "react";
import EditProductModal from "@/components/EditProductModal";
import QuickAddProductModal from "@/components/QuickAddProductModal";
import Link from "next/link";
import { productsCacheStorage } from "@/app/lib/localforage";

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
  const [loading, setLoading] = useState(false); // Start false, fetchProducts will set to true
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Debounce للبحث
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Initial load only
  useEffect(() => {
    if (!initialized) {
      fetchProducts(1, perPage, "", "all", "all");
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle product modal close
  const handleProductModalClose = () => {
    setSelectedProduct(null);
  };

  // Handle filter/search changes (skip initial render)
  useEffect(() => {
    if (!initialized) return;
    fetchProducts(page, perPage, debouncedSearch, filterStatus, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, debouncedSearch, filterStatus, category]);

  const fetchProducts = async (
    pageNum,
    perPageNum,
    searchTerm = "",
    status = "all",
    categoryId = "all"
  ) => {
    // Skip if already fetching to avoid duplicate calls
    if (__products_fetch_in_flight) {
      return;
    }

    __products_fetch_in_flight = true;

    try {
      // 🚀 Stale-While-Revalidate: عرض الـ cache فوراً (بدون فلاتر)
      if (!searchTerm && status === "all" && categoryId === "all" && pageNum === 1) {
        const cache = await productsCacheStorage.getCache();
        if (cache && cache.products && cache.products.length > 0) {
          // عرض البيانات من الـ cache فوراً
          setProducts(cache.products);
          setCategories(cache.categories || []);
          setTotalPages(cache.pagination?.totalPages || 1);
          
          // فحص: هل الـ cache حديث؟
          const isStale = await productsCacheStorage.isCacheStale(3 * 60 * 1000); // 3 دقائق
          if (!isStale) {
            __products_fetch_in_flight = false;
            return; // الـ cache حديث، لا داعي للتحديث
          }
          // الـ cache قديم - التحديث في الخلفية (بدون لودر)
          setLoading(false); // ✅ أوقف اللودر
        }
      } else {
        setLoading(true); // فقط عند البحث أو الفلترة
      }

      const query = new URLSearchParams();
      query.set("page", pageNum);
      query.set("per_page", searchTerm || status !== "all" || categoryId !== "all" ? perPageNum : "100");
      if (searchTerm) query.set("search", searchTerm);
      if (status !== "all") query.set("status", status);
      if (categoryId && categoryId !== "all") query.set("category", categoryId);

      const res = await fetch(`/api/products?${query.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("فشل جلب المنتجات");

      const data = await res.json();
      setProducts(data.products);
      if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }

      // تحديث الـ cache (فقط للقائمة الكاملة بدون فلاتر)
      if (!searchTerm && status === "all" && categoryId === "all" && pageNum === 1) {
        await productsCacheStorage.saveCache(
          data.products,
          data.categories,
          data.pagination
        );
      }
    } catch (err) {
      setToast({ message: "فشل تحميل المنتجات", type: "error" });
    } finally {
      setLoading(false);
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
    const isManageStock = typeof updatedData.manage_stock !== 'undefined' ? !!updatedData.manage_stock : !!selectedProduct?.manage_stock;
    const newQty = isManageStock ? Number(updatedData.stock_quantity ?? selectedProduct?.stock_quantity ?? 0) : null;
    const productId = updatedData.id;

    const optimisticUpdate = (p) => {
      if (p.id !== productId) return p;
      return {
        ...p,
        name: typeof updatedData.name !== 'undefined' ? updatedData.name : p.name,
        status: typeof updatedData.status !== 'undefined' ? updatedData.status : p.status,
        price: typeof updatedData.price !== 'undefined' ? updatedData.price : p.price,
        regular_price: typeof updatedData.price !== 'undefined' ? updatedData.price : p.regular_price,
        sale_price: typeof updatedData.sale_price !== 'undefined' ? (updatedData.sale_price || "") : p.sale_price,
        manage_stock: isManageStock,
        stock_quantity: isManageStock ? (newQty ?? 0) : p.stock_quantity,
      };
    };

    setProducts((prev) => prev.map(optimisticUpdate));
    
    // Update cache too
    await productsCacheStorage.updateProductInCache(productId, {
      name: updatedData.name,
      status: updatedData.status,
      price: updatedData.price,
      regular_price: updatedData.price,
      sale_price: updatedData.sale_price,
      manage_stock: isManageStock,
      stock_quantity: isManageStock ? (newQty ?? 0) : undefined,
    });

    // Close modal fast and show lightweight toast
    setSelectedProduct(null);
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
          body: JSON.stringify(updatedData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setToast({ message: data?.error || data?.message || 'تعذر تحديث المنتج على الخادم، سيُعاد التحقق قريبًا', type: 'error' });
          setTimeout(() => setToast(null), 2500);
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-5 py-2.5 rounded-lg hover:from-green-700 hover:to-emerald-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2"
              >
                <span className="text-lg">⚡</span>
                <span>إضافة سريعة</span>
              </button>
              <Link
                href="/warehouse"
                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-5 py-2.5 rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2"
              >
                <span className="text-lg">📦</span>
                <span>إدارة المخزن</span>
              </Link>
            </div>
          </div>

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <span className="font-semibold">💡 ملاحظة:</span> المنتجات الجديدة يتم إضافتها وإدارتها من خلال نظام المخزن.
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="ابحث بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-4 pr-10 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <select
              className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium text-sm min-w-[140px]"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="all">{loading ? 'جاري التحميل...' : '🏷️ كل الفئات'}</option>
              {Array.isArray(categories) && categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.count ? ` (${c.count})` : ''}</option>
              ))}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium text-sm min-w-[140px]"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">📊 كل الحالات</option>
              <option value="publish">✓ منشور</option>
              <option value="draft">✎ مسودة</option>
              <option value="pending">⏳ قيد المراجعة</option>
            </select>
            <button
              onClick={() => {
                setSearch('');
                setCategory('all');
                setFilterStatus('all');
                setPage(1);
                fetchProducts(1, perPage, '', 'all', 'all');
              }}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all font-medium text-sm"
              title="تحديث المنتجات من السيرفر"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>تحديث</span>
            </button>
          </div>
        </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: perPage }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500 text-lg">لا توجد منتجات حتى الآن</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            أضف منتج جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => {
            const stockQty = product.stock_quantity ?? 0;
            const manageStock = product.manage_stock;
            const isLowStock = manageStock && stockQty > 0 && stockQty <= 5;
            const isOutOfStock = manageStock && stockQty === 0;
            
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col border border-gray-100 overflow-hidden group"
              >
                {/* Image Container */}
                <div className="relative w-full h-44 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer">
                  <img
                    src={product.images[0]?.src || "/placeholder.webp"}
                    alt={product.name}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onClick={() => setSelectedProduct(product)}
                  />
                  
                  {/* Status Badge - Top Left */}
                  <span
                    className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-white text-[10px] font-bold shadow-lg backdrop-blur-sm ${
                      product.status === "publish"
                        ? "bg-gradient-to-r from-green-500 to-green-600"
                        : product.status === "draft"
                        ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                        : "bg-gradient-to-r from-blue-500 to-blue-600"
                    }`}
                  >
                    {product.status === "publish"
                      ? "✓ منشور"
                      : product.status === "draft"
                      ? "✎ مسودة"
                      : "⏳ مراجعة"}
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
                </div>

                {/* Content */}
                <div className="p-3 flex flex-col flex-grow">
                  {/* Product Name */}
                  <h2 
                    className="font-bold text-sm mb-2 line-clamp-2 min-h-[2.5rem] text-gray-800 group-hover:text-blue-600 transition-colors cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
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
                  <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                    <button
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-xs font-semibold shadow-sm hover:shadow-md"
                      onClick={() => setSelectedProduct(product)}
                    >
                      ✏️ تعديل
                    </button>
                    <select
                      disabled={updating}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white cursor-pointer"
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
      <div className="flex justify-center items-center gap-4 mt-8 mb-4">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all font-semibold text-gray-700 shadow-sm"
        >
          ← السابق
        </button>
        <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold shadow-md">
          {page} / {totalPages}
        </div>
        <button
          onClick={nextPage}
          disabled={page === totalPages}
          className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all font-semibold text-gray-700 shadow-sm"
        >
          التالي →
        </button>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <EditProductModal
          product={selectedProduct}
          onClose={handleProductModalClose}
          onSave={handleUpdateProduct}
          updating={updating}
          setToast={setToast}
        />
      )}
      {imageModal && (
        <ImageModal src={imageModal} onClose={() => setImageModal(null)} />
      )}

      {/* Quick Add Modal */}
      <QuickAddProductModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAddSuccess}
        setToast={setToast}
      />

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
