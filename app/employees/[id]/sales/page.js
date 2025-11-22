"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EmployeeSalesPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id;
  
  const [employee, setEmployee] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, month, year]);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const { employeesStorage } = await import('@/app/lib/employees-storage');
      const { invoiceStorage } = await import('@/app/lib/localforage');
      
      // تحميل بيانات الموظف
      const emp = await employeesStorage.getEmployee(employeeId);
      if (!emp) {
        router.push('/employees');
        return;
      }
      setEmployee(emp);
      
      // تحميل كل الفواتير
      const allInvoices = await invoiceStorage.getAllInvoices();
      
      // فلترة فواتير الموظف في الشهر المحدد
      const employeeInvoices = allInvoices.filter(inv => {
        if (inv.soldBy?.employeeId !== employeeId) return false;
        
        const invDate = new Date(inv.date || inv.createdAt);
        return invDate.getMonth() + 1 === month && 
               invDate.getFullYear() === year;
      });
      
      // حساب الإحصائيات
      const stats = calculateSalesStats(employeeInvoices);
      
      setSalesData({
        invoices: employeeInvoices,
        stats: stats
      });
      
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSalesStats = (invoices) => {
    const totalSales = invoices.reduce((sum, inv) => sum + (inv.summary?.total || inv.total || 0), 0);
    const totalInvoices = invoices.length;
    const averageInvoiceValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    // 💰 حساب الأرباح
    const totalProfit = invoices.reduce((sum, inv) => sum + (inv.summary?.totalProfit || 0), 0);
    const productsProfit = invoices.reduce((sum, inv) => sum + (inv.summary?.finalProductsProfit || inv.summary?.productsProfit || 0), 0);
    const servicesProfit = invoices.reduce((sum, inv) => sum + (inv.summary?.servicesTotal || 0), 0);
    
    // عدد المنتجات اللي عليها ربح
    const profitableItemsCount = invoices.reduce((sum, inv) => sum + (inv.summary?.profitItemsCount || 0), 0);
    
    // حساب المبيعات حسب طريقة الدفع
    const cashSales = invoices
      .filter(inv => inv.paymentMethod === 'cash')
      .reduce((sum, inv) => sum + (inv.summary?.total || inv.total || 0), 0);
    
    const cardSales = invoices
      .filter(inv => inv.paymentMethod === 'card')
      .reduce((sum, inv) => sum + (inv.summary?.total || inv.total || 0), 0);
    
    const otherSales = totalSales - cashSales - cardSales;
    
    // أكبر فاتورة
    const largestInvoice = invoices.length > 0 
      ? Math.max(...invoices.map(inv => inv.summary?.total || inv.total || 0))
      : 0;
    
    // أصغر فاتورة
    const smallestInvoice = invoices.length > 0 
      ? Math.min(...invoices.map(inv => inv.summary?.total || inv.total || 0))
      : 0;
    
    // المبيعات اليومية
    const salesByDay = {};
    const invoicesByDay = {};
    invoices.forEach(inv => {
      const day = new Date(inv.date || inv.createdAt).getDate();
      const total = inv.summary?.total || inv.total || 0;
      salesByDay[day] = (salesByDay[day] || 0) + total;
      invoicesByDay[day] = (invoicesByDay[day] || 0) + 1;
    });
    
    // أفضل يوم مبيعات
    let bestDay = { day: 0, sales: 0 };
    Object.entries(salesByDay).forEach(([day, sales]) => {
      if (sales > bestDay.sales) {
        bestDay = { day: parseInt(day), sales };
      }
    });
    
    // حساب إجمالي عدد المنتجات المباعة
    const totalItemsSold = invoices.reduce((sum, inv) => {
      return sum + (inv.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
    }, 0);
    
    return {
      totalSales,
      totalInvoices,
      averageInvoiceValue,
      totalProfit,
      productsProfit,
      servicesProfit,
      profitableItemsCount,
      profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
      cashSales,
      cardSales,
      otherSales,
      largestInvoice,
      smallestInvoice,
      salesByDay,
      invoicesByDay,
      bestDay,
      totalItemsSold
    };
  };

  const getMonthName = (monthNum) => {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return months[monthNum - 1];
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">جاري تحميل التقارير...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">الموظف غير موجود</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link 
            href={`/employees/${employeeId}`}
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← العودة لصفحة الموظف
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span>💰</span>
            <span>تقرير مبيعات: {employee.name}</span>
          </h1>
          <p className="text-gray-600">كود الموظف: {employee.employeeCode}</p>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-600">الفترة</div>
          <div className="text-xl font-bold text-gray-900">
            {getMonthName(month)} {year}
          </div>
        </div>
      </div>

      {/* فلتر الشهر */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow border flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الشهر
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {getMonthName(i + 1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            السنة
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={loadSalesData}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 تحديث
        </button>
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">إجمالي المبيعات</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.totalSales.toLocaleString('ar-EG')} <span className="text-xl">ج.م</span>
          </div>
          <div className="text-xs opacity-75 mt-1">
            💰 ربح: {salesData?.stats.totalProfit.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">عدد الفواتير</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.totalInvoices}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {salesData?.stats.totalItemsSold} منتج مباع
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">هامش الربح</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.profitMargin.toFixed(1)}%
          </div>
          <div className="text-xs opacity-75 mt-1">
            {salesData?.stats.profitableItemsCount} منتج بربح
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">أكبر فاتورة</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.largestInvoice.toLocaleString('ar-EG')} <span className="text-xl">ج.م</span>
          </div>
          <div className="text-xs opacity-75 mt-1">
            أصغر: {salesData?.stats.smallestInvoice.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
      </div>

      {/* مبيعات حسب طريقة الدفع */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💵</span>
            <span>المبيعات النقدية</span>
          </h3>
          <div className="text-2xl font-bold text-green-600">
            {salesData?.stats.cashSales.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {salesData?.stats.totalSales > 0 
              ? ((salesData?.stats.cashSales / salesData?.stats.totalSales) * 100).toFixed(1)
              : 0}% من الإجمالي
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💳</span>
            <span>المبيعات بالبطاقة</span>
          </h3>
          <div className="text-2xl font-bold text-blue-600">
            {salesData?.stats.cardSales.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {salesData?.stats.totalSales > 0 
              ? ((salesData?.stats.cardSales / salesData?.stats.totalSales) * 100).toFixed(1)
              : 0}% من الإجمالي
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🏆</span>
            <span>أفضل يوم</span>
          </h3>
          <div className="text-2xl font-bold text-purple-600">
            {salesData?.stats.bestDay.day > 0 ? salesData?.stats.bestDay.day : '-'}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {salesData?.stats.bestDay.sales > 0 
              ? `${salesData?.stats.bestDay.sales.toLocaleString('ar-EG')} ج.م`
              : 'لا توجد مبيعات'}
          </div>
        </div>
      </div>

      {/* 💰 تفاصيل الأرباح */}
      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 rounded-xl p-6 mb-6">
        <h3 className="text-xl font-bold text-yellow-900 mb-4 flex items-center gap-2">
          <span>💰</span>
          <span>تحليل الأرباح</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">إجمالي الأرباح</div>
            <div className="text-2xl font-bold text-green-700">
              {salesData?.stats.totalProfit.toLocaleString('ar-EG')} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              هامش: {salesData?.stats.profitMargin.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">ربح المنتجات</div>
            <div className="text-2xl font-bold text-blue-700">
              {salesData?.stats.productsProfit.toLocaleString('ar-EG')} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {salesData?.stats.profitableItemsCount} منتج
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">ربح الخدمات</div>
            <div className="text-2xl font-bold text-purple-700">
              {salesData?.stats.servicesProfit.toLocaleString('ar-EG')} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              إيراد كامل
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 leading-relaxed">
            <strong>💡 ملاحظة:</strong> الأرباح تُحسب فقط للمنتجات اللي محدد لها سعر شراء في النظام. 
            الخدمات تُحسب كإيراد كامل لأنها مش بضاعة.
          </p>
        </div>
      </div>

      {/* قائمة الفواتير */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>📋</span>
            <span>الفواتير ({salesData?.invoices.length})</span>
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          {salesData?.invoices.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">رقم الفاتورة</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الوقت</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">المنتجات</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الربح</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">طريقة الدفع</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {salesData?.invoices.map(invoice => {
                  const date = new Date(invoice.date || invoice.createdAt);
                  const total = invoice.summary?.total || invoice.total || 0;
                  const profit = invoice.summary?.totalProfit || 0;
                  const itemsCount = invoice.items?.length || 0;
                  const profitItemsCount = invoice.summary?.profitItemsCount || 0;
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {invoice.id.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {date.toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {date.toLocaleTimeString('ar-EG', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {itemsCount} منتج
                        {profitItemsCount > 0 && (
                          <span className="text-xs text-green-600 mr-1">
                            ({profitItemsCount} بربح)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">
                        {total.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {profit > 0 ? (
                          <span className="text-yellow-700">
                            💰 {profit.toLocaleString('ar-EG')} ج.م
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.paymentMethod === 'cash' ? '💵 نقدي' : 
                         invoice.paymentMethod === 'wallet' ? '👛 محفظة' :
                         invoice.paymentMethod === 'instapay' ? '📱 انستا باي' :
                         '💳 أخرى'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-lg font-medium">لا توجد فواتير في هذا الشهر</p>
              <p className="text-sm mt-2">لم يقم {employee.name} ببيع أي منتجات في {getMonthName(month)} {year}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
