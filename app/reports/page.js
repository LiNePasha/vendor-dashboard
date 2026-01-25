"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PERIOD_OPTIONS = [
  { value: "today", label: "اليوم" },
  { value: "yesterday", label: "أمس" },
  { value: "week", label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذا العام" },
  { value: "custom", label: "فترة مخصصة" },
];

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      
      if (period === "custom" && customDates.start && customDates.end) {
        url += `&start_date=${customDates.start}&end_date=${customDates.end}`;
      }

      const [analyticsRes, chartRes] = await Promise.all([
        fetch(url),
        fetch(`/api/analytics/sales-chart?period=${period}${
          period === "custom" && customDates.start && customDates.end
            ? `&start_date=${customDates.start}&end_date=${customDates.end}`
            : ""
        }`),
      ]);

      const analyticsData = await analyticsRes.json();
      const chartData = await chartRes.json();

      setAnalytics(analyticsData);
      setChartData(chartData);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDateApply = () => {
    if (customDates.start && customDates.end) {
      loadAnalytics();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("ar-EG").format(num);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل التقارير...</p>
        </div>
      </div>
    );
  }

  if (!analytics?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">فشل تحميل التقارير</p>
          <button
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const { summary, orders_by_status, payment_methods, top_products, daily_sales } = analytics;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">📊 التقارير والإحصائيات</h1>
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              ← رجوع
            </button>
          </div>

          {/* Period Selector */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-700">الفترة:</label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {period === "custom" && (
              <div className="flex items-center gap-2 mt-2 w-full">
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) =>
                    setCustomDates({ ...customDates, start: e.target.value })
                  }
                  className="px-3 py-2 border rounded-lg"
                />
                <span className="text-gray-500">إلى</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) =>
                    setCustomDates({ ...customDates, end: e.target.value })
                  }
                  className="px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={handleCustomDateApply}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  تطبيق
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">إجمالي المبيعات</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.total_revenue)}
                </p>
                {summary.revenue_growth !== 0 && (
                  <p
                    className={`text-xs mt-1 ${
                      summary.revenue_growth > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {summary.revenue_growth > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(summary.revenue_growth).toFixed(1)}% عن الفترة السابقة
                  </p>
                )}
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">عدد الطلبات</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(summary.total_orders)}
                </p>
                {summary.orders_growth !== 0 && (
                  <p
                    className={`text-xs mt-1 ${
                      summary.orders_growth > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {summary.orders_growth > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(summary.orders_growth).toFixed(1)}% عن الفترة السابقة
                  </p>
                )}
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">متوسط قيمة الطلب</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.avg_order_value)}
                </p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          {/* Total Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">المنتجات المباعة</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(summary.total_items_sold)}
                </p>
              </div>
              <div className="text-4xl">🛍️</div>
            </div>
          </div>
        </div>

        {/* Sales Chart */}
        {chartData?.data?.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📈 المبيعات اليومية</h2>
            <div className="overflow-x-auto">
              <div className="min-w-full" style={{ minHeight: "300px" }}>
                <SalesChart data={chartData.data} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Orders by Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📊 الطلبات حسب الحالة</h2>
            {Object.keys(orders_by_status).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(orders_by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{getStatusLabel(status)}</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatNumber(count)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد طلبات</p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💳 طرق الدفع</h2>
            {Object.keys(payment_methods).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(payment_methods).map(([method, data]) => (
                  <div key={method} className="border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{method}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatNumber(data.count)} طلب
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(data.total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>

        {/* Top Products */}
        {top_products?.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🏆 أفضل المنتجات مبيعاً</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      المنتج
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الكمية المباعة
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      الإيرادات
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      عدد الطلبات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {top_products.map((product, index) => (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-xl mr-2">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ""}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {product.name}
                            </p>
                            {product.sku && (
                              <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatNumber(product.quantity)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatNumber(product.orders)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Bar Chart Component (using CSS)
function SalesChart({ data }) {
  if (!data || data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <div className="space-y-2">
      {data.map((day) => {
        const percentage = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
        return (
          <div key={day.date} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 text-right">
              {new Date(day.date).toLocaleDateString("ar-EG", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
              <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-700">
                {day.revenue > 0 && `${day.revenue.toLocaleString("ar-EG")} ج.م`}
              </span>
            </div>
            <span className="text-xs text-gray-500 w-16 text-left">
              {day.orders} طلب
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Helper function for status labels
function getStatusLabel(status) {
  const labels = {
    pending: "ترك الدفع",
    "on-hold": "معلق",
    processing: "قيد التجهيز",
    completed: "مكتمل",
    cancelled: "ملغى",
    refunded: "مسترجع",
    failed: "فشل",
  };
  return labels[status] || status;
}
