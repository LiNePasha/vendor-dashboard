'use client';

import { useState, useEffect } from 'react';
import { warehouseStorage, suppliersStorage } from '../lib/warehouse-storage';
import { productsCacheStorage } from '../lib/localforage';
import Link from 'next/link';

export default function WarehousePage() {
  const [products, setProducts] = useState([]);
  const [warehouseData, setWarehouseData] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalForm, setModalForm] = useState({
    purchasePrice: '',
    localStock: '',
    notes: '',
    selectedSuppliers: [] // قائمة IDs الموردين
  });

  // Transfer Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    product: null,
    quantity: '',
    maxQuantity: 0
  });
  const [transferring, setTransferring] = useState(false);

  // Image Modal state
  const [imageModal, setImageModal] = useState(null);

  useEffect(() => {
    loadData(currentPage);
  }, [currentPage]);

  const loadData = async (pageNum = 1) => {
    try {
      // 🚀 Stale-While-Revalidate: جلب الـ cache أولاً (للصفحة الأولى فقط)
      if (pageNum === 1) {
        const cache = await productsCacheStorage.getCache();
        if (cache && cache.products && cache.products.length > 0) {
          // عرض المنتجات من الـ cache فوراً
          const cachedProducts = cache.products;
          const whData = await warehouseStorage.getAllProductsData();
          const suppliersData = await suppliersStorage.getAllSuppliers();
          
          const whMap = {};
          whData.forEach(item => {
            whMap[item.wooProductId] = item;
          });
          
          setProducts(cachedProducts);
          setWarehouseData(whMap);
          setSuppliers(suppliersData);
          if (cache.pagination?.totalPages) {
            setTotalPages(cache.pagination.totalPages);
          }
          setLoading(false); // ✅ أوقف اللودر - الـ cache ظاهر

          // التحديث في الخلفية (بدون لودر)
          const isStale = await productsCacheStorage.isCacheStale(3 * 60 * 1000); // 3 دقائق
          if (!isStale) {
            return; // الـ cache حديث، مفيش داعي للتحديث
          }
        }
      } else {
        setLoading(true); // عرض لودر للصفحات الأخرى
      }

      // جلب من API (في الخلفية أو أول مرة أو صفحات أخرى)
      const response = await fetch(`/api/products?per_page=500&page=${pageNum}`);
      if (response.ok) {
        const data = await response.json();
        const apiProducts = data.products || [];
        
        // تحديث الـ cache (للصفحة الأولى فقط)
        if (pageNum === 1) {
          await productsCacheStorage.saveCache(apiProducts, data.categories, data.pagination);
        }
        
        // جلب البيانات المحلية
        const whData = await warehouseStorage.getAllProductsData();
        const suppliersData = await suppliersStorage.getAllSuppliers();
        
        // تحويل البيانات المحلية لـ Map
        const whMap = {};
        whData.forEach(item => {
          whMap[item.wooProductId] = item;
        });
        
        setProducts(apiProducts);
        setWarehouseData(whMap);
        setSuppliers(suppliersData);
        if (data.pagination?.totalPages) {
          setTotalPages(data.pagination.totalPages);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product) => {
    setSelectedProduct(product);
    const data = warehouseData[product.id] || {};
    
    setModalForm({
      purchasePrice: data.purchasePrice || '',
      localStock: data.localStock || '',
      notes: data.notes || '',
      selectedSuppliers: (data.suppliers || []).map(s => s.supplierId)
    });
    
    setShowModal(true);
  };

  const handleAddSupplier = (supplierId) => {
    if (!modalForm.selectedSuppliers.includes(supplierId)) {
      setModalForm({
        ...modalForm,
        selectedSuppliers: [...modalForm.selectedSuppliers, supplierId]
      });
    }
  };

  const handleRemoveSupplier = (supplierId) => {
    setModalForm({
      ...modalForm,
      selectedSuppliers: modalForm.selectedSuppliers.filter(id => id !== supplierId)
    });
  };

  const handleSave = async () => {
    if (!selectedProduct) return;

    try {
      // تحويل IDs إلى objects
      const suppliersObjects = modalForm.selectedSuppliers.map(id => {
        const supplier = suppliers.find(s => s.id === id);
        return {
          supplierId: id,
          supplierName: supplier?.name || '',
          addedAt: new Date().toISOString()
        };
      });

      await warehouseStorage.setProductData(selectedProduct.id, {
        purchasePrice: parseFloat(modalForm.purchasePrice) || 0,
        localStock: parseInt(modalForm.localStock) || 0,
        notes: modalForm.notes,
        suppliers: suppliersObjects
      });

      alert('✅ تم الحفظ بنجاح!');
      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const openTransferModal = (product, data) => {
    setTransferForm({
      product,
      quantity: '',
      maxQuantity: data.localStock || 0
    });
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferForm.product || !transferForm.quantity) {
      alert('⚠️ حدد الكمية المراد نقلها');
      return;
    }

    const qty = parseInt(transferForm.quantity);
    if (qty <= 0 || qty > transferForm.maxQuantity) {
      alert(`⚠️ الكمية يجب أن تكون بين 1 و ${transferForm.maxQuantity}`);
      return;
    }

    setTransferring(true);
    try {
      // 1. نقل المخزون للـ API
      const response = await fetch('/api/warehouse/transfer-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: transferForm.product.id,
          quantity: qty
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل النقل');
      }

      // 2. تحديث المخزون المحلي
      const currentData = warehouseData[transferForm.product.id] || {};
      const newLocalStock = (currentData.localStock || 0) - qty;

      await warehouseStorage.setProductData(transferForm.product.id, {
        ...currentData,
        localStock: Math.max(0, newLocalStock)
      });

      // 3. ✅ تحديث الـ cache فوراً
      await productsCacheStorage.updateProductInCache(transferForm.product.id, {
        stock_quantity: result.newStock,
        manage_stock: true
      });

      alert(`✅ تم نقل ${qty} قطعة بنجاح!\n\nمخزون الكاشير القديم: ${result.oldStock}\nمخزون الكشاير الجديد: ${result.newStock}`);
      setShowTransferModal(false);
      await loadData(); // إعادة تحميل البيانات
    } catch (error) {
      console.error('Transfer error:', error);
      alert('❌ ' + error.message);
    } finally {
      setTransferring(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    const data = warehouseData[p.id];

    if (filterStatus === 'has-supplier') {
      return data && data.suppliers && data.suppliers.length > 0;
    }
    if (filterStatus === 'no-supplier') {
      return !data || !data.suppliers || data.suppliers.length === 0;
    }
    if (filterStatus === 'has-price') {
      return data && data.purchasePrice > 0;
    }
    if (filterStatus === 'no-price') {
      return !data || !data.purchasePrice;
    }
    return true;
  });

  const stats = {
    total: products.length,
    withSupplier: products.filter(p => {
      const d = warehouseData[p.id];
      return d && d.suppliers && d.suppliers.length > 0;
    }).length,
    withPrice: products.filter(p => {
      const d = warehouseData[p.id];
      return d && d.purchasePrice > 0;
    }).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📦 المخزن</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">إدارة بيانات المنتجات والموردين</p>
        </div>
        <div className="flex gap-4">
<Link 
          href="/suppliers" 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2"
        >
          <span className="text-xl">🏢</span>
          <span>الموردين</span>
        </Link>
        <Link 
          href="/warehouse/add" 
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-md flex items-center gap-2"
        >
          <span className="text-xl">🏢</span>
          <span>أضافة منتج</span>
        </Link>
        </div>
        
        
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
          <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">إجمالي المنتجات</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-300 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-green-200 dark:border-green-700 shadow-sm">
          <div className="text-green-600 dark:text-green-400 text-sm font-medium">✅ مسجل لها موردين</div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-300 mt-1">{stats.withSupplier}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-purple-200 dark:border-purple-700 shadow-sm">
          <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">💰 مسجل لها سعر شراء</div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-300 mt-1">{stats.withPrice}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="🔍 البحث بالاسم أو SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)} 
          className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">الكل</option>
          <option value="has-supplier">✅ لها موردين</option>
          <option value="no-supplier">⚠️ بدون موردين</option>
          <option value="has-price">💰 لها سعر شراء</option>
          <option value="no-price">⚠️ بدون سعر شراء</option>
        </select>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          title="تحديث المنتجات من السيرفر"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span className="hidden sm:inline">تحديث</span>
        </button>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600 dark:text-gray-400">جاري تحميل المنتجات...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-16 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">لا توجد نتائج</h3>
          <p className="text-gray-600 dark:text-gray-400">جرب تغيير البحث أو الفلتر</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map((product) => {
            const data = warehouseData[product.id] || {};
            const apiStock = product.stock_quantity || 0;

            return (
              <div key={product.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-shadow">
                <div className="flex gap-3 mb-3">
                  {product.images?.[0]?.src ? (
                    <img 
                      src={product.images[0].src} 
                      alt={product.name} 
                      className="w-16 h-16 object-cover rounded-lg bg-white border shadow-sm cursor-pointer hover:opacity-80 hover:scale-105 transition-all" 
                      onClick={() => setImageModal(product.images[0].src)}
                      title="اضغط لعرض الصورة بحجم أكبر"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg border flex items-center justify-center text-gray-400 text-2xl">
                      📦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate text-gray-900 dark:text-white">{product.name}</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{product.sku || 'بدون SKU'}</div>
                    {product.categories?.[0]?.name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">🏷️ {product.categories[0].name}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between bg-blue-50 p-2 rounded-lg">
                    <span className="text-blue-700 font-medium">مخزون الكاشير:</span>
                    <span className="font-bold text-blue-900">{apiStock} قطعة</span>
                  </div>
                  
                  {data.localStock > 0 && (
                    <div className="flex justify-between bg-purple-50 p-2 rounded-lg">
                      <span className="text-purple-700 font-medium">مخزون محلي:</span>
                      <span className="font-bold text-purple-900">{data.localStock} قطعة</span>
                    </div>
                  )}
                  
                  {data.purchasePrice > 0 && (
                    <div className="flex justify-between bg-green-50 p-2 rounded-lg">
                      <span className="text-green-700 font-medium">سعر الشراء:</span>
                      <span className="font-bold text-green-900">{data.purchasePrice.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  
                  {data.suppliers && data.suppliers.length > 0 ? (
                    <div className="bg-green-50 p-2 rounded-lg">
                      <div className="text-xs text-green-700 font-semibold mb-1">✅ الموردين:</div>
                      {data.suppliers.map((s, idx) => (
                        <div key={idx} className="text-xs text-green-800">• {s.supplierName}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-orange-50 p-2 rounded-lg text-xs text-orange-700 font-semibold text-center">
                      ⚠️ بدون موردين
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(product)}
                    className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 font-semibold shadow-md transition-colors"
                  >
                    ⚙️ إدارة
                  </button>
                  {data.localStock > 0 && (
                    <button 
                      onClick={() => openTransferModal(product, data)}
                      className="px-3 bg-purple-600 text-white text-sm py-2.5 rounded-lg hover:bg-purple-700 font-semibold shadow-md transition-colors"
                      title="نقل مخزون للـكاشير "
                    >
                      ↗️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ {selectedProduct.name}</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Product Info */}
              <div className="flex gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                {selectedProduct.images?.[0]?.src && (
                  <img 
                    src={selectedProduct.images[0].src} 
                    alt={selectedProduct.name} 
                    className="w-20 h-20 object-cover rounded-lg border" 
                  />
                )}
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{selectedProduct.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">SKU: {selectedProduct.sku || 'N/A'}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">سعر البيع: {selectedProduct.regular_price} ج.م</div>
                  <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">مخزون الكاشير: {selectedProduct.stock_quantity || 0} قطعة</div>
                </div>
              </div>

              {/* Suppliers */}
              <div>
                <label className="block text-sm font-bold mb-3 text-gray-900 dark:text-white">الموردين:</label>
                
                {/* Selected Suppliers */}
                {modalForm.selectedSuppliers.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {modalForm.selectedSuppliers.map(supplierId => {
                      const supplier = suppliers.find(s => s.id === supplierId);
                      return supplier ? (
                        <div key={supplierId} className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">✅</span>
                            <span className="font-semibold text-green-900">{supplier.name}</span>
                            {supplier.phone && <span className="text-xs text-gray-600">({supplier.phone})</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSupplier(supplierId)}
                            className="text-red-600 hover:text-red-700 font-bold"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Add Supplier */}
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddSupplier(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">اختر مورد لإضافته...</option>
                    {suppliers
                      .filter(s => !modalForm.selectedSuppliers.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))
                    }
                  </select>
                  <Link
                    href="/suppliers"
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    ➕
                  </Link>
                </div>
              </div>

              {/* Purchase Price */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-white">
                  سعر الشراء (ج.م):
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={modalForm.purchasePrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setModalForm({ ...modalForm, purchasePrice: val });
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="300.00"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 سعر ثابت - يُستخدم لحساب الربح</p>
              </div>

              {/* Local Stock */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-white">
                  المخزون المحلي (اختياري):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={modalForm.localStock}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setModalForm({ ...modalForm, localStock: val });
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="15"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 الموجود في المخزن (للتسجيل فقط - مش للبيع)</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-white">
                  ملاحظات (اختياري):
                </label>
                <textarea
                  value={modalForm.notes}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows="3"
                  placeholder="أي ملاحظات عن المنتج..."
                />
              </div>

              {/* Warning */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>⚠️ ملاحظة مهمة:</strong>
                  المخزون المحلي ملهوش دعوة بالي بيتعرض في الكاشير دا المخزن فقط.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-5 flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold shadow-md transition-colors"
              >
                ✅ حفظ
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-8 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors text-gray-900 dark:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferForm.product && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-5 rounded-t-xl">
              <h2 className="text-xl font-bold">↗️ نقل مخزون للـكاشير </h2>
              <p className="text-sm text-purple-100 mt-1">{transferForm.product.name}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Product Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">المخزون المحلي الحالي:</span>
                  <span className="font-bold text-purple-900 dark:text-purple-300">{transferForm.maxQuantity} قطعة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">مخزون الكاشير الحالي:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-300">{transferForm.product.stock_quantity || 0} قطعة</span>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-900 dark:text-white">
                  الكمية المراد نقلها:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={transferForm.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      const num = val === '' ? '' : parseInt(val);
                      if (num === '' || (num >= 1 && num <= transferForm.maxQuantity)) {
                        setTransferForm({ ...transferForm, quantity: val });
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg font-semibold bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={`1 - ${transferForm.maxQuantity}`}
                  disabled={transferring}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 سيتم خصم الكمية من المخزون المحلي وإضافتها لمخزون الكاشير
                </p>
              </div>

              {/* Preview */}
              {transferForm.quantity && parseInt(transferForm.quantity) > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-bold text-blue-900 mb-2">📊 معاينة بعد النقل:</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">مخزون محلي جديد:</span>
                    <span className="font-bold text-purple-900">
                      {transferForm.maxQuantity - parseInt(transferForm.quantity)} قطعة
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">مخزون الكاشير جديد:</span>
                    <span className="font-bold text-blue-900">
                      {(transferForm.product.stock_quantity || 0) + parseInt(transferForm.quantity)} قطعة
                    </span>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>⚠️ تنبيه:</strong> هذه العملية سوف:
                </p>
                <ul className="text-sm text-orange-700 mt-2 mr-4 space-y-1">
                  <li>• تخصم من المخزون المحلي</li>
                  <li>• تضيف للمخزون في الكاشير</li>
                  <li>• لا يمكن التراجع عنها</li>
                </ul>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 p-5 flex gap-3 rounded-b-xl">
              <button
                onClick={handleTransfer}
                disabled={transferring || !transferForm.quantity || parseInt(transferForm.quantity) <= 0}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold shadow-md transition-colors"
              >
                {transferring ? '⏳ جاري النقل...' : '↗️ نقل الآن'}
              </button>
              <button
                onClick={() => setShowTransferModal(false)}
                disabled={transferring}
                className="px-8 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 font-semibold transition-colors text-gray-900 dark:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 mb-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold text-gray-700 dark:text-gray-200 shadow-sm"
          >
            ← السابق
          </button>
          <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-bold shadow-md">
            {currentPage} / {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold text-gray-700 dark:text-gray-200 shadow-sm"
          >
            التالي →
          </button>
        </div>
      )}

      {/* Image Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setImageModal(null)}
        >
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold backdrop-blur-md transition-all z-10"
          >
            ×
          </button>
          <img
            src={imageModal}
            alt="product preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
