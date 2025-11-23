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

const usePOSStore = create(persist((set, get) => ({
  // State
  products: [],
  cart: [],
  services: [], // Service fees array
  categories: [],
  loading: false,
  processing: false,
  pendingUpdates: [], // For tracking pending stock updates
  vendorInfo: null, // Store vendor info (logo, name, phone, email, address)
  orders: [], // 🔥 كل الطلبات
  processingOrders: [], // 🔥 الطلبات قيد التجهيز فقط
  ordersLoading: false,
  lastOrdersFetch: null,

  // Cart Actions
  addToCart: async (product) => {
    const { cart } = get();
    const existingItem = cart.find(item => item.id === product.id);
    
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
      const newCart = [...cart, { ...product, quantity: 1 }];
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
  addService: (id = null, description = '', amount = 0) => {
    const { services } = get();
    const newService = {
      id: id || Date.now().toString(),
      description: description,
      amount: amount
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

  // Products Actions
  fetchProducts: async (query = {}, append = false) => {
    try {
      // Dedupe identical requests within a short window to avoid double fetch in dev
      const key = `${query.page || 1}|${query.search || ''}|${query.category || 'all'}`;
      const now = Date.now();
      if (key === __pos_lastProductsFetchKey && now - __pos_lastProductsFetchAt < 800) {
        return { success: true, deduped: true };
      }
      __pos_lastProductsFetchKey = key;
      __pos_lastProductsFetchAt = now;

      // 🚀 Stale-While-Revalidate Strategy
      // 1️⃣ عرض الـ cache أولاً (إذا متاح)
      if (!append && !query.search && query.category === 'all') {
        const cache = await productsCacheStorage.getCache();
        if (cache && cache.products && cache.products.length > 0) {
          // عرض البيانات من الـ cache فوراً
          set({
            products: cache.products,
            categories: cache.categories || [],
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
          data.categories || [],
          data.pagination || {}
        );
      }
      
      // 4️⃣ Update state
      set(state => ({
        products: append ? [...state.products, ...(data.products || [])] : (data.products || []),
        categories: data.categories || state.categories,
        hasMore: (query.page || 1) < ((data.pagination?.totalPages || 0))
      }));

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

      // Update local product stock quantities (both in state and cache)
      const stockUpdates = updates.map(update => ({
        id: update.productId,
        stock_quantity: update.newQuantity
      }));

      // Update state
      set(state => ({
        products: state.products.map(p => {
          const update = stockUpdates.find(u => u.id === p.id);
          return update ? { ...p, stock_quantity: update.stock_quantity } : p;
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
    const { cart, services, clearCart, clearServices, processStockUpdates } = get();
    
    if (cart.length === 0 && services.length === 0) {
      return { error: 'السلة والخدمات فارغة - أضف منتجات أو خدمات' };
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
      
      const discountAmount = paymentDetails.discountType === 'percentage'
        ? (subtotal * (Number(paymentDetails.discount) / 100))
        : Number(paymentDetails.discount);

      const finalTotal = subtotal - discountAmount + Number(paymentDetails.extraFee);

      if (finalTotal < 0) {
        return { error: 'إجمالي الفاتورة لا يمكن أن يكون سالباً' };
      }

      // Calculate profit for items with purchase price
      let totalProductsProfit = 0; // أرباح المنتجات فقط (قبل الخصم)
      const itemsWithProfit = [];
      
      const invoiceItems = cart.map(item => {
        const purchasePrice = purchasePricesMap[item.id];
        let profit = 0;
        
        if (purchasePrice !== undefined && purchasePrice !== null) {
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
        }

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          totalPrice: Number(item.price) * item.quantity,
          stock_quantity: item.stock_quantity,
          purchasePrice: purchasePrice || null,
          profit: profit || null
        };
      });

      // Filter valid services (must have description and positive amount)
      const validServices = services
        .filter(s => s.description.trim() && s.amount > 0)
        .map(s => ({
          id: s.id,
          description: s.description.trim(),
          amount: Number(s.amount)
        }));

      // 💰 حساب الربح النهائي (مع الخصم والرسوم)
      
      // حصة المنتجات من الخصم (نسبة من الخصم الكلي)
      const productsRatio = subtotal > 0 ? (productsSubtotal / subtotal) : 0;
      const discountOnProducts = discountAmount * productsRatio;
      
      // الربح النهائي للمنتجات بعد الخصم
      const finalProductsProfit = Math.max(0, totalProductsProfit - discountOnProducts);
      
      // الربح الكلي:
      // - ربح المنتجات (بعد الخصم)
      // - الرسوم الإضافية (إيراد كامل)
      // - إيرادات الخدمات (إيراد كامل)
      const totalProfit = finalProductsProfit + Number(paymentDetails.extraFee) + servicesTotal;

      // Create invoice
      const invoice = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: invoiceItems,
        services: validServices,
        summary: {
          productsSubtotal,
          servicesTotal,
          subtotal,
          discount: {
            type: paymentDetails.discountType,
            value: Number(paymentDetails.discount),
            amount: discountAmount
          },
          extraFee: Number(paymentDetails.extraFee),
          total: finalTotal,
          totalProfit: totalProfit, // الربح الكلي (مع الخصم والرسوم)
          productsProfit: totalProductsProfit, // ربح المنتجات الأصلي (قبل الخصم)
          finalProductsProfit: finalProductsProfit, // ربح المنتجات بعد الخصم
          discountOnProducts: discountOnProducts, // حصة المنتجات من الخصم
          profitItemsCount: itemsWithProfit.length
        },
        profitDetails: itemsWithProfit,
        paymentMethod: paymentDetails.paymentMethod,
        // 🆕 إضافة معلومات البائع
        soldBy: paymentDetails.soldBy || null,
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

      // Process stock updates immediately (only if there are products)
      if (cart.length > 0) {
        const updates = cart.map(item => ({
          productId: item.id,
          newQuantity: Math.max(0, item.stock_quantity - item.quantity)
        }));

        // Update stock and wait for response
        const { successCount } = await processStockUpdates(updates);

        // Mark invoice as synced if update was successful
        if (successCount > 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
        }

        // Refresh products list to get updated stock quantities
        const { fetchProducts } = get();
        fetchProducts({ page: 1 });
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
    try {
      set({ ordersLoading: true });
      
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.per_page) params.append('per_page', filters.per_page);
      
      const res = await fetch(`/api/orders?${params}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const data = await res.json();
      const fetchedOrders = data.orders || data || [];
      
      // 🔥 تحديث حسب الفلتر
      if (filters.status === 'processing') {
        // تحديث الطلبات قيد التجهيز فقط
        set({ 
          processingOrders: fetchedOrders,
          lastOrdersFetch: Date.now()
        });
      } else {
        // تحديث كل الطلبات
        set({ 
          orders: fetchedOrders,
          processingOrders: fetchedOrders.filter(o => o.status === 'processing'),
          lastOrdersFetch: Date.now()
        });
      }
      
      return { success: true, orders: fetchedOrders };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return { error: error.message };
    } finally {
      set({ ordersLoading: false });
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