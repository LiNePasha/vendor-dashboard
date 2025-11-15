"use client";
import { useRouter } from "next/navigation";
import usePOSStore from "./stores/pos-store";
import { useEffect, useState } from "react";
import { invoiceStorage } from "./lib/localforage";

export default function DashboardPage() {
  const router = useRouter();
  const { vendorInfo, getVendorInfo } = usePOSStore();
  
  const [stats, setStats] = useState({
    totalOrders: 0,
    processingOrders: 0,
    totalRevenue: 0,
    productsCount: 0,
    recentOrders: [],
    // Invoices stats
    totalInvoices: 0,
    totalProfit: 0,
    productsProfit: 0,
    servicesRevenue: 0,
    extraFeesRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorInfo) {
      getVendorInfo();
    }
    fetchDashboardStats();
  }, [vendorInfo, getVendorInfo]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Fetch orders
      const ordersRes = await fetch('/api/orders?per_page=100', {
        credentials: 'include',
      });
      const ordersData = await ordersRes.json();
      const orders = ordersData.orders || ordersData || [];
      
      // Fetch products
      const productsRes = await fetch('/api/products?per_page=1', {
        credentials: 'include',
      });
      const productsData = await productsRes.json();

      // Fetch invoices from localforage
      const invoices = await invoiceStorage.getAllInvoices();
      
      // Calculate invoices profit (same logic as invoices page)
      const totalProfit = invoices.reduce((sum, inv) => {
        if (inv.summary?.totalProfit !== undefined && inv.summary?.totalProfit !== null) {
          return sum + inv.summary.totalProfit;
        }
        const oldProfit = (inv.summary?.productsProfit || 0);
        const services = (inv.summary?.servicesTotal || 0);
        const extraFee = (inv.summary?.extraFee || 0);
        return sum + oldProfit + services + extraFee;
      }, 0);

      const productsProfit = invoices.reduce((sum, inv) => 
        sum + (inv.summary?.finalProductsProfit || inv.summary?.productsProfit || 0), 0
      );
      
      const servicesRevenue = invoices.reduce((sum, inv) => 
        sum + (inv.summary?.servicesTotal || 0), 0
      );
      
      const extraFeesRevenue = invoices.reduce((sum, inv) => 
        sum + (inv.summary?.extraFee || 0), 0
      );
      
      // Calculate stats
      const processingOrders = orders.filter(o => o.status === 'processing');
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
      const recentOrders = orders.slice(0, 5);
      
      setStats({
        totalOrders: orders.length,
        processingOrders: processingOrders.length,
        totalRevenue: totalRevenue,
        productsCount: productsData.total || 0,
        recentOrders: recentOrders,
        totalInvoices: invoices.length,
        totalProfit: totalProfit,
        productsProfit: productsProfit,
        servicesRevenue: servicesRevenue,
        extraFeesRevenue: extraFeesRevenue,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'إضافة منتج',
      icon: '📦',
      color: 'from-blue-500 to-blue-600',
      action: () => router.push('/products'),
    },
    {
      title: 'فواتير جديدة',
      icon: '🧾',
      color: 'from-green-500 to-green-600',
      action: () => router.push('/pos'),
    },
    {
      title: 'عرض الطلبات',
      icon: '📦',
      color: 'from-purple-500 to-purple-600',
      action: () => router.push('/orders'),
    },
    {
      title: 'إدارة الفواتير',
      icon: '📄',
      color: 'from-orange-500 to-orange-600',
      action: () => router.push('/pos/invoices'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">مرحباً بك 👋</h1>
            <p className="text-blue-100">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Orders */}
        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 rounded-lg p-3">
              <span className="text-3xl">📦</span>
            </div>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            ) : (
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-800">{stats.totalOrders}</p>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 font-medium">إجمالي الطلبات</h3>
          <button
            onClick={() => router.push('/orders')}
            className="text-blue-500 text-sm mt-2 hover:underline"
          >
            عرض الكل →
          </button>
        </div>

        {/* Processing Orders */}
        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all border-t-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 rounded-lg p-3">
              <span className="text-3xl">⏳</span>
            </div>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            ) : (
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-800">{stats.processingOrders}</p>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 font-medium">قيد التجهيز</h3>
          <button
            onClick={() => router.push('/orders')}
            className="text-yellow-600 text-sm mt-2 hover:underline"
          >
            معالجة الآن →
          </button>
        </div>

        {/* Total Revenue */}
        {/* <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all border-t-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 rounded-lg p-3">
              <span className="text-3xl">💰</span>
            </div>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
            ) : (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">
                  {stats.totalRevenue.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">جنيه</p>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 font-medium">إجمالي الإيرادات</h3>
          <p className="text-green-600 text-sm mt-2">من جميع الطلبات</p>
        </div> */}

        {/* Total Profit - Same as invoices page */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-6 text-white shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-pink-100 text-sm font-medium mb-1">💰 صافي الأرباح</p>
              {loading ? (
                <div className="animate-pulse bg-pink-400 bg-opacity-30 h-10 w-28 rounded"></div>
              ) : (
                <p className="text-3xl font-bold">{stats.totalProfit.toFixed(0)} ج.م</p>
              )}
            </div>
            <div className="bg-pink-400 bg-opacity-30 rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          {!loading && (
            <div className="space-y-1.5 pt-3 border-t border-pink-400 border-opacity-30 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-pink-100">📦 أرباح المنتجات</span>
                <span className="font-bold">{stats.productsProfit.toFixed(0)} ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pink-100">🔧 إيرادات الخدمات</span>
                <span className="font-bold">{stats.servicesRevenue.toFixed(0)} ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pink-100">➕ رسوم إضافية</span>
                <span className="font-bold">{stats.extraFeesRevenue.toFixed(0)} ج.م</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-pink-400 border-opacity-20">
                <span className="text-pink-100">من {stats.totalInvoices} فاتورة</span>
                <button
                  onClick={() => router.push('/pos/invoices')}
                  className="text-pink-100 hover:text-white text-xs underline"
                >
                  عرض التفاصيل →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>⚡</span> إجراءات سريعة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.action}
              className={`bg-gradient-to-r ${action.color} text-white rounded-xl p-4 hover:scale-105 transition-all shadow-md hover:shadow-lg`}
            >
              <div className="text-4xl mb-2">{action.icon}</div>
              <p className="font-medium text-sm">{action.title}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>🕒</span> آخر الطلبات
          </h2>
          <button
            onClick={() => router.push('/orders')}
            className="text-blue-500 text-sm hover:underline"
          >
            عرض الكل →
          </button>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="bg-gray-200 w-12 h-12 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="bg-gray-200 h-4 w-3/4 rounded"></div>
                  <div className="bg-gray-200 h-3 w-1/2 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : stats.recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-6xl mb-2">📦</div>
            <p>لا توجد طلبات حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentOrders.map((order) => {
              const statusColors = {
                'processing': 'bg-blue-100 text-blue-700',
                'completed': 'bg-green-100 text-green-700',
                'on-hold': 'bg-yellow-100 text-yellow-700',
                'cancelled': 'bg-gray-100 text-gray-700',
              };
              
              const statusLabels = {
                'processing': 'قيد التجهيز',
                'completed': 'مكتمل',
                'on-hold': 'معلق',
                'cancelled': 'ملغى',
              };
              
              return (
                <div
                  key={order.id}
                  onClick={() => router.push('/orders')}
                  className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg w-12 h-12 flex items-center justify-center font-bold shadow-md">
                    #{order.id}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {order.billing?.first_name} {order.billing?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {order.line_items?.length || 0} منتج • {order.total} جنيه
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
