"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import usePOSStore from "@/app/stores/pos-store";
import OrderDetailsModal from "@/components/OrderDetailsModal";

const STATUS_OPTIONS = [
  { value: "on-hold", label: "معلق", color: "bg-yellow-500" },
  { value: "processing", label: "قيد التجهيز", color: "bg-blue-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "cancelled", label: "ملغى", color: "bg-gray-500" },
  { value: "refunded", label: "تم الاسترجاع", color: "bg-purple-500" },
  { value: "failed", label: "فشل", color: "bg-red-500" },
];

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🔥 استخدام Global State
  const orders = usePOSStore((state) => state.orders);
  const ordersLoading = usePOSStore((state) => state.ordersLoading);
  const fetchOrders = usePOSStore((state) => state.fetchOrders);
  const updateOrderStatus = usePOSStore((state) => state.updateOrderStatus);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState(null);

  // 🆕 قراءة search من URL أول مرة وجلب الطلب مباشرة
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
      // 🆕 جلب الطلبات مع search filter من الـ API مباشرة
      fetchOrders({ search: searchFromUrl, per_page: 50 });
    }
  }, [searchParams]);

  // 🔥 Auto-refresh orders كل 30 ثانية (بس لو الصفحة مفتوحة)
  useEffect(() => {
    // جلب الطلبات أول مرة
    fetchOrders();

    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(() => {
      // 🆕 تحقق لو الصفحة مفتوحة (visible) قبل ما نعمل fetch
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    }, 30000); // 30 seconds

    // 🆕 لو المستخدم رجع للصفحة، حدث فوراً
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchOrders]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = (orderId, newStatus) => {
    // Update global state
    updateOrderStatus(orderId, newStatus);

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("تم نسخ العنوان!");
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
    
    // Date filtering
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const orderDate = new Date(order.date_created);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && orderDate >= fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && orderDate <= toDate;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="p-6 relative min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white z-[100000000000] shadow-lg ${
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
          {ordersLoading ? 'جاري التحميل...' : (
            <>
              {filteredOrders.length} {filteredOrders.length !== orders.length && `من ${orders.length}`} طلب
              {(searchTerm || statusFilter || dateFrom || dateTo) && filteredOrders.length !== orders.length && (
                <span className="text-blue-600 font-medium"> (مفلتر)</span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col gap-4">
          {/* Search and Status Filter Row */}
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

          {/* Date Filter Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium whitespace-nowrap">📅 من:</label>
              <input
                type="date"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium whitespace-nowrap">📅 إلى:</label>
              <input
                type="date"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(searchTerm || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  router.push('/orders');
                  fetchOrders(); // جلب جميع الطلبات من جديد
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium whitespace-nowrap"
              >
                🔄 مسح الفلاتر
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {(searchTerm || statusFilter || dateFrom || dateTo) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">الفلاتر النشطة:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  🔍 {searchTerm}
                  <button onClick={() => setSearchTerm("")} className="hover:text-blue-900">×</button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  📊 {STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}
                  <button onClick={() => setStatusFilter("")} className="hover:text-purple-900">×</button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  📅 من: {new Date(dateFrom).toLocaleDateString('ar-EG')}
                  <button onClick={() => setDateFrom("")} className="hover:text-green-900">×</button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  📅 إلى: {new Date(dateTo).toLocaleDateString('ar-EG')}
                  <button onClick={() => setDateTo("")} className="hover:text-green-900">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ordersLoading ? (
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
                  router.push('/orders');
                  fetchOrders(); // جلب جميع الطلبات من جديد
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
            
            // 🔥 تحديد الطلبات الجديدة فعلاً حسب التاريخ (اليوم فقط)
            const orderDate = new Date(order.date_created);
            orderDate.setHours(orderDate.getHours() + 2); // توقيت مصر
            const today = new Date();
            const isToday = orderDate.toDateString() === today.toDateString();
            const isNew = isToday && order.status === 'on-hold'; // جديد فقط لو معلق واليوم
            
            const items = order.line_items || [];
            const itemsCount = items.length;

            // استخراج الصور من المنتجات - WooCommerce بيحطها في meta_data أو product
            const getProductImages = () => {
              return items.map((item, idx) => {
                // محاولة الحصول على الصورة من أماكن مختلفة
                let imageUrl = null;
                
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
            
            // حساب الوقت مع تصحيح التوقيت
            const getTimeAgo = (dateString) => {
              const date = new Date(dateString);
              date.setHours(date.getHours() + 2); // توقيت مصر UTC+2
              const now = new Date();
              const seconds = Math.floor((now - date) / 1000);
              
              // 🔥 التحقق من نفس اليوم
              const isToday = date.toDateString() === now.toDateString();
              
              if (seconds < 60) return 'الآن';
              if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
              
              // 🔥 لو نفس اليوم نعرض "اليوم" بدل "منذ X ساعة"
              if (isToday) {
                return `اليوم ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
              }
              
              if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
              if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
              
              return date.toLocaleDateString('ar-EG');
            };

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
                      {/* 🆕 بادج نوع التوصيل */}
                      {order.meta_data?.some(m => 
                        (m.key === '_is_store_pickup' && m.value === 'yes') || 
                        (m.key === '_delivery_type' && m.value === 'store_pickup')
                      ) ? (
                        <span className="inline-flex items-center gap-1 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                          🏪 استلام
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          🚚 توصيل
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-md ${
                          statusObj?.color || "bg-gray-500"
                        }`}
                      >
                        {statusObj?.label || order.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {getTimeAgo(order.date_created)}
                      </p>
                    </div>
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
                    <select
                      className="border-2 border-gray-200 rounded-lg px-2 py-2 text-xs bg-white hover:border-blue-500 transition-colors font-medium"
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

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onStatusChange={handleStatusChange}
        showToast={showToast}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white z-[70] shadow-lg ${
            toast.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// 🔥 Wrapper مع Suspense boundary
export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">جاري تحميل الطلبات...</p>
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
