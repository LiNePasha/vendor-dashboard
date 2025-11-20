"use client";

import { useState } from "react";

export default function QuickAddProductModal({ isOpen, onClose, onSuccess, setToast }) {
  const [quickAddForm, setQuickAddForm] = useState({ name: '', price: '', stock: 0 });
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAddForm.name || !quickAddForm.price) {
      setToast({ message: '⚠️ الاسم والسعر مطلوبان', type: 'error' });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    setQuickAddLoading(true);
    try {
      const response = await fetch('/api/warehouse/create-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickAddForm.name,
          sellingPrice: parseFloat(quickAddForm.price),
          purchasePrice: 0,
          stock: parseInt(quickAddForm.stock) || 0,
          category: '',
          sku: '',
          imageBase64: null
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
      setQuickAddForm({ name: '', price: '', stock: 0 });
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
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            💡 المخزون = الكمية المتاحة للبيع من POS
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              💡 <strong>ملاحظة:</strong> سيتم إنشاء المنتج بالاسم والسعر والمخزون. يمكنك تعديل باقي التفاصيل (الصورة، الفئة) لاحقاً من صفحة المنتجات أو المخزن.
            </p>
          </div>

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
