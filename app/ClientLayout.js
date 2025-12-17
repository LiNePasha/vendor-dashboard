"use client";
import { useEffect } from "react";
import Link from "next/link";
import NotificationBell from "../components/NotificationBell";
import NotificationCenter from "../components/NotificationCenter";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import NetworkStatus from "@/components/NetworkStatus";
import usePOSStore from "@/app/stores/pos-store";
import { useRouter, usePathname } from "next/navigation";

export default function ClientLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const getVendorInfo = usePOSStore((s) => s.getVendorInfo);

  useEffect(() => {
    // Avoid fetching vendor info on the login page to prevent unnecessary 401s
    const isLogin = pathname === '/login';
    const isPrint = pathname?.includes('/print');
    if (!isLogin && !isPrint && !vendorInfo) {
      getVendorInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorInfo, pathname]);

  // إخفاء الـ navbar في صفحة اللوجين وصفحة الطباعة
  const isLoginPage = pathname === '/login';
  const isPrintPage = pathname?.includes('/print');
  const shouldHideLayout = isLoginPage || isPrintPage;
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
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
  
  // Handle sidebar quick actions
  const handleSidebarAction = (action) => {
    switch (action) {
      case 'new-order':
        router.push('/orders');
        break;
      case 'new-product':
        router.push('/products');
        break;
      default:
        break;
    }
  };

  return (
    <>
      {/* Network Status Indicator - Always visible */}
      <NetworkStatus />
      
      {!shouldHideLayout && (
        <>
          {/* Hamburger Menu Button - Mobile Only */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="fixed top-4 right-4 z-50 md:hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
            aria-label="فتح القائمة"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Sidebar Navigation */}
          <Sidebar 
            onAction={handleSidebarAction} 
            isCollapsed={isCollapsed}
            onToggleCollapse={setIsCollapsed}
            isMobileOpen={isMobileSidebarOpen}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
          />
          
          {/* Top Bar */}
          <div 
            className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md shadow-sm z-30 print:hidden transition-all duration-300"
            style={{ marginRight: !shouldHideLayout ? (isCollapsed ? '80px' : '288px') : '0' }}
          >
            <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <div className="md:flex items-center gap-4 hidden">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 truncate">
                  {vendorInfo?.name || 'لوحة التحكم'}
                </h2>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <NotificationBell 
                  onToggleSidebar={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
                  onOpenSidebar={() => setIsNotificationCenterOpen(true)}
                  onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
                  soundEnabled={soundEnabled}
                />
              </div>
            </div>
          </div>

          {/* Notification Center - الجديدة فقط */}
          <NotificationCenter 
            isOpen={isNotificationCenterOpen}
            onClose={() => setIsNotificationCenterOpen(false)}
          />
        </>
      )}
      <main 
        className={`print:p-0 transition-all duration-300 ${!shouldHideLayout ? (isCollapsed ? 'md:mr-20' : 'md:mr-72') : ''}`} 
        style={{ 
          marginTop: shouldHideLayout ? '0' : '72px',
          padding: shouldHideLayout ? '0' : '0'
        }}
      >
        {children}
      </main>
    </>
  );
}
