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
import BulkUploadModal from '@/components/BulkUploadModal';
import WholesalePricingModal from '@/components/WholesalePricingModal';

// 🔧 دالة معالجة الأحرف العربية
const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ء')
    .replace(/[ة]/g, 'ه')  // تاء مربوطة → هاء
    .replace(/[\u064B-\u065F]/g, ''); // إزالة التشكيل
};

export default function POSPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // 🆕 Debounced search
  const [searchType, setSearchType] = useState('text'); // 🆕 'text', 'price', 'stock', 'variable'
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [stockFrom, setStockFrom] = useState('');
  const [stockTo, setStockTo] = useState('');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState('categories'); // 🆕 categories or products
  const [toast, setToast] = useState(null);
  const [discount, setDiscount] = useState(0);

  // 🆕 Bulk price update state
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState([]);
  const [bulkScope, setBulkScope] = useState('selected'); // selected | all | category
  const [bulkCategoryIds, setBulkCategoryIds] = useState([]); // Multi-category support
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkShowSelectedOnly, setBulkShowSelectedOnly] = useState(false);
  const [bulkOperation, setBulkOperation] = useState('increase'); // increase | decrease | set
  const [bulkValueType, setBulkValueType] = useState('percentage'); // percentage | amount
  const [bulkPriceTarget, setBulkPriceTarget] = useState('both'); // both | regular | sale
  const [bulkValue, setBulkValue] = useState('');
  const [bulkSetPrices, setBulkSetPrices] = useState({}); // key -> new set price (per product)
  const [bulkApplying, setBulkApplying] = useState(false);
  const [discountType, setDiscountType] = useState('amount');
  const [discountApplyMode, setDiscountApplyMode] = useState('both');
  const [extraFee, setExtraFee] = useState(0);
  const [extraFeeType, setExtraFeeType] = useState('amount');
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
  const [showBulkUpload, setShowBulkUpload] = useState(false); // 🆕 Bulk Upload Modal
  const [showWholesaleModal, setShowWholesaleModal] = useState(false); // 🆕 Wholesale Pricing Modal
  // 🆕 حالة الدفع للتوصيل
  const [deliveryPaymentStatus, setDeliveryPaymentStatus] = useState('cash_on_delivery');
  const [deliveryPaidAmount, setDeliveryPaidAmount] = useState(0);
  const [deliveryPaymentNote, setDeliveryPaymentNote] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // 🆕 Cart Expansion State
  const [isCartExpanded, setIsCartExpanded] = useState(false);

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

  // ⏱️ Debouncing للبحث - تأخير 300ms بعد توقف الكتابة
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 🔍 Frontend filtering - البحث والفلترة على الداتا المحملة locally
  const filteredProducts = useMemo(() => {
    let filtered = allProducts;

    // فلترة حسب الكاتجوري
    if (category && category !== 'all') {
      filtered = filtered.filter(product =>
        product.categories?.some(cat => cat.id === parseInt(category))
      );
    }

    // 🆕 البحث بالسعر
    if (searchType === 'price' && (priceFrom || priceTo)) {
      const minPrice = priceFrom ? parseFloat(priceFrom) : 0;
      const maxPrice = priceTo ? parseFloat(priceTo) : Infinity;
      
      filtered = filtered.filter(product => {
        const productPrice = parseFloat(product.price) || 0;
        return productPrice >= minPrice && productPrice <= maxPrice;
      });
    }
    // 🆕 البحث بالكمية (Stock)
    else if (searchType === 'stock' && (stockFrom || stockTo)) {
      const minStock = stockFrom ? parseFloat(stockFrom) : 0;
      const maxStock = stockTo ? parseFloat(stockTo) : Infinity;
      
      filtered = filtered.filter(product => {
        const productStock = parseFloat(product.stock_quantity) || 0;
        return productStock >= minStock && productStock <= maxStock;
      });
    }
    // 🆕 المنتجات المتعددة (Variable Products)
    else if (searchType === 'variable') {
      filtered = filtered.filter(product => 
        product.type === 'variable' || product.is_variation === true
      );
    }
    // البحث بالكلام
    else if (searchType === 'text' && debouncedSearch.trim()) {
      const searchWords = normalizeArabic(debouncedSearch.toLowerCase().trim()).split(/\s+/);
      
      filtered = filtered
        .map(product => {
          const productName = normalizeArabic(product.name?.toLowerCase() || '');
          const productSku = normalizeArabic(product.sku?.toLowerCase() || '');
          const productBarcode = normalizeArabic(product.barcode?.toLowerCase() || '');
          const categoryNames = product.categories?.map(c => normalizeArabic(c.name?.toLowerCase() || '')).join(' ') || '';
          
          // أولاً: تحقق إن كل الكلمات موجودة (شرط أساسي)
          const allWordsMatch = searchWords.every(word =>
            productName.includes(word) || productSku.includes(word) || productBarcode.includes(word) || categoryNames.includes(word)
          );
          
          if (!allWordsMatch) {
            return null; // لو مش كل الكلمات موجودة، استبعد المنتج
          }
          
          // حساب Score للترتيب (بس للمنتجات اللي فيها كل الكلمات)
          let score = 0;
          
          searchWords.forEach(word => {
            // بحث في الاسم
            if (productName.includes(word)) {
              score += 10;
              // بونص لو الكلمة في البداية
              if (productName.startsWith(word)) score += 20;
            }
            
            // بحث في SKU (أولوية عالية)
            if (productSku.includes(word)) {
              score += 50;
              if (productSku === word) score += 100; // Match كامل
            }
            
            // بحث في الباركود (أولوية عالية جداً)
            if (productBarcode && productBarcode.includes(word)) {
              score += 200;
              if (productBarcode === word) score += 500; // Match كامل
            }
            
            // بحث في الكاتيجوري (أولوية متوسطة)
            if (categoryNames.includes(word)) {
              score += 5;
            }
          });
          
          // بونص إضافي لو كل الكلمات موجودة في الاسم لوحده
          const allWordsInName = searchWords.every(word => productName.includes(word));
          if (allWordsInName) score += 15;
          
          return { product, score };
        })
        .filter(item => item !== null) // استبعاد المنتجات المرفوضة
        .sort((a, b) => b.score - a.score) // ترتيب حسب الـ Score (الأعلى أولاً)
        .map(item => item.product); // استخراج المنتجات
    }

    // 🔥 إنشاء unique ID لكل منتج للتخلص من duplicate keys
    return filtered.map(product => {
      // إذا كان variation، أضف parent_id و unique id
      if (product.is_variation && product.variation_id) {
        return {
          ...product,
          uniqueId: `${product.parent_id}_var_${product.variation_id}`,
          // نخلي الـ id الأصلي كما هو للـ backend
        };
      }
      return {
        ...product,
        uniqueId: `prod_${product.id}`, // unique ID للمنتجات العادية
      };
    });
  }, [allProducts, category, debouncedSearch, searchType, priceFrom, priceTo, stockFrom, stockTo]);

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

  // 🔥 التأكد دايماً إن الـ activeTabId موجود ضمن الـ tabs
  useEffect(() => {
    if (tabs.length > 0) {
      const activeExists = tabs.some(t => t.id === activeTabId);
      if (!activeExists) {
        // لو الـ activeTabId مش موجود، اختار أول tab
        setActiveTabId(tabs[0].id);
      }
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
      extraFeeType: 'amount',
      deliveryFee: 0,
      deliveryNotes: '',
      deliveryPaymentStatus: 'cash_on_delivery',
      deliveryPaidAmount: 0,
      deliveryPaymentNote: '',
      orderNotes: '',
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
    setTabs(prevTabs => prevTabs.map(tab => 
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

  // 🆕 Toggle selection for bulk operations
  const handleBulkToggle = (productId, checked) => {
    setSelectedBulkIds(prev => {
      const normalizedId = productId.toString();
      if (checked) {
        if (!prev.includes(normalizedId)) return [...prev, normalizedId];
        return prev;
      } else {
        return prev.filter(id => id !== normalizedId);
      }
    });
  };

  // 🆕 Toggle single selected product key
  const addBulkSelection = (productKey) => {
    setSelectedBulkIds(prev => [...new Set([...prev, productKey])]);
  };

  const removeBulkSelection = (productKey) => {
    setSelectedBulkIds(prev => prev.filter(id => id !== productKey));
  };

  // 🆕 Clear selected bulk after apply
  const clearBulkSelection = () => {
    setSelectedBulkIds([]);
    setBulkScope('selected');
    setBulkCategoryIds([]);
    setBulkSearch('');
    setBulkShowSelectedOnly(false);
    setBulkOperation('increase');
    setBulkValueType('percentage');
    setBulkPriceTarget('both');
    setBulkValue('');
    setBulkSetPrices({});
  };

  // 🆕 حساب المنتجات المستهدفة للبريك ال bulk
  const getBulkTargetProducts = () => {
    let target = [];
    if (bulkScope === 'all') {
      target = allProducts || [];
    } else if (bulkScope === 'category') {
      const ids = bulkCategoryIds.map(id => id.toString());
      if (ids.length === 0) return [];
      target = (allProducts || []).filter(product =>
        product.categories?.some(cat => ids.includes(cat.id?.toString()))
      );
    } else {
      // selected
      target = (allProducts || []).filter(product => {
        const productKey = product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`);
        return selectedBulkIds.includes(productKey.toString());
      });
    }
    return target;
  };

  // 🆕 المنتجات اللي تظهر في صندوق التحديد (لـ selected نعرض الكل لأول مرة)
  const getBulkSelectableProducts = () => {
    if (bulkScope === 'selected') {
      return allProducts || [];
    }
    return getBulkTargetProducts();
  };

  const filteredBulkProducts = (() => {
    const baseProducts = getBulkSelectableProducts();
    const query = (bulkSearch || '').toLowerCase().trim();
    const searchFiltered = !query ? baseProducts : baseProducts.filter((product) => {
      const productName = (product.name || product.title || '').toLowerCase();
      const productSku = (product.sku || '').toLowerCase();
      return productName.includes(query) || productSku.includes(query);
    });

    if (!bulkShowSelectedOnly) return searchFiltered;

    return searchFiltered.filter((product) => {
      const productKey = product.uniqueId || (product.is_variation && product.variation_id
        ? `${product.parent_id}_var_${product.variation_id}`
        : `prod_${product.id}`);
      return selectedBulkIds.includes(productKey.toString());
    });
  })();

  const bulkTotalInScope = getBulkSelectableProducts().length;
  const bulkFilteredCount = filteredBulkProducts.length;

  // 🆕 Auto-select products when scope changes
  useEffect(() => {
    if (bulkScope === 'all') {
      // اختار كل المنتجات المرئية
      const allKeys = (filteredProducts || []).map(prod => 
        prod.uniqueId || (prod.is_variation && prod.variation_id ? `${prod.parent_id}_var_${prod.variation_id}` : `prod_${prod.id}`)
      );
      setSelectedBulkIds(allKeys.map(k => k.toString()));
    } else if (bulkScope === 'category' && bulkCategoryIds.length > 0) {
      // اختار منتجات الفئات المختارة
      const categoryProducts = (allProducts || []).filter(product =>
        product.categories?.some(cat => bulkCategoryIds.includes(cat.id?.toString()))
      );
      const categoryKeys = categoryProducts.map(prod =>
        prod.uniqueId || (prod.is_variation && prod.variation_id ? `${prod.parent_id}_var_${prod.variation_id}` : `prod_${prod.id}`)
      );
      setSelectedBulkIds(categoryKeys.map(k => k.toString()));
    }
  }, [bulkScope, bulkCategoryIds, filteredProducts, allProducts]);

  // 🆕 تطبيق التعديل الجماعي على الأسعار
  const applyBulkPriceUpdate = async () => {
    const targetProducts = getBulkTargetProducts();

    if (targetProducts.length === 0) {
      setToast({ message: 'لا يوجد منتجات محددة للتعديل', type: 'error' });
      return;
    }

    const globalAmount = bulkValue !== '' && !isNaN(parseFloat(bulkValue))
      ? parseFloat(bulkValue)
      : null;

    if (bulkOperation !== 'set' && (globalAmount === null || globalAmount < 0)) {
      setToast({ message: 'من فضلك أدخل قيمة صحيحة', type: 'error' });
      return;
    }

    if (bulkOperation === 'set') {
      const missingProducts = targetProducts.filter((product) => {
        const productKey = (product.uniqueId || (product.is_variation && product.variation_id
          ? `${product.parent_id}_var_${product.variation_id}`
          : `prod_${product.id}`)).toString();
        const manualValue = bulkSetPrices[productKey];
        const manualNumeric = manualValue !== undefined && manualValue !== '' ? parseFloat(manualValue) : NaN;
        const hasManual = !isNaN(manualNumeric) && manualNumeric >= 0;
        const hasGlobal = globalAmount !== null && globalAmount >= 0;
        return !hasManual && !hasGlobal;
      });

      if (missingProducts.length > 0) {
        setToast({ message: 'اكتب سعر جديد لكل منتج أو أدخل سعر موحد سريع', type: 'error' });
        return;
      }
    }

    const targetKeys = targetProducts.map(product =>
      (product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`)).toString()
    );

    const priceUpdates = targetProducts.map(product => {
      return {
        id: product.id,
        type: product.type,
        parent_id: product.parent_id,
        variation_id: product.variation_id,
        is_variation: !!(product.is_variation && product.variation_id),
        current_price: parseFloat(product.price) || 0,
        current_regular_price: parseFloat(product.regular_price || product.price) || 0,
        current_sale_price: product.sale_price,
        manual_set_price: (() => {
          const manualValue = bulkSetPrices[(product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`)).toString()];
          if (manualValue === undefined || manualValue === '') return null;
          const parsed = parseFloat(manualValue);
          return isNaN(parsed) ? null : parsed;
        })(),
        productKey: (product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`)).toString(),
      };
    });

    try {
      setBulkApplying(true);

      const response = await fetch('/api/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          updates: priceUpdates,
          operation: bulkOperation,
          valueType: bulkValueType,
          value: globalAmount,
          priceTarget: bulkPriceTarget,
          clearSaleOnRegular: true,
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل تعديل الأسعار على السيرفر');
      }

      const regularPriceMap = new Map();
      const salePriceMap = new Map();

      (result.applied || []).forEach((entry) => {
        const key = entry.is_variation
          ? `${entry.parent_id}_var_${entry.variation_id}`
          : `prod_${entry.id}`;

        if (entry.new_regular_price !== null && entry.new_regular_price !== undefined) {
          regularPriceMap.set(key, entry.new_regular_price);
        }

        if (entry.new_sale_price !== null && entry.new_sale_price !== undefined) {
          salePriceMap.set(key, entry.new_sale_price);
        }
      });

      targetProducts.forEach(product => {
        const productKey = (product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`)).toString();
        const hasRegularUpdate = regularPriceMap.has(productKey);
        const hasSaleUpdate = salePriceMap.has(productKey);
        const nextRegular = hasRegularUpdate ? regularPriceMap.get(productKey) : null;
        const nextSale = hasSaleUpdate ? salePriceMap.get(productKey) : null;

        if (!hasRegularUpdate && !hasSaleUpdate) return;

        const resolvedRegular = hasRegularUpdate
          ? nextRegular
          : (parseFloat(product.regular_price || product.price) || 0);

        const hasSaleValue = hasSaleUpdate && nextSale !== '';
        const resolvedPrice = hasSaleValue
          ? parseFloat(nextSale)
          : resolvedRegular;

        updateProduct(product.id, {
          price: resolvedPrice,
          regular_price: resolvedRegular,
          ...(hasSaleUpdate ? { sale_price: nextSale } : {})
        });
      });

      if (activeTab && activeTab.cart) {
        const updatedCart = activeTab.cart.map(item => {
          const itemKey = item.id?.toString();
          const hasRegularUpdate = regularPriceMap.has(itemKey);
          const hasSaleUpdate = salePriceMap.has(itemKey);
          if (!hasRegularUpdate && !hasSaleUpdate) return item;

          const nextRegular = hasRegularUpdate
            ? regularPriceMap.get(itemKey)
            : (parseFloat(item.regular_price || item.price) || 0);

          const nextSale = hasSaleUpdate ? salePriceMap.get(itemKey) : item.sale_price;
          const hasSaleValue = nextSale !== '' && nextSale !== null && nextSale !== undefined;

          return {
            ...item,
            price: hasSaleValue ? parseFloat(nextSale) : nextRegular,
            regular_price: nextRegular,
            ...(hasSaleUpdate ? { sale_price: nextSale } : {})
          };
        });
        updateActiveTab({ cart: updatedCart });
      }

      setToast({
        message: `✅ تم تعديل ${result.updatedCount || targetProducts.length} منتج فعلياً على السيرفر${result.mode === 'fallback-individual' ? ' (بوضع متوافق)' : ''}`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 3000);
      clearBulkSelection();
      setBulkPanelOpen(false);

      syncAllProducts().catch((error) => {
        console.error('Failed to resync products after bulk price update:', error);
      });
    } catch (error) {
      setToast({ message: error.message || 'فشل تعديل الأسعار', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBulkApplying(false);
    }
  };

  // 🔍 معالجة البحث - instant local filtering
  const handleSearch = (e) => {
    const searchValue = e.target.value;
    setSearch(searchValue);
    
    // 🔥 إذا كتب المستخدم شيء في البحث، انتقل تلقائياً لعرض المنتجات
    if (searchValue.trim() && viewMode === 'categories') {
      setViewMode('products');
      setCategory('all'); // عرض كل المنتجات عند البحث
    }
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
        // Remove from tab cart using unique id
        updateActiveTab({
          cart: activeTab.cart.filter(item => item.id !== p.id)
        });
      } else {
        // Update to specific quantity in tab cart
        const existingItem = activeTab.cart.find(item => item.id === p.id);
        if (existingItem) {
          updateActiveTab({
            cart: activeTab.cart.map(item => 
              item.id === p.id ? { ...item, quantity: p._setQuantity } : item
            )
          });
        }
      }
    } else {
      // Normal add to tab cart
      const existingItem = activeTab.cart.find(item => item.id === p.id);
      if (existingItem) {
        if (existingItem.quantity < p.stock_quantity) {
          updateActiveTab({
            cart: activeTab.cart.map(item => 
              item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item
            )
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
      id: `${product.id}_var_${variation.id}`, // ✅ unique key للـ variation
      variation_id: variation.id,
      parent_id: product.id,
      name: `${product.name} - ${variation.description}`,
      price: variation.price,
      regular_price: variation.regular_price,
      sale_price: variation.sale_price,
      stock_quantity: variation.stock_quantity,
      manage_stock: variation.manage_stock,
      sku: variation.sku,
      images: variation.image ? [{ src: variation.image }] : product.images,
      // معلومات إضافية للـ variation
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

  // 🆕 دالة تعديل سعر المنتج في العربة (جملة فورية)
  const handleUpdateItemPrice = async (id, newPrice, variation_id) => {
    if (!activeTab) return;
    
    if (newPrice <= 0) {
      setToast({ message: 'السعر يجب أن يكون أكبر من 0', type: 'error' });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    // تحديث السعر في العربة
    const updatedCart = activeTab.cart.map(item => {
      // للمنتجات العادية
      if (!variation_id && item.id === id) {
        return { 
          ...item, 
          price: parseFloat(newPrice),
          wholesalePrice: true,
          originalPrice: item.originalPrice || item.price
        };
      }
      // للمنتجات المتغيرة
      if (variation_id && item.variation_id === variation_id) {
        return { 
          ...item, 
          price: parseFloat(newPrice),
          wholesalePrice: true,
          originalPrice: item.originalPrice || item.price
        };
      }
      return item;
    });

    updateActiveTab({
      cart: [...updatedCart]
    });

    setToast({ 
      message: `✅ تم تحديث السعر إلى ${newPrice} جنيه`, 
      type: 'success' 
    });
    setTimeout(() => setToast(null), 2000);
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
      // ✅ نحافظ على الـ ID الكامل للـ variations: ${parent_id}_var_${variation_id}
      // عشان updateQuantity يلاقي المنتج صح في الـ cart
      const productToAdd = { ...item };
      
      await addToCart(productToAdd);
      if (item.quantity > 1) {
        await updateQuantity(item.id, item.quantity);
      }
    }
    
    // نحط الخدمات
    for (const service of activeTab.services || []) {
      await addService(
        service.id, 
        service.description, 
        service.amount,
        service.employeeId,      // 🔥 نضيف employeeId
        service.employeeName,    // 🔥 نضيف employeeName
        service.employeeCode     // 🔥 نضيف employeeCode
      );
    }
    
    // نحط باقي البيانات
    setDiscount(activeTab.discount);
    setDiscountType(activeTab.discountType);
    setDiscountApplyMode(activeTab.discountApplyMode);
    setExtraFee(activeTab.extraFee);
    setExtraFeeType(activeTab.extraFeeType);
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
      extraFeeType: activeTab.extraFeeType, 
      paymentMethod: activeTab.paymentMethod,
      orderNotes: activeTab.orderNotes || '',
      soldBy: {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.id // 🔥 id هو نفسه employeeCode في structure الموظف
      },
      deliveryPayment: activeTab.orderType === 'delivery' ? {
        status: activeTab.deliveryPaymentStatus,
        paidAmount: activeTab.deliveryPaymentStatus === 'half_paid' ? activeTab.deliveryPaidAmount : null,
        note: activeTab.deliveryPaymentStatus === 'half_paid' ? activeTab.deliveryPaymentNote : null
      } : null
    });
    
    if (result.success && result.invoice) {
      setLastInvoice(result.invoice);
      
      // 🔥 فتح صفحة الطباعة فوراً (مش مستني حاجة!)
      if (result.invoice?.id) {
        const url = `/pos/invoices/print?id=${encodeURIComponent(result.invoice.id)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      
      // 🔥 إعادة تهيئة الـ tab الحالي فوراً عشان الكاشير يقدر يشتغل
      updateActiveTab({
        cart: [],
        services: [],
        discount: 0,
        discountType: 'amount',
        discountApplyMode: 'both',
        extraFee: 0,
        extraFeeType: 'amount',
        orderType: 'pickup',
        selectedCustomer: null,
        deliveryFee: 0,
        deliveryNotes: '',
        deliveryPaymentStatus: 'cash_on_delivery',
        deliveryPaidAmount: 0,
        deliveryPaymentNote: '',
        paymentMethod: 'cash',
        orderNotes: ''
      });
      
      setToast({ message: 'تم إنشاء الفاتورة ✅ جاري التحديث في الخلفية...', type: 'success' });
      
      // 🔥 إضافة المنتجات المؤقتة للسيستم في الخلفية (بدون انتظار)
      const tempProducts = activeTab.cart.filter(item => item.is_temp_product);
      if (tempProducts.length > 0) {
        console.log('🔄 Adding temp products to system:', tempProducts.length);
        
        Promise.all(
          tempProducts.map(async (item) => {
            try {
              const response = await fetch('/api/warehouse/create-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.temp_data)
              });
              const result = await response.json();
              if (result.success) {
                console.log(`✅ Added temp product: ${item.name}`);
              }
            } catch (error) {
              console.error(`❌ Failed to add temp product: ${item.name}`, error);
            }
          })
        ).then(() => {
          console.log('✅ All temp products processed');
          syncAllProducts(); // مزامنة بعد الإضافة
        });
      }
      
      // 🔄 إعادة تحميل المنتجات تلقائياً بعد الفاتورة
      setTimeout(async () => {
        try {
          await syncAllProducts();
        } catch (error) {
          console.error('Error syncing products after checkout:', error);
        }
      }, 500);
      
      // 🔄 مزامنة الفاتورة في الخلفية بدون إعادة تحميل كل المنتجات
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
          clearInterval(checkSyncStatus);
        }
      }, 2000);
      
      setTimeout(() => clearInterval(checkSyncStatus), 30000);
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
          <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-2">
              {/* Top Row on Mobile: Logo + Search */}
              <div className="flex items-center gap-2 w-full sm:flex-initial">
                {/* Logo */}
                <div className="flex items-center gap-2 bg-blue-800 px-2 sm:px-3 py-2 rounded-lg flex-shrink-0">
                  <span className="text-xl sm:text-2xl">🏪</span>
                  <span className="font-bold text-sm sm:text-lg hidden sm:inline">كاشير</span>
                </div>

                {/* Search Bar */}
                <div className="flex-1 flex gap-2">
                  {/* Search Type Dropdown */}
                  <select
                    value={searchType}
                    onChange={(e) => {
                      setSearchType(e.target.value);
                      // مسح القيم عند تغيير النوع
                      setPriceFrom('');
                      setPriceTo('');
                      setStockFrom('');
                      setStockTo('');
                      if (e.target.value === 'text') {
                        // لا تفعل شيء، الـ search موجود
                      } else {
                        setSearch('');
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-blue-800 text-white border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                  >
                    <option value="text">🔍 كلام</option>
                    <option value="price">💰 سعر</option>
                    <option value="stock">📦 كمية</option>
                    <option value="variable">🔀 متعدد</option>
                  </select>
                  
                  {/* Search Input or Price/Stock Range */}
                  {searchType === 'text' ? (
                    <input
                      type="text"
                      placeholder="🔍 ابحث..."
                      value={search}
                      onChange={handleSearch}
                      className="flex-1 px-3 sm:px-4 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    />
                  ) : searchType === 'price' ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        placeholder="من (ج.م)"
                        value={priceFrom}
                        onChange={(e) => setPriceFrom(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      />
                      <span className="text-white self-center">-</span>
                      <input
                        type="number"
                        placeholder="إلى (ج.م)"
                        value={priceTo}
                        onChange={(e) => setPriceTo(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      />
                    </div>
                  ) : searchType === 'stock' ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="number"
                        placeholder="من (عدد)"
                        value={stockFrom}
                        onChange={(e) => setStockFrom(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      />
                      <span className="text-white self-center">-</span>
                      <input
                        type="number"
                        placeholder="إلى (عدد)"
                        value={stockTo}
                        onChange={(e) => setStockTo(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-blue-800 text-white placeholder-blue-300 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 px-3 py-2 rounded-lg bg-blue-700 text-white text-center text-sm sm:text-base">
                      📋 عرض المنتجات المتعددة فقط
                    </div>
                  )}
                </div>
              </div>

              {/* Second Row on Mobile: Employee + Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Employee Selector - Compact */}
                <div className="flex-1 sm:flex-initial sm:w-48">
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
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Wholesale Pricing Button */}
                  <button
                    onClick={() => setShowBulkUpload(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2"
                    title="إضافة منتجات متعددة"
                  >
                    <span className="text-sm sm:text-base">📦</span>
                    <span className="hidden lg:inline text-sm sm:text-base"> متعددة</span>
                  </button>

                  <button
                    onClick={() => setShowWholesaleModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2"
                    title="تسعير جملة"
                  >
                    <span className="text-sm sm:text-base">🏪</span>
                    <span className="hidden lg:inline text-sm sm:text-base">جملة</span>
                  </button>

                  {/* View Invoices Button */}
                  <button
                    onClick={() => setShowInvoicesModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 sm:px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2"
                    title="شوف الفواتير"
                  >
                    <span className="text-sm sm:text-base">📋</span>
                    <span className="hidden lg:inline text-sm sm:text-base"> فواتير</span>
                  </button>

                  {/* Sync Button */}
                  <button
                    onClick={syncNow}
                    disabled={syncInProgress}
                    className="bg-blue-800 hover:bg-blue-700 px-2 sm:px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    title="تحديث الآن"
                  >
                    <span className={`${syncInProgress ? 'animate-spin' : ''} text-base sm:text-xl`}>🔄</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowBulkUpload(false);
                      setShowWholesaleModal(false);
                      setShowInvoicesModal(false);
                      setShowMobileCart(false);
                      setBulkPanelOpen(prev => !prev);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-2 sm:px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2"
                    title="تسعير جملة"
                  >
                    <span className="text-sm sm:text-base">🔧</span>
                    <span className="hidden lg:inline text-sm sm:text-base">تسعير جماعي</span>
                  </button>

                  {/* Quick Add */}
                  <button
                    onClick={() => setShowQuickAdd(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-2 rounded-lg font-bold transition-colors md:flex items-center gap-1 sm:gap-2"
                    title="إضافة منتج"
                  >
                    <span className="text-sm sm:text-base">➕</span>
                    <span className="hidden lg:inline text-sm sm:text-base"> جديد</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 🆕 Popup for Bulk Price Update */}
            {bulkPanelOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-4">
                  <button
                    onClick={() => setBulkPanelOpen(false)}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-9 h-9 flex items-center justify-center transition-colors"
                    title="إغلاق"
                  >
                    ✕
                  </button>

                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">تعديل الأسعار بشكل جماعي</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-black">اختر المجال</label>
                      <select
                        value={bulkScope}
                        onChange={(e) => setBulkScope(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-gray-300 text-black"
                      >
                      <option value="selected">المنتجات المحددة</option>
                      <option value="all">كل المنتجات</option>
                      <option value="category">فئة محددة</option>
                    </select>
                  </div>

                  {bulkScope === 'category' && (
                    <div className="md:col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-black">اختر الفئات</label>
                      <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-white">
                        {categories.length === 0 ? (
                          <p className="text-xs text-gray-500">لا توجد فئات</p>
                        ) : (
                          categories.map(cat => {
                            const checked = bulkCategoryIds.includes(cat.id?.toString());
                            return (
                              <label key={cat.id} className="flex items-center gap-2 text-sm text-black">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBulkCategoryIds(prev => [...new Set([...prev, cat.id?.toString()])]);
                                    } else {
                                      setBulkCategoryIds(prev => prev.filter(id => id !== cat.id?.toString()));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300"
                                />
                                <span>{cat.name}</span>
                              </label>
                            );
                          })
                        )}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setBulkCategoryIds(categories.map(cat => cat.id?.toString()))}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                            type="button"
                          >
                            اختر الكل
                          </button>
                          <button
                            onClick={() => setBulkCategoryIds([])}
                            className="text-xs bg-gray-200 hover:bg-gray-300 text-black px-2 py-1 rounded"
                            type="button"
                          >
                            امسح الكل
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-black">نوع التعديل</label>
                    <select
                      value={bulkOperation}
                      onChange={(e) => setBulkOperation(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-gray-300 text-black"
                    >
                      <option value="increase">زيادة</option>
                      <option value="decrease">نقصان</option>
                      <option value="set">تحديد سعر جديد</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-black">نوع السعر المستهدف</label>
                    <select
                      value={bulkPriceTarget}
                      onChange={(e) => setBulkPriceTarget(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-gray-300 text-black"
                    >
                      <option value="both">العادي + العرض معًا</option>
                      <option value="regular">السعر العادي</option>
                      <option value="sale">سعر العرض (Sale)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => {
                      const allKeys = (getBulkTargetProducts() || []).map(prod => prod.uniqueId || (prod.is_variation && prod.variation_id ? `${prod.parent_id}_var_${prod.variation_id}` : `prod_${prod.id}`));
                      setSelectedBulkIds(allKeys.map(k => k.toString()));
                      setToast({ message: `✅ تم تحديد ${allKeys.length} منتج`, type: 'success' });
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-shadow hover:shadow-lg"
                  >
                    تحديد كل المنتجات الظاهرة
                  </button>
                  <button
                    onClick={() => setSelectedBulkIds([])}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-lg text-xs font-semibold"
                  >
                    مسح الاختيار
                  </button>
                  <button
                    onClick={() => setBulkShowSelectedOnly(prev => !prev)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${bulkShowSelectedOnly ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
                  >
                    {bulkShowSelectedOnly ? 'إظهار الكل' : 'المحدد فقط'}
                  </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-[11px]">
                    <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">داخل المجال: {bulkTotalInScope}</span>
                    <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">المعروض: {bulkFilteredCount}</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">محدد: {selectedBulkIds.length}</span>
                  </div>
                </div>


                <div className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">حدد المنتجات من القائمة</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                      نتائج: {filteredBulkProducts.length}
                    </span>
                  </div>

                  <div className="mb-3 relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder="ابحث عن منتج أو SKU..."
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {filteredBulkProducts.length === 0 ? (
                      <div className="text-center text-xs text-gray-500 py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        لا توجد منتجات مطابقة للبحث أو الفلاتر الحالية
                      </div>
                    ) : filteredBulkProducts.map((product) => {
                      const productKey = product.uniqueId || (product.is_variation && product.variation_id ? `${product.parent_id}_var_${product.variation_id}` : `prod_${product.id}`);
                      const checked = selectedBulkIds.includes(productKey.toString());
                      return (
                        <label key={productKey} className={`block rounded-xl p-2.5 border ${checked ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'} hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors space-y-2`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBulkIds(prev => [...new Set([...prev, productKey.toString()])]);
                                  } else {
                                    setSelectedBulkIds(prev => prev.filter(id => id !== productKey.toString()));
                                  }
                                }}
                                className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded"
                              />
                              <span className="text-xs font-medium text-slate-800 leading-5 break-words">
                                {product.name ?? product.title ?? product.sku ?? product.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-right leading-5 whitespace-nowrap">
                              <div className="font-semibold text-slate-700">عادي: {product.regular_price || product.price || '0'}</div>
                              <div className="font-semibold text-emerald-700">عرض: {product.sale_price || '—'}</div>
                            </div>
                          </div>

                          {bulkOperation === 'set' && checked && (
                            <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-2">
                              <span className="text-[11px] text-gray-600 whitespace-nowrap">سعر المنتج ده:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={bulkSetPrices[productKey.toString()] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkSetPrices(prev => ({ ...prev, [productKey.toString()]: val }));
                                }}
                                className="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white text-xs text-black"
                                placeholder="اكتب السعر الجديد"
                              />
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                  <div>
                    <label className="text-xs font-bold text-black">
                      {bulkOperation === 'set' ? 'سعر موحد سريع (اختياري)' : 'القيمة'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      placeholder={bulkOperation === 'set' ? 'اكتب سعر يطبق على كل المنتجات غير المحدد لها سعر' : ''}
                      className="w-full px-2 py-1 rounded-lg border border-gray-300 text-black"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-black">نوع القيمة</label>
                    <select
                      value={bulkValueType}
                      onChange={(e) => setBulkValueType(e.target.value)}
                      disabled={bulkOperation === 'set'}
                      className="w-full px-2 py-1 rounded-lg border border-gray-300 text-black"
                    >
                      <option value="percentage">٪</option>
                      <option value="amount">جنيه</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={applyBulkPriceUpdate}
                      disabled={bulkApplying}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg"
                    >
                      {bulkApplying ? 'جاري التعديل الفعلي...' : 'تطبيق تعديل الأسعار'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  اختر / حدّد المنتجات من الشبكة بالعلامات، ثم اضغط التطبيق. 
                  <span className="font-bold">(يدعم السعر العادي + سعر العرض + المنتجات المتغيرة، مع تطبيق فعلي على السيرفر)</span>
                </div>

                {bulkOperation === 'set' && (
                  <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                    💡 في وضع "تحديد سعر جديد" يمكنك كتابة سعر مختلف لكل منتج من القائمة. 
                    لو كتبت "سعر موحد سريع" بالأعلى، هيتطبق على أي منتج لسه بدون سعر يدوي.
                  </div>
                )}
              </div>
            </div>
            )}

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
          <div className="flex-1 overflow-y-auto p-2 bg-gray-50" dir="rtl">
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
                  selectedProducts={selectedBulkIds}
                  onToggleSelect={handleBulkToggle}
                />
              )}
            </div>
          </div>

          {/* 🛒 Cart - RIGHT SIDE (اليمين) */}
          <div className={`hidden md:flex w-[25rem] bg-white shadow-xl border-l border-gray-200 flex-col ml-auto ${isCartExpanded ? 'h-auto' : ''}`} dir="rtl">
            {/* Cart Component - Full Height Scrollable */}
            <div className={`${isCartExpanded ? 'h-auto' : 'flex-1 overflow-y-auto'}`}>
              <Cart
                key={`cart-${activeTabId}-${activeTab?.cart?.length || 0}-${JSON.stringify(activeTab?.cart?.map(i => i.price) || [])}`}
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
                  const shippingCost = customer?.shippingCost || 0;
                  updateActiveTab({ 
                    selectedCustomer: customer,
                    deliveryFee: shippingCost  // تحديث رسوم التوصيل تلقائيًا
                  });
                  setDeliveryFee(shippingCost); // تحديث الـ store أيضًا
                }}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateItemPrice={handleUpdateItemPrice} // 🆕 تعديل سعر المنتج (جملة فورية)
                onAddItem={(tempProduct) => {
                  if (!activeTab) return;
                  updateActiveTab({
                    cart: [...activeTab.cart, tempProduct]
                  });
                }}
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
                onUpdateService={(id, fieldOrUpdates, value) => {
                  if (!activeTab) return;
                  
                  // إذا كان fieldOrUpdates object، حدّث multiple fields مرة واحدة
                  if (typeof fieldOrUpdates === 'object') {
                    console.log('🔄 onUpdateService (multi-field):', { id, updates: fieldOrUpdates });
                    const updatedServices = (activeTab.services || []).map(s =>
                      s.id === id ? { ...s, ...fieldOrUpdates } : s
                    );
                    console.log('✅ Updated services:', updatedServices);
                    updateActiveTab({ services: updatedServices });
                  } else {
                    // single field update (backward compatible)
                    console.log('🔄 onUpdateService (single-field):', { id, field: fieldOrUpdates, value });
                    const updatedServices = (activeTab.services || []).map(s =>
                      s.id === id ? { ...s, [fieldOrUpdates]: value } : s
                    );
                    console.log('✅ Updated services:', updatedServices);
                    updateActiveTab({ services: updatedServices });
                  }
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
                extraFeeType={activeTab?.extraFeeType || extraFeeType}
                deliveryFee={activeTab?.deliveryFee ?? deliveryFee}
                deliveryNotes={activeTab?.deliveryNotes || deliveryNotes}
                deliveryPaymentStatus={activeTab?.deliveryPaymentStatus || deliveryPaymentStatus}
                deliveryPaidAmount={activeTab?.deliveryPaidAmount ?? deliveryPaidAmount}
                deliveryPaymentNote={activeTab?.deliveryPaymentNote || deliveryPaymentNote}
                orderNotes={activeTab?.orderNotes || orderNotes}
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
                onExtraFeeTypeChange={(v) => {
                  setExtraFeeType(v);
                  updateActiveTab({ extraFeeType: v });
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
                onOrderNotesChange={(v) => {
                  setOrderNotes(v);
                  updateActiveTab({ orderNotes: v });
                }}
                onPaymentMethodChange={(v) => {
                  setPaymentMethod(v);
                  updateActiveTab({ paymentMethod: v });
                }}
                onPaymentStatusChange={(v) => { // 🆕 حالة الدفع
                  updateActiveTab({ paymentStatus: v });
                }}
                paymentStatus={activeTab?.paymentStatus || 'paid_full'} // 🆕 حالة الدفع
                onExpandChange={(expanded) => setIsCartExpanded(expanded)} // 🆕 تتبع حالة التوسيع
              />
            </div>
          </div>
        </div>

        {/* Mobile Cart - Bottom Sheet */}
        <div className="md:hidden">
          {/* Floating Cart Button */}
          <button
            onClick={() => setShowMobileCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl transition-all z-40 flex items-center gap-3 font-bold text-lg"
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
                    key={`mobile-cart-${activeTabId}-${cart?.length || 0}-${JSON.stringify(cart?.map(i => i.price) || [])}`}
                    items={cart}
                    services={services}
                    employees={employees}
                    onUpdateQuantity={handleUpdateQuantity}
                    onUpdateItemPrice={handleUpdateItemPrice} // 🆕 تعديل سعر المنتج (جملة فورية)
                    onAddItem={(tempProduct) => {
                      addToCart(tempProduct);
                    }}
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
            <div className="bg-gradient-to-r from-slate-700 to-gray-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📋</span>
                <h2 className="text-2xl font-bold">الفواتير</h2>
              </div>
              <button
                onClick={() => setShowInvoicesModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-colors text-2xl font-bold"
                title="الفواتير"
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

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={async () => {
          // Refresh products after bulk upload
          await syncAllProducts();
          setToast({ type: 'success', message: 'تم إضافة المنتجات بنجاح!' });
        }}
        setToast={setToast}
      />

      {/* Wholesale Pricing Modal */}
      <WholesalePricingModal
        isOpen={showWholesaleModal}
        onClose={() => {
          setShowWholesaleModal(false);
        }}
        products={allProducts}
        vendorInfo={vendorInfo}
      />
    </>
  );
}