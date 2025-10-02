"use client";
import { useState } from "react";

export default function AddProductModal({ onAdded, setToast, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // ✅ معاينة الصورة
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f)); // توليد صورة معاينة
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!name || !price) {
        setToast({ message: "الرجاء إدخال الاسم والسعر", type: "error" });
        setTimeout(() => setToast(null), 3000);
        return setLoading(false);
      }

      if (salePrice && parseFloat(salePrice) >= parseFloat(price)) {
        setToast({
          message: "سعر العرض يجب أن يكون أقل من السعر الأساسي",
          type: "error",
        });
        return setLoading(false);
      }

      let imageUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);
        imageUrl = uploadData.url;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, price, salePrice, imageUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ message: "تم إضافة المنتج بنجاح ✅", type: "success" });
      setName("");
      setPrice("");
      setSalePrice("");
      setFile(null);
      setPreview(null);

      onAdded && onAdded(data);
      onClose(); // ✅ قفل المودال بعد الإضافة
    } catch (err) {
      console.error(err);
      setToast({ message: "فشل إضافة المنتج", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-2 p-6 relative overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر إغلاق */}
        <button
          className="absolute top-3 right-3 text-gray-600 hover:text-black"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-center">➕ إضافة منتج جديد</h2>

        <form onSubmit={handleAdd} className="space-y-4">
          {/* الاسم */}
          <input
            type="text"
            placeholder="اسم المنتج"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
          />

          {/* السعر الأساسي */}
          <input
            type="number"
            placeholder="السعر الأساسي"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
          />

          {/* سعر العرض */}
          <input
            type="number"
            placeholder="سعر العرض (اختياري)"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
          />

          {/* صورة */}
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-green-50 file:text-green-600
                     hover:file:bg-green-100"
          />

          {/* معاينة الصورة */}
          {preview && (
            <div className="mt-3">
              <img
                src={preview}
                alt="معاينة"
                className="w-full h-48 object-contain rounded-lg border"
              />
            </div>
          )}

          {/* معاينة السعر */}
          {price && (
            <div className="mt-3 text-center">
              {salePrice ? (
                <div className="space-x-2">
                  <span className="line-through text-gray-500">{price} ج.م</span>
                  <span className="text-red-600 font-bold">{salePrice} ج.م</span>
                </div>
              ) : (
                <span className="text-green-600 font-bold">{price} ج.م</span>
              )}
            </div>
          )}

          {/* أزرار */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              onClick={onClose}
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? "⏳ جاري الإضافة..." : "➕ إضافة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
