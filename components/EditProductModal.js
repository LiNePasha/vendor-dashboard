import { useState } from "react";

export default function EditProductModal({
  product,
  onClose,
  onSave,
  updating,
  setToast,
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.regular_price);
  const [salePrice, setSalePrice] = useState(product.sale_price || "");

  const handleSave = () => {
    if (!name || !price) {
      setToast({ message: "الرجاء ملء الاسم والسعر", type: "error" });
      setTimeout(() => setToast(null), 3000);
    }

    // ✅ فالديشن: سعر العرض أقل من الأساسي
    if (salePrice && parseFloat(salePrice) >= parseFloat(price)) {
      setToast({
        message: "سعر العرض يجب أن يكون أقل من السعر الأساسي",
        type: "error",
      });
    }

    onSave({
      id: product.id,
      name,
      price,
      regular_price: price,
      sale_price: salePrice || "",
      status: product.status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">تعديل المنتج</h2>

        {/* الاسم */}
        <label className="block mb-2">الاسم:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border w-full rounded px-2 py-1 mb-4"
        />

        {/* السعر الأساسي */}
        <label className="block mb-2">السعر الأساسي:</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border w-full rounded px-2 py-1 mb-4"
        />

        {/* سعر التخفيض */}
        <label className="block mb-2">سعر العرض (Sale):</label>
        <input
          type="number"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className="border w-full rounded px-2 py-1 mb-4"
        />

        {/* معاينة الصورة */}
        {product.images[0] && (
          <div className="mb-4">
            <label className="block mb-2 font-semibold">معاينة الصورة:</label>
            <img
              src={product.images[0].src}
              alt={product.name}
              className="w-full h-64 object-contain rounded border"
            />
          </div>
        )}

        {/* الأزرار */}
        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400 transition"
            onClick={onClose}
            disabled={updating}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={updating}
            className={`bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition ${
              updating ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {updating ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
