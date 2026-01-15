"use client";

import usePOSStore from '@/app/stores/pos-store';
import localforage from 'localforage';

export default function LogoutButton() {
  const clearAll = usePOSStore((state) => state.clearAll);

  async function handleLogout() {
    try {
      // Clear POS store data
      await clearAll();
      
      // Call logout API
      await fetch("/api/logout", { method: "POST" });
      
      // Clear all localStorage (including Zustand persist)
      localStorage.clear();
      
      // ✅ امسح بس البيانات المؤقتة (العربة + cache المنتجات فقط)
      // ❌ لا تمسح: suppliers, creditors, warehouse-products, savedServices, wholesale-prices
      // ❌ لا تمسح: employees, attendance, payroll, advances, leaves, deductions, invoices
      try {
        await localforage.removeItem('current-cart');      // العربة المؤقتة
        await localforage.removeItem('products-cache');    // cache المنتجات (هيترفرش)
        
        // ✅ Keep all persistent data:
        // - suppliers, creditors, warehouse-products (warehouse-storage.js)
        // - savedServices (services/page.js)
        // - wholesale-prices (أسعار الجملة - localforage.js)
        // - employees, attendance, payroll, advances, leaves, deductions (employees-storage.js)
        // - invoices (localforage.js)
      } catch (e) {
        console.error('Error clearing temporary data:', e);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always redirect to login
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="text-red-600 font-bold hover:underline"
    >
      تسجيل الخروج
    </button>
  );
}
