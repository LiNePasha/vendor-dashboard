"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function NotificationSidebar({ isOpen, onClose, soundEnabled = true, onSoundToggle }) {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const sidebarRef = useRef(null);

  // Load read notifications from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('readNotifications');
    if (saved) {
      setReadNotifications(new Set(JSON.parse(saved)));
    }
  }, []);
  
  // Toggle sound
  const toggleSound = () => {
    if (typeof onSoundToggle === 'function') {
      onSoundToggle(!soundEnabled);
    }
  };

  // Fetch processing orders
  const fetchProcessingOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?status=processing&per_page=10', {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const data = await res.json();
      const processingOrders = data.orders || data || [];
      
      setOrders(processingOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders when sidebar opens
  useEffect(() => {
    if (isOpen) {
      fetchProcessingOrders();
      // Poll every 60 seconds while sidebar is open
      const interval = setInterval(fetchProcessingOrders, 60000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Mark notification as read
  const markAsRead = (orderId) => {
    const newRead = new Set(readNotifications);
    newRead.add(orderId);
    setReadNotifications(newRead);
    localStorage.setItem('readNotifications', JSON.stringify([...newRead]));
  };

  // Mark all as read
  const markAllAsRead = () => {
    const allIds = orders.map(o => o.id);
    const newRead = new Set([...readNotifications, ...allIds]);
    setReadNotifications(newRead);
    localStorage.setItem('readNotifications', JSON.stringify([...newRead]));
  };

  // Navigate to order details
  const handleOrderClick = (orderId) => {
    markAsRead(orderId);
    router.push(`/orders#${orderId}`);
    onClose();
  };

  // Get product images with fallback
  const getProductImages = (items) => {
    return items.slice(0, 4).map((item) => {
      let imageUrl = null;
      
      if (item.image?.src) {
        imageUrl = item.image.src;
      } else if (item.image_url) {
        imageUrl = item.image_url;
      } else if (item.meta_data) {
        const imageMeta = item.meta_data.find(m => m.key === '_thumbnail_id' || m.key === 'image');
        if (imageMeta?.value) imageUrl = imageMeta.value;
      }
      
      if (!imageUrl || imageUrl === '') {
        imageUrl = '/icons/placeholder.webp';
      }
      
      return imageUrl;
    });
  };

  const unreadCount = orders.filter(o => !readNotifications.has(o.id)).length;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          style={{ opacity: isOpen ? 1 : 0 }}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <span className="text-2xl">🔔</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">الإشعارات</h2>
                <p className="text-blue-100 text-sm">
                  {unreadCount > 0 ? `${unreadCount} غير مقروء` : 'كل الإشعارات مقروءة'}
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ تحديد الكل كمقروء
            </button>
            <button
              onClick={toggleSound}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 rounded-lg text-lg transition-all"
              title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              onClick={fetchProcessingOrders}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 rounded-lg text-lg transition-all"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] bg-gray-50">
          {loading ? (
            // Loading Skeletons
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="aspect-square bg-gray-200 rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-green-100 rounded-full w-24 h-24 flex items-center justify-center mb-4">
                <span className="text-5xl">✅</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                رائع! لا توجد طلبات جديدة
              </h3>
              <p className="text-gray-500">
                كل الطلبات تم معالجتها
              </p>
            </div>
          ) : (
            // Notifications List
            <div className="p-4 space-y-3">
              {orders.map((order) => {
                const isRead = readNotifications.has(order.id);
                const images = getProductImages(order.line_items || []);
                const itemsCount = order.line_items?.length || 0;
                const timeAgo = getTimeAgo(order.date_created);

                return (
                  <div
                    key={order.id}
                    onClick={() => handleOrderClick(order.id)}
                    className={`bg-white rounded-xl p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer border-2 ${
                      isRead 
                        ? 'border-gray-100 opacity-75' 
                        : 'border-blue-200 ring-2 ring-blue-100'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {!isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        )}
                        <span className="font-bold text-gray-800 text-lg">
                          #{order.id}
                        </span>
                        {!isRead && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            جديد
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{timeAgo}</span>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg w-10 h-10 flex items-center justify-center font-bold text-lg">
                        {order.billing?.first_name?.charAt(0) || '؟'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {order.billing?.first_name} {order.billing?.last_name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {order.billing?.phone || 'لا يوجد رقم'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 text-lg">
                          {order.total}
                        </p>
                        <p className="text-xs text-gray-500">{order.currency}</p>
                      </div>
                    </div>

                    {/* Products Images Grid */}
                    {images.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600">
                            📦 المنتجات ({itemsCount})
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {images.map((img, idx) => (
                            <div
                              key={idx}
                              className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group"
                            >
                              <img
                                src={img}
                                alt={`Product ${idx + 1}`}
                                className="w-full h-full object-contain p-1 transition-transform group-hover:scale-110"
                                onError={(e) => {
                                  e.target.src = '/icons/placeholder.webp';
                                }}
                              />
                              {idx === 3 && itemsCount > 4 && (
                                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                                  <span className="text-white font-bold text-lg">
                                    +{itemsCount - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Products Summary */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {order.line_items?.slice(0, 2).map(item => 
                          `${item.name} (×${item.quantity})`
                        ).join(' • ')}
                        {itemsCount > 2 && ` و ${itemsCount - 2} منتج آخر`}
                      </p>
                    </div>

                    {/* Action Hint */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderClick(order.id);
                        }}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 px-3 rounded-lg font-medium transition-all"
                      >
                        📄 عرض التفاصيل
                      </button>
                      {!isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(order.id);
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-2 px-3 rounded-lg font-medium transition-all"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <button
            onClick={() => {
              router.push('/orders');
              onClose();
            }}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            📦 عرض كل الطلبات
          </button>
        </div>
      </div>
    </>
  );
}

// Helper function for time ago
function getTimeAgo(dateString) {
  // تحويل التاريخ من UTC لتوقيت مصر (UTC+2)
  const date = new Date(dateString);
  date.setHours(date.getHours() + 2); // إضافة ساعتين لتوقيت مصر
  
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
  
  return date.toLocaleDateString('ar-EG');
}
