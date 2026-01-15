"use client";
import { useEffect } from "react";
import Link from "next/link";
import NotificationBell from "../components/NotificationBell";
import NotificationCenter from "../components/NotificationCenter";
import { useState } from "react";
import TopNavbar from "@/components/TopNavbar";
import NetworkStatus from "@/components/NetworkStatus";
import usePOSStore from "@/app/stores/pos-store";
import { useRouter, usePathname } from "next/navigation";
import { requestPersistentStorage, setupAutoBackup } from "@/app/lib/data-persistence";

export default function ClientLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const getVendorInfo = usePOSStore((s) => s.getVendorInfo);

  // 🆕 Initialize data persistence on app load
  useEffect(() => {
    const initDataPersistence = async () => {
      try {
        // Request persistent storage to prevent browser from deleting data
        const result = await requestPersistentStorage();
        console.log('💾 Persistent storage:', result.granted ? 'Granted ✅' : `Not granted (${result.reason}) ⚠️`);
        
        // Setup auto-backup system (runs every 7 days)
        setupAutoBackup();
        console.log('🔄 Auto-backup system initialized ✅');
      } catch (error) {
        console.error('❌ Error initializing data persistence:', error);
      }
    };
    
    initDataPersistence();
  }, []); // Run once on mount

  useEffect(() => {
    // Avoid fetching vendor info on the login page to prevent unnecessary 401s
    const isLogin = pathname === '/login';
    const isPrint = pathname?.includes('/print');
    if (!isLogin && !isPrint && !vendorInfo) {
      getVendorInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorInfo, pathname]);

  // إخفاء الـ navbar في صفحة اللوجين وصفحة الطباعة وصفحة الكاشير
  const isLoginPage = pathname === '/login';
  const isPrintPage = pathname?.includes('/print');
  const isPOSPage = pathname === '/pos';
  const shouldHideLayout = isLoginPage || isPrintPage || isPOSPage;
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Debug: log pathname to check
  useEffect(() => {
    console.log('Current pathname:', pathname);
    console.log('isPOSPage:', isPOSPage);
    console.log('shouldHideLayout:', shouldHideLayout);
  }, [pathname, isPOSPage, shouldHideLayout]);
  
  // Load sound preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notificationSoundEnabled');
    if (saved !== null) {
      setSoundEnabled(saved === 'true');
    }
  }, []);
  
  // Keyboard shortcut: Ctrl+N to toggle NotificationCenter
  useEffect(() => {
    if (shouldHideLayout) return;
    
    const handleKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsNotificationCenterOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [shouldHideLayout]);

  return (
    <>
      {/* Network Status Indicator - Always visible */}
      <NetworkStatus />
      
      {!shouldHideLayout && (
        <>
          {/* Top Navbar */}
          <TopNavbar />
          
          {/* Top Left Corner: Notification Bell + Logout - Desktop Only */}
          <div className="hidden md:flex fixed top-3 left-3 z-[60] print:hidden items-center gap-2">
            <NotificationBell 
              onToggleSidebar={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
              onOpenSidebar={() => setIsNotificationCenterOpen(true)}
              onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
              soundEnabled={soundEnabled}
            />
            
            {/* Logout Button */}
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
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-all font-semibold text-xs shadow-lg hover:shadow-xl"
              title="تسجيل الخروج"
            >
              <span className="text-sm">🚪</span>
              <span>خروج</span>
            </button>
          </div>

          {/* Notification Center */}
          <NotificationCenter 
            isOpen={isNotificationCenterOpen}
            onClose={() => setIsNotificationCenterOpen(false)}
          />
        </>
      )}
      <main 
        className="print:p-0" 
        style={{ 
          marginTop: shouldHideLayout ? '0' : '64px',
          padding: shouldHideLayout ? '0' : '0'
        }}
      >
        {children}
      </main>
    </>
  );
}
