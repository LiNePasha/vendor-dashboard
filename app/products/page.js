"use client";

import { useState, useEffect } from "react";
import AddProductForm from "@/components/AddProductForm";
import EditProductModal from "@/components/EditProductModal";

// Toast Component
function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed px-4 py-2 rounded shadow text-white z-50 transition-all 
    ${
      type === "success"
        ? "bg-green-500 bottom-5 left-1/2 -translate-x-1/2"
        : "bg-red-500 top-12 left-1/2 -translate-x-1/2"
    }`}
    >
      {message}
      <button className="ml-2 font-bold" onClick={onClose}>
        &times;
      </button>
    </div>
  );
}

// Skeleton Loader
function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col animate-pulse">
      <div className="bg-gray-200 h-40 w-full rounded mb-2" />
      <div className="bg-gray-200 h-4 w-3/4 rounded mb-1" />
      <div className="bg-gray-200 h-4 w-1/2 rounded" />
    </div>
  );
}

// Modal تكبير الصورة
function ImageModal({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="product"
        className="max-h-[90vh] max-w-full rounded shadow-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Main Products Page
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [toast, setToast] = useState(null);
  const [imageModal, setImageModal] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Debounce للبحث
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchProducts(page, perPage, debouncedSearch, filterStatus);
  }, [page, perPage, debouncedSearch, filterStatus]);

  const fetchProducts = async (
    pageNum,
    perPageNum,
    searchTerm = "",
    status = "all"
  ) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("page", pageNum);
      query.set("per_page", perPageNum);
      if (searchTerm) query.set("search", searchTerm);
      if (status !== "all") query.set("status", status);

      const res = await fetch(`/api/products?${query.toString()}`, {
        credentials: "include", // ⚡ مهم جدًا
      });

      if (!res.ok) throw new Error("فشل جلب المنتجات");

      const data = await res.json();
      setProducts(data.products);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "فشل تحميل المنتجات", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // دالة بتضيف المنتج الجديد على طول في الـ state
  const handleAdded = (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]); // يضيفه أول القائمة
  };

  const handleUpdateProduct = async (updatedData) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ⚡ مهم جدًا
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) throw new Error("فشل التعديل");

      const updatedProduct = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
      setSelectedProduct(null);
      // خليها تختفي بعد 3 ثواني مثلاً
      setTimeout(() => {
        setToast(null); // أو { message: "", type: "" } حسب كيف معرف الـ state
      }, 2500);
    } catch (err) {
      console.error(err);
      setToast({
        message: "فشل تعديل المنتج! تأكد من البيانات",
        type: "error",
      });
    } finally {
      setUpdating(false);
    }
  };

  const nextPage = () => page < totalPages && setPage(page + 1);
  const prevPage = () => page > 1 && setPage(page - 1);

  return (
    <div className="p-6">
      {/* <h1 className="text-2xl font-bold mb-6">المنتجات</h1> */}

      <div className="flex justify-center md:justify-between  items-center mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          ➕ منتج جديد
        </button>

        {showModal && (
          <AddProductForm
            onAdded={handleAdded}
            setToast={setToast}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>

      {/* Search & Filter */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="text"
          placeholder="ابحث بالاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">كل الحالات</option>
          <option value="publish">منشور</option>
          <option value="draft">مسودة</option>
          <option value="pending">قيد المراجعة</option>
        </select>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: perPage }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-gray-500">لا توجد منتجات حتى الآن</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow hover:shadow-2xl transition transform hover:-translate-y-1 p-4 flex flex-col justify-between border border-gray-200"
            >
              <div className="relative w-full h-48 overflow-hidden rounded bg-gray-100 group cursor-pointer">
                <img
                  src={product.images[0]?.src || "/placeholder.png"}
                  alt={product.name}
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onClick={() => setSelectedProduct(product)}
                />
                <span
                  className={`absolute top-2 left-2 px-2 py-1 rounded text-white text-xs font-semibold ${
                    product.status === "publish"
                      ? "bg-green-500"
                      : product.status === "draft"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                >
                  {product.status === "publish"
                    ? "منشور"
                    : product.status === "draft"
                    ? "مسودة"
                    : "قيد المراجعة"}
                </span>
              </div>
              <h2 className="font-bold mt-3 truncate">{product.name}</h2>
              {/* السعر */}
              <div className="mt-1">
                {product.sale_price ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 line-through">
                      {product.regular_price} {product.currency}
                    </span>
                    <span className="text-red-600 font-bold">
                      {product.sale_price} {product.currency}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-700 font-semibold">
                    {product.regular_price || product.price} {product.currency}
                  </span>
                )}
              </div>

              <div className="mt-3 flex justify-between items-center gap-2">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                  onClick={() => setSelectedProduct(product)}
                >
                  تعديل
                </button>
                <select
                  disabled={updating}
                  className="border rounded px-2 py-1"
                  value={product.status}
                  onChange={(e) =>
                    handleUpdateProduct({
                      id: product.id,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="publish">منشور</option>
                  <option value="draft">مسودة</option>
                  <option value="pending">قيد المراجعة</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          السابق
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={page === totalPages}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          التالي
        </button>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <EditProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSave={handleUpdateProduct}
          updating={updating}
          setToast={setToast}
        />
      )}
      {imageModal && (
        <ImageModal src={imageModal} onClose={() => setImageModal(null)} />
      )}

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
