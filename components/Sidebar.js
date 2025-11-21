"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVendorStoreLink,getVendorLogo } from "@/app/lib/vendor-constants";
import usePOSStore from "@/app/stores/pos-store";
import Image from "next/image";
import { filterMenuItemsForRole, isCashierMode, toggleCashierMode } from "@/app/lib/roles-permissions";

const menuItems = [
  {
    title: "الرئيسية",
    icon: "🏠",
    href: "/",
    badge: null,
  },
  {
    title: "الطلبات",
    icon: "📦",
    href: "/orders",
    badge: "new",
  },
  {
    title: "المنتجات",
    icon: "🛍️",
    href: "/products",
    badge: null,
  },
  {
    title: "المخزن",
    icon: "📦",
    href: "/warehouse",
    badge: null,
  },
  {
    title: "الموردين",
    icon: "🏢",
    href: "/suppliers",
    badge: null,
  },
  {
    title: "مدينون",
    icon: "💰",
    href: "/creditors",
    badge: null,
  },
  {
    title: "الخدمات",
    icon: "⚙️",
    href: "/services",
    badge: null,
  },
  {
    title: "الكاشير",
    icon: "🛒",
    href: "/pos",
    badge: null,
  },
  {
    title: "الفواتير",
    icon: "📄",
    href: "/pos/invoices",
    badge: null,
  },
  {
    title: "الموظفين",
    icon: "👥",
    href: "/employees",
    badge: null,
  },
  {
    title: "سجل التدقيق",
    icon: "📝",
    href: "/employees/audit",
    badge: null,
  },
];

const quickActions = [
  {
    title: "طلب جديد",
    icon: "➕",
    action: "new-order",
  },
  {
    title: "إضافة منتج",
    icon: "📦",
    action: "new-product",
  },
];

export default function Sidebar({ onAction, isCollapsed, onToggleCollapse }) {
  const pathname = usePathname();
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const storeUrl = getVendorStoreLink(vendorInfo?.id);
  const storeLogo = getVendorLogo(vendorInfo?.id);
  
  // Secret Mode State
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showSecretMode, setShowSecretMode] = useState(false);
  const [cashierMode, setCashierMode] = useState(false);
  
  // تحميل حالة الكاشير من localStorage
  useEffect(() => {
    setCashierMode(isCashierMode());
  }, []);
  
  // عداد الضغطات على اللوجو (3 مرات)
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    
    if (newCount === 3) {
      setShowSecretMode(true);
      setLogoClickCount(0); // إعادة تعيين العداد
    }
    
    // إعادة تعيين العداد بعد ثانيتين
    setTimeout(() => setLogoClickCount(0), 2000);
  };
  
  // تبديل وضع الكاشير
  const handleToggleCashierMode = (e) => {
    const enabled = e.target.checked;
    const success = toggleCashierMode(enabled);
    
    if (!success) {
      // لو فشل، نرجع الـ checkbox لوضعه الأصلي
      e.target.checked = !enabled;
    }
  };
  
  // فلترة القائمة حسب الدور
  const filteredMenuItems = filterMenuItemsForRole(menuItems);

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 z-40 shadow-2xl print:hidden flex flex-col ${
        isCollapsed ? "w-20" : "w-72"
      }`}
    >
      {/* Header - Fixed */}
      <div className="p-6 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3 flex-1">
              <div 
                onClick={handleLogoClick}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform"
                title="اضغط 3 مرات للوضع السري 🤫"
              >
                {storeLogo ? (
                  <Image src={storeLogo} alt="Logo" width={40} height={40} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <span className="text-xl">{storeUrl ? '🏪' : '⚡'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {storeUrl ? (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:text-blue-400 transition-colors group"
                  >
                    <h1 className="font-bold text-sm truncate group-hover:underline">
                      {vendorInfo?.name || 'متجرك'}
                    </h1>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <span>شاهد المتجر</span>
                      <span className="text-[10px]">↗️</span>
                    </p>
                  </a>
                ) : (
                  <>
                    <h1 className="font-bold text-lg">Spare2App</h1>
                    <p className="text-xs text-gray-400">لوحة التحكم</p>
                  </>
                )}
              </div>
            </div>
          )}
          {isCollapsed && (
            <div 
              onClick={handleLogoClick}
              className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform mx-auto"
              title="اضغط 3 مرات للوضع السري 🤫"
            >
              {storeLogo ? (
                <Image src={storeLogo} alt="Logo" width={40} height={40} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <span className="text-xl">{storeUrl ? '🏪' : '⚡'}</span>
              )}
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => onToggleCollapse?.(!isCollapsed)}
              className="w-8 h-8 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg flex items-center justify-center transition-all"
            >
              <span className="text-sm">→</span>
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => onToggleCollapse?.(!isCollapsed)}
              className="w-8 h-8 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg flex items-center justify-center transition-all absolute left-2 top-6"
            >
              <span className="text-sm">←</span>
            </button>
          )}
        </div>
        
        {/* Secret Mode - Cashier Toggle */}
        {showSecretMode && !isCollapsed && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg animate-pulse">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cashierMode"
                checked={cashierMode}
                onChange={handleToggleCashierMode}
                className="w-4 h-4 accent-yellow-500 cursor-pointer"
              />
              <label htmlFor="cashierMode" className="text-xs text-yellow-400 cursor-pointer select-none">
                {cashierMode ? '🔓 وضع الكاشير مفعّل' : '🔒 تفعيل وضع الكاشير'}
              </label>
              <button
                onClick={() => setShowSecretMode(false)}
                className="mr-auto text-gray-400 hover:text-white text-xs"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
        {filteredMenuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                isActive
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30"
                  : "hover:bg-gray-700/50"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              {!isCollapsed && (
                <>
                  <span className="flex-1 font-medium">{item.title}</span>
                  {item.badge === "new" && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                      جديد
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick Actions */}
      {/* {!isCollapsed && (
        <div className="px-4 py-4 border-t border-gray-700/50 mt-auto">
          <p className="text-xs text-gray-400 mb-3 px-2">إجراءات سريعة</p>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.action}
                onClick={() => onAction?.(action.action)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="font-medium text-sm">{action.title}</span>
              </button>
            ))}
          </div>
        </div>
      )} */}

      {/* Footer - User Info */}
      {/* <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center font-bold shadow-lg">
              V
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">Vendor</p>
              <p className="text-xs text-gray-400">مدير المتجر</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center font-bold shadow-lg">
              V
            </div>
          </div>
        )}
      </div> */}
    </aside>
  );
}
