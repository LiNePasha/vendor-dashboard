import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoiceStorage, cartStorage, wholesalePriceStorage, serviceTemplatesStorage } from '@/app/lib/localforage';

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
  addService: () => {
    const { services } = get();
    const newService = {
      id: Date.now().toString(),
      description: '',
      amount: 0
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

      set({ loading: true });
      
      const params = {
        page: query.page?.toString() || '1',
        per_page: '12',
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
        // Return empty result on error instead of throwing
        return { error: data.error || 'فشل تحميل المنتجات' };
      }
      
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

      // Update local product stock quantities optimistically
      updates.forEach(update => {
        set(state => ({
          products: state.products.map(p =>
            p.id === update.productId
              ? { ...p, stock_quantity: update.newQuantity }
              : p
          )
        }));
      });

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

      // Load wholesale prices
      const wholesalePrices = await wholesalePriceStorage.getAllWholesalePrices();

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

      // Calculate profit for items with wholesale price
      let totalProfit = 0;
      const itemsWithProfit = [];
      
      const invoiceItems = cart.map(item => {
        const wholesalePrice = wholesalePrices[item.id];
        let profit = 0;
        
        if (wholesalePrice !== undefined && wholesalePrice !== null) {
          // Calculate profit: (selling price - wholesale price) * quantity
          profit = (Number(item.price) - Number(wholesalePrice)) * item.quantity;
          totalProfit += profit;
          itemsWithProfit.push({
            id: item.id,
            name: item.name,
            wholesalePrice: Number(wholesalePrice),
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
          wholesalePrice: wholesalePrice || null,
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
          totalProfit: totalProfit,
          profitItemsCount: itemsWithProfit.length
        },
        profitDetails: itemsWithProfit,
        paymentMethod: paymentDetails.paymentMethod,
        synced: false
      };

      // Save invoice first
      await invoiceStorage.saveInvoice(invoice);
      
      // Clear cart and services immediately
      await clearCart();
      clearServices();

      // Process stock updates in background (only if there are products)
      if (cart.length > 0) {
        const updates = cart.map(item => ({
          productId: item.id,
          newQuantity: Math.max(0, item.stock_quantity - item.quantity)
        }));

        // Start background stock update (do not block UI)
        processStockUpdates(updates).catch(() => {});

        // Schedule verification after 30 seconds. Only after verification we update UI / fetch products.
        setTimeout(async () => {
          try {
            const res = await fetch('/api/pos/verify-update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates }),
            credentials: 'include'
          });

          const data = await res.json();

          // If any items verified or mismatch detected, mark invoice synced and refresh as needed
          if (data.verified > 0) {
            await invoiceStorage.markInvoiceAsSynced(invoice.id);
          }

          let shouldFetch = false;
          if (Array.isArray(data.details)) {
            data.details.forEach(detail => {
              if (detail.status === 'mismatch') {
                shouldFetch = true;
                // update mismatched product quantities to current stock from server
                set(state => ({
                  products: state.products.map(p =>
                    p.id === detail.productId
                      ? { ...p, stock_quantity: detail.currentStock }
                      : p
                  )
                }));
              }
            });
          }

          if (shouldFetch || data.verified > 0) {
            const { fetchProducts } = get();
            fetchProducts({ page: 1 });
          }
        } catch (error) {
          // Silently handle verification error
        }
      }, 15000);
      }

      // Return success with invoice immediately
      return {
        success: true,
        message: 'تم إنشاء الفاتورة',
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
    set({
      products: [],
      cart: [],
      services: [],
      categories: [],
      loading: false,
      processing: false,
      pendingUpdates: [],
      vendorInfo: null
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