"use client";

import { useState, useEffect } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { Toast } from '@/components/Toast';
import QuickAddProductModal from '@/components/QuickAddProductModal';
import usePOSStore from '@/app/stores/pos-store';
import InvoiceModal from './InvoiceModal';
import EmployeeSelector from '@/components/EmployeeSelector';

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [extraFee, setExtraFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false); // 🆕 Mobile cart visibility

  const {
    products = [],
    cart = [],
    services = [],
    categories = [],
    loading = false,
    processing = false,
    hasMore = false,
    fetchProducts,
    addToCart,
    updateQuantity,
    removeFromCart,
    processCheckout,
    addService,
    updateService,
    removeService,
    init
  } = usePOSStore();

  useEffect(() => {
    if (!initialized) {
      init();
      fetchProducts({ page: 1 }).then((result) => {
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
      console.log('Loaded employees:', activeEmployees.length);
      
      // 🆕 تحميل الموظف المحفوظ
      const savedEmployeeId = localStorage.getItem('selectedPOSEmployee');
      if (savedEmployeeId) {
        const savedEmp = activeEmployees.find(emp => emp.id === savedEmployeeId);
        if (savedEmp) {
          setSelectedEmployee(savedEmp);
          console.log('تم تحميل الموظف المحفوظ:', savedEmp.name);
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  useEffect(() => {
    if (!initialized) return; // Don't fetch on initial mount
    const t = setTimeout(() => {
      fetchProducts({ page: 1, search, category }).then((result) => {
        if (result?.error) {
          setToast({ message: result.error, type: 'error' });
        }
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchProducts({ page: next, search, category }, true);
  };

  const handleAddToCart = async (p) => {
    const res = await addToCart(p);
    if (res?.error) setToast({ message: res.error, type: 'error' });
  };

  const handleQuickAddSuccess = async () => {
    // تحديث قائمة المنتجات
    await fetchProducts({ page: 1, search, category });
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
        {/* Products Section */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            {/* Search - Full width on mobile */}
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
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

          <ProductGrid products={products} loading={loading} onAddToCart={handleAddToCart} />

          {!loading && Array.isArray(products) && products.length > 0 && (
            <div className="mt-6 text-center pb-20 md:pb-6">
              {hasMore ? (
                <button onClick={loadMore} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">تحميل المزيد</button>
              ) : (
                <p className="text-gray-500">لا يوجد المزيد من المنتجات</p>
              )}
            </div>
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
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={removeFromCart}
            onAddService={addService}
            onUpdateService={updateService}
            onRemoveService={removeService}
            onCheckout={handleCheckout}
            processing={processing}
            discount={discount}
            discountType={discountType}
            extraFee={extraFee}
            paymentMethod={paymentMethod}
            onDiscountChange={(v) => setDiscount(Number(v))}
            onDiscountTypeChange={(v) => setDiscountType(v)}
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
                    extraFee={extraFee}
                    paymentMethod={paymentMethod}
                    onDiscountChange={(v) => setDiscount(Number(v))}
                    onDiscountTypeChange={(v) => setDiscountType(v)}
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

      {/* Quick Add Modal */}
      <QuickAddProductModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAddSuccess}
        setToast={setToast}
      />

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