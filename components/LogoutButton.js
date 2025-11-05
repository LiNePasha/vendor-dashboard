"use client";

import usePOSStore from '@/app/stores/pos-store';

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
      
      // Clear all IndexedDB stores (localforage - cart, invoices, wholesale prices)
      if (window.indexedDB) {
        try {
          const databases = await window.indexedDB.databases();
          databases.forEach(db => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        } catch (e) {
          // Silently handle error
        }
      }
    } catch (error) {
      // Silently handle error
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
