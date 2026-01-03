"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { useCashierSync } from '@/app/hooks/useCashierSync';

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState('categories'); // 🆕 categories or products
  const [toast, setToast] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [discountApplyMode, setDiscountApplyMode] = useState('both');
  const [extraFee, setExtraFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Add pos-page class to body on mount
  useEffect(() => {
    document.body.classList.add('pos-page');
    return () => {
      document.body.classList.remove('pos-page');
    };
  }, []);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [editingProductId, setEditingProductId] = useState(null); // 🆕 للتعديل
  const [variationSelectorProduct, setVariationSelectorProduct] = useState(null); // 🆕 للـ variation selector
  const [variationSelectorVariations, setVariationSelectorVariations] = useState([]); // 🆕 variations list
  // 🆕 حالة الدفع للتوصيل
  const [deliveryPaymentStatus, setDeliveryPaymentStatus] = useState('cash_on_delivery');
  const [deliveryPaidAmount, setDeliveryPaidAmount] = useState(0);
  const [deliveryPaymentNote, setDeliveryPaymentNote] = useState('');

  // 🆕 Multi-Tabs System for Multiple Invoices
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  
  // 🆕 Invoices Modal
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);

  const {
    products: allProducts = [],
    cart = [],
    services = [],
    categories = [],
    loading = false,
    processing = false,
    lastSync,
    syncInProgress,
    vendorInfo, // 🆕 Vendor info for logo fallback
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
    syncAllProducts,
    addToCart,
    updateQuantity,
    removeFromCart,
    processCheckout,
    addService,
    updateService,
    removeService,
    updateProduct,
  } = usePOSStore();

  // 🚀 Auto-sync كل 30 ثانية
  const { syncNow } = useCashierSync();

  // 🔍 Frontend filtering - البحث والفلترة على الداتا المحملة locally
  const filteredProducts = useMemo(() => {
    let filtered = allProducts;

    // فلترة حسب الكاتجوري
    if (category && category !== 'all') {
      filtered = filtered.filter(product =>
        product.categories?.some(cat => cat.id === parseInt(category))
      );
    }

    // فلترة حسب البحث
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allProducts, category, search]);

  // 🆕 تحميل Tabs من localStorage
  useEffect(() => {
    const savedTabs = localStorage.getItem('posTabs');
    const savedActiveTabId = localStorage.getItem('posActiveTabId');
    
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        if (parsedTabs.length > 0) {
          setTabs(parsedTabs);
          setActiveTabId(savedActiveTabId || parsedTabs[0].id);
          return;
        }
      } catch (error) {
        console.error('Error loading tabs:', error);
      }
    }
    
    // إنشاء tab افتراضية إذا لم توجد
    const defaultTab = createNewTab(null); // null = استخدم الترتيب التلقائي
    setTabs([defaultTab]);
    setActiveTabId(defaultTab.id);
  }, []);

  // 🆕 حفظ Tabs في localStorage عند التغيير
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem('posTabs', JSON.stringify(tabs));
      localStorage.setItem('posActiveTabId', activeTabId);
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (!initialized) {
      // تحميل الموظفين النشطين
      loadEmployees();
      setInitialized(true);
    }
  }, [initialized]);

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

  // 🆕 Multi-Tabs Functions
  const getInvoiceNumberName = (index) => {
    const arabicNumbers = {
      1: 'أول',
      2: 'تاني',
      3: 'تالت',
      4: 'رابع',
      5: 'خامس',
      6: 'سادس',
      7: 'سابع',
      8: 'تامن',
      9: 'تاسع',
      10: 'عاشر'
    };
    
    if (index <= 10) {
      return `${arabicNumbers[index]} فاتورة`;
    } else {
      return `${index} فاتورة`;
    }
  };

  // 🆕 دالة لحساب اسم الـ tab حسب موقعه
  const getTabDisplayName = (tab, index) => {
    // إذا كان Tab معدل يدوياً (له custom name)، استخدم الاسم المخصص
    // وإلا احسب الاسم حسب الترتيب
    if (tab.customName) {
      return tab.customName;
    }
    return getInvoiceNumberName(index + 1);
  };

  const createNewTab = (name) => {
    return {
      id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customName: name || null, // null = استخدم الترتيب التلقائي
      cart: [],
      services: [],
      discount: 0,
      discountType: 'amount',
      discountApplyMode: 'both',
      extraFee: 0,
      deliveryFee: 0,
      deliveryNotes: '',
      deliveryPaymentStatus: 'cash_on_delivery',
      deliveryPaidAmount: 0,
      deliveryPaymentNote: '',
      paymentMethod: 'cash',
      orderType: 'store',
      selectedCustomer: null,
      createdAt: new Date().toISOString()
    };
  };

  const addNewTab = () => {
    const newTab = createNewTab();
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setToast({ message: '✅ تم إنشاء فاتورة جديدة', type: 'success' });
  };

  const closeTab = (tabId) => {
    if (tabs.length === 1) {
      setToast({ message: '⚠️ لا يمكن إغلاق آخر فاتورة', type: 'error' });
      return;
    }
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    
    // إذا كان Tab المغلق هو النشط، انتقل للتالي أو السابق
    if (activeTabId === tabId) {
      const nextTab = newTabs[tabIndex] || newTabs[tabIndex - 1] || newTabs[0];
      setActiveTabId(nextTab.id);
    }
  };

  const updateActiveTab = (updates) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  };

  const renameTab = (tabId, newName) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, customName: newName } : tab
    ));
  };

  // Get active tab data
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // 🔍 معالجة البحث - instant local filtering
  const handleSearch = (e) => {
    setSearch(e.target.value);
    // الفلترة تتم automatically في useMemo
  };

  // 🆕 دالة اختيار التصنيف
  const handleSelectCategory = (categoryId) => {
    setCategory(categoryId);
    setViewMode('products');
    setSearch(''); // مسح البحث
  };

  // 🆕 دالة الرجوع للتصنيفات
  const handleBackToCategories = () => {
    setViewMode('categories');
    setCategory('all');
    setSearch('');
  };

  const handleAddToCart = async (p) => {
    if (!activeTab) return;
    
    // Handle custom quantity set
    if (p._setQuantity !== undefined) {
      if (p._setQuantity === 0) {
        // Remove from tab cart - نحذف بس المنتج المحدد مش كل المنتجات
        updateActiveTab({
          cart: activeTab.cart.filter(item => {
            const matches = (item.is_variation && item.variation_id === p.variation_id) || 
                           (!item.is_variation && item.id === p.id);
            return !matches; // نخلي كل حاجة ما عدا اللي بنحذفه
          })
        });
      } else {
        // Update to specific quantity in tab cart
        const existingItem = activeTab.cart.find(item => 
          (item.is_variation && item.variation_id === p.variation_id) || 
          (!item.is_variation && item.id === p.id)
        );
        if (existingItem) {
          updateActiveTab({
            cart: activeTab.cart.map(item => {
              const matches = (item.is_variation && item.variation_id === p.variation_id) || 
                             (!item.is_variation && item.id === p.id);
              return matches ? { ...item, quantity: p._setQuantity } : item;
            })
          });
        }
      }
    } else {
      // Normal add to tab cart
      const existingItem = activeTab.cart.find(item => 
        (item.is_variation && item.variation_id === p.variation_id) || 
        (!item.is_variation && item.id === p.id)
      );
      if (existingItem) {
        if (existingItem.quantity < p.stock_quantity) {
          updateActiveTab({
            cart: activeTab.cart.map(item => {
              const matches = (item.is_variation && item.variation_id === p.variation_id) || 
                             (!item.is_variation && item.id === p.id);
              return matches ? { ...item, quantity: item.quantity + 1 } : item;
            })
          });
        } else {
          setToast({ message: 'الكمية المتاحة غير كافية', type: 'error' });
        }
      } else {
        updateActiveTab({
          cart: [...activeTab.cart, { ...p, quantity: 1 }]
        });
      }
    }
  };

  const handleQuickAddSuccess = async () => {
    // تحديث المنتج في الـ cache
    await syncNow();
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

    // 🔥 استخدم handleAddToCart للإضافة للـ active tab بدل addToCart من store
    handleAddToCart(variationProduct);
    
    // إغلاق الـ modal
    setVariationSelectorProduct(null);
    setVariationSelectorVariations([]);
    
    setToast({ message: `✅ تمت إضافة "${variationProduct.name}"`, type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  const handleUpdateQuantity = async (id, qty) => {
    if (!activeTab) return;
    
    if (qty <= 0) {
      updateActiveTab({
        cart: activeTab.cart.filter(item => item.id !== id)
      });
    } else {
      updateActiveTab({
        cart: activeTab.cart.map(item =>
          item.id === id ? { ...item, quantity: qty } : item
        )
      });
    }
  };

  const handleCheckout = async () => {
    if (!activeTab) return;
    
    if ((!activeTab.cart || activeTab.cart.length === 0) && (!activeTab.services || activeTab.services.length === 0)) {
      return setToast({ message: 'السلة فارغة - أضف منتجات أو خدمات', type: 'error' });
    }
    
    // 🆕 التحقق من اختيار الموظف البائع
    if (!selectedEmployee) {
      return setToast({ 
        message: '⚠️ يرجى اختيار الموظف البائع أولاً', 
        type: 'error' 
      });
    }
    
    if (activeTab.discountType === 'percentage' && activeTab.discount > 100) {
      return setToast({ message: 'نسبة الخصم لا يمكن أن تتجاوز 100%', type: 'error' });
    }
    if (activeTab.discount < 0 || activeTab.extraFee < 0) {
      return setToast({ message: 'قيمة غير صالحة', type: 'error' });
    }

    // 🔄 نسخ بيانات الفاتورة للـ Zustand store للمعالجة
    // نحط المنتجات في الـ cart المؤقت
    for (const item of activeTab.cart) {
      await addToCart(item);
      if (item.quantity > 1) {
        await updateQuantity(item.id, item.quantity);
      }
    }
    
    // نحط الخدمات
    for (const service of activeTab.services || []) {
      await addService(service.description, service.amount);
    }
    
    // نحط باقي البيانات
    setDiscount(activeTab.discount);
    setDiscountType(activeTab.discountType);
    setDiscountApplyMode(activeTab.discountApplyMode);
    setExtraFee(activeTab.extraFee);
    setPaymentMethod(activeTab.paymentMethod);
    setOrderType(activeTab.orderType);
    selectCustomer(activeTab.selectedCustomer);
    setDeliveryFee(activeTab.deliveryFee);
    setDeliveryNotes(activeTab.deliveryNotes);
    setDeliveryPaymentStatus(activeTab.deliveryPaymentStatus);
    setDeliveryPaidAmount(activeTab.deliveryPaidAmount);
    setDeliveryPaymentNote(activeTab.deliveryPaymentNote);

    const result = await processCheckout({ 
      discount: activeTab.discount, 
      discountType: activeTab.discountType,
      discountApplyMode: activeTab.discountApplyMode,
      extraFee: activeTab.extraFee, 
      paymentMethod: activeTab.paymentMethod,
      soldBy: {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.employeeCode
      },
      deliveryPayment: activeTab.orderType === 'delivery' ? {
        status: activeTab.deliveryPaymentStatus,
        paidAmount: activeTab.deliveryPaymentStatus === 'half_paid' ? activeTab.deliveryPaidAmount : null,
        note: activeTab.deliveryPaymentStatus === 'half_paid' ? activeTab.deliveryPaymentNote : null
      } : null
    });
    
    if (result.success && result.invoice) {
      setLastInvoice(result.invoice);
      setShowInvoice(true);
      setToast({ message: 'تم إنشاء الفاتورة وتحديث المخزون بنجاح ✅', type: 'success' });
      
      // إعادة تهيئة الـ tab الحالي (مسح السلة)
      updateActiveTab(createNewTab(activeTab.customName));
      
      // 🔄 إعادة تحميل البيانات بعد البيع
      try {
        await syncAllProducts();
        
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
        }, 2000);
        
        setTimeout(() => clearInterval(checkSyncStatus), 40000);
      } catch (error) {
        console.error('Error reloading data after checkout:', error);
      }
    } else {
      setToast({ message: result.error || 'فشل أثناء المحاولة', type: 'error' });
    }
  };

  return (
    <>
      {/* Hide Layout for POS Page */}
      <style jsx global>{`
        body.pos-page nav,
        body.pos-page .print\\:hidden:not(.pos-content),
        body.pos-page header {
          display: none !important;
        }
        body.pos-page main {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
      `}</style>
      
      <div className="h-screen flex flex-col bg-gray-100 pos-content">
        {/* Header */}
        <div className="bg-blue-900 text-white shadow-lg sticky top-0 z-30">
          <div className="max-w-screen-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              {/* Logo */}
              <div className="flex items-center gap-2 bg-blue-800 px-3 py-2 rounded-lg">
                <span className="text-2xl">🏪</span>
                <span className="font-bold text-lg hidden md:inline">كاشير</span>
              </div>

              {/* Search Bar */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="🔍 ابحث عن منتج..."
                  value={search}
                  onChange={handleSearch}
                  className="w-full px-4 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Employee Selector - Compact */}
              <div className="w-48">
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

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* View Invoices Button */}
                <button
                  onClick={() => setShowInvoicesModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                  title="شوف الفواتير"
                >
                  <span>📋</span>
                  <span className="hidden lg:inline">شوف الفواتير</span>
                </button>

                {/* Sync Button */}
                <button
                  onClick={syncNow}
                  disabled={syncInProgress}
                  className="bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  title="تحديث الآن"
                >
                  <span className={syncInProgress ? 'animate-spin text-xl' : 'text-xl'}>🔄</span>
                </button>

                {/* Quick Add */}
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors hidden md:flex items-center gap-2"
                  title="إضافة منتج"
                >
                  <span>➕</span>
                  <span className="hidden lg:inline">منتج جديد</span>
                </button>
              </div>
            </div>

            {/* 🆕 Multi-Tabs for Multiple Invoices */}
            {tabs.length > 0 && (
              <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
                {/* Tabs List */}
                {tabs.map((tab, index) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all group relative ${
                      tab.id === activeTabId
                        ? 'bg-white text-blue-900 shadow-md font-bold'
                        : 'bg-blue-800 hover:bg-blue-700 text-white'
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <span className="text-sm">
                      {tab.orderType === 'delivery' ? '🚚' : '🏪'}
                    </span>
                    <span className="text-xs whitespace-nowrap">{getTabDisplayName(tab, index)}</span>
                    {tab.cart && tab.cart.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        tab.id === activeTabId ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {tab.cart.length}
                      </span>
                    )}
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className={`text-xs hover:text-red-500 transition-colors ${
                          tab.id === activeTabId ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="إغلاق الفاتورة"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add New Tab Button */}
                <button
                  onClick={addNewTab}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all text-xs font-bold whitespace-nowrap"
                  title="إضافة فاتورة جديدة"
                >
                  <span>➕</span>
                  <span>فاتورة</span>
                </button>
              </div>
            )}

            {/* Breadcrumb */}
            {viewMode === 'products' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToCategories}
                  className="bg-blue-800 px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-bold"
                >
                  <span>⬅️</span>
                  <span>كل الأقسام</span>
                </button>
                {category !== 'all' && (
                  <div className="bg-orange-500 px-3 py-1 rounded-lg flex items-center gap-2 text-sm font-bold">
                    <span>📂</span>
                    <span>{categories.find(c => c.id === parseInt(category))?.name || 'القسم الحالي'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🎨 Main Content Area */}
        <div className="flex-1 flex overflow-hidden" dir="ltr">
          {/* 📦 Products Area - LEFT SIDE (الشمال) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50" dir="rtl">
            <div className="max-w-screen-2xl mx-auto">
              {/* Employee Selector - Mobile */}
              <div className="md:hidden mb-4">
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

              {viewMode === 'categories' ? (
                <CategoryGrid
                  categories={categories}
                  onSelectCategory={handleSelectCategory}
                  loading={loading}
                />
              ) : (
                <ProductGrid
                  products={filteredProducts}
                  loading={loading}
                  onAddToCart={handleAddToCart}
                  onEdit={setEditingProductId}
                  onSelectVariation={handleSelectVariation}
                  cart={activeTab?.cart || cart}
                  vendorId={vendorInfo?.id} // 🆕 Pass vendor ID for logo fallback
                />
              )}
            </div>
          </div>

          {/* 🛒 Cart - RIGHT SIDE (اليمين) */}
          <div className="hidden md:flex w-80 bg-white shadow-xl border-l border-gray-200 flex-col ml-auto" dir="rtl">
            {/* Cart Component - Full Height Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <Cart
                items={activeTab?.cart || cart}
                services={activeTab?.services || services}
                employees={employees}
                selectedEmployee={selectedEmployee}
                orderType={activeTab?.orderType || orderType}
                selectedCustomer={activeTab?.selectedCustomer || selectedCustomer}
                onOrderTypeChange={(type) => {
                  setOrderType(type);
                  updateActiveTab({ orderType: type });
                }}
                onCustomerSelect={(customer) => {
                  selectCustomer(customer);
                  updateActiveTab({ selectedCustomer: customer });
                }}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={(id) => {
                  if (!activeTab) return;
                  updateActiveTab({
                    cart: activeTab.cart.filter(item => item.id !== id)
                  });
                }}
                onAddService={(desc, amount) => {
                  if (!activeTab) return;
                  const newService = {
                    id: Date.now().toString(),
                    description: desc,
                    amount: Number(amount)
                  };
                  updateActiveTab({
                    services: [...(activeTab.services || []), newService]
                  });
                }}
                onUpdateService={(id, field, value) => {
                  if (!activeTab) return;
                  updateActiveTab({
                    services: (activeTab.services || []).map(s =>
                      s.id === id ? { ...s, [field]: value } : s
                    )
                  });
                }}
                onRemoveService={(id) => {
                  if (!activeTab) return;
                  updateActiveTab({
                    services: (activeTab.services || []).filter(s => s.id !== id)
                  });
                }}
                onCheckout={handleCheckout}
                processing={processing}
                discount={activeTab?.discount ?? discount}
                discountType={activeTab?.discountType || discountType}
                discountApplyMode={activeTab?.discountApplyMode || discountApplyMode}
                extraFee={activeTab?.extraFee ?? extraFee}
                deliveryFee={activeTab?.deliveryFee ?? deliveryFee}
                deliveryNotes={activeTab?.deliveryNotes || deliveryNotes}
                deliveryPaymentStatus={activeTab?.deliveryPaymentStatus || deliveryPaymentStatus}
                deliveryPaidAmount={activeTab?.deliveryPaidAmount ?? deliveryPaidAmount}
                deliveryPaymentNote={activeTab?.deliveryPaymentNote || deliveryPaymentNote}
                paymentMethod={activeTab?.paymentMethod || paymentMethod}
                onDiscountChange={(v) => {
                  setDiscount(Number(v));
                  updateActiveTab({ discount: Number(v) });
                }}
                onDiscountTypeChange={(v) => {
                  setDiscountType(v);
                  updateActiveTab({ discountType: v });
                }}
                onDiscountApplyModeChange={(v) => {
                  setDiscountApplyMode(v);
                  updateActiveTab({ discountApplyMode: v });
                }}
                onExtraFeeChange={(v) => {
                  setExtraFee(Number(v));
                  updateActiveTab({ extraFee: Number(v) });
                }}
                onDeliveryFeeChange={(v) => {
                  setDeliveryFee(v);
                  updateActiveTab({ deliveryFee: v });
                }}
                onDeliveryNotesChange={(v) => {
                  setDeliveryNotes(v);
                  updateActiveTab({ deliveryNotes: v });
                }}
                onDeliveryPaymentStatusChange={(v) => {
                  setDeliveryPaymentStatus(v);
                  updateActiveTab({ deliveryPaymentStatus: v });
                }}
                onDeliveryPaidAmountChange={(v) => {
                  setDeliveryPaidAmount(v);
                  updateActiveTab({ deliveryPaidAmount: v });
                }}
                onDeliveryPaymentNoteChange={(v) => {
                  setDeliveryPaymentNote(v);
                  updateActiveTab({ deliveryPaymentNote: v });
                }}
                onPaymentMethodChange={(v) => {
                  setPaymentMethod(v);
                  updateActiveTab({ paymentMethod: v });
                }}
                onPaymentStatusChange={(v) => { // 🆕 حالة الدفع
                  updateActiveTab({ paymentStatus: v });
                }}
                paymentStatus={activeTab?.paymentStatus || 'paid_full'} // 🆕 حالة الدفع
              />
            </div>
          </div>
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

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
      </div>

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        mode="create"
        onSuccess={(data) => {
          setToast({ message: '✅ تم إضافة المنتج بنجاح', type: 'success' });
          syncNow(); // مزامنة سريعة
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
          syncNow(); // مزامنة سريعة
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

      {/* 🆕 Invoices Modal */}
      {showInvoicesModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowInvoicesModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full h-[90vh] max-w-7xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📋</span>
                <h2 className="text-2xl font-bold">الفواتير</h2>
              </div>
              <button
                onClick={() => setShowInvoicesModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-colors text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="/pos/invoices"
                className="w-full h-full border-0"
                title="الفواتير"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}