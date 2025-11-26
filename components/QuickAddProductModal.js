"use client";

import { useState } from "react";

export default function QuickAddProductModal({ isOpen, onClose, onSuccess, setToast }) {
  const [quickAddForm, setQuickAddForm] = useState({ name: '', price: '', stock: 0, sku: '' });
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // التحقق من نوع الملف
      if (!file.type.startsWith('image/')) {
        setToast({ message: '⚠️ يرجى اختيار صورة فقط', type: 'error' });
        setTimeout(() => setToast(null), 2500);
        return;
      }

      // التحقق من حجم الملف (أقل من 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setToast({ message: '⚠️ حجم الصورة يجب أن يكون أقل من 5 ميجابايت', type: 'error' });
        setTimeout(() => setToast(null), 2500);
        return;
      }

      setImageFile(file);
      
      // إنشاء معاينة للصورة + تحويلها لـ base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageBase64(reader.result); // حفظ الـ base64
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAddForm.name || !quickAddForm.price) {
      setToast({ message: '⚠️ الاسم والسعر مطلوبان', type: 'error' });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    setQuickAddLoading(true);
    
    try {
      let uploadedImageUrl = null;

      // 1. رفع الصورة أولاً لو موجودة
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('فشل رفع الصورة');
        }

        const uploadData = await uploadRes.json();
        uploadedImageUrl = uploadData.url;
      }

      // 2. إنشاء المنتج مع رابط الصورة
      const response = await fetch('/api/warehouse/create-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickAddForm.name,
          sellingPrice: parseFloat(quickAddForm.price),
          purchasePrice: 0,
          stock: parseInt(quickAddForm.stock) || 0,
          category: '',
          sku: quickAddForm.sku || '',
          imageUrl: uploadedImageUrl
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل إنشاء المنتج');
      }

      setToast({ message: `✅ تم إضافة "${result.product.name}" بنجاح!`, type: 'success' });
      setTimeout(() => setToast(null), 2500);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result.product);
      }
      
      // Reset and close
      setQuickAddForm({ name: '', price: '', stock: 0, sku: '' });
      setImageFile(null);
      setImagePreview(null);
      setImageBase64(null);
      onClose();
    } catch (error) {
      console.error('Error adding product:', error);
      setToast({ message: '❌ ' + error.message, type: 'error' });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setQuickAddLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl animate-scaleIn">
        <div className="border-b border-gray-200 dark:border-gray-700 p-5 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span>إضافة منتج سريع</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleQuickAdd} className="p-5 space-y-4">
          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              📸 صورة المنتج (اختياري)
            </label>
            
            {!imagePreview ? (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="product-image-upload"
                  disabled={quickAddLoading}
                />
                <label
                  htmlFor="product-image-upload"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all group"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-10 h-10 mb-3 text-gray-400 group-hover:text-gray-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">اضغط لرفع صورة</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PNG, JPG, WEBP (أقل من 5MB)
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="relative group">
                <img
                  src={imagePreview}
                  alt="معاينة"
                  className="w-full h-40 object-contain rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={quickAddLoading}
                  className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              اسم المنتج *
            </label>
            <input
              type="text"
              value={quickAddForm.name}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="مثال: مساعد هيدروليك أمامي"
              required
              autoFocus
              disabled={quickAddLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              رقم SKU (اختياري)
            </label>
            <input
              type="text"
              value={quickAddForm.sku}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, sku: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="مثال: PROD-12345"
              disabled={quickAddLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                سعر البيع * (ج.م)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quickAddForm.price}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, price: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="450"
                required
                disabled={quickAddLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                المخزون 🛒
              </label>
              <input
                type="number"
                min="0"
                value={quickAddForm.stock || 0}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, stock: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0"
                disabled={quickAddLoading}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            💡 المخزون = الكمية المتاحة للبيع من الكاشير
          </p>

          {/* <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              💡 <strong>ملاحظة:</strong> {imagePreview ? 'سيتم رفع الصورة على Cloudinary تلقائياً.' : 'يمكنك إضافة صورة لاحقاً من صفحة المنتجات أو المخزن.'}
            </p>
          </div> */}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={quickAddLoading}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-700 text-white py-3 rounded-lg hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md transition-all"
            >
              {quickAddLoading ? '⏳ جاري الإضافة...' : '✅ إضافة المنتج'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={quickAddLoading}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 font-semibold transition-colors text-gray-900 dark:text-white"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
