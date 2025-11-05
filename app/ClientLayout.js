"use client";
import { useEffect } from "react";
import Link from "next/link";
import LogoutButton from "../components/LogoutButton";
import usePOSStore from "@/app/stores/pos-store";

export default function ClientLayout({ children }) {
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

  return (
    <>
      <nav className="p-4 flex justify-between bg-white shadow print:hidden">
        <Link href="/" className="font-bold text-xl">
          لوحة التحكم
        </Link>
        <LogoutButton />
      </nav>
      <main className="flex-1 p-4 print:p-0">{children}</main>
    </>
  );
}
