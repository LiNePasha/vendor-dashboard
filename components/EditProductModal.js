import { useState, useEffect } from "react";

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
  const [sku, setSku] = useState(product.sku || "");
  const [externalUrl, setExternalUrl] = useState(product.external_url || "");
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity || 0);
  const [manageStock, setManageStock] = useState(product.manage_stock || false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(product.images?.[0]?.src || null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (!name || (!price && !externalUrl)) {
      setToast({ message: "الرجاء ملء الاسم والسعر أو رابط المنتج", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // ✅ فالديشن: سعر العرض أقل من الأساسي
    if (salePrice && parseFloat(salePrice) >= parseFloat(price)) {
      setToast({
        message: "سعر العرض يجب أن يكون أقل من السعر الأساسي",
        type: "error",
      });
      return;
    }

    // 🆕 رفع الصورة الجديدة لو موجودة
    let imageUrl = product.images?.[0]?.src || null;
    if (file) {
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);
        imageUrl = uploadData.url;
      } catch (err) {
        setToast({ message: "فشل رفع الصورة", type: "error" });
        setTimeout(() => setToast(null), 3000);
        setUploadingImage(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    }

    // ✅ بناء الداتا حسب نوع المنتج
    const updatedProduct = {
      id: product.id,
      name,
      regular_price: price,
      price,
      sale_price: salePrice || "",
      sku: sku || "",
      status: product.status,
      external_url: externalUrl || "",
      manage_stock: manageStock,
      stock_quantity: manageStock ? stockQuantity : null,
      imageUrl, // 🆕 إضافة رابط الصورة
    };

    onSave(updatedProduct);
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

        {/* SKU */}
        <label className="block mb-2">رقم SKU:</label>
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="مثال: PROD-12345"
          className="border w-full rounded px-2 py-1 mb-4"
        />

        {/* لو المنتج مش خارجي */}
        {!product.external_url && (
          <>
            <label className="block mb-2">السعر الأساسي:</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border w-full rounded px-2 py-1 mb-4"
            />

            <label className="block mb-2">سعر العرض (Sale):</label>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="border w-full rounded px-2 py-1 mb-4"
            />
          </>
        )}

        {/* ✅ لو المنتج خارجي يظهر له رابط خارجي للتعديل */}
        {product.external_url && (
          <>
            <label className="block mb-2">رابط المنتج الخارجي:</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://example.com/product"
              className="border w-full rounded px-2 py-1 mb-4"
            />
          </>
        )}

        {/* إدارة المخزون */}
        <div className="mb-4 space-y-2">
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
              <label className="block mb-1">الكمية المتوفرة:</label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                className="border w-full rounded px-2 py-1"
              />
            </div>
          )}
        </div>

        {/* معاينة الصورة */}
        <div className="mb-4">
          <label className="block mb-2 font-semibold">الصورة:</label>
          
          {preview && (
            <img
              src={preview}
              alt={product.name}
              className="w-full h-64 object-contain rounded border mb-3"
            />
          )}
          
          <div className="flex gap-2">
            <label
              htmlFor="editProductImage"
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition text-sm"
            >
              {preview ? '📷 تغيير الصورة' : '📷 إضافة صورة'}
            </label>
            <input
              id="editProductImage"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(product.images?.[0]?.src || null);
                }}
                className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition text-sm"
              >
                ✕ إلغاء
              </button>
            )}
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400 transition"
            onClick={onClose}
            disabled={updating || uploadingImage}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={updating || uploadingImage}
            className={`bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition ${
              (updating || uploadingImage) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploadingImage ? "⏳ جاري رفع الصورة..." : updating ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
