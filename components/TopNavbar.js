"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVendorStoreLink, getVendorLogo } from "@/app/lib/vendor-constants";
import usePOSStore from "@/app/stores/pos-store";
import Image from "next/image";
import { filterMenuItemsForRole, isCashierMode, toggleCashierMode } from "@/app/lib/roles-permissions";

const menuItems = [
  {
    title: "الرئيسية",
    icon: "🏠",
    href: "/",
    color: "from-blue-500 to-blue-600"
  },
  {
    title: "الكاشير",
    icon: "🛒",
    href: "/pos",
    color: "from-green-500 to-green-600"
  },
  {
    title: "الفواتير",
    icon: "📄",
    href: "/pos/invoices",
    color: "from-purple-500 to-purple-600"
  },
  {
    title: "الطلبات",
    icon: "📦",
    href: "/orders",
    color: "from-orange-500 to-orange-600"
  },
  {
    title: "المنتجات",
    icon: "🛍️",
    href: "/products",
    color: "from-pink-500 to-pink-600"
  },
  {
    title: "المخزن",
    icon: "📦",
    href: "/warehouse",
    color: "from-indigo-500 to-indigo-600"
  },
  {
    title: "العملاء",
    icon: "👥",
    href: "/customers",
    color: "from-teal-500 to-teal-600"
  },
  {
    title: "الموظفين",
    icon: "👔",
    href: "/employees",
    color: "from-cyan-500 to-cyan-600"
  },
  {
    title: "الموردين",
    icon: "🏢",
    href: "/suppliers",
    color: "from-amber-500 to-amber-600"
  },
  {
    title: "مدينون",
    icon: "💰",
    href: "/creditors",
    color: "from-yellow-500 to-yellow-600"
  },
  {
    title: "الخدمات",
    icon: "⚙️",
    href: "/services",
    color: "from-gray-500 to-gray-600"
  },
  {
    title: "Sheets",
    icon: "📊",
    href: "/sheet-data",
    color: "from-emerald-500 to-emerald-600"
  },
  {
    title: "التدقيق",
    icon: "📝",
    href: "/employees/audit",
    color: "from-rose-500 to-rose-600"
  },
];

export default function TopNavbar() {
  const pathname = usePathname();
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const storeUrl = getVendorStoreLink(vendorInfo?.id);
  const storeLogo = getVendorLogo(vendorInfo?.id);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
      setLogoClickCount(0);
    }
    
    setTimeout(() => setLogoClickCount(0), 2000);
  };
  
  // تبديل وضع الكاشير
  const handleToggleCashierMode = (e) => {
    const enabled = e.target.checked;
    const success = toggleCashierMode(enabled);
    
    if (!success) {
      e.target.checked = !enabled;
    }
  };
  
  // فلترة القائمة حسب الدور
  const filteredMenuItems = filterMenuItemsForRole(menuItems);

  return (
    <>
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md print:hidden border-b-2 border-gray-100">
        <div className="max-w-full">
          {/* Main Header Row */}
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-between h-16">
              
              {/* Right Side: Logo + Store Info */}
              <div className="flex items-center gap-3 min-w-[180px] lg:min-w-[220px]">
                <div 
                  onClick={handleLogoClick}
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    {storeLogo ? (
                      <Image src={storeLogo} alt="Logo" width={48} height={48} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <span className="text-2xl">{storeUrl ? '🏪' : '⚡'}</span>
                    )}
                  </div>
                  <div className="hidden md:block">
                    {storeUrl ? (
                      <a
                        href={storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-blue-600 transition-colors"
                      >
                        <h1 className="font-bold text-gray-800 text-base leading-tight">
                          {vendorInfo?.name || 'متجرك'}
                        </h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <span>المتجر</span>
                          <span className="text-[10px]">↗️</span>
                        </p>
                      </a>
                    ) : (
                      <>
                        <h1 className="font-bold text-gray-800">Spare2App</h1>
                        <p className="text-xs text-gray-500">لوحة التحكم</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Center: Navigation Links (Desktop Only) */}
              <div className="hidden lg:flex items-center gap-2 flex-1 justify-center max-w-5xl">
                {filteredMenuItems.slice(0, 6).map((item) => {
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all group min-w-[80px] ${
                        isActive
                          ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                          : "text-gray-600 hover:bg-gray-50 hover:scale-105"
                      }`}
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      <span className="text-xs font-bold whitespace-nowrap">{item.title}</span>
                    </Link>
                  );
                })}
                
                {/* More Menu Dropdown */}
                {filteredMenuItems.length > 6 && (
                  <div className="relative group">
                    <button className="flex flex-col items-center justify-center px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-50 hover:scale-105 transition-all min-w-[80px]">
                      <span className="text-2xl mb-1">⋯</span>
                      <span className="text-xs font-bold">المزيد</span>
                    </button>
                    
                    {/* Dropdown */}
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <div className="p-2 max-h-[400px] overflow-y-auto">
                        {filteredMenuItems.slice(6).map((item) => {
                          const isActive = pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1 ${
                                isActive
                                  ? `bg-gradient-to-r ${item.color} text-white`
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <span className="text-xl">{item.icon}</span>
                              <span className="text-sm font-medium">{item.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Left Side: Mobile Menu Button (Mobile Only) */}
              <div className="flex items-center min-w-[50px] lg:min-w-[220px] lg:justify-end">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden w-11 h-11 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-all text-gray-700"
                >
                  {isMobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Secret Mode - Cashier Toggle */}
          {showSecretMode && (
            <div className="px-4 lg:px-6 pb-3 animate-fadeIn">
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="cashierMode"
                  checked={cashierMode}
                  onChange={handleToggleCashierMode}
                  className="w-5 h-5 accent-yellow-500 cursor-pointer"
                />
                <label htmlFor="cashierMode" className="text-sm text-yellow-800 cursor-pointer select-none flex-1 font-medium">
                  {cashierMode ? '🔓 وضع الكاشير مفعّل' : '🔒 تفعيل وضع الكاشير'}
                </label>
                <button
                  onClick={() => setShowSecretMode(false)}
                  className="text-yellow-600 hover:text-yellow-800 text-lg font-bold px-2"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
          />
          
          {/* Menu Content */}
          <div className="fixed top-16 left-0 right-0 bottom-0 z-50 bg-white lg:hidden overflow-y-auto animate-slideDown">
            <div className="p-4">
              {/* Search Bar */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 ابحث عن صفحة..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
              
              {/* Menu Items Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {filteredMenuItems.map((item) => {
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => !isPOS && setIsMobileMenuOpen(false)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                        isActive
                          ? `bg-gradient-to-br ${item.color} text-white shadow-lg`
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <span className="font-bold text-sm text-center">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
              
              {/* Mobile Logout */}
              <button
                onClick={async () => {
                  try {
                    await fetch("/api/logout", { method: "POST" });
                    localStorage.clear();
                    window.location.href = "/login";
                  } catch (error) {
                    console.error('Logout error:', error);
                    window.location.href = "/login";
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all font-bold shadow-lg"
              >
                <span className="text-xl">🚪</span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
