"use client";
import { useEffect } from "react";
import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import NotificationBell from "../components/NotificationBell";
import { useState } from "react";
import NotificationSidebar from "@/components/NotificationSidebar";
import Sidebar from "@/components/Sidebar";
import usePOSStore from "@/app/stores/pos-store";
import { useRouter } from "next/navigation";

export default function ClientLayout({ children }) {
  const router = useRouter();
  const vendorInfo = usePOSStore((s) => s.vendorInfo);
  const getVendorInfo = usePOSStore((s) => s.getVendorInfo);

  useEffect(() => {
    // Avoid fetching vendor info on the login page to prevent unnecessary 401s
    const isLogin = typeof window !== 'undefined' && window.location.pathname === '/login';
    if (!isLogin && !vendorInfo) {
      getVendorInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorInfo]);

  // إخفاء الـ navbar في صفحة اللوجين
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Load sound preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notificationSoundEnabled');
    if (saved !== null) {
      setSoundEnabled(saved === 'true');
    }
  }, []);
  
  // Keyboard shortcut: Ctrl+N to toggle notifications
  useEffect(() => {
    if (isLoginPage) return;
    
    const handleKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [isLoginPage]);
  
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
      {!isLoginPage && (
        <>
          {/* Sidebar Navigation */}
          <Sidebar 
            onAction={handleSidebarAction} 
            isCollapsed={isCollapsed}
            onToggleCollapse={setIsCollapsed}
          />
          
          {/* Top Bar */}
          <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md shadow-sm z-30 print:hidden" style={{ marginRight: isCollapsed ? '80px' : '288px' }}>
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  {vendorInfo?.name || 'لوحة التحكم'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell 
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  onOpenSidebar={() => setIsSidebarOpen(true)}
                  soundEnabled={soundEnabled}
                />
                <LogoutButton />
              </div>
            </div>
          </div>

          {/* Notification Sidebar */}
          <NotificationSidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            soundEnabled={soundEnabled}
            onSoundToggle={(enabled) => {
              setSoundEnabled(enabled);
              localStorage.setItem('notificationSoundEnabled', enabled.toString());
            }}
          />
        </>
      )}
      <main className="print:p-0" style={{ marginRight: isLoginPage ? '0' : (isCollapsed ? '80px' : '288px'), marginTop: isLoginPage ? '0' : '80px', padding: isLoginPage ? '0' : '0' }}>
        {children}
      </main>
    </>
  );
}
