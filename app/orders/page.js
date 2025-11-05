"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { invoiceStorage } from "@/app/lib/localforage";

const STATUS_OPTIONS = [
  { value: "on-hold", label: "معلق", color: "bg-yellow-500" },
  { value: "processing", label: "قيد التجهيز", color: "bg-blue-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "cancelled", label: "ملغى", color: "bg-gray-500" },
  { value: "refunded", label: "تم الاسترجاع", color: "bg-purple-500" },
  { value: "failed", label: "فشل", color: "bg-red-500" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [registeringInvoice, setRegisteringInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState(null);
  const modalRef = useRef(null);

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("فشل تحميل الطلبات");
      
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast("فشل جلب الطلبات", "error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (!res.ok) throw new Error("فشل تحديث الحالة");

      const updatedOrder = await res.json();

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: updatedOrder.status } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: updatedOrder.status });
      }
      
      showToast("تم تحديث حالة الطلب!");
    } catch (err) {
      showToast("فشل تغيير الحالة!", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("تم نسخ العنوان!");
  };

  const handleRegisterInvoice = async (order) => {
    setRegisteringInvoice(true);
    try {
      // Check if order is already registered
      const existingInvoices = await invoiceStorage.getAllInvoices();
      const alreadyRegistered = existingInvoices.some(inv => inv.orderId === order.id);
      
      if (alreadyRegistered) {
        showToast("هذا الطلب مسجل بالفعل في الفواتير!", "error");
        setTimeout(() => {
          router.push('/pos/invoices');
        }, 1500);
        return;
      }

      // Convert order to invoice format
      const invoiceItems = order.line_items.map(item => ({
        id: item.product_id || item.id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        totalPrice: parseFloat(item.price) * item.quantity,
        stock_quantity: null, // Don't track stock for orders
        wholesalePrice: null,
        profit: null
      }));

      const subtotal = parseFloat(order.total);
      
      const invoice = {
        id: `order-${order.id}-${Date.now()}`,
        orderId: order.id, // Reference to original order
        date: new Date().toISOString(),
        items: invoiceItems,
        services: [], // No services for orders
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
        synced: true, // Already synced from WooCommerce
        source: 'order' // Mark as coming from orders
      };

      // Save invoice
      await invoiceStorage.saveInvoice(invoice);
      
      showToast("تم تسجيل الفاتورة بنجاح! 🎉");
      
      // Navigate to invoices page
      setTimeout(() => {
        router.push('/pos/invoices');
      }, 1500);
      
    } catch (error) {
      showToast("فشل تسجيل الفاتورة!", "error");
    } finally {
      setRegisteringInvoice(false);
    }
  };

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setSelectedOrder(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const fullName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || order.id.toString().includes(searchTerm);
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 relative min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white z-50 shadow-lg ${
            toast.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📦 الطلبات</h1>
        <p className="text-gray-500 mt-1">
          {loading ? 'جاري التحميل...' : `${orders.length} طلب`}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="🔍 ابحث بالرقم أو اسم العميل..."
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">📊 كل الحالات</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          // Loading Skeletons
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm p-5 animate-pulse border border-gray-100"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="h-6 bg-gray-200 rounded w-20" />
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="flex gap-3 mt-4">
                <div className="h-9 bg-gray-200 rounded flex-1" />
                <div className="h-9 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))
        ) : filteredOrders.length === 0 ? (
          // Empty State
          <div className="col-span-full text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg mb-2">
              {orders.length === 0 ? 'لا توجد طلبات' : 'لا توجد طلبات مطابقة للبحث'}
            </p>
            {searchTerm || statusFilter ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                }}
                className="text-blue-500 hover:underline text-sm mt-2"
              >
                مسح الفلاتر
              </button>
            ) : null}
          </div>
        ) : (
          // Orders List
          filteredOrders.map((order) => {
            const statusObj = STATUS_OPTIONS.find((s) => s.value === order.status);
            const isNew = order.status === "on-hold";

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border-2 ${
                  isNew ? "border-yellow-400" : "border-gray-100"
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-bold text-lg text-gray-800">#{order.id}</h2>
                    {isNew && (
                      <span className="inline-block bg-red-500 text-white text-xs px-2 py-0.5 rounded mt-1">
                        🔔 طلب جديد
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-white text-sm font-medium ${
                      statusObj?.color || "bg-gray-500"
                    }`}
                  >
                    {statusObj?.label || order.status}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">العميل:</span>{" "}
                    {order.billing?.first_name} {order.billing?.last_name}
                  </p>
                  <p className="text-gray-600">
                    💳 {order.payment_method_title}
                  </p>
                  <p className="text-gray-900 font-bold text-lg">
                    {order.total} {order.currency}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                    onClick={() => setSelectedOrder(order)}
                  >
                    📄 التفاصيل
                  </button>
                  {order.status === "processing" && (
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
                      onClick={() => handleRegisterInvoice(order)}
                      disabled={registeringInvoice}
                    >
                      {registeringInvoice ? "⏳" : "🧾"} تسجيل فاتورة
                    </button>
                  )}
                  <select
                    disabled={updatingStatus}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={handleOutsideClick}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">الطلب #{selectedOrder.id}</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {new Date(selectedOrder.date_created).toLocaleString('ar-EG')}
                  </p>
                </div>
                <button
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-2xl transition-colors"
                  onClick={() => setSelectedOrder(null)}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <section className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span>👤</span> بيانات العميل
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">الاسم:</span>{" "}
                    {selectedOrder.billing?.first_name} {selectedOrder.billing?.last_name}
                  </p>
                  {selectedOrder.billing?.email && (
                    <p className="text-gray-700">
                      <span className="font-medium">البريد:</span> {selectedOrder.billing.email}
                    </p>
                  )}
                  {selectedOrder.billing?.phone && (
                    <p className="text-gray-700">
                      <span className="font-medium">الهاتف:</span> {selectedOrder.billing.phone}
                    </p>
                  )}
                  {selectedOrder.billing?.address_1 && (
                    <div className="flex items-start gap-2 pt-2">
                      <p className="flex-1 text-gray-700">
                        <span className="font-medium">العنوان:</span>{" "}
                        {selectedOrder.billing.address_1}, {selectedOrder.billing?.state}
                      </p>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${selectedOrder.billing.address_1}, ${selectedOrder.billing.state}`
                          )
                        }
                        className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                      >
                        📋 نسخ
                      </button>
                      {selectedOrder.meta_data?.find((m) => m.key === "_billing_maps_link") && (
                        <a
                          href={
                            selectedOrder.meta_data.find((m) => m.key === "_billing_maps_link").value
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
                <p className="text-gray-700">{selectedOrder.payment_method_title}</p>
              </section>

              {/* Products */}
              <section>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <span>📦</span> المنتجات ({selectedOrder.line_items?.length || 0})
                </h3>
                <div className="space-y-3">
                  {selectedOrder.line_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 bg-gray-50 rounded-xl p-4"
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          الكمية: {item.quantity} × {item.price} {selectedOrder.currency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                          {(item.quantity * parseFloat(item.price)).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{selectedOrder.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Total */}
              <section className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xl text-gray-800">المجموع الكلي</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {selectedOrder.total} {selectedOrder.currency}
                  </p>
                </div>
              </section>

              {/* Register Invoice Button (in modal) */}
              {selectedOrder.status === "processing" && (
                <section>
                  <button
                    onClick={() => handleRegisterInvoice(selectedOrder)}
                    disabled={registeringInvoice}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                  >
                    {registeringInvoice ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        جاري التسجيل...
                      </>
                    ) : (
                      <>
                        🧾 تسجيل كفاتورة
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    سيتم حفظ الطلب في الفواتير ويمكنك طباعته
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
