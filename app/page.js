"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import usePOSStore from "./stores/pos-store";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const PERIOD_OPTIONS = [
  { value: "today", label: "اليوم" },
  { value: "yesterday", label: "أمس" },
  { value: "week", label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذا العام" },
  { value: "custom", label: "فترة مخصصة" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { vendorInfo, getVendorInfo } = usePOSStore();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (!vendorInfo) {
      getVendorInfo();
    }
  }, [vendorInfo, getVendorInfo]);

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

  const { summary, orders_by_status, payment_methods, top_products } = analytics;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl mb-6 mx-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">مرحباً بك 👋</h1>
            <p className="text-blue-100 text-lg">
              {vendorInfo?.name || 'متجر Spare2App'}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3">
              <p className="text-sm text-blue-100">اليوم</p>
              <p className="text-2xl font-bold">
                {new Date().toLocaleDateString('ar-EG', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-md mx-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⚡</span> إجراءات سريعة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button
            onClick={() => router.push('/products')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <div className="text-4xl mb-2">📦</div>
            <p className="font-medium text-sm">المنتجات</p>
          </button>
          <button
            onClick={() => router.push('/pos')}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <div className="text-4xl mb-2">🛒</div>
            <p className="font-medium text-sm">الكاشير</p>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <div className="text-4xl mb-2">📦</div>
            <p className="font-medium text-sm">الطلبات</p>
          </button>
          <button
            onClick={() => router.push('/pos/invoices')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <div className="text-4xl mb-2">📄</div>
            <p className="font-medium text-sm">إدارة الفواتير</p>
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <div className="text-4xl mb-2">⚙️</div>
            <p className="font-medium text-sm">الإعدادات</p>
          </button>
        </div>
      </div>

      {/* Analytics Header with Period Selector */}
      <div className="bg-white rounded-xl shadow-sm mb-6 mx-4">
        <div className="px-4 sm:px-6 py-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>التقارير والإحصائيات</span>
          </h2>

          {/* Period Selector - Mobile Optimized */}
          <div className="space-y-3">
            {/* Mobile: Dropdown */}
            <div className="block sm:hidden">
              <label className="block text-sm font-medium text-gray-700 mb-2">اختر الفترة:</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop/Tablet: Buttons */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-gray-700">الفترة:</label>
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      period === opt.value
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {period === "custom" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) =>
                    setCustomDates({ ...customDates, start: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500 text-center sm:text-right">إلى</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) =>
                    setCustomDates({ ...customDates, end: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCustomDateApply}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md"
                >
                  تطبيق
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {/* Total Revenue */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl sm:text-4xl">💰</div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">إجمالي المبيعات</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
                {formatCurrency(summary.total_revenue)}
              </p>
              {summary.revenue_growth !== 0 && (
                <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  summary.revenue_growth > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}>
                  <span>{summary.revenue_growth > 0 ? "↑" : "↓"}</span>
                  <span>{Math.abs(summary.revenue_growth).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl sm:text-4xl">📦</div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">عدد الطلبات</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
                {formatNumber(summary.total_orders)}
              </p>
              {summary.orders_growth !== 0 && (
                <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  summary.orders_growth > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}>
                  <span>{summary.orders_growth > 0 ? "↑" : "↓"}</span>
                  <span>{Math.abs(summary.orders_growth).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl sm:text-4xl">📊</div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">متوسط قيمة الطلب</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {formatCurrency(summary.avg_order_value)}
              </p>
            </div>
          </div>

          {/* Total Items */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl sm:text-4xl">🛍️</div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">المنتجات المباعة</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {formatNumber(summary.total_items_sold)}
              </p>
            </div>
          </div>
        </div>

        {/* Sales Chart */}
        {chartData?.data?.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-2xl shadow-lg overflow-hidden">
            {/* Chart Header with Gradient */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 sm:p-6">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                    <span className="text-2xl">📈</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">المبيعات اليومية</h2>
                    <p className="text-xs sm:text-sm text-blue-100">
                      {chartData.data.length} يوم - {formatCurrency(chartData.data.reduce((sum, d) => sum + d.revenue, 0))} إجمالي
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-xs text-blue-100">إجمالي الطلبات</p>
                  <p className="text-xl font-bold">{chartData.data.reduce((sum, d) => sum + d.orders, 0)}</p>
                </div>
              </div>
            </div>
            
            {/* Chart Body */}
            <div className="p-4 sm:p-6">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-full px-4 sm:px-0" style={{ minHeight: "300px" }}>
                  <SalesChart data={chartData.data} />
                </div>
              </div>
              
              {/* Chart Legend - Mobile Only */}
              <div className="block sm:hidden mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
                    <span>الإيرادات</span>
                  </div>
                  <div className="font-semibold">
                    {chartData.data.reduce((sum, d) => sum + d.orders, 0)} طلب
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Orders by Status */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📊</span>
              <span>الطلبات حسب الحالة</span>
            </h2>
            {Object.keys(orders_by_status).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(orders_by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{getStatusLabel(status)}</span>
                    <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-full shadow-sm">
                      {formatNumber(count)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500">لا توجد طلبات</p>
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>💳</span>
              <span>طرق الدفع</span>
            </h2>
            {Object.keys(payment_methods).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(payment_methods).map(([method, data]) => (
                  <div key={method} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{method}</span>
                      <span className="text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-full shadow-sm">
                        {formatNumber(data.count)} طلب
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">
                      {formatCurrency(data.total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">💳</div>
                <p className="text-gray-500">لا توجد بيانات</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        {top_products?.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🏆</span>
              <span>أفضل المنتجات مبيعاً</span>
            </h2>
            
            {/* Mobile: Cards View */}
            <div className="block lg:hidden space-y-3">
              {top_products.map((product, index) => (
                <div key={product.product_id} className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        {product.name}
                      </p>
                      {product.sku && (
                        <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600 font-medium mb-1">الكمية</p>
                      <p className="text-sm font-bold text-gray-900">{formatNumber(product.quantity)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-xs text-green-600 font-medium mb-1">الإيرادات</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(product.revenue)}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-xs text-purple-600 font-medium mb-1">الطلبات</p>
                      <p className="text-sm font-bold text-gray-900">{formatNumber(product.orders)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden lg:block overflow-x-auto">
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

// Professional Chart Component using Recharts - Mobile Optimized
function SalesChart({ data }) {
  if (!data || data.length === 0) return null;

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Format data for Recharts
  const chartData = data.map((day, index) => ({
    date: new Date(day.date).toLocaleDateString("ar-EG", {
      day: "numeric",
      month: isMobile ? "numeric" : "short",
    }),
    shortDate: new Date(day.date).toLocaleDateString("ar-EG", {
      day: "numeric",
    }),
    fullDate: day.date,
    revenue: day.revenue,
    orders: day.orders,
    items: day.items,
  }));

  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length;

  // Custom Tooltip - Mobile Optimized
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-2 sm:p-3 rounded-lg shadow-2xl border border-gray-700 max-w-[200px]">
          <p className="font-bold text-xs sm:text-sm mb-1 text-blue-300">{data.date}</p>
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-300">💰</span>
              <span className="font-bold text-green-400 text-xs">{formatCurrency(data.revenue)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-300">📦 {data.orders}</span>
              <span className="text-gray-300">🛍️ {data.items}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Legend - Compact for Mobile */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
            <span className="text-gray-600">الإيرادات</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">الطلبات</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 hidden sm:block">
          متوسط: {formatCurrency(avgRevenue)}
        </div>
      </div>

      {/* Area Chart - Responsive Height */}
      <div className="w-full overflow-x-auto" style={{ height: isMobile ? '280px' : '350px' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={isMobile ? 300 : undefined}>
          <AreaChart
            data={chartData}
            margin={{ 
              top: 10, 
              right: isMobile ? 5 : 10, 
              left: isMobile ? -25 : 0, 
              bottom: isMobile ? 5 : 5 
            }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis
              dataKey={isMobile ? "shortDate" : "date"}
              stroke="#6b7280"
              style={{ fontSize: isMobile ? '8px' : '11px', fontWeight: 400 }}
              tick={{ fill: '#6b7280' }}
              interval={isMobile ? Math.floor(chartData.length / 6) : 0}
              angle={0}
              textAnchor="middle"
              height={30}
              tickMargin={8}
            />
            <YAxis
              yAxisId="revenue"
              stroke="#3b82f6"
              style={{ fontSize: isMobile ? '8px' : '11px', fontWeight: 400 }}
              tick={{ fill: '#6b7280' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={isMobile ? 30 : 50}
              tickMargin={5}
            />
            <YAxis
              yAxisId="orders"
              orientation="left"
              stroke="#10b981"
              style={{ fontSize: isMobile ? '8px' : '11px', fontWeight: 400 }}
              tick={{ fill: '#6b7280' }}
              width={isMobile ? 25 : 40}
              hide={isMobile}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }} 
            />
            
            {/* Revenue Area */}
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={isMobile ? 2 : 3}
              fill="url(#colorRevenue)"
              animationDuration={1000}
              dot={isMobile ? false : { r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: isMobile ? 4 : 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
            />
            
            {/* Orders Area (smaller) */}
            <Area
              yAxisId={isMobile ? "revenue" : "orders"}
              type="monotone"
              dataKey="orders"
              stroke="#10b981"
              strokeWidth={isMobile ? 1.5 : 2}
              fill="url(#colorOrders)"
              animationDuration={1200}
              dot={false}
              activeDot={{ r: isMobile ? 3 : 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Summary Below Chart - Compact Mobile */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200">
        <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600 mb-1">أعلى</p>
          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{formatCurrency(maxRevenue)}</p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-600 mb-1">الطلبات</p>
          <p className="text-xs sm:text-sm font-bold text-gray-900">
            {data.reduce((sum, d) => sum + d.orders, 0)}
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-600 mb-1">المنتجات</p>
          <p className="text-xs sm:text-sm font-bold text-gray-900">
            {data.reduce((sum, d) => sum + d.items, 0)}
          </p>
        </div>
      </div>
      
      {/* Mobile Average - Show below stats */}
      <div className="block sm:hidden text-center">
        <span className="text-xs text-gray-500">متوسط: {formatCurrency(avgRevenue)}</span>
      </div>
    </div>
  );
}

// Format currency helper
function formatCurrency(amount) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
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
