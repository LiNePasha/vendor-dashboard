"use client";
import { useRouter } from "next/navigation";
import usePOSStore from "./stores/pos-store";
import { getVendorLogo } from "./lib/vendor-constants";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();

  const { vendorInfo, getVendorInfo } = usePOSStore();
  
    useEffect(() => {
      if (!vendorInfo) {
        // Get vendor info from Zustand (cached) if not already loaded
        getVendorInfo();
      }
    }, [vendorInfo, getVendorInfo]);

    // Use STATIC logo based on vendor ID (not from API)
    const logoSrc = getVendorLogo(vendorInfo?.id);

  return (
    <>
      <div className="flex flex-col items-center justify-center mb-6">
        <img
          src={logoSrc}
          alt={vendorInfo?.name || "Logo"}
          className="w-24 object-cover mb-2 bg-white border-2 border-gray-200 rounded-lg p-2"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/icons/placeholder.webp";
          }}
        />
        <p className="text-center text-white">سيستم: {vendorInfo?.name || "اسم المتجر"} ({vendorInfo?.id})</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
        {/* Orders Card */}
        <div
          className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => router.push("/orders")}
        >
          <h2 className="text-lg font-semibold mb-2">📦 الطلبات</h2>
          <p className="text-gray-600 mb-4">تصفح وأدر الطلبات</p>
          <span className="text-blue-600 font-medium hover:underline">
            عرض الطلبات →
          </span>
        </div>

        {/* Products Card */}
        <div
          className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => router.push("/products")}
        >
          <h2 className="text-lg font-semibold mb-2">🛍️ المنتجات</h2>
          <p className="text-gray-600 mb-4">أضف، عدّل أو احذف المنتجات</p>
          <span className="text-blue-600 font-medium hover:underline">
            إدارة المنتجات →
          </span>
        </div>

        {/* POS Card */}
        <div
          className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => router.push("/pos")}
        >
          <h2 className="text-lg font-semibold mb-2">🛍️ الكاشير</h2>
          <p className="text-gray-600 mb-4">أضف، عدّل أو احذف فواتير</p>
          <span className="text-blue-600 font-medium hover:underline">
            برنامج الكاشير →
          </span>
        </div>

        {/* Products Card */}
        <div
          className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => router.push("/pos/invoices")}
        >
          <h2 className="text-lg font-semibold mb-2">🛍️ الفواتير</h2>
          <p className="text-gray-600 mb-4">أضف، عدّل أو احذف الفواتير</p>
          <span className="text-blue-600 font-medium hover:underline">
            إدارة الفواتير →
          </span>
        </div>
      </div>
    </>
  );
}
