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
  const [filterType, setFilterType] = useState('month'); // 'week', 'month', 'year'
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekNumber, setWeekNumber] = useState(1); // 1, 2, 3, 4, 5
  const [loading, setLoading] = useState(true);

  // دالة لتنسيق الأرقام - تقريب وإضافة فواصل
  const formatPrice = (price) => {
    const num = Number(price);
    if (isNaN(num)) return '0';
    return Math.round(num).toLocaleString('en-US');
  };

  useEffect(() => {
    loadSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filterType, month, year, weekNumber]);

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
      
      console.log('🔍 Looking for employee:', employeeId);
      console.log('📊 Total invoices:', allInvoices.length);
      
      // فلترة فواتير الموظف حسب نوع الفلتر
      // 🔥 نجيب الفواتير اللي الموظف باعها أو عمل فيها خدمة
      const employeeInvoices = allInvoices.filter(inv => {
        const invDate = new Date(inv.date || inv.createdAt);
        
        // فلترة حسب نوع الفترة
        let isInPeriod = false;
        
        if (filterType === 'week') {
          // أسبوع محدد في شهر محدد
          // الأسبوع الأول: من 1 لـ 7، الثاني: من 8 لـ 14، وهكذا
          
          // نحسب أول وآخر يوم في الأسبوع
          const weekStartDay = ((weekNumber - 1) * 7) + 1; // الأسبوع الأول يبدأ من 1
          
          // نجيب عدد أيام الشهر عشان ما نطلعش من الشهر
          const daysInMonth = new Date(year, month, 0).getDate();
          const weekEndDay = Math.min(weekStartDay + 6, daysInMonth); // لحد 7 أيام أو نهاية الشهر
          
          // نعمل الـ dates
          const weekStart = new Date(year, month - 1, weekStartDay);
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(year, month - 1, weekEndDay);
          weekEnd.setHours(23, 59, 59, 999);
          
          // نتأكد إن التاريخ في نطاق الأسبوع
          isInPeriod = invDate >= weekStart && invDate <= weekEnd;
                      
        } else if (filterType === 'month') {
          // نفس الشهر
          isInPeriod = invDate.getMonth() + 1 === month && 
                      invDate.getFullYear() === year;
        } else if (filterType === 'year') {
          // نفس السنة
          isInPeriod = invDate.getFullYear() === year;
        }
        
        if (!isInPeriod) return false;
        
        // لو الموظف هو البائع (نقارن بالـ employeeCode)
        const isSeller = inv.soldBy?.employeeCode === employeeId || String(inv.soldBy?.employeeId) === String(employeeId);
        
        // لو الموظف عامل خدمة في الفاتورة (نقارن بالـ employeeCode أو employeeId)
        const hasService = (inv.services || []).some(s => {
          if (!s.employeeId) return false;
          const match = s.employeeCode === employeeId || String(s.employeeId) === String(employeeId);
          if (match) {
            console.log('✅ Found service match in invoice:', inv.id, 'Service:', s.description, 'employeeCode:', s.employeeCode, 'employeeId:', s.employeeId);
          }
          return match;
        });
        
        if (hasService) {
          console.log('🔧 Invoice with services:', inv.id, 'Services:', inv.services);
        }
        
        return isSeller || hasService;
      });
      
      // 🆕 ترتيب الفواتير من الأحدث للأقدم
      employeeInvoices.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        return dateB - dateA; // الأحدث أولاً
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
    // 🔥 نفصل الفواتير: اللي الموظف باعها vs اللي عمل فيها خدمة بس
    const salesInvoices = invoices.filter(inv => 
      inv.soldBy?.employeeCode === employeeId || String(inv.soldBy?.employeeId) === String(employeeId)
    );
    const serviceOnlyInvoices = invoices.filter(inv => 
      !(inv.soldBy?.employeeCode === employeeId || String(inv.soldBy?.employeeId) === String(employeeId)) && 
      (inv.services || []).some(s => s.employeeId && (s.employeeCode === employeeId || String(s.employeeId) === String(employeeId)))
    );
    
    const totalSales = salesInvoices.reduce((sum, inv) => sum + (inv.summary?.total || inv.total || 0), 0);
    const totalInvoices = salesInvoices.length;
    const averageInvoiceValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    // 💰 حساب الأرباح - المنتجات من الفواتير اللي باعها فقط
    const productsProfit = salesInvoices.reduce((sum, inv) => sum + (inv.summary?.finalProductsProfit || inv.summary?.productsProfit || 0), 0);
    
    // 🆕 تتبع المنتجات بدون سعر شراء
    const itemsWithoutPurchasePrice = salesInvoices.reduce((sum, inv) => sum + (inv.summary?.itemsWithoutPurchasePrice || 0), 0);
    const totalItemsInSales = salesInvoices.reduce((sum, inv) => sum + (inv.summary?.totalItemsCount || inv.items?.length || 0), 0);
    
    // 🔧 حساب ربح الخدمات من كل الفواتير (اللي باعها + اللي عمل فيها خدمة)
    const servicesProfit = invoices.reduce((sum, inv) => {
      const services = inv.services || [];
      const employeeServices = services.filter(s => 
        s.employeeId && (s.employeeCode === employeeId || String(s.employeeId) === String(employeeId))
      );
      
      // حساب إجمالي خدمات الموظف في الفاتورة دي
      const employeeServicesTotal = employeeServices.reduce((serviceSum, s) => serviceSum + (s.amount || 0), 0);
      
      // 🆕 التحقق من وضع تطبيق الخصم
      const discountApplyMode = inv.summary?.discount?.applyMode || 'both';
      
      // لو فيه خصم ووضع التطبيق يشمل الخدمات
      if (inv.summary?.discount?.amount > 0 && inv.summary?.subtotal > 0 && 
          (discountApplyMode === 'both' || discountApplyMode === 'services')) {
        
        if (discountApplyMode === 'both') {
          // توزيع بالنسبة
          const servicesRatio = employeeServicesTotal / inv.summary.subtotal;
          const discountOnEmployeeServices = inv.summary.discount.amount * servicesRatio;
          const finalEmployeeServicesProfit = Math.max(0, employeeServicesTotal - discountOnEmployeeServices);
          return sum + finalEmployeeServicesProfit;
        } else if (discountApplyMode === 'services') {
          // الخصم كله على الخدمات - نحسب حصة خدمات الموظف
          const servicesTotal = inv.summary?.servicesTotal || 0;
          if (servicesTotal > 0) {
            const employeeServicesRatio = employeeServicesTotal / servicesTotal;
            const discountOnEmployeeServices = inv.summary.discount.amount * employeeServicesRatio;
            const finalEmployeeServicesProfit = Math.max(0, employeeServicesTotal - discountOnEmployeeServices);
            return sum + finalEmployeeServicesProfit;
          }
        }
      }
      
      return sum + employeeServicesTotal;
    }, 0);
    
    // عدد المنتجات اللي عليها ربح
    const profitableItemsCount = salesInvoices.reduce((sum, inv) => sum + (inv.summary?.profitItemsCount || 0), 0);
    
    // حساب المبيعات حسب طريقة الدفع (من الفواتير اللي باعها فقط)
    const cashSales = salesInvoices
      .filter(inv => inv.paymentMethod === 'cash')
      .reduce((sum, inv) => sum + (inv.summary?.total || inv.total || 0), 0);
    
    const cardSales = salesInvoices
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
    salesInvoices.forEach(inv => {
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
    const totalItemsSold = salesInvoices.reduce((sum, inv) => {
      return sum + (inv.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
    }, 0);
    
    return {
      totalSales,
      totalInvoices,
      averageInvoiceValue,
      totalProfit: productsProfit + servicesProfit, // 🔥 ربح المنتجات + ربح خدمات الموظف
      productsProfit,
      servicesProfit,
      profitableItemsCount,
      profitMargin: totalSales > 0 ? ((productsProfit + servicesProfit) / totalSales) * 100 : 0,
      cashSales,
      cardSales,
      otherSales,
      largestInvoice,
      smallestInvoice,
      salesByDay,
      invoicesByDay,
      bestDay,
      totalItemsSold,
      serviceOnlyInvoicesCount: serviceOnlyInvoices.length, // 🆕 عدد الفواتير اللي عمل فيها خدمة بس
      itemsWithoutPurchasePrice, // 🆕 عدد المنتجات بدون سعر شراء
      totalItemsInSales, // 🆕 إجمالي المنتجات في المبيعات
      hasMissingProfitData: itemsWithoutPurchasePrice > 0 // 🆕 flag للتحذير
    };
  };

  const getMonthName = (monthNum) => {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return months[monthNum - 1];
  };

  const getPeriodLabel = () => {
    if (filterType === 'week') {
      // حساب تواريخ الأسبوع - من أول الشهر
      const weekStartDay = ((weekNumber - 1) * 7) + 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      const weekEndDay = Math.min(weekStartDay + 6, daysInMonth);
      
      return `${getMonthName(month)} ${year} - الأسبوع ${weekNumber} (من ${weekStartDay} إلى ${weekEndDay})`;
    } else if (filterType === 'month') {
      return `${getMonthName(month)} ${year}`;
    } else if (filterType === 'year') {
      return `${year}`;
    }
    return '';
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
            {getPeriodLabel()}
          </div>
        </div>
      </div>

      {/* فلتر الفترة */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow border">
        {/* نوع الفلتر */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            عرض التقرير حسب
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType('week')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 أسبوع
            </button>
            <button
              onClick={() => setFilterType('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📆 شهر
            </button>
            <button
              onClick={() => setFilterType('year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📈 سنة
            </button>
          </div>
        </div>

        {/* خيارات الفلتر حسب النوع */}
        <div className="flex gap-4 items-end">
          {/* الشهر - يظهر في حالة الأسبوع والشهر */}
          {(filterType === 'week' || filterType === 'month') && (
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
          )}
          
          {/* رقم الأسبوع - يظهر فقط في حالة الأسبوع */}
          {filterType === 'week' && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الأسبوع
              </label>
              <select
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>الأسبوع الأول</option>
                <option value={2}>الأسبوع الثاني</option>
                <option value={3}>الأسبوع الثالث</option>
                <option value={4}>الأسبوع الرابع</option>
                <option value={5}>الأسبوع الخامس</option>
              </select>
            </div>
          )}

          {/* السنة - تظهر دائماً */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              السنة
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map(y => (
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
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">إجمالي المبيعات</div>
          <div className="text-3xl font-bold">
            {formatPrice(salesData?.stats.totalSales)} <span className="text-xl">ج.م</span>
          </div>
          <div className="text-xs opacity-75 mt-1">
            💰 ربح: {formatPrice(salesData?.stats.totalProfit)} ج.م
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
          <div className="text-sm opacity-90 mb-1">عدد الفواتير</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.totalInvoices}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {salesData?.stats.totalItemsSold} منتج مباع
            {salesData?.stats.serviceOnlyInvoicesCount > 0 && (
              <span className="mr-2">+ {salesData?.stats.serviceOnlyInvoicesCount} خدمة</span>
            )}
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
            {formatPrice(salesData?.stats.largestInvoice)} <span className="text-xl">ج.م</span>
          </div>
          <div className="text-xs opacity-75 mt-1">
            أصغر: {formatPrice(salesData?.stats.smallestInvoice)} ج.م
          </div>
        </div>
      </div>

      {/* 🆕 تحذير لو فيه منتجات بدون سعر شراء */}
      {salesData?.stats.hasMissingProfitData && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-800 mb-2">⚠️ تحذير: بيانات الأرباح غير مكتملة</h3>
              <p className="text-sm text-yellow-700 mb-2">
                <strong>{salesData.stats.itemsWithoutPurchasePrice}</strong> من <strong>{salesData.stats.totalItemsInSales}</strong> منتج 
                في مبيعات هذا الموظف ليس له سعر شراء محدد
              </p>
              <p className="text-xs text-yellow-600">
                💡 النتيجة: الأرباح المعروضة ({formatPrice(salesData.stats.totalProfit)} ج.م) 
                <strong className="mx-1">أقل من القيمة الفعلية</strong> 
                لأنها لا تشمل أرباح المنتجات التي لا يوجد لها سعر شراء.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                🔧 الحل: قم بإضافة سعر الشراء للمنتجات من صفحة <Link href="/products" className="underline font-bold">إدارة المنتجات</Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* مبيعات حسب طريقة الدفع */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💵</span>
            <span>المبيعات النقدية</span>
          </h3>
          <div className="text-2xl font-bold text-green-600">
            {formatPrice(salesData?.stats.cashSales)} ج.م
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
            {formatPrice(salesData?.stats.cardSales)} ج.م
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
              ? `${formatPrice(salesData?.stats.bestDay.sales)} ج.م`
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
              {formatPrice(salesData?.stats.totalProfit)} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              هامش: {salesData?.stats.profitMargin.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">ربح المنتجات</div>
            <div className="text-2xl font-bold text-blue-700">
              {formatPrice(salesData?.stats.productsProfit)} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {salesData?.stats.profitableItemsCount} منتج
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">ربح الخدمات</div>
            <div className="text-2xl font-bold text-purple-700">
              {formatPrice(salesData?.stats.servicesProfit)} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-1">
              إيراد كامل
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 leading-relaxed">
            <strong>💡 ملاحظة:</strong> الأرباح تُحسب من المنتجات (اللي فيها سعر شراء) + الخدمات المسؤول عنها الموظف فقط. 
            الخدمات اللي عملها موظفين تانيين مش بتظهر في تقريره. <strong>الخصم بيتوزع بالنسبة</strong> على المنتجات والخدمات.
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
                  
                  // 🔥 حساب ربح الموظف من الفاتورة دي بس
                  const isSeller = invoice.soldBy?.employeeId == employeeId;
                  const employeeProductsProfit = isSeller 
                    ? (invoice.summary?.finalProductsProfit || invoice.summary?.productsProfit || 0)
                    : 0;
                  
                  const employeeServices = (invoice.services || []).filter(s => s.employeeId == employeeId);
                  const employeeServicesTotal = employeeServices.reduce((sum, s) => sum + (s.amount || 0), 0);
                  
                  // 🆕 حساب حصة خدمات الموظف من الخصم بناءً على وضع التطبيق
                  let employeeServicesProfit = employeeServicesTotal;
                  const discountApplyMode = invoice.summary?.discount?.applyMode || 'both';
                  
                  if (invoice.summary?.discount?.amount > 0 && employeeServicesTotal > 0 &&
                      (discountApplyMode === 'both' || discountApplyMode === 'services')) {
                    
                    if (discountApplyMode === 'both' && invoice.summary?.subtotal > 0) {
                      // توزيع بالنسبة
                      const servicesRatio = employeeServicesTotal / invoice.summary.subtotal;
                      const discountOnEmployeeServices = invoice.summary.discount.amount * servicesRatio;
                      employeeServicesProfit = Math.max(0, employeeServicesTotal - discountOnEmployeeServices);
                    } else if (discountApplyMode === 'services') {
                      // الخصم كله على الخدمات
                      const servicesTotal = invoice.summary?.servicesTotal || 0;
                      if (servicesTotal > 0) {
                        const employeeServicesRatio = employeeServicesTotal / servicesTotal;
                        const discountOnEmployeeServices = invoice.summary.discount.amount * employeeServicesRatio;
                        employeeServicesProfit = Math.max(0, employeeServicesTotal - discountOnEmployeeServices);
                      }
                    }
                  }
                  
                  const employeeProfit = employeeProductsProfit + employeeServicesProfit;
                  
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
                        {isSeller ? (
                          <>
                            {itemsCount} منتج
                            {profitItemsCount > 0 && (
                              <span className="text-xs text-green-600 mr-1">
                                ({profitItemsCount} بربح)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-purple-600">خدمات فقط</span>
                        )}
                        {employeeServices.length > 0 && (
                          <span className="text-xs text-purple-600 block mt-1">
                            🔧 {employeeServices.length} خدمة
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">
                        {isSeller ? (
                          <>{formatPrice(total)} ج.م</>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {/* 🆕 لو فيه منتجات بدون سعر شراء - نعرض تحذير */}
                        {isSeller && (invoice.summary?.itemsWithoutPurchasePrice > 0 || invoice.itemsWithoutProfit?.length > 0) ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-yellow-600 text-xs flex items-center gap-1">
                              ⚠️ مفيش سعر شراء لـ {invoice.summary?.itemsWithoutPurchasePrice || invoice.itemsWithoutProfit?.length || 0} منتج
                            </span>
                            {employeeProfit > 0 && (
                              <span className="text-gray-500 text-xs">
                                الربح الجزئي: {formatPrice(employeeProfit)} ج.م
                              </span>
                            )}
                          </div>
                        ) : employeeProfit > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-yellow-700">
                              💰 {formatPrice(employeeProfit)} ج.م
                            </span>
                            {employeeProductsProfit > 0 && employeeServicesProfit > 0 && (
                              <span className="text-xs text-gray-500">
                                ({formatPrice(employeeProductsProfit)} منتجات + {formatPrice(employeeServicesProfit)} خدمات)
                              </span>
                            )}
                          </div>
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
