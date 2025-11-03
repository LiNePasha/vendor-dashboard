'use client';

import { useState, useEffect } from 'react';
import { invoiceStorage, cartStorage } from '@/app/lib/localforage';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { Toast } from '@/components/Toast';

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount');
  const [extraFee, setExtraFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Load products and cart
  useEffect(() => {
    fetchProducts();
    loadCart();
  }, []);

  const fetchProducts = async (pageNum = 1, append = false) => {
    try {
      const query = new URLSearchParams({
        page: pageNum.toString(),
        per_page: '12',
        search: debouncedSearch,
        category: category !== 'all' ? category : ''
      });

      const isInitialLoad = pageNum === 1 && !append;
      if (isInitialLoad) {
        setLoading(true);
        setCategoriesLoading(true);
      }
      if (append) setLoadingMore(true);

      // Fetch products
      const res = await fetch(`/api/products?${query}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('فشل تحميل المنتجات');
      
      const data = await res.json();
      
      // Process products
      const productsList = Array.isArray(data.products) ? data.products : [];
      if (append) {
        setProducts(prev => [...prev, ...productsList]);
      } else {
        setProducts(productsList);
      }
      
      // Process categories - only update on initial load
      if (isInitialLoad && Array.isArray(data.categories)) {
        const formattedCategories = data.categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          count: cat.count || 0
        }));
        setCategories(formattedCategories);
      }

      // التحقق من وجود معلومات الصفحات
      const totalPages = data.pagination?.totalPages || 1;
      setHasMore(pageNum < totalPages);

    } catch (error) {
      console.error(error);
      setToast({ message: 'فشل تحميل المنتجات', type: 'error' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setCategoriesLoading(false);
    }
  };

  // Load more products
  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, true);
  };

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [category, debouncedSearch]);

  const loadCart = async () => {
    const savedCart = await cartStorage.getCart();
    setCart(savedCart);
  };

  const addToCart = async (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        setToast({ message: 'لا يوجد مخزون كافي', type: 'error' });
        return;
      }
      const updatedCart = cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      setCart(updatedCart);
      await cartStorage.saveCart(updatedCart);
    } else {
      const newCart = [...cart, { ...product, quantity: 1 }];
      setCart(newCart);
      await cartStorage.saveCart(newCart);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity > product.stock_quantity) {
      setToast({ message: 'لا يوجد مخزون كافي', type: 'error' });
      return;
    }

    const updatedCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    setCart(updatedCart);
    await cartStorage.saveCart(updatedCart);
  };

  const removeFromCart = async (productId) => {
    const updatedCart = cart.filter(item => item.id !== productId);
    setCart(updatedCart);
    await cartStorage.saveCart(updatedCart);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    // Validate inputs
    if (discountType === 'percentage' && discount > 100) {
      setToast({ message: 'نسبة الخصم لا يمكن أن تتجاوز 100%', type: 'error' });
      return;
    }
    
    if (discount < 0 || extraFee < 0) {
      setToast({ message: 'لا يمكن إدخال قيم سالبة', type: 'error' });
      return;
    }

    setProcessing(true);

    try {
      // Calculate all totals
      const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      const discountAmount = discountType === 'percentage' 
        ? (subtotal * (Number(discount) / 100))
        : Number(discount);
      const finalTotal = subtotal - discountAmount + Number(extraFee);

      // Validate final total
      if (finalTotal < 0) {
        throw new Error('إجمالي الفاتورة لا يمكن أن يكون سالباً');
      }

      // Create detailed invoice
      const invoice = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          totalPrice: Number(item.price) * item.quantity
        })),
        summary: {
          subtotal,
          discount: {
            type: discountType,
            value: Number(discount),
            amount: discountAmount
          },
          extraFee: Number(extraFee),
          total: finalTotal
        },
        paymentMethod,
        synced: false
      };

      // Save invoice locally
      await invoiceStorage.saveInvoice(invoice);

      // Update stock in WooCommerce
      const updates = cart.map(item => ({
        productId: item.id,
        newQuantity: item.stock_quantity - item.quantity
      }));

      const res = await fetch('/api/pos/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      });

      if (res.ok) {
        await invoiceStorage.markInvoiceAsSynced(invoice.id);
        setToast({ message: 'تم حفظ الفاتورة وتحديث المخزون', type: 'success' });
        await cartStorage.clearCart();
        setCart([]);
        // Refresh products to get updated stock
        fetchProducts();
      } else {
        setToast({ 
          message: 'تم حفظ الفاتورة محلياً لكن فشل تحديث المخزون. سيتم المزامنة لاحقاً',
          type: 'error'
        });
      }
    } catch (error) {
      setToast({ 
        message: 'فشلت عملية البيع. تم حفظ الفاتورة محلياً.',
        type: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Products Section */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Search & Filters */}
        <div className="mb-4 space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading || categoriesLoading}
            >
              <option value="all">
                {categoriesLoading ? 'جاري تحميل التصنيفات...' : 'كل الفئات'}
              </option>
              {!categoriesLoading && categories && categories.length > 0 ? (
                categories.map(cat => (
                  <option key={cat.id || cat} value={cat.id || cat}>
                    {cat.name || cat} {cat.count ? `(${cat.count})` : ''}
                  </option>
                ))
              ) : null}
            </select>
          </div>

          {/* Active Filters */}
          <div className="flex gap-2 text-sm">
            {category !== 'all' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {categories.find(c => c.id === Number(category))?.name}
                <button
                  onClick={() => setCategory('all')}
                  className="ml-1 hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            )}
            {search && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                بحث: {search}
                <button
                  onClick={() => setSearch('')}
                  className="ml-1 hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <ProductGrid
          products={products}
          loading={loading}
          search=""  // Search is now handled by API
          category="all"  // Category is now handled by API
          onAddToCart={addToCart}
        />

        {/* Load More */}
        {!loading && products.length > 0 && (
          <div className="mt-6 text-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
              </button>
            ) : (
              <p className="text-gray-500">لا يوجد المزيد من المنتجات</p>
            )}
          </div>
        )}
      </div>

      {/* Cart Section */}
      <div className="w-1/3 min-w-[400px] bg-white border-l">
        <Cart
          items={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onCheckout={handleCheckout}
          processing={processing}
          discount={discount}
          discountType={discountType}
          extraFee={extraFee}
          paymentMethod={paymentMethod}
          onDiscountChange={(value) => setDiscount(Number(value))}
          onDiscountTypeChange={setDiscountType}
          onExtraFeeChange={(value) => setExtraFee(Number(value))}
          onPaymentMethodChange={setPaymentMethod}
        />
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}