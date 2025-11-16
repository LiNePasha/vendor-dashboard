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
      
      // دعم الـ format القديم والجديد
      if (data.orders && Array.isArray(data.orders)) {
        // Format جديد: { orders: [], total: 0 }
        setOrders(data.orders);
      } else if (Array.isArray(data)) {
        // Format قديم: []
        setOrders(data);
      } else {
        setOrders([]);
      }
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
            const items = order.line_items || [];
            const itemsCount = items.length;

            // استخراج الصور من المنتجات - WooCommerce بيحطها في meta_data أو product
            const getProductImages = () => {
              return items.map((item, idx) => {
                // محاولة الحصول على الصورة من أماكن مختلفة
                let imageUrl = null;
                
                // Debug: طباعة البيانات
                if (idx === 0) {
                  console.log('🖼️ Item structure:', {
                    name: item.name,
                    image: item.image,
                    image_url: item.image_url,
                    has_meta: !!item.meta_data
                  });
                }
                
                // من الـ image object (الطريقة الصحيحة في WooCommerce REST API)
                if (item.image?.src) {
                  imageUrl = item.image.src;
                }
                // من image_url مباشرة
                else if (item.image_url) {
                  imageUrl = item.image_url;
                }
                // من الـ meta_data
                else if (item.meta_data) {
                  const imageMeta = item.meta_data.find(m => m.key === '_thumbnail_id' || m.key === 'image');
                  if (imageMeta?.value) imageUrl = imageMeta.value;
                }
                
                // Fallback للـ placeholder
                if (!imageUrl || imageUrl === '') {
                  imageUrl = '/icons/placeholder.webp';
                }
                
                return {
                  ...item,
                  imageUrl: imageUrl
                };
              });
            };

            const itemsWithImages = getProductImages();

            // تحديد layout الصور حسب العدد (زي Facebook)
            const getImageLayout = () => {
              if (itemsCount === 0) return null;
              if (itemsCount === 1) return "single";
              if (itemsCount === 2) return "double";
              if (itemsCount === 3) return "triple";
              if (itemsCount === 4) return "quad";
              return "grid"; // 5+
            };

            const layout = getImageLayout();

            return (
              <div
                key={order.id}
                className={`group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border-2 cursor-pointer transform hover:-translate-y-2 ${
                  isNew 
                    ? "border-yellow-400 ring-4 ring-yellow-100 shadow-yellow-200/50" 
                    : "border-gray-100 hover:border-blue-300"
                }`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="p-4">
                  {/* Header - Order Number & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                      {isNew && (
                        <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                          <span className="relative">🔔 جديد</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-md ${
                        statusObj?.color || "bg-gray-500"
                      }`}
                    >
                      {statusObj?.label || order.status}
                    </span>
                  </div>

                {/* Products Images Grid - Facebook Style */}
                {items.length > 0 && (
                  <div className="mb-3 rounded-xl overflow-hidden bg-gray-50">
                    {/* Single Image - Full Width */}
                    {layout === "single" && (
                      <div className="w-full aspect-[16/10] relative group bg-white">
                        <img
                          src={itemsWithImages[0].imageUrl}
                          alt={itemsWithImages[0].name}
                          className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = "/icons/placeholder.webp";
                          }}
                        />
                      </div>
                    )}

                    {/* Two Images - Side by Side */}
                    {layout === "double" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {itemsWithImages.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="relative group bg-white overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Three Images - Facebook Style (1 big left, 2 small right) */}
                    {layout === "triple" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        <div className="row-span-2 bg-white overflow-hidden relative group">
                          <img
                            src={itemsWithImages[0].imageUrl}
                            alt={itemsWithImages[0].name}
                            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.src = "/icons/placeholder.webp";
                            }}
                          />
                        </div>
                        {itemsWithImages.slice(1, 3).map((item, idx) => (
                          <div key={idx} className="bg-white overflow-hidden relative group">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Four Images - Facebook Style (2x2 Grid) */}
                    {layout === "quad" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {itemsWithImages.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="bg-white overflow-hidden relative group">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Five or More Images - Facebook Style (with +X overlay) */}
                    {layout === "grid" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {/* First large image */}
                        <div className="row-span-2 bg-white overflow-hidden relative group">
                          <img
                            src={itemsWithImages[0].imageUrl}
                            alt={itemsWithImages[0].name}
                            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.src = "/icons/placeholder.webp";
                            }}
                          />
                        </div>
                        
                        {/* Next 3 images */}
                        {itemsWithImages.slice(1, 4).map((item, idx) => {
                          const isLast = idx === 2 && itemsCount > 4;
                          return (
                            <div key={idx} className="bg-white overflow-hidden relative group">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={`w-full h-full object-contain p-1 transition-all duration-300 ${
                                  isLast ? 'brightness-50 group-hover:brightness-40' : 'group-hover:scale-105'
                                }`}
                                onError={(e) => {
                                  e.target.src = "/icons/placeholder.webp";
                                }}
                              />
                              {isLast && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                                  <span className="text-white font-bold text-3xl drop-shadow-lg">
                                    +{itemsCount - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Products Summary - Enhanced */}
                <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg w-12 h-12 flex items-center justify-center shadow-md">
                        <div className="text-center">
                          <div className="text-lg font-bold leading-none">{itemsCount}</div>
                          <div className="text-[9px] leading-none mt-0.5">منتج</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">
                        {items[0]?.name}
                      </div>
                      {itemsCount > 1 && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {items.slice(1, 3).map(item => item.name).join(" • ")}
                          {itemsCount > 3 && ` وأخرى...`}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {items.slice(0, Math.min(3, itemsCount)).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            <span className="font-medium">×{item.quantity}</span>
                          </span>
                        ))}
                        {itemsCount > 3 && (
                          <span className="text-xs text-gray-400">+{itemsCount - 3} أخرى</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Customer Info */}
                  <div className="space-y-2 mb-4 text-sm px-1">
                    <p className="text-gray-700 flex items-center gap-2">
                      <span className="text-gray-400">👤</span>
                      <span className="font-medium">
                        {order.billing?.first_name} {order.billing?.last_name}
                      </span>
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">💳</span>
                      {order.payment_method_title}
                    </p>
                    <p className="text-gray-900 font-bold text-xl flex items-center gap-2">
                      <span className="text-gray-400 text-base">💰</span>
                      {order.total} {order.currency}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 px-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2.5 rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
                      onClick={() => setSelectedOrder(order)}
                    >
                      📄 التفاصيل
                    </button>
                    {order.status === "processing" && (
                      <button
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-2.5 rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
                        onClick={() => handleRegisterInvoice(order)}
                        disabled={registeringInvoice}
                        title="تسجيل فاتورة"
                      >
                        {registeringInvoice ? "⏳" : "🧾"}
                      </button>
                    )}
                    <select
                      disabled={updatingStatus}
                      className="border-2 border-gray-200 rounded-lg px-2 py-2 text-xs bg-white hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
                <div className="space-y-3">
                  {/* Shipping */}
                  {selectedOrder.shipping_total && parseFloat(selectedOrder.shipping_total) > 0 && (
                    <div className="flex justify-between items-center text-gray-700">
                      <span className="font-medium">🚚 الشحن</span>
                      <span className="font-semibold">{selectedOrder.shipping_total} {selectedOrder.currency}</span>
                    </div>
                  )}
                  
                  {/* Total */}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-blue-200">
                    <h3 className="font-bold text-xl text-gray-800">المجموع الكلي</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {selectedOrder.total} {selectedOrder.currency}
                    </p>
                  </div>
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
