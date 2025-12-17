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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 🆕 دالة اختيار التصنيف
  const handleSelectCategory = (categoryId) => {
    setCategory(categoryId);
    setViewMode('products');
    setSearch(''); // مسح البحث
    // 🔥 جلب المنتجات حسب التصنيف
    fetchProducts({ page: 1, search: '', category: categoryId }).then((result) => {
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
      id: product.id,
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

  // 🆕 دالة البحث بالباركود/SKU
  const handleBarcodeSearch = async (sku) => {
    if (!sku || sku.trim() === '') return;

    // 🆕 تحويل الأحرف العربية للإنجليزية (في حالة السكانر بيكتب عربي)
    const arabicToEnglishMap = {
      'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p',
      'ج': '[', 'د': ']', 'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k',
      'م': 'l', 'ك': ';', 'ط': "'", 'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm',
      'و': ',', 'ز': '.', 'ظ': '/'
    };
    
    const convertedSku = sku.split('').map(char => arabicToEnglishMap[char] || char).join('');

    // البحث في المنتجات المحملة أولاً
    const foundProduct = products.find(p => 
      p.sku && (p.sku.toLowerCase() === sku.toLowerCase() || p.sku.toLowerCase() === convertedSku.toLowerCase())
    );

    if (foundProduct) {
      // إضافة المنتج للسلة مباشرة
      const res = await addToCart(foundProduct);
      if (res?.error) {
        setToast({ message: res.error, type: 'error' });
      } else {
        setToast({ message: `✅ تمت إضافة "${foundProduct.name}"`, type: 'success' });
        setTimeout(() => setToast(null), 2000);
      }
      setBarcodeInput(''); // مسح الحقل
    } else {
      // البحث في السيرفر
      setToast({ message: '🔍 جاري البحث عن المنتج...', type: 'info' });
      setTimeout(() => setToast(null), 1500);
      
      // محاولة جلب المنتج من السيرفر
      const result = await fetchProducts({ page: 1, search: convertedSku });
      
      setTimeout(() => {
        const serverProduct = products.find(p => 
          p.sku && (p.sku.toLowerCase() === sku.toLowerCase() || p.sku.toLowerCase() === convertedSku.toLowerCase())
        );
        
        if (serverProduct) {
          addToCart(serverProduct);
          setToast({ message: `✅ تمت إضافة "${serverProduct.name}"`, type: 'success' });
          setTimeout(() => setToast(null), 2000);
        } else {
          // المنتج مش موجود - إعادة تحميل المنتجات الأصلية
          setToast({ message: '❌ المنتج غير موجود - SKU: ' + convertedSku, type: 'error' });
          setTimeout(() => setToast(null), 3000);
          // إعادة تحميل المنتجات الأصلية
          fetchProducts({ page: 1, search: '', category });
        }
        setBarcodeInput('');
      }, 500);
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
                loading={categoriesLoading}
                onSelectCategory={handleSelectCategory}
                totalProducts={products.length}
              />
            </>
          ) : (
            <>
              {/* 🆕 Back to Categories Button */}
              <div className="mb-4">
                <button
                  onClick={handleBackToCategories}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold shadow-sm"
                >
                  <span className="text-xl">🏪</span>
                  <span>رجوع للتصنيفات</span>
                </button>
              </div>

              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
            {/* 🆕 Barcode Scanner Input */}
            <div className="relative">
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
            </div>

            {/* Search - Full width on mobile */}
            <div className="relative w-full">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                onClick={() => fetchProducts({ page: 1, search: '', category: 'all' })}
                disabled={loading}
                className="px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                title="تحديث المنتجات من السيرفر"
              >
                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                <span>تحديث</span>
              </button>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="col-span-2 md:col-span-1 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                title="إضافة منتج سريع"
              >
                <span>⚡</span>
                <span>إضافة منتج</span>
              </button>
            </div>
          </div>

              <ProductGrid 
                products={products} 
                loading={loading} 
                onAddToCart={handleAddToCart}
                onEdit={(product) => setEditingProductId(product.id)}
                onSelectVariation={handleSelectVariation}
                cart={cart} 
              />

              {!loading && Array.isArray(products) && products.length > 0 && (
                <div className="mt-6 text-center pb-20 md:pb-6">
                  {hasMore ? (
                    <button onClick={loadMore} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">تحميل المزيد</button>
                  ) : (
                    <p className="text-gray-500">لا يوجد المزيد من المنتجات</p>
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl transition-all z-40 flex items-center gap-3 font-bold text-lg"
          >
            <span className="text-2xl">🛒</span>
            <span>السلة ({(cart?.length || 0) + (services?.length || 0)})</span>
            {((cart?.length || 0) + (services?.length || 0)) > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
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
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
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
          fetchProducts({ page: 1, search, category });
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
          fetchProducts({ page: 1, search, category });
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