"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVendorStoreLink } from "@/app/lib/vendor-constants";
import usePOSStore from "@/app/stores/pos-store";

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
    title: "الخدمات",
    icon: "⚙️",
    href: "/services",
    badge: null,
  },
  {
    title: "نقاط البيع",
    icon: "🧾",
    href: "/pos",
    badge: null,
  },
  {
    title: "الفواتير",
    icon: "📄",
    href: "/pos/invoices",
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

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 z-40 shadow-2xl print:hidden ${
        isCollapsed ? "w-20" : "w-72"
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">{storeUrl ? '🏪' : '⚡'}</span>
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
          <button
            onClick={() => onToggleCollapse?.(!isCollapsed)}
            className="w-8 h-8 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg flex items-center justify-center transition-all"
          >
            <span className="text-sm">{isCollapsed ? "→" : "←"}</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
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
