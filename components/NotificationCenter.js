"use client";

import { useState, useEffect } from "react";

// دالة مساعدة لجلب vendorId من localStorage
function getVendorIdFromLocalStorage() {
  try {
    const raw = localStorage.getItem('pos-store');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.vendorInfo?.id || null;
  } catch {
    return null;
  }
}

export default function NotificationCenter({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('unread'); // 'unread', 'all'

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // استخدام الـ API الجديد مع read status من database
      const vendorId = getVendorIdFromLocalStorage() || '22';
      const res = await fetch(
        `/api/notifications-v2?filter=${filter}&per_page=50&vendor_id=${vendorId}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId, orderId = null) => {
    console.log('🔔 markAsRead called:', { notificationId, orderId });
    try {
      // استخدام الـ API الجديد لعمل mark as read في database
      const vendorId = getVendorIdFromLocalStorage() || '22';
      const res = await fetch(
        `/api/notifications-v2?id=${notificationId}&vendor_id=${vendorId}`,
        { 
          method: 'POST',
          credentials: 'include' 
        }
      );
      console.log('✅ Mark as read response:', res.status);
      if (res.ok) {
        // إعادة تحميل الـ notifications بعد التحديث
        fetchNotifications();
        // لو في orderId, اروح على صفحة الأوردرات مع البحث
        if (orderId) {
          console.log('🚀 Navigating to orders page with search:', orderId);
          window.location.href = `/orders?search=${orderId}`;
        }
      }
    } catch (error) {
      console.error('❌ Error marking as read:', error);
    }
  };



  const extractOrderId = (message) => {
    if (!message) {
      console.log('🔍 extractOrderId: No message');
      return null;
    }
    
    // جرب تطلع الرقم من الـ href (orders-details/NUMBER)
    let match = message.match(/orders-details[\/\\]+(\d+)/);
    if (match) {
      console.log('🔍 extractOrderId (from href):', { message, orderId: match[1] });
      return match[1];
    }
    
    // جرب تطلع الرقم من جوا الـ anchor tag (>NUMBER</a>)
    match = message.match(/>(\d{4,})</);
    if (match) {
      console.log('🔍 extractOrderId (from anchor):', { message, orderId: match[1] });
      return match[1];
    }
    
    // آخر محاولة: أي رقم كبير (4 أرقام أو أكتر) بعد #
    match = message.match(/#[^\d]*(\d{4,})/);
    if (match) {
      console.log('🔍 extractOrderId (from #):', { message, orderId: match[1] });
      return match[1];
    }
    
    console.log('🔍 extractOrderId: No order ID found', { message });
    return null;
  };

  const getTimeAgo = (dateString) => {
    // 🔥 معالجة التاريخ: التاريخ جاي من WooCommerce بصيغة "2026-01-02 04:00:52"
    // لازم نحوله لـ ISO format مع Z عشان يتعامل كـ UTC
    let date;
    if (dateString && dateString.includes(' ')) {
      // تحويل من "2026-01-02 04:00:52" لـ "2026-01-02T04:00:52Z"
      const isoString = dateString.replace(' ', 'T') + 'Z';
      date = new Date(isoString);
    } else {
      date = new Date(dateString);
    }
    
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'الآن';
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
    return `منذ ${Math.floor(seconds / 86400)} يوم`;
  };

  const stripHTML = (html) => {
    // إزالة الـ HTML tags وترك النص فقط
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar - يفتح من الشمال */}
      <div 
        className={`fixed top-0 left-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-xl font-bold">🔔 الإشعارات</h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-3 font-bold transition-colors ${
              filter === 'unread'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            غير مقروء
            {notifications.length > 0 && filter === 'unread' && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {notifications.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 font-bold transition-colors ${
              filter === 'all'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            الكل
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-lg font-bold">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const orderId = extractOrderId(notification.message);
                const isOrderNotif = notification.message_type === 'order';
                
                return (
                  <div
                    key={notification.ID}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => markAsRead(notification.ID, orderId)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isOrderNotif ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {isOrderNotif ? (
                          <span className="text-xl">🛒</span>
                        ) : (
                          <span className="text-xl">📝</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 mb-1">
                          {stripHTML(notification.message)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(notification.created)}
                          </span>
                          {orderId && (
                            <span className="text-xs text-blue-600">
                              رقم الطلب: #{orderId}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Read/Unread indicator */}
                      {notification.is_read === '0' ? (
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full" title="غير مقروء"></div>
                      ) : (
                        <div className="flex-shrink-0 w-5 h-5 text-green-500" title="مقروء">
                          <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && filter === 'unread' && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(
                    `/api/notifications-v2?action=mark-all-read&vendor_id=22`,
                    { 
                      method: 'POST',
                      credentials: 'include' 
                    }
                  );
                  
                  if (res.ok) {
                    // إعادة تحميل الـ notifications بعد التحديث
                    fetchNotifications();
                  }
                } catch (error) {
                  console.error('Error marking all as read:', error);
                }
              }}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              وضع علامة مقروء على الكل
            </button>
          </div>
        )}
      </div>


    </>
  );
}
