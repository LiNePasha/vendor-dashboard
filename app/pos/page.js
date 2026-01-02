"use client";

import { useState, useEffect } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CategoryGrid } from '@/components/pos/CategoryGrid';
import { Cart } from '@/components/pos/Cart';
import { Toast } from '@/components/Toast';
import ProductFormModal from '@/components/ProductFormModal';
import VariationSelector from '@/components/pos/VariationSelector';
import usePOSStore from '@/app/stores/pos-store';
import InvoiceModal from './InvoiceModal';
import EmployeeSelector from '@/components/EmployeeSelector';
import CustomerSelector from '@/components/CustomerSelector';
import { productsCacheStorage } from '@/app/lib/localforage';

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false); // 🔍 Loading للبحث
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState('categories'); // 🆕 categories or products
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [discountApplyMode, setDiscountApplyMode] = useState('both');
  const [extraFee, setExtraFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [editingProductId, setEditingProductId] = useState(null); // 🆕 للتعديل
  const [variationSelectorProduct, setVariationSelectorProduct] = useState(null); // 🆕 للـ variation selector
  const [variationSelectorVariations, setVariationSelectorVariations] = useState([]); // 🆕 variations list

  const {
    products = [],
    cart = [],
    services = [],
    categories = [],
    categoriesLoading = false,
    loading = false,
    processing = false,
    hasMore = false,
    // 🆕 Delivery state
    orderType,
    selectedCustomer,
    deliveryFee,
    deliveryNotes,
    setOrderType,
    selectCustomer,
    setDeliveryFee,
    setDeliveryNotes,
    // Actions
    fetchProducts,
    fetchCategories,
    addToCart,
    updateQuantity,
    removeFromCart,
    processCheckout,
    addService,
    updateService,
    removeService,
    updateProduct,
    init
  } = usePOSStore();

  useEffect(() => {
    if (!initialized) {
      init();
      // 🆕 تحميل التصنيفات أولاً
      fetchCategories().then((result) => {
        if (result?.error) {
          setToast({ message: result.error, type: 'error' });
        }
      });
      // تحميل الموظفين النشطين
      loadEmployees();
      setInitialized(true);
    }
    
    // 🆕 Auto-refresh المنتجات كل 30 ثانية
    const refreshInterval = setInterval(() => {
      if (viewMode === 'products' && !searching) {
        fetchProducts({ page: 1, search, category }, false, true); // silent refresh
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, viewMode, search, category, searching]);

  const loadEmployees = async () => {
    try {
      const { employeesStorage } = await import('@/app/lib/employees-storage');
      const allEmployees = await employeesStorage.getAllEmployees();
      const activeEmployees = allEmployees.filter(emp => emp.isActive !== false);
      setEmployees(activeEmployees);
      
      // 🆕 تحميل الموظف المحفوظ
      const savedEmployeeId = localStorage.getItem('selectedPOSEmployee');
      if (savedEmployeeId) {
        const savedEmp = activeEmployees.find(emp => emp.id === savedEmployeeId);
        if (savedEmp) {
          setSelectedEmployee(savedEmp);
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  // 🔍 Debounce للبحث - لو السيرش فاضي يرجع فوري
  useEffect(() => {
    if (!initialized) return;
    
    // لو السيرش فاضي - بحث فوري بدون delay
    if (search === '') {
      setSearching(false);
      if (viewMode === 'products') {
        fetchProducts({ page: 1, search: '', category }).then((result) => {
          if (result?.error) {
            setToast({ message: result.error, type: 'error' });
          }
        });
      }
      return;
    }
    
    // إظهار loading للبحث
    setSearching(true);
    
    const handler = setTimeout(() => {
      setViewMode('products'); // الانتقال لعرض المنتجات
      fetchProducts({ page: 1, search, category }).then((result) => {
        setSearching(false);
        if (result?.error) {
          setToast({ message: result.error, type: 'error' });
        }
      });
    }, 300); // 300ms للاستجابة السريعة
    
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]); // نشتغل بس لما السيرش يتغير

  // 🆕 تحميل المنتجات عند تغيير الفئة
  useEffect(() => {
    if (!initialized) return;
    if (viewMode !== 'products') return;
    setSearching(true); // Always show spinner before fetching
    fetchProducts({ page: 1, search, category }).then((result) => {
      setSearching(false);
      if (result?.error) {
        setToast({ message: result.error, type: 'error' });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]); // 🔥 نشتغل لما الفئة تتغير

  // 🆕 دالة اختيار التصنيف
  const handleSelectCategory = (categoryId) => {
    setSearching(true); // Always show spinner before fetching
    setCategory(categoryId);
    setViewMode('products');
    setSearch(''); // مسح البحث
    fetchProducts({ page: 1, search: '', category: categoryId }).then((result) => {
      setSearching(false);
      if (result?.error) {
        setToast({ message: result.error, type: 'error' });
      }
    });
  };

  // 🆕 دالة الرجوع للتصنيفات
  const handleBackToCategories = () => {
    setViewMode('categories');
    setCategory('all');
    setSearch('');
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchProducts({ page: next, search, category }, true);
  };

  const handleAddToCart = async (p) => {
    // Handle custom quantity set
    if (p._setQuantity !== undefined) {
      if (p._setQuantity === 0) {
        // Remove from cart
        await removeFromCart(p.id);
      } else {
        // Update to specific quantity
        const res = await updateQuantity(p.id, p._setQuantity);
        if (res?.error) setToast({ message: res.error, type: 'error' });
      }
    } else {
      // Normal add to cart
      const res = await addToCart(p);
      if (res?.error) setToast({ message: res.error, type: 'error' });
    }
  };

  const handleQuickAddSuccess = async () => {
    // تحديث قائمة المنتجات
    await fetchProducts({ page: 1, search, category });
  };

  // 🆕 دالة اختيار variation من منتج variable
  const handleSelectVariation = async (product) => {
    setToast({ message: '🔄 جاري تحميل المتغيرات...', type: 'info' });
    
    try {
      // جلب variations من الـ API
      const res = await fetch(`/api/products/${product.id}/variations`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تحميل المتغيرات');
      }
      
      // 🆕 إضافة المخزون المحلي لكل variation
      const { warehouseStorage } = await import('@/app/lib/warehouse-storage');
      const variationsWithLocalStock = await Promise.all(
        data.variations.map(async (v) => {
          const localStock = await warehouseStorage.getVariationLocalStock(v.id);
          return {
            ...v,
            localStock: localStock || 0
          };
        })
      );
      
      setVariationSelectorProduct(product);
      setVariationSelectorVariations(variationsWithLocalStock);
      setToast(null);
    } catch (error) {
      setToast({ message: error.message || 'فشل تحميل المتغيرات', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // 🆕 دالة إضافة variation للسلة
  const handleVariationSelect = async (product, variation) => {
    // إنشاء product object مدمج مع variation
    const variationProduct = {
      id: variation.id, // استخدم id الخاص بالـ variation كبند منفصل في السلة
      variation_id: variation.id,
      name: `${product.name} - ${variation.description}`,
      price: variation.price,
      regular_price: variation.regular_price,
      sale_price: variation.sale_price,
      stock_quantity: variation.stock_quantity,
      manage_stock: variation.manage_stock,
      sku: variation.sku,
      images: variation.image ? [{ src: variation.image }] : product.images,
      // معلومات إضافية للـ variation
      parent_id: product.id,
      parent_name: product.name,
      variation_attributes: variation.attributes,
      is_variation: true
    };

    const res = await addToCart(variationProduct);
    if (res?.error) {
      setToast({ message: res.error, type: 'error' });
    } else {
      setToast({ message: `✅ تمت إضافة "${variationProduct.name}"`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleUpdateQuantity = async (id, qty) => {
    const res = await updateQuantity(id, qty);
    if (res?.error) setToast({ message: res.error, type: 'error' });
  };

  const handleCheckout = async () => {
    if ((!cart || cart.length === 0) && (!services || services.length === 0)) {
      return setToast({ message: 'السلة فارغة - أضف منتجات أو خدمات', type: 'error' });
    }
    
    // 🆕 التحقق من اختيار الموظف البائع
    if (!selectedEmployee) {
      return setToast({ 
        message: '⚠️ يرجى اختيار الموظف البائع أولاً', 
        type: 'error' 
      });
    }
    
    if (discountType === 'percentage' && discount > 100) return setToast({ message: 'نسبة الخصم لا يمكن أن تتجاوز 100%', type: 'error' });
    if (discount < 0 || extraFee < 0) return setToast({ message: 'قيمة غير صالحة', type: 'error' });

    const result = await processCheckout({ 
      discount, 
      discountType,
      discountApplyMode, // 🆕 تطبيق الخصم على
      extraFee, 
      paymentMethod,
      // 🆕 إرسال بيانات البائع
      soldBy: {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.employeeCode
      }
    });
    
    if (result.success && result.invoice) {
      setLastInvoice(result.invoice);
      setShowInvoice(true);
      setToast({ message: 'تم إنشاء الفاتورة وتحديث المخزون بنجاح ✅', type: 'success' });
      
      // إعادة تعيين الخصم والرسوم الإضافية
      setDiscount(0);
      setDiscountType('amount');
      setDiscountApplyMode('both');
      setExtraFee(0);
      
      // Poll invoice status to update UI when synced
      const invoiceId = result.invoice.id;
      const checkSyncStatus = setInterval(async () => {
        try {
          const { invoiceStorage } = await import('@/app/lib/localforage');
          const updatedInvoice = await invoiceStorage.getInvoice(invoiceId);
          if (updatedInvoice && updatedInvoice.synced) {
            setLastInvoice(updatedInvoice);
            clearInterval(checkSyncStatus);
          }
        } catch (error) {
          // Silently handle error
        }
      }, 2000); // Check every 2 seconds
      
      // Stop checking after 40 seconds
      setTimeout(() => clearInterval(checkSyncStatus), 40000);
    } else {
      setToast({ message: result.error || 'فشل أثناء المحاولة', type: 'error' });
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row bg-gray-100 min-h-screen">
        {/* Main Content Section */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          
          {/* 🆕 Categories View */}
          {viewMode === 'categories' ? (
            <>
              <CategoryGrid
                categories={categories}
                loading={categoriesLoading || searching}
                onSelectCategory={(catId) => {
                  handleSelectCategory(catId);
                }}
                totalProducts={products.length}
              />
            </>
          ) : (
            <>
              {/* 🆕 Back to Categories Button */}
              <div className="mb-4">
                <button
                  onClick={handleBackToCategories}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#232b3b] border-2 border-blue-900 text-white rounded-lg hover:bg-[#181f2a] hover:border-blue-500 transition-all font-semibold shadow-sm"
                >
                  <span className="text-xl">🏪</span>
                  <span>رجوع للتصنيفات</span>
                </button>
              </div>

              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
            {/* 🆕 Barcode Scanner Input */}
            {/* <div className="relative">
              <input
                type="text"
                placeholder="🔍 امسح الباركود هنا أو اكتب SKU..."
                className="w-full px-4 py-3 pr-12 rounded-lg border-2 border-blue-500 bg-blue-50 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-lg font-mono"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeSearch(barcodeInput);
                  }
                }}
                autoFocus
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl">
                📦
              </div>
            </div> */}

            {/* Search - Full width on mobile */}
            <div className="relative w-full">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">
                {searching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                ) : (
                  '🔍'
                )}
              </span>
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                className="w-full px-4 pr-10 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
              />
              {searching && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-medium">
                  جاري البحث...
                </span>
              )}
            </div>
            
            {/* Filters Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                className="px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                <option value="all">{loading ? 'جاري التحميل...' : 'كل الفئات'}</option>
                {Array.isArray(categories) && categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.count ? ` (${c.count})` : ''}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  setSearching(true);
                  await fetchProducts({ page: 1, search: '', category }, false, true); // forceRefresh = true
                  setSearching(false);
                }}
                disabled={searching}
                className="px-3 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                title="تحديث المنتجات من السيرفر"
              >
                <span className={searching ? 'animate-spin' : ''}>🔄</span>
                <span>تحديث</span>
              </button>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="col-span-2 md:col-span-1 px-3 py-2.5 bg-green-900 text-white rounded-lg hover:bg-green-800 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                title="إضافة منتج سريع"
              >
                <span>⚡</span>
                <span>إضافة منتج</span>
              </button>
            </div>
          </div>

              <ProductGrid 
                products={products} 
                loading={searching} 
                onAddToCart={handleAddToCart}
                onEdit={(product) => setEditingProductId(product.id)}
                onSelectVariation={handleSelectVariation}
                cart={cart} 
              />

              {!loading && Array.isArray(products) && products.length > 0 && (
                <div className="mt-6 text-center pb-20 md:pb-6">
                  {hasMore ? (
                    <button onClick={loadMore} className="px-6 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-medium">تحميل المزيد</button>
                  ) : (
                    <p className="text-gray-300">لا يوجد المزيد من المنتجات</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cart Section - Desktop Sidebar */}
        <div className="hidden md:block w-1/3 min-w-[400px] bg-white border-l sticky top-0 self-start overflow-y-auto" style={{ maxHeight: '100vh' }}>
          {/* 🆕 اختيار الموظف البائع */}
          <div className="p-4 border-b bg-gray-50">
            <EmployeeSelector
              employees={employees}
              selectedEmployee={selectedEmployee}
              onChange={(employee) => {
                setSelectedEmployee(employee);
                // 🆕 حفظ الموظف في localStorage
                if (employee) {
                  localStorage.setItem('selectedPOSEmployee', employee.id);
                } else {
                  localStorage.removeItem('selectedPOSEmployee');
                }
              }}
              required={true}
            />
          </div>

          {/* 🆕 نوع الطلب والتوصيل */}
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            {/* <h3 className="font-bold text-sm text-gray-700 mb-3">📦 نوع الطلب</h3> */}
            <div className="flex gap-3">
              <button
                onClick={() => setOrderType('pickup')}
                className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${
                  orderType === 'pickup'
                    ? '!bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-2 border-blue-500'
                    : '!bg-white !text-gray-600 border-2 border-gray-300 hover:border-blue-400'
                }`}
              >
                <span className={orderType === 'pickup' ? 'text-xl' : 'text-lg'}>🏪</span>
                <span className="mr-1.5">استلام</span>
              </button>
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${
                  orderType === 'delivery'
                    ? '!bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg border-2 border-green-500'
                    : '!bg-white !text-gray-600 border-2 border-gray-300 hover:border-green-400'
                }`}
              >
                <span className={orderType === 'delivery' ? 'text-xl' : 'text-lg'}>🚚</span>
                <span className="mr-1.5">توصيل</span>
              </button>
            </div>

            {orderType === 'delivery' && (
              <div className="space-y-3">
                {/* اختيار العميل */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    العميل <span className="text-red-500">*</span>
                  </label>
                  <CustomerSelector
                    selectedCustomer={selectedCustomer}
                    onSelect={selectCustomer}
                    onClear={() => selectCustomer(null)}
                  />
                </div>

                {/* رسوم التوصيل */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    رسوم التوصيل (ج.م)
                  </label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                    placeholder="0"
                    min="0"
                    step="5"
                  />
                </div>

                {/* ملاحظات التوصيل */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ملاحظات التوصيل
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                    placeholder="ملاحظات إضافية للتوصيل..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
          
          <Cart
            items={cart}
            services={services}
            employees={employees}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={removeFromCart}
            onAddService={addService}
            onUpdateService={updateService}
            onRemoveService={removeService}
            onCheckout={handleCheckout}
            processing={processing}
            discount={discount}
            discountType={discountType}
            discountApplyMode={discountApplyMode}
            extraFee={extraFee}
            deliveryFee={deliveryFee}
            paymentMethod={paymentMethod}
            onDiscountChange={(v) => setDiscount(Number(v))}
            onDiscountTypeChange={(v) => setDiscountType(v)}
            onDiscountApplyModeChange={(v) => setDiscountApplyMode(v)}
            onExtraFeeChange={(v) => setExtraFee(Number(v))}
            onPaymentMethodChange={(v) => setPaymentMethod(v)}
          />
        </div>

        {/* Mobile Cart - Bottom Sheet */}
        <div className="md:hidden">
          {/* Floating Cart Button */}
          <button
            onClick={() => setShowMobileCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl transition-all z-40 flex items-center gap-3 font-bold text-lg"
          >
            <span className="text-2xl">🛒</span>
            <span>السلة ({(cart?.length || 0) + (services?.length || 0)})</span>
            {((cart?.length || 0) + (services?.length || 0)) > 0 && (
              <span className="bg-red-700 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                {(cart?.length || 0) + (services?.length || 0)}
              </span>
            )}
          </button>

          {/* Mobile Cart Modal */}
          {showMobileCart && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn">
              <div className="absolute inset-0" onClick={() => setShowMobileCart(false)} />
              <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl md:max-h-[90vh] md:overflow-hidden animate-slideUp">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>🛒</span>
                    <span>السلة</span>
                  </h2>
                  <button
                    onClick={() => setShowMobileCart(false)}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                  >
                    <span className="text-2xl">×</span>
                  </button>
                </div>

                {/* Employee Selector */}
                <div className="p-4 border-b bg-gray-50">
                  <EmployeeSelector
                    employees={employees}
                    selectedEmployee={selectedEmployee}
                    onChange={(employee) => {
                      setSelectedEmployee(employee);
                      if (employee) {
                        localStorage.setItem('selectedPOSEmployee', employee.id);
                      } else {
                        localStorage.removeItem('selectedPOSEmployee');
                      }
                    }}
                    required={true}
                  />
                </div>

                {/* Cart Content */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                  <Cart
                    items={cart}
                    services={services}
                    employees={employees}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={removeFromCart}
                    onAddService={addService}
                    onUpdateService={updateService}
                    onRemoveService={removeService}
                    onCheckout={() => {
                      handleCheckout();
                      setShowMobileCart(false);
                    }}
                    processing={processing}
                    discount={discount}
                    discountType={discountType}
                    discountApplyMode={discountApplyMode}
                    extraFee={extraFee}
                    paymentMethod={paymentMethod}
                    onDiscountChange={(v) => setDiscount(Number(v))}
                    onDiscountTypeChange={(v) => setDiscountType(v)}
                    onDiscountApplyModeChange={(v) => setDiscountApplyMode(v)}
                    onExtraFeeChange={(v) => setExtraFee(Number(v))}
                    onPaymentMethodChange={(v) => setPaymentMethod(v)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        mode="create"
        onSuccess={(data) => {
          setToast({ message: '✅ تم إضافة المنتج بنجاح', type: 'success' });
          fetchProducts({ page: 1, search, category }, false, true); // forceRefresh = true
        }}
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        isOpen={!!editingProductId}
        onClose={() => setEditingProductId(null)}
        mode="edit"
        productId={editingProductId}
        onSuccess={(data) => {
          setToast({ message: '✅ تم تعديل المنتج بنجاح', type: 'success' });
          setEditingProductId(null);
          fetchProducts({ page: 1, search, category }, false, true); // forceRefresh = true
        }}
      />

      {/* Variation Selector Modal */}
      {variationSelectorProduct && (
        <VariationSelector
          product={variationSelectorProduct}
          variations={variationSelectorVariations}
          onClose={() => {
            setVariationSelectorProduct(null);
            setVariationSelectorVariations([]);
          }}
          onSelect={handleVariationSelect}
        />
      )}

      <InvoiceModal
        invoice={lastInvoice}
        open={showInvoice}
        onClose={() => setShowInvoice(false)}
        onPrint={() => {
          if (lastInvoice?.id) {
            const url = `/pos/invoices/print?id=${encodeURIComponent(lastInvoice.id)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }}
      />
    </>
  );
}