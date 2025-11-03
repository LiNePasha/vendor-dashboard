'use client';

import { useState, useEffect } from 'react';
import { invoiceStorage } from '@/app/lib/localforage';
import { Toast } from '@/components/Toast';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const allInvoices = await invoiceStorage.getAllInvoices();
    setInvoices(allInvoices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
    setLoading(false);
  };

  const syncInvoice = async (invoice) => {
    setSyncingId(invoice.id);
    try {
      const updates = invoice.items.map(item => ({
        productId: item.id,
        newQuantity: item.stock_quantity - item.quantity
      }));

      const res = await fetch('/api/pos/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to sync stock');

      await invoiceStorage.markInvoiceAsSynced(invoice.id);
      setToast({ message: 'تم تحديث المخزون بنجاح', type: 'success' });
      loadInvoices(); // Reload to update UI
    } catch (error) {
      setToast({ message: 'فشل تحديث المخزون', type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">الفواتير</h1>

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <div className="text-center text-gray-500">لا توجد فواتير</div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white rounded-lg shadow p-4"
            >
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleString()}
                    </span>
                    <span className={`ml-2 px-2 py-1 rounded text-sm
                      ${invoice.synced 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {invoice.synced ? 'تمت المزامنة' : 'في انتظار المزامنة'}
                    </span>
                  </div>
                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {invoice.paymentMethod === 'cash' ? 'كاش' :
                     invoice.paymentMethod === 'wallet' ? 'محفظة' :
                     invoice.paymentMethod === 'instapay' ? 'انستا باي' : 'أخرى'}
                  </span>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>المجموع:</span>
                    <span>{invoice.summary?.subtotal?.toFixed(2)} ج.م</span>
                  </div>
                  
                  {invoice.summary?.discount?.amount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>
                        الخصم ({invoice.summary.discount.type === 'percentage' 
                          ? `${invoice.summary.discount.value}%` 
                          : `${invoice.summary.discount.value} ج.م`}):
                      </span>
                      <span>- {invoice.summary.discount.amount.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  
                  {invoice.summary?.extraFee > 0 && (
                    <div className="flex justify-between">
                      <span>رسوم إضافية:</span>
                      <span>+ {Number(invoice.summary.extraFee).toFixed(2)} ج.م</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>الإجمالي:</span>
                    <span>{invoice.summary?.total?.toFixed(2)} ج.م</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <h3 className="font-medium mb-2">المنتجات:</h3>
                <div className="space-y-1">
                  {invoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} × {item.quantity}</span>
                      <span>{(Number(item.price) * item.quantity).toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              {!invoice.synced && (
                <button
                  onClick={() => syncInvoice(invoice)}
                  disabled={syncingId === invoice.id}
                  className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium
                    ${syncingId === invoice.id
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {syncingId === invoice.id ? 'جاري المزامنة...' : 'مزامنة الآن'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

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