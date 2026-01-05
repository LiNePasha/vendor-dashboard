import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoiceStorage, cartStorage, wholesalePriceStorage, serviceTemplatesStorage, productsCacheStorage } from '@/app/lib/localforage';
import { warehouseStorage } from '@/app/lib/warehouse-storage';

// --- Helper function ---
const getDaysSinceLastOrder = (dateString) => {
  const lastOrder = new Date(dateString);
  const now = new Date();
  const diff = now - lastOrder;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// --- Lightweight de-duplication guards (handle StrictMode double effects in dev) ---
let __pos_lastProductsFetchKey = '';
let __pos_lastProductsFetchAt = 0;
let __pos_vendorFetchInFlight = false;
let __pos_ordersFetchInFlight = false; // 🔥 منع concurrent orders fetching

const usePOSStore = create(persist((set, get) => ({
  // State
  products: [],
  cart: [],
  services: [], // Service fees array
  categories: [],
  categoriesLoading: false,
  loading: false,
  processing: false,
  pendingUpdates: [], // For tracking pending stock updates
  vendorInfo: null, // Store vendor info (logo, name, phone, email, address)
  orders: [], // 🔥 كل الطلبات
  processingOrders: [], // 🔥 الطلبات قيد التجهيز فقط
  ordersLoading: false,
  lastOrdersFetch: null,
  
  // 🆕 Delivery System State
  orderType: 'pickup', // 'pickup' | 'delivery'
  selectedCustomer: null, // العميل المختار
  deliveryFee: 0, // رسوم التوصيل
  deliveryNotes: '', // ملاحظات التوصيل

  // 🚀 Cashier System State
  lastSync: null, // آخر تزامن كامل
  syncInProgress: false, // جاري التزامن
  autoSyncEnabled: true, // التزامن التلقائي مفعّل
  syncError: null, // آخر خطأ في التزامن

  // Cart Actions
  addToCart: async (product) => {
    const { cart } = get();
    const existingItem = cart.find(item => item.id === product.id);
    
    // 🆕 التحقق من المخزون قبل الإضافة
    if (product.stock_quantity <= 0) {
      return { error: `⚠️ "${product.name}" - المخزون فارغ!` };
    }
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        return { error: 'لا يوجد مخزون كافي' };
      }
      const updatedCart = cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      await cartStorage.saveCart(updatedCart);
      set({ cart: updatedCart });
      return { success: true };
    } else {
      // تحديد السعر الحالي والأصلي بشكل صحيح
      const currentPrice = Number(product.price); // السعر الفعلي الحالي
      const regularPrice = product.regular_price ? Number(product.regular_price) : null;
      
      // التحقق من وجود خصم: لو regular_price أكبر من price
      const hasDiscount = regularPrice && regularPrice > currentPrice;
      
      const newCart = [...cart, { 
        ...product, 
        quantity: 1,
        price: currentPrice, // السعر الفعلي
        originalPrice: hasDiscount ? regularPrice : null // السعر الأصلي فقط لو فيه خصم
      }];
      await cartStorage.saveCart(newCart);
      set({ cart: newCart });
      return { success: true };
    }
  },

  updateQuantity: async (productId, quantity) => {
    const { cart, products } = get();
    const product = products.find(p => p.id === productId);
    if (!product) return { error: 'المنتج غير موجود' };

    if (quantity > product.stock_quantity) {
      return { error: 'لا يوجد مخزون كافي' };
    }

    const updatedCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    await cartStorage.saveCart(updatedCart);
    set({ cart: updatedCart });
    return { success: true };
  },

  removeFromCart: async (productId) => {
    const { cart } = get();
    const updatedCart = cart.filter(item => item.id !== productId);
    await cartStorage.saveCart(updatedCart);
    set({ cart: updatedCart });
  },

  clearCart: async () => {
    await cartStorage.clearCart();
    set({ cart: [] });
  },

  // Service Actions
  addService: (id = null, description = '', amount = 0, employeeId = null, employeeName = null, employeeCode = null) => {
    const { services } = get();
    const newService = {
      id: id || Date.now().toString(),
      description: description,
      amount: amount,
      employeeId: employeeId,
      employeeName: employeeName,
      employeeCode: employeeCode  // 🔥 إضافة employeeCode
    };
    set({ services: [...services, newService] });
  },

  updateService: (id, field, value) => {
    const { services } = get();
    const updated = services.map(service =>
      service.id === id ? { ...service, [field]: value } : service
    );
    set({ services: updated });
  },

  removeService: (id) => {
    const { services } = get();
    set({ services: services.filter(s => s.id !== id) });
  },

  clearServices: () => {
    set({ services: [] });
  },

  // 🆕 Delivery System Actions
  setOrderType: (type) => {
    set({ orderType: type });
    // إذا تم التحويل لـ pickup، امسح بيانات التوصيل
    if (type === 'pickup') {
      set({ selectedCustomer: null, deliveryFee: 0, deliveryNotes: '' });
    }
  },

  selectCustomer: (customer) => {
    const deliveryFee = customer?.shippingCost || 0;
    set({ 
      selectedCustomer: customer,
      deliveryFee: deliveryFee
    });
  },

  setDeliveryFee: (fee) => {
    set({ deliveryFee: parseFloat(fee) || 0 });
  },

  setDeliveryNotes: (notes) => {
    set({ deliveryNotes: notes });
  },

  clearDeliveryData: () => {
    set({
      orderType: 'pickup',
      selectedCustomer: null,
      deliveryFee: 0,
      deliveryNotes: ''
    });
  },

  // 🆕 Update single product locally (for optimistic updates)
  updateProduct: (productId, updates) => {
    set(state => ({
      products: state.products.map(p => 
        p.id === productId ? { ...p, ...updates } : p
      )
    }));
  },

  // 🆕 Categories Actions
  fetchCategories: async () => {
    try {
      set({ categoriesLoading: true });

      const res = await fetch('/api/categories', {
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'فشل تحميل التصنيفات');
      }

      const data = await res.json();

      if (data.success && data.categories) {
        set({ 
          categories: data.categories,
          categoriesLoading: false 
        });
        return { success: true, categories: data.categories };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('❌ Categories error:', error);
      set({ categoriesLoading: false });
      return { error: error.message || 'فشل تحميل التصنيفات' };
    }
  },

  // 🚀 NEW: Full Sync - تحميل كل المنتجات مرة واحدة من Cashier API
  syncAllProducts: async () => {
    const { syncInProgress } = get();
    
    // منع تزامن متعدد في نفس الوقت
    if (syncInProgress) {
      console.log('⏳ Sync already in progress...');
      return { success: false, error: 'تزامن قيد التنفيذ بالفعل' };
    }

    try {
      set({ syncInProgress: true, loading: true, syncError: null });
      console.log('🚀 Starting full sync from Cashier API...');

      const startTime = performance.now();

      // 🔥 استخدام الـ Cashier API الجديد مع all=true
      // إضافة timestamp عشان نمنع أي cache من Next.js أو Browser
      const timestamp = Date.now();
      const res = await fetch(`/api/cashier/initial?all=true&force=1&t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store', // 🔥 منع Next.js من عمل cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'فشل التزامن مع السيرفر');
      }

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      console.log(`✅ Full sync completed in ${elapsed}ms`);
      console.log(`📦 Loaded ${data.products?.length || 0} products`);
      console.log(`📂 Loaded ${data.categories?.length || 0} categories`);

      // حفظ البيانات في الـ state
      set({
        products: data.products || [],
        categories: data.categories || [],
        lastSync: new Date().toISOString(),
        loading: false,
        syncInProgress: false,
        syncError: null
      });

      // حفظ في IndexedDB للـ offline usage
      await productsCacheStorage.saveCache(
        data.products || [],
        data.categories || [],
        data.pagination || {},
        data.metadata?.sync_timestamp
      );

      return {
        success: true,
        totalProducts: data.products?.length || 0,
        totalCategories: data.categories?.length || 0,
        loadTime: elapsed,
        metadata: data.metadata
      };

    } catch (error) {
      console.error('❌ Full sync error:', error);
      set({
        syncInProgress: false,
        loading: false,
        syncError: error.message
      });
      return { success: false, error: error.message };
    }
  },

  // 🔄 NEW: Delta Sync - جلب التغييرات فقط
  syncChanges: async () => {
    const { lastSync, autoSyncEnabled } = get();

    if (!autoSyncEnabled) {
      return { success: false, skipped: true };
    }

    if (!lastSync) {
      // لو مفيش full sync قبل كده، اعمل full sync
      return get().syncAllProducts();
    }

    try {
      console.log('🔄 Checking for changes since:', lastSync);

      const res = await fetch(`/api/cashier/changes?since=${encodeURIComponent(lastSync)}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store', // 🔥 منع Next.js من عمل cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) {
        throw new Error('فشل جلب التغييرات');
      }

      const data = await res.json();
      const changes = data.updates || [];

      if (changes.length === 0) {
        console.log('✅ No changes detected');
        return { success: true, changes: 0 };
      }

      console.log(`📝 Applying ${changes.length} changes...`);

      // تطبيق التغييرات
      set(state => {
        let products = [...state.products];

        changes.forEach(change => {
          if (change.action === 'updated') {
            // تحديث منتج موجود
            const index = products.findIndex(p => p.id === change.data.id);
            if (index !== -1) {
              products[index] = { ...products[index], ...change.data };
            }
          } else if (change.action === 'created') {
            // إضافة منتج جديد
            products.push(change.data);
          } else if (change.action === 'deleted') {
            // حذف منتج
            products = products.filter(p => p.id !== change.id);
          }
        });

        return { products };
      });

      // تحديث الـ cache
      const currentState = get();
      await productsCacheStorage.saveCache(
        currentState.products,
        currentState.categories,
        {},
        new Date().toISOString()
      );

      set({ lastSync: data.metadata?.sync_timestamp || new Date().toISOString() });

      return { success: true, changes: changes.length };

    } catch (error) {
      console.error('❌ Delta sync error:', error);
      return { success: false, error: error.message };
    }
  },

  // 🔧 Toggle Auto Sync
  setAutoSync: (enabled) => {
    set({ autoSyncEnabled: enabled });
  },

  // Products Actions (للبحث والفلترة فقط)
  fetchProducts: async (query = {}, append = false, forceRefresh = false) => {
    try {
      // Dedupe identical requests within a short window to avoid double fetch in dev
      // Skip dedupe if forceRefresh
      if (!forceRefresh) {
        const key = `${query.page || 1}|${query.search || ''}|${query.category || 'all'}`;
        const now = Date.now();
        if (key === __pos_lastProductsFetchKey && now - __pos_lastProductsFetchAt < 800) {
          return { success: true, deduped: true };
        }
        __pos_lastProductsFetchKey = key;
        __pos_lastProductsFetchAt = now;
      }

      // 🚀 Stale-While-Revalidate Strategy
      // 1️⃣ عرض الـ cache أولاً (إذا متاح) - unless forceRefresh
      if (!forceRefresh && !append && !query.search && query.category === 'all') {
        const cache = await productsCacheStorage.getCache();
        if (cache && cache.products && cache.products.length > 0) {
          // عرض البيانات من الـ cache فوراً
          // 🔧 لا تمسح categories - هي متحملة من fetchCategories
          set({
            products: cache.products,
            hasMore: false, // الـ cache يحتوي كل المنتجات
            loading: false // ✅ أوقف اللودر
          });
          
          // فحص: هل الـ cache حديث؟
          const isStale = await productsCacheStorage.isCacheStale(3 * 60 * 1000); // 3 دقائق
          if (!isStale) {
            // الـ cache حديث - لا داعي للتحديث
            return { success: true, cached: true, fresh: true };
          }
          // الـ cache قديم - التحديث في الخلفية (بدون لودر)
        } else {
          set({ loading: true }); // فقط لو مفيش cache
        }
      } else {
        set({ loading: true }); // عند البحث أو الفلترة
      }
      
      const params = {
        page: query.page?.toString() || '1',
        per_page: '20', // 🔥 عدد ثابت للصفحة الواحدة
        search: query.search || ''
      };
      
      // Only add category if it's valid and not 'all'
      if (query.category && query.category !== 'all' && query.category !== 'undefined') {
        params.category = query.category;
      }
      
      const searchParams = new URLSearchParams(params);

      const res = await fetch(`/api/products?${searchParams}`, {
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { error: data.error || 'فشل تحميل المنتجات' };
      }

      // 3️⃣ Update cache (only if no filters - we cache the full list)
      if (!query.search && query.category === 'all' && !append) {
        await productsCacheStorage.saveCache(
          data.products || [],
          [], // لا نحفظ categories في cache المنتجات
          data.pagination || {}
        );
      }
      
      // 4️⃣ Update state
      set(state => {
        return {
          products: append ? [...state.products, ...(data.products || [])] : (data.products || []),
          hasMore: (query.page || 1) < ((data.pagination?.totalPages || 0))
        };
      });

      return { success: true, data };
    } catch (error) {
      return { error: error.message || 'فشل تحميل المنتجات' };
    } finally {
      set({ loading: false });
    }
  },

  // Stock Update Actions
  processStockUpdates: async (updates) => {
    try {
      // Send all updates in one request
      const res = await fetch('/api/pos/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      });

      const data = await res.json();
      
      const successCount = data.updated || 0;
      const failedUpdates = data.details?.filter(d => d.status === 'failed') || [];

      // Update local product/variation stock quantities (both in state and cache)
      const stockUpdates = updates.map(update => ({
        id: update.variationId || update.productId,
        stock_quantity: update.newQuantity
      }));

      // Update state for both products and variations if present
      set(state => ({
        products: state.products.map(p => {
          // إذا كان المنتج نفسه أو أحد الـ variations
          const update = stockUpdates.find(u => u.id === p.id);
          if (update) return { ...p, stock_quantity: update.stock_quantity };
          // إذا كان المنتج يحتوي على variations
          if (Array.isArray(p.variations)) {
            const newVariations = p.variations.map(v => {
              const vUpdate = stockUpdates.find(u => u.id === v.id);
              return vUpdate ? { ...v, stock_quantity: vUpdate.stock_quantity } : v;
            });
            return { ...p, variations: newVariations };
          }
          return p;
        })
      }));

      // Update cache
      await productsCacheStorage.updateMultipleProductsInCache(stockUpdates);

      return { successCount, failedUpdates };
    } catch (error) {
      return { successCount: 0, failedUpdates: updates };
    }
  },

  // Checkout Process
  processCheckout: async (paymentDetails) => {
    const { cart, services, clearCart, clearServices, processStockUpdates, orderType, selectedCustomer, deliveryFee, deliveryNotes } = get();
    
    if (cart.length === 0 && services.length === 0) {
      return { error: 'السلة والخدمات فارغة - أضف منتجات أو خدمات' };
    }

    // التحقق من بيانات التوصيل إذا كان الطلب توصيل
    if (orderType === 'delivery') {
      if (!selectedCustomer) {
        return { error: 'يجب اختيار عميل للتوصيل' };
      }
      if (!selectedCustomer.phone || !selectedCustomer.phone.trim()) {
        return { error: 'يجب إدخال رقم هاتف العميل' };
      }
    }

    try {
      set({ processing: true });

      // Load warehouse data (purchase prices)
      const warehouseData = await warehouseStorage.getAllProductsData();
      const purchasePricesMap = {};
      warehouseData.forEach(item => {
        if (item.purchasePrice > 0) {
          purchasePricesMap[item.wooProductId] = item.purchasePrice;
        }
      });

      // Calculate products subtotal
      const productsSubtotal = cart.reduce((sum, item) => 
        sum + (Number(item.price) * item.quantity), 0
      );

      // Calculate services total
      const servicesTotal = services
        .filter(s => s.description && s.amount > 0)
        .reduce((sum, service) => sum + Number(service.amount), 0);

      // Combined subtotal
      const subtotal = productsSubtotal + servicesTotal;
      
      // 🆕 حساب الخصم بناءً على وضع التطبيق (discountApplyMode)
      const discountApplyMode = paymentDetails.discountApplyMode || 'both'; // both, products, services
      
      let discountBase = subtotal; // القاعدة اللي هنحسب عليها الخصم
      
      if (discountApplyMode === 'products') {
        discountBase = productsSubtotal;
      } else if (discountApplyMode === 'services') {
        discountBase = servicesTotal;
      }
      
      const discountAmount = paymentDetails.discountType === 'percentage'
        ? (discountBase * (Number(paymentDetails.discount) / 100))
        : Number(paymentDetails.discount);

      // 🆕 حساب الرسوم الإضافية بناءً على النوع
      const extraFeeAmount = paymentDetails.extraFeeType === 'percentage'
        ? (subtotal * (Number(paymentDetails.extraFee) / 100))
        : Number(paymentDetails.extraFee);

      // إضافة رسوم التوصيل إذا كان الطلب توصيل
      const finalDeliveryFee = orderType === 'delivery' ? Number(deliveryFee) : 0;
      const finalTotal = subtotal - discountAmount + extraFeeAmount + finalDeliveryFee;

      if (finalTotal < 0) {
        return { error: 'إجمالي الفاتورة لا يمكن أن يكون سالباً' };
      }

      // Calculate profit for items with purchase price
      let totalProductsProfit = 0; // أرباح المنتجات فقط (قبل الخصم)
      const itemsWithProfit = [];
      const itemsWithoutPurchasePrice = []; // 🆕 تتبع المنتجات بدون سعر شراء
      
      const invoiceItems = cart.map(item => {
        const purchasePrice = purchasePricesMap[item.id];
        let profit = 0;
        
        if (purchasePrice !== undefined && purchasePrice !== null && purchasePrice >= 0) {
          // Calculate profit: (selling price - purchase price) * quantity
          profit = (Number(item.price) - Number(purchasePrice)) * item.quantity;
          totalProductsProfit += profit;
          itemsWithProfit.push({
            id: item.id,
            name: item.name,
            purchasePrice: Number(purchasePrice),
            sellingPrice: Number(item.price),
            quantity: item.quantity,
            profit: profit
          });
        } else {
          // 🆕 منتج بدون سعر شراء - الربح غير محسوب
          itemsWithoutPurchasePrice.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          });
        }

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          originalPrice: item.originalPrice || null, // 🆕 حفظ السعر الأصلي للعرض في الفاتورة
          quantity: item.quantity,
          totalPrice: Number(item.price) * item.quantity,
          stock_quantity: item.stock_quantity,
          purchasePrice: purchasePrice || null,
          profit: profit || null,
          hasPurchasePrice: (purchasePrice !== undefined && purchasePrice !== null) // 🆕 flag
        };
      });

      // Filter valid services (must have description and positive amount)
        const validServices = services
          .filter(s => s.description.trim() && s.amount > 0)
          .map(s => {
            const serviceData = {
              id: s.id,
              description: s.description.trim(),
              amount: Number(s.amount),
              employeeId: s.employeeId ? String(s.employeeId) : null, // 🔥 حفظ معلومات الموظف كـ string
              employeeName: s.employeeName || null,
              employeeCode: s.employeeCode || null // 🔥 حفظ كود الموظف للمقارنة
            };
            console.log('💾 Saving service:', serviceData);
            return serviceData;
          });      // 💰 حساب الربح النهائي (مع الخصم والرسوم)
      
      // 🔥 توزيع الخصم بناءً على وضع التطبيق
      let discountOnProducts = 0;
      let discountOnServices = 0;
      
      if (discountApplyMode === 'both') {
        // توزيع الخصم بالنسبة على المنتجات والخدمات
        const productsRatio = subtotal > 0 ? (productsSubtotal / subtotal) : 0;
        const servicesRatio = subtotal > 0 ? (servicesTotal / subtotal) : 0;
        discountOnProducts = discountAmount * productsRatio;
        discountOnServices = discountAmount * servicesRatio;
      } else if (discountApplyMode === 'products') {
        // الخصم كله على المنتجات
        discountOnProducts = discountAmount;
        discountOnServices = 0;
      } else if (discountApplyMode === 'services') {
        // الخصم كله على الخدمات
        discountOnProducts = 0;
        discountOnServices = discountAmount;
      }
      
      // الربح النهائي للمنتجات بعد الخصم
      const finalProductsProfit = Math.max(0, totalProductsProfit - discountOnProducts);
      
      // الربح النهائي للخدمات بعد الخصم
      const finalServicesProfit = Math.max(0, servicesTotal - discountOnServices);
      
      // الربح الكلي:
      // - ربح المنتجات (بعد الخصم)
      // - الرسوم الإضافية (إيراد كامل)
      // - إيرادات الخدمات (بعد الخصم)
      // - رسوم التوصيل (إيراد كامل)
      const totalProfit = finalProductsProfit + extraFeeAmount + finalServicesProfit + finalDeliveryFee;

      // Create invoice
      const invoice = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: invoiceItems,
        services: validServices,
        // 🆕 معلومات التوصيل
        delivery: orderType === 'delivery' ? {
          customer: {
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email || '',
            address: selectedCustomer.address || {}
          },
          fee: finalDeliveryFee,
          notes: deliveryNotes || ''
        } : null,
        orderType: orderType, // 'pickup' | 'delivery'
        summary: {
          productsSubtotal,
          servicesTotal,
          subtotal,
          discount: {
            type: paymentDetails.discountType,
            value: Number(paymentDetails.discount),
            amount: discountAmount,
            applyMode: discountApplyMode // 🆕 وضع تطبيق الخصم
          },
          extraFee: extraFeeAmount,
          extraFeeType: paymentDetails.extraFeeType || 'amount', // 🆕 نوع الرسوم
          extraFeeValue: Number(paymentDetails.extraFee), // 🆕 القيمة الأصلية للرسوم
          deliveryFee: finalDeliveryFee, // 🆕 رسوم التوصيل
          total: finalTotal,
          totalProfit: totalProfit, // الربح الكلي (بعد الخصم والرسوم)
          productsProfit: totalProductsProfit, // ربح المنتجات الأصلي (قبل الخصم)
          finalProductsProfit: finalProductsProfit, // ربح المنتجات بعد الخصم
          finalServicesProfit: finalServicesProfit, // ربح الخدمات بعد الخصم
          discountOnProducts: discountOnProducts, // حصة المنتجات من الخصم
          discountOnServices: discountOnServices, // حصة الخدمات من الخصم
          profitItemsCount: itemsWithProfit.length,
          itemsWithoutPurchasePrice: itemsWithoutPurchasePrice.length, // 🆕 عدد المنتجات بدون سعر شراء
          totalItemsCount: cart.length // 🆕 إجمالي المنتجات
        },
        profitDetails: itemsWithProfit,
        itemsWithoutProfit: itemsWithoutPurchasePrice, // 🆕 قائمة المنتجات بدون سعر شراء
        paymentMethod: paymentDetails.paymentMethod,
        // 🔥 حساب paymentStatus بناءً على deliveryPaymentStatus
        paymentStatus: (() => {
          // إذا مفيش توصيل - مدفوع بالكامل دائماً
          if (orderType !== 'delivery') {
            return 'paid_full';
          }
          
          // إذا فيه توصيل - نشوف حالة الدفع
          const deliveryStatus = paymentDetails.deliveryPayment?.status;
          
          if (deliveryStatus === 'cash_on_delivery') {
            return 'unpaid'; // الكل غير مدفوع
          } else if (deliveryStatus === 'half_paid') {
            return 'partial'; // مدفوع جزئي
          } else if (deliveryStatus === 'fully_paid_no_delivery') {
            return 'partial'; // 🔥 مدفوع المنتجات فقط، رسوم التوصيل غير مدفوعة
          } else if (deliveryStatus === 'fully_paid') {
            return 'paid_full'; // مدفوع بالكامل
          }
          
          return 'paid_full'; // افتراضي
        })(),
        // 🆕 إضافة معلومات البائع
        soldBy: paymentDetails.soldBy || null,
        // 🆕 بيانات الدفع للتوصيل
        deliveryPayment: paymentDetails.deliveryPayment ? {
          status: paymentDetails.deliveryPayment.status,
          paidAmount: paymentDetails.deliveryPayment.status === 'half_paid' 
            ? (paymentDetails.deliveryPayment.paidAmount || 0)
            : (paymentDetails.deliveryPayment.status === 'fully_paid_no_delivery'
              ? (finalTotal - finalDeliveryFee) // المدفوع = ثمن المنتجات
              : (paymentDetails.deliveryPayment.status === 'fully_paid' 
                ? finalTotal 
                : 0)),
          remainingAmount: paymentDetails.deliveryPayment.status === 'half_paid' 
            ? (finalTotal - (paymentDetails.deliveryPayment.paidAmount || 0))
            : (paymentDetails.deliveryPayment.status === 'fully_paid_no_delivery' 
              ? finalDeliveryFee // 🔥 المتبقي = رسوم التوصيل فقط
              : 0),
          note: paymentDetails.deliveryPayment.note || null
        } : null,
        orderNotes: paymentDetails.orderNotes || '',
        synced: false
      };

      // Save invoice first
      await invoiceStorage.saveInvoice(invoice);
      
      // 🆕 تسجيل في Audit Log
      try {
        const { logSaleRecorded } = await import('@/app/lib/audit-logger');
        await logSaleRecorded(invoice);
      } catch (error) {
        console.error('Failed to log sale in audit:', error);
        // لا نوقف العملية لو فشل التسجيل
      }
      
      // Clear cart and services immediately
      await clearCart();
      clearServices();

      // 🆕 مسح بيانات التوصيل بعد نجاح الطلب
      if (orderType === 'delivery' && selectedCustomer) {
        // تحديث إحصائيات العميل إذا كان أوفلاين
        if (selectedCustomer.type === 'offline') {
          try {
            const offlineCustomersStorage = await import('@/app/lib/offline-customers-storage');
            await offlineCustomersStorage.default.updateCustomerStats(selectedCustomer.id, finalTotal);
          } catch (error) {
            console.error('Failed to update customer stats:', error);
          }
        }
      }
      
      // مسح بيانات التوصيل
      set({
        orderType: 'pickup',
        selectedCustomer: null,
        deliveryFee: 0,
        deliveryNotes: ''
      });

      // Process stock updates immediately (only if there are products)
      if (cart.length > 0) {
        const updates = cart.map(item => {
          // إذا كان العنصر متغير (is_variation أو variation_id موجود)
          if (item.is_variation || item.variation_id) {
            return {
              productId: item.parent_id || item.parentId || item.product_id || item.productId, // id المنتج الأب
              variationId: item.variation_id || item.id, // id الـ variation
              newQuantity: Math.max(0, item.stock_quantity - item.quantity)
            };
          } else {
            // منتج عادي
            return {
              productId: item.id,
              newQuantity: Math.max(0, item.stock_quantity - item.quantity)
            };
          }
        });

        // Update stock and wait for response
        const { successCount } = await processStockUpdates(updates);
        
        // 🆕 تحديث المخزون المحلي للمتغيرات
        try {
          for (const item of cart) {
            if (item.variation_id) {
              // هذا variation - محتاج نحدث المخزون المحلي
              const currentLocalStock = await warehouseStorage.getVariationLocalStock(item.variation_id);
              const newLocalStock = Math.max(0, currentLocalStock - item.quantity);
              await warehouseStorage.setVariationLocalStock(item.variation_id, newLocalStock);
            }
          }
        } catch (error) {
          console.error('❌ فشل تحديث المخزون المحلي للمتغيرات:', error);
          // لا نوقف العملية
        }

        // Mark invoice as synced if update was successful
        if (successCount > 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
        }

        // 🔄 Full Sync - تحديث كامل للمنتجات من Cashier API
        const { syncAllProducts } = get();
        console.log('🔄 Syncing products after checkout...');
        syncAllProducts().then(result => {
          if (result.success) {
            console.log(`✅ Products synced: ${result.totalProducts} products loaded`);
          } else {
            console.error('❌ Sync failed after checkout:', result.error);
          }
        });
      }

      // Return success with invoice
      return {
        success: true,
        message: 'تم إنشاء الفاتورة وتحديث المخزون',
        invoice
      };

    } catch (error) {
      return {
        success: false,
        error: 'فشلت عملية البيع',
        details: error.message
      };
    } finally {
      set({ processing: false });
    }
  },

  // Initialize
  init: async () => {
    const savedCart = await cartStorage.getCart();
    set({ cart: savedCart });
  },

  // Clear all store data (for logout)
  clearAll: async () => {
    await cartStorage.clearCart();
    await invoiceStorage.clearAll();
    await wholesalePriceStorage.clearAll();
    await serviceTemplatesStorage.clearAll();
    await productsCacheStorage.clearCache(); // Clear products cache on logout
    set({
      orders: [],
      cart: [],
      services: [],
      categories: [],
      loading: false,
      processing: false,
      pendingUpdates: [],
      vendorInfo: null,
      processingOrders: [],
      ordersLoading: false,
      lastOrdersFetch: null
    });
  },

  // Get vendor info (from store or fetch if not available)
  getVendorInfo: async () => {
    const { vendorInfo } = get();
    
    // Return cached vendor info if available
    if (vendorInfo) {
      return vendorInfo;
    }
    
    // Otherwise fetch it
    try {
      if (__pos_vendorFetchInFlight) {
        // If another call already fetching, wait briefly and return latest state
        await new Promise(r => setTimeout(r, 300));
        return get().vendorInfo;
      }
      __pos_vendorFetchInFlight = true;
      const res = await fetch('/api/vendor', { credentials: 'include' });
      const data = await res.json();
      if (!data?.error) {
        set({ vendorInfo: data });
        return data;
      }
    } catch (error) {
      // Silently handle error in production
    } finally {
      __pos_vendorFetchInFlight = false;
    }
    
    return null;
  },

  // 🔥 Fetch Orders (Global State)
  fetchOrders: async (filters = {}) => {
    // 🔥 Request guard - منع multiple concurrent requests
    if (__pos_ordersFetchInFlight) {
      return { success: false, message: 'Already fetching' };
    }
    
    try {
      __pos_ordersFetchInFlight = true;
      
      // 🔥 فقط حدّث ordersLoading لو مش loading بالفعل
      const currentState = get();
      if (!currentState.ordersLoading) {
        set({ ordersLoading: true });
      }
      
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.per_page) params.append('per_page', filters.per_page);
      if (filters.after) params.append('after', filters.after);
      if (filters.search) params.append('search', filters.search); // 🆕 دعم البحث
      
      const res = await fetch(`/api/orders?${params}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const data = await res.json();
      const fetchedOrders = data.orders || data || [];
      
      // 🔥🔥🔥 CRITICAL FIX: مقارنة orders قبل التحديث - منع unnecessary re-renders
      const state = get();
      const currentOrderIds = new Set(state.orders.map(o => o.id));
      const fetchedOrderIds = new Set(fetchedOrders.map(o => o.id));
      
      // تحقق من تغيير في orders العامة
      const ordersChanged = 
        state.orders.length !== fetchedOrders.length ||
        [...fetchedOrderIds].some(id => !currentOrderIds.has(id)) ||
        [...currentOrderIds].some(id => !fetchedOrderIds.has(id));
      
      // 🔥 فقط حدّث orders لو فيه تغيير فعلي
      if (ordersChanged) {
        set({ orders: fetchedOrders });
      }
      
      // 🔥 استخراج processing orders بشكل آمن
      const newProcessingOrders = fetchedOrders
        .filter(order => order.status === 'processing')
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
      
      // 🔥 قارن بشكل دقيق باستخدام Set
      const currentProcessing = state.processingOrders;
      const currentProcessingIds = new Set(currentProcessing.map(o => o.id));
      const newProcessingIds = new Set(newProcessingOrders.map(o => o.id));
      
      // تحقق من تغيير فعلي في processing orders
      const processingChanged = 
        currentProcessing.length !== newProcessingOrders.length ||
        [...newProcessingIds].some(id => !currentProcessingIds.has(id)) ||
        [...currentProcessingIds].some(id => !newProcessingIds.has(id));
      
      if (processingChanged) {
        set({ 
          processingOrders: newProcessingOrders,
          lastOrdersFetch: Date.now()
        });
      }
      
      __pos_ordersFetchInFlight = false; // 🔥 Release lock
      
      // 🔥 فقط حدّث ordersLoading لو كان true
      if (get().ordersLoading) {
        set({ ordersLoading: false });
      }
      
      return { success: true, orders: fetchedOrders };
    } catch (error) {
      console.error('Error fetching orders:', error);
      __pos_ordersFetchInFlight = false; // 🔥 Release lock في حالة error
      
      if (get().ordersLoading) {
        set({ ordersLoading: false });
      }
      
      return { error: error.message };
    }
  },

  // Update order status in global state
  updateOrderStatus: (orderId, newStatus) => {
    set(state => {
      const updatedOrders = state.orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      );
      
      return {
        orders: updatedOrders,
        processingOrders: updatedOrders.filter(o => o.status === 'processing')
      };
    });
  },

  // 🔥 استخراج العملاء من الطلبات
  getCustomers: () => {
    const { orders } = get();
    const customersMap = new Map();

    orders.forEach(order => {
      const billing = order.billing || {};
      const customerKey = billing.email || billing.phone || `guest-${order.id}`;
      
      if (!customersMap.has(customerKey)) {
        customersMap.set(customerKey, {
          id: customerKey,
          name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'عميل',
          email: billing.email || '',
          phone: billing.phone || '',
          address: `${billing.address_1 || ''} ${billing.address_2 || ''}`.trim(),
          city: billing.city || '',
          state: billing.state || '',
          country: billing.country || '',
          orders: [],
          total_spent: 0,
          orders_count: 0,
          first_order_date: order.date_created,
          last_order_date: order.date_created,
        });
      }

      const customer = customersMap.get(customerKey);
      
      // 🔥 كل الطلبات تظهر في التاريخ
      customer.orders.push({
        id: order.id,
        date: order.date_created,
        status: order.status,
        total: parseFloat(order.total || 0),
        items_count: order.line_items?.length || 0,
      });

      // 🔥 بس completed و processing بس اللي يتحسبوا في الإنفاق
      if (order.status === 'completed' || order.status === 'processing') {
        customer.total_spent += parseFloat(order.total || 0);
        customer.orders_count += 1;
      }

      // تحديث تواريخ أول وآخر طلب
      if (new Date(order.date_created) < new Date(customer.first_order_date)) {
        customer.first_order_date = order.date_created;
      }
      if (new Date(order.date_created) > new Date(customer.last_order_date)) {
        customer.last_order_date = order.date_created;
      }
    });

    // تحويل Map إلى Array وترتيب حسب الإنفاق
    const customers = Array.from(customersMap.values())
      .map(customer => ({
        ...customer,
        average_order: customer.orders_count > 0 
          ? customer.total_spent / customer.orders_count 
          : 0,
        status: getDaysSinceLastOrder(customer.last_order_date) <= 30 
          ? 'active' 
          : 'inactive',
        days_since_last_order: getDaysSinceLastOrder(customer.last_order_date),
      }))
      .sort((a, b) => b.total_spent - a.total_spent);

    return customers;
  },

  // 🔥 احصائيات العملاء
  getCustomersStats: () => {
    const customers = get().getCustomers();
    
    return {
      total: customers.length,
      active: customers.filter(c => c.status === 'active').length,
      inactive: customers.filter(c => c.status === 'inactive').length,
      total_revenue: customers.reduce((sum, c) => sum + c.total_spent, 0),
      average_order_value: customers.length > 0
        ? customers.reduce((sum, c) => sum + c.average_order, 0) / customers.length
        : 0,
      top_customers: customers.slice(0, 5),
    };
  }
}), {
  name: 'pos-store',
  // Persist only vendorInfo so print page can read it instantly in a new tab
  partialize: (state) => ({ vendorInfo: state.vendorInfo }),
  storage: createJSONStorage(() => {
    if (typeof window !== 'undefined') return window.localStorage;
    // Fallback to no-op storage during SSR to avoid crashes
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  })
}));

export default usePOSStore;