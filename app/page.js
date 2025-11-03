"use client";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  return (
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
  );
}
