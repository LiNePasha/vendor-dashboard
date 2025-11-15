'use client';

import { useState, useEffect } from 'react';
import { warehouseStorage, suppliersStorage } from '../../lib/warehouse-storage';
import { useRouter } from 'next/navigation';

export default function AddProductPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [syncToApi, setSyncToApi] = useState(true); // خيار المزامنة مع API - مفعّل افتراضياً
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    sellingPrice: '',
    purchasePrice: '',
    supplierId: '',
    apiStock: 0, // الكمية في API (للبيع)
    localStock: 0, // الكمية في المخزن المحلي
    category: '',
    image: null
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const suppliersList = await suppliersStorage.getAllSuppliers();
    setSuppliers(suppliersList);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setForm({ ...form, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.sellingPrice) {
      alert('⚠️ الاسم وسعر البيع مطلوبان');
      return;
    }

    setLoading(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === form.supplierId);
      
      // إذا اختار المستخدم المزامنة مع API
      if (syncToApi) {
        const response = await fetch('/api/warehouse/create-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            sku: form.sku,
            sellingPrice: parseFloat(form.sellingPrice),
            purchasePrice: parseFloat(form.purchasePrice) || 0,
            stock: parseInt(form.apiStock) || 0, // الكمية للـ API
            category: form.category,
            imageBase64: form.image // base64 image
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'فشل إنشاء المنتج في API');
        }

        // حفظ البيانات المحلية مع ربطها بالمنتج في API
        if (form.purchasePrice || form.supplierId || form.localStock) {
          await warehouseStorage.setProductData(result.product.id, {
            purchasePrice: parseFloat(form.purchasePrice) || 0,
            localStock: parseInt(form.localStock) || 0, // المخزون المحلي
            notes: '',
            suppliers: selectedSupplier ? [{
              supplierId: selectedSupplier.id,
              supplierName: selectedSupplier.name,
              addedAt: new Date().toISOString()
            }] : []
          });
        }

        alert(`✅ تم إنشاء المنتج بنجاح في WooCommerce!\n\nID: ${result.product.id}\nالاسم: ${result.product.name}\nالمخزون: ${result.product.stock_quantity}`);
      } else {
        // حفظ محلي فقط (الطريقة القديمة)
        await warehouseStorage.addProduct({
          ...form,
          supplierName: selectedSupplier?.name || ''
        });

        alert('✅ تم إضافة المنتج للمخزن المحلي بنجاح!');
      }

      router.push('/warehouse');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">➕ إضافة منتج جديد</h1>
        <p className="text-gray-600 text-sm mt-1">أضف منتج جديد للمخزن المحلي</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* اسم المنتج */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">اسم المنتج *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="مثال: مساعد هيدروليك أمامي"
              required
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-semibold mb-2">SKU (اختياري)</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="مثال: HD-123"
            />
          </div>

          {/* الفئة */}
          <div>
            <label className="block text-sm font-semibold mb-2">الفئة (اختياري)</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="مثال: هيدروليك"
            />
          </div>

          {/* سعر البيع */}
          <div>
            <label className="block text-sm font-semibold mb-2">سعر البيع * (ج.م)</label>
            <input
              type="number"
              step="0.01"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="450"
              required
            />
          </div>

          {/* سعر الشراء */}
          <div>
            <label className="block text-sm font-semibold mb-2">سعر الشراء (ج.م)</label>
            <input
              type="number"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="300"
            />
          </div>

          {/* المورد */}
          <div>
            <label className="block text-sm font-semibold mb-2">المورد</label>
            <div className="flex gap-2">
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                <option value="">اختر المورد</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push('/suppliers')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕
              </button>
            </div>
          </div>

          {/* الكمية في API */}
          <div>
            <label className="block text-sm font-semibold mb-2">الكمية المتاحة للبيع (API) 🛒</label>
            <input
              type="number"
              value={form.apiStock}
              onChange={(e) => setForm({ ...form, apiStock: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">💡 الكمية التي ستكون متاحة للبيع من POS</p>
          </div>

          {/* الكمية في المخزن المحلي */}
          <div>
            <label className="block text-sm font-semibold mb-2">الكمية في المخزن المحلي 📦</label>
            <input
              type="number"
              value={form.localStock}
              onChange={(e) => setForm({ ...form, localStock: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">💡 للتسجيل فقط - يمكن نقلها للـ API لاحقاً</p>
          </div>

          {/* صورة المنتج */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">صورة المنتج (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2 border rounded-lg"
            />
            {imagePreview && (
              <div className="mt-3">
                <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded border" />
              </div>
            )}
          </div>

          {/* خيار المزامنة مع API */}
          <div className="md:col-span-2">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToApi}
                  onChange={(e) => setSyncToApi(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <span>🔄</span>
                    <span>مزامنة مع WooCommerce API</span>
                  </div>
                  {/* <p className="text-sm text-gray-600 mt-1">
                    عند التفعيل، سيتم إنشاء المنتج مباشرة في WooCommerce ورفع الصورة لـ Cloudinary
                  </p> */}
                  {/* {syncToApi && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-800 font-semibold mb-2">✅ سيتم:</p>
                      <ul className="text-xs text-blue-700 space-y-1 mr-4">
                        <li>• رفع الصورة لـ Cloudinary تلقائياً</li>
                        <li>• إنشاء المنتج في WooCommerce</li>
                        <li>• إضافة المخزون للـ API مباشرة</li>
                        <li>• حفظ سعر الشراء والمورد محلياً</li>
                      </ul>
                    </div>
                  )} */}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6 pt-6 border-t">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
          >
            {loading ? '⏳ جاري الحفظ...' : syncToApi ? '🔄 حفظ ومزامنة مع API' : '✅ حفظ محلياً فقط'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/warehouse')}
            disabled={loading}
            className="px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
          >
            إلغاء
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>ملاحظة:</strong> {syncToApi 
              ? 'المنتج سيُنشأ مباشرة في WooCommerce وسيكون متاحاً للبيع من خلال POS.' 
              : 'المنتج سيُحفظ في المخزن المحلي فقط. يمكنك لاحقاً مزامنته مع WooCommerce.'}
          </p>
        </div>
      </form>
    </div>
  );
}
