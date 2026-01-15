"use client";

import { useEffect, useState } from 'react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // تحديث الحالة الأولية
    setIsOnline(navigator.onLine);

    // استماع لتغييرات الاتصال
    const handleOnline = () => {
      setIsOnline(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* مؤشر دائم في الـ Top Bar */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-[99999] animate-pulse">
          <span className="text-sm font-semibold">⚠️ لا يوجد اتصال بالإنترنت - تعمل في الوضع Offline</span>
        </div>
      )}

      {/* Toast للتنبيه عند التغيير */}
      {showToast && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded-xl text-white z-[100000] shadow-2xl ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          } transition-all duration-300`}
        >
          <div className="flex items-center gap-3">
            {isOnline ? (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">✅ تم استعادة الاتصال بالإنترنت</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="font-semibold">⚠️ انقطع الاتصال بالإنترنت</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
