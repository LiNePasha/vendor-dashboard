"use client";
import { useState, useEffect } from "react";

export default function AddProductModal({ onAdded, setToast, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isWholesale, setIsWholesale] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [manageStock, setManageStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(0);

useEffect(() => {
  // ✅ قراءة الكوكيز اللي اسمها isWholesale
  const wholesaleCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith("isWholesale="));

  if (wholesaleCookie) {
    const value = wholesaleCookie.split("=")[1] === "true";
    setIsWholesale(value);
  }
}, []);


  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!name) {
        setToast({ message: "الرجاء إدخال الاسم", type: "error" });
        setTimeout(() => setToast(null), 3000);
        return setLoading(false);
      }

      if (!isWholesale && !price) {
        setToast({ message: "الرجاء إدخال السعر", type: "error" });
        setTimeout(() => setToast(null), 3000);
        return setLoading(false);
      }

      if (
        !isWholesale &&
        salePrice &&
        parseFloat(salePrice) >= parseFloat(price)
      ) {
        setToast({
          message: "سعر العرض يجب أن يكون أقل من السعر الأساسي",
          type: "error",
        });
        return setLoading(false);
      }

      if (isWholesale && !whatsapp) {
        setToast({
          message: "من فضلك أدخل رقم الواتساب للتواصل",
          type: "error",
        });
        setTimeout(() => setToast(null), 3000);
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

      // ✅ بناء البيانات حسب نوع المستخدم
      const body = isWholesale
        ? {
            name,
            whatsapp,
            imageUrl,
            type: "external",
          }
        : { 
            name, 
            price, 
            salePrice, 
            imageUrl, 
            type: "simple",
            manage_stock: manageStock,
            stock_quantity: manageStock ? stockQuantity : null
          };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ message: "تم إضافة المنتج بنجاح ✅", type: "success" });
      setTimeout(() => setToast(null), 3000);

      onAdded && onAdded(data);
      onClose();
    } catch (err) {
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
        <button
          className="absolute top-3 right-3 text-gray-600 hover:text-black"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-center">
          ➕ إضافة منتج جديد
        </h2>

        <form onSubmit={handleAdd} className="space-y-4">
          <input
            type="text"
            placeholder="اسم المنتج"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
          />

          {!isWholesale ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="السعر الأساسي"
                    value={price}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        setPrice(val);
                      }
                    }}
                    className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
                  />
                </div>
                
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="سعر العرض (اختياري)"
                    value={salePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        setSalePrice(val);
                      }
                    }}
                    className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
                  />
                </div>
              </div>

              {/* إدارة المخزون */}
              <div className="space-y-2">
                {/* <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={manageStock}
                    onChange={(e) => setManageStock(e.target.checked)}
                    className="rounded"
                  />
                  <span>تفعيل إدارة المخزون</span>
                </label> */}

                {manageStock && (
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">الكمية المتوفرة:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={stockQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                          setStockQuantity(val === '' ? 0 : parseInt(val));
                        }
                      }}
                      className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
                      placeholder="أدخل الكمية المتوفرة"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <input
              type="text"
              placeholder="رقم واتساب للتواصل (مثال: 01000000000)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="border w-full px-3 py-2 rounded-lg focus:ring focus:ring-green-300"
            />
          )}

          <div>
            <label
              htmlFor="productImage"
              className="flex items-center justify-center w-full px-4 py-3 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition"
            >
              📷 تحميل صورة المنتج
            </label>
            <input
              id="productImage"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {preview && (
            <div className="mt-3">
              <img
                src={preview}
                alt="معاينة"
                className="w-full h-48 object-contain rounded-lg border"
              />
            </div>
          )}

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
