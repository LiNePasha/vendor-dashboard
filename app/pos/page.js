"use client";

import { useState, useEffect } from 'react';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { Toast } from '@/components/Toast';
import usePOSStore from '@/app/stores/pos-store';
import InvoiceModal from './InvoiceModal';

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
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleUpdateQuantity = async (id, qty) => {
    const res = await updateQuantity(id, qty);
    if (res?.error) setToast({ message: res.error, type: 'error' });
  };

  const handleCheckout = async () => {
    if ((!cart || cart.length === 0) && (!services || services.length === 0)) {
      return setToast({ message: 'السلة فارغة - أضف منتجات أو خدمات', type: 'error' });
    }
    if (discountType === 'percentage' && discount > 100) return setToast({ message: 'نسبة الخصم لا يمكن أن تتجاوز 100%', type: 'error' });
    if (discount < 0 || extraFee < 0) return setToast({ message: 'قيمة غير صالحة', type: 'error' });

    const result = await processCheckout({ discount, discountType, extraFee, paymentMethod });
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
      <div className="flex bg-gray-100">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-4 space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                className="flex-1 px-4 py-2 rounded-lg border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="px-4 py-2 rounded-lg border"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                title="تحديث المنتجات من السيرفر"
              >
                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                <span className="hidden sm:inline">تحديث</span>
              </button>
            </div>
          </div>

          <ProductGrid products={products} loading={loading} onAddToCart={handleAddToCart} />

          {!loading && Array.isArray(products) && products.length > 0 && (
            <div className="mt-6 text-center">
              {hasMore ? (
                <button onClick={loadMore} className="px-6 py-2 bg-blue-600 text-white rounded-lg">تحميل المزيد</button>
              ) : (
                <p className="text-gray-500">لا يوجد المزيد من المنتجات</p>
              )}
            </div>
          )}
        </div>

        <div className="w-1/3 min-w-[400px] bg-white border-l sticky top-0 self-start">
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

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
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