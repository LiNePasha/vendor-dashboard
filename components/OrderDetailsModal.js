"use client";

import { useRef, useState } from "react";
import { invoiceStorage } from "@/app/lib/localforage";

export default function OrderDetailsModal({ 
  order, 
  isOpen, 
  onClose, 
  onStatusChange,
  showToast 
}) {
  const modalRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [registeringInvoice, setRegisteringInvoice] = useState(false);

  if (!isOpen || !order) return null;

  // Handle status change
  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id, status: newStatus }),
      });

      if (!res.ok) throw new Error("فشل تحديث الحالة");

      const updatedOrder = await res.json();
      
      if (onStatusChange) {
        onStatusChange(order.id, updatedOrder.status);
      }
      
      if (showToast) {
        showToast("تم تحديث حالة الطلب!");
      }
    } catch (err) {
      if (showToast) {
        showToast("فشل تغيير الحالة!", "error");
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle register invoice
  const handleRegisterInvoice = async () => {
    setRegisteringInvoice(true);
    try {
      const existingInvoices = await invoiceStorage.getAllInvoices();
      const alreadyRegistered = existingInvoices.some(inv => inv.orderId === order.id);
      
      if (alreadyRegistered) {
        if (showToast) {
          showToast("هذا الطلب مسجل بالفعل في الفواتير!", "error");
        }
        return;
      }

      const invoiceItems = order.line_items.map(item => ({
        id: item.product_id || item.id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        totalPrice: parseFloat(item.price) * item.quantity,
        stock_quantity: null,
        wholesalePrice: null,
        profit: null
      }));

      const subtotal = parseFloat(order.total);
      
      const invoice = {
        id: `order-${order.id}-${Date.now()}`,
        orderId: order.id,
        date: new Date().toISOString(),
        items: invoiceItems,
        services: [],
        summary: {
          productsSubtotal: subtotal,
          servicesTotal: 0,
          subtotal: subtotal,
          discount: {
            type: 'fixed',
            value: 0,
            amount: 0
          },
          extraFee: 0,
          total: subtotal,
          totalProfit: 0,
          profitItemsCount: 0
        },
        profitDetails: [],
        paymentMethod: order.payment_method_title || 'غير محدد',
        customerInfo: {
          name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          phone: order.billing?.phone || '',
          email: order.billing?.email || '',
          address: order.billing?.address_1 ? `${order.billing.address_1}, ${order.billing?.state || ''}` : ''
        },
        synced: true,
        source: 'order'
      };

      await invoiceStorage.saveInvoice(invoice);
      
      if (showToast) {
        showToast("تم تسجيل الفاتورة بنجاح! 🎉");
      }
    } catch (error) {
      if (showToast) {
        showToast("فشل تسجيل الفاتورة!", "error");
      }
    } finally {
      setRegisteringInvoice(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    if (showToast) {
      showToast("تم نسخ العنوان!");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <h2 className="text-2xl font-bold">طلب #{order.id}</h2>
              <p className="text-blue-100 text-sm">
                {(() => {
                  if (!order.date_created) return 'تاريخ غير محدد';
                  try {
                    // معالجة التاريخ وإضافة ساعتين (فرق التوقيت بين UTC والقاهرة)
                    const dateStr = order.date_created.replace('T', ' ').substring(0, 16);
                    const [datePart, timePart] = dateStr.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    const date = new Date(year, month - 1, day, parseInt(hour) + 2, minute); // +2 hours for Cairo timezone
                    
                    return date.toLocaleString('ar-EG', { 
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                  } catch (e) {
                    return 'تاريخ غير صالح';
                  }
                })()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition-all hover:rotate-90"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Actions */}
          <section className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حالة الطلب
              </label>
              <div className="relative">
                <select
                  disabled={updatingStatus}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base bg-white hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="on-hold">معلق</option>
                  <option value="processing">قيد التجهيز</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغى</option>
                  <option value="refunded">تم الاسترجاع</option>
                  <option value="failed">فشل</option>
                </select>
                {updatingStatus && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                &nbsp;
              </label>
              <button
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-3 rounded-lg transition-all font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleRegisterInvoice}
                disabled={registeringInvoice}
              >
                {registeringInvoice ? '⏳ جاري التسجيل...' : '🧾 تسجيل فاتورة'}
              </button>
            </div>
          </section>

          {/* Customer Info */}
          <section className="bg-blue-50 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span>👤</span> بيانات العميل
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                <span className="font-medium">الاسم:</span>{" "}
                {order.billing?.first_name} {order.billing?.last_name}
              </p>
              {order.billing?.email && (
                <p className="text-gray-700">
                  <span className="font-medium">البريد:</span> {order.billing.email}
                </p>
              )}
              {order.billing?.phone && (
                <p className="text-gray-700">
                  <span className="font-medium">الهاتف:</span> {order.billing.phone}
                </p>
              )}
              {order.billing?.address_1 && (
                <div className="flex items-start gap-2 pt-2">
                  <p className="flex-1 text-gray-700">
                    <span className="font-medium">العنوان:</span>{" "}
                    {order.billing.address_1}, {order.billing?.state}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${order.billing.address_1}, ${order.billing.state}`
                      )
                    }
                    className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                  >
                    📋 نسخ
                  </button>
                  {order.meta_data?.find((m) => m.key === "_billing_maps_link") && (
                    <a
                      href={
                        order.meta_data.find((m) => m.key === "_billing_maps_link").value
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 text-xs font-medium"
                    >
                      🗺️ خرائط
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Payment Method */}
          <section className="bg-green-50 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <span>💳</span> طريقة الدفع
            </h3>
            <p className="text-gray-700">{order.payment_method_title}</p>
          </section>

          {/* Products */}
          <section>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>📦</span> المنتجات ({order.line_items?.length || 0})
            </h3>
            <div className="space-y-3">
              {order.line_items?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 bg-gray-50 rounded-xl p-4"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        e.target.src = '/icons/placeholder.webp';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      الكمية: {item.quantity} × {item.price} {order.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900">
                      {(item.quantity * parseFloat(item.price)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{order.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Total */}
          <section className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5">
            <div className="space-y-3">
              {order.shipping_total && parseFloat(order.shipping_total) > 0 && (
                <div className="flex justify-between items-center text-gray-700">
                  <span className="font-medium">🚚 الشحن</span>
                  <span className="font-semibold">{order.shipping_total} {order.currency}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-3 border-t-2 border-blue-200">
                <h3 className="font-bold text-xl text-gray-800">المجموع الكلي</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {order.total} {order.currency}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
