"use client";

import { useState, useEffect } from 'react';
import { auditLogger } from '@/app/lib/audit-logger';
import Link from 'next/link';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    startDate: '',
    endDate: '',
    employeeId: '',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const filtered = await auditLogger.filterLogs(filters);
      const statistics = await auditLogger.getStats(filters);
      
      setLogs(filtered);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      employee_created: '➕',
      employee_updated: '✏️',
      employee_deleted: '🗑️',
      all_employees_deleted: '🚨',
      checkin_recorded: '✅',
      checkout_recorded: '🚪',
      deduction_added: '💸',
      deduction_updated: '✏️',
      deduction_deleted: '🗑️',
      sale_recorded: '🛒',
      audit_cleared: '⚠️',
      data_exported: '📥',
      login: '🔐',
      logout: '🚪',
      test_entry: '🧪'
    };
    return icons[action] || '📝';
  };

  const getActionLabel = (action) => {
    const labels = {
      employee_created: 'إضافة موظف',
      employee_updated: 'تعديل موظف',
      employee_deleted: 'حذف موظف',
      all_employees_deleted: 'حذف جميع الموظفين',
      checkin_recorded: 'تسجيل حضور',
      checkout_recorded: 'تسجيل انصراف',
      deduction_added: 'إضافة خصم',
      deduction_updated: 'تعديل خصم',
      deduction_deleted: 'حذف خصم',
      sale_recorded: 'تسجيل مبيعات',
      audit_cleared: 'مسح السجل',
      data_exported: 'تصدير بيانات',
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      test_entry: 'اختبار'
    };
    return labels[action] || action;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      employees: 'موظفين',
      attendance: 'حضور',
      deductions: 'خصومات',
      sales: 'مبيعات',
      system: 'نظام'
    };
    return labels[category] || category;
  };

  const getActionColor = (action) => {
    if (action.includes('created') || action.includes('login')) return 'text-green-600 bg-green-50 border-green-200';
    if (action.includes('updated')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (action.includes('deleted') || action.includes('logout')) return 'text-red-600 bg-red-50 border-red-200';
    if (action.includes('sale')) return 'text-purple-600 bg-purple-50 border-purple-200';
    if (action.includes('checkin')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (action.includes('checkout')) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      employees: '👥',
      attendance: '⏰',
      deductions: '💸',
      sales: '🛒',
      system: '⚙️'
    };
    return icons[category] || '📋';
  };

  const resetFilters = () => {
    setFilters({
      category: '',
      action: '',
      startDate: '',
      endDate: '',
      employeeId: '',
      search: ''
    });
  };

  const exportToCSV = () => {
    const headers = ['التاريخ', 'الوقت', 'الفئة', 'العملية', 'الوصف', 'الهدف', 'المستخدم'];
    const rows = logs.map(log => {
      const date = new Date(log.timestamp);
      return [
        date.toLocaleDateString('ar-EG'),
        date.toLocaleTimeString('ar-EG'),
        log.category,
        log.action,
        log.description,
        log.target?.name || log.target?.id || '-',
        log.performedBy?.name || 'System'
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const testAuditLog = async () => {
    try {
      console.log('🧪 Testing audit log...');
      const result = await auditLogger.log({
        category: 'system',
        action: 'test_entry',
        description: 'اختبار سجل التدقيق',
        target: { type: 'test', id: 'TEST-001', name: 'Test Entry' },
        performedBy: { type: 'admin', name: 'Test User' }
      });
      console.log('🧪 Test result:', result);
      alert(result.success ? '✅ تم التسجيل بنجاح!' : '❌ فشل التسجيل!');
      loadLogs();
    } catch (error) {
      console.error('🧪 Test error:', error);
      alert('❌ حدث خطأ: ' + error.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <span>📝</span>
              <span>سجل التدقيق الشامل</span>
            </h1>
            <p className="text-gray-600">
              كل العمليات المسجلة في النظام - سجل دائم لا يُمسح
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* <button
              onClick={testAuditLog}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>🧪</span>
              <span>اختبار</span>
            </button> */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>{showFilters ? '🔼' : '🔽'}</span>
              <span>{showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}</span>
            </button>
            <button
              onClick={exportToCSV}
              disabled={logs.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>📥</span>
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div className="text-sm opacity-90 mb-1">إجمالي العمليات</div>
            <div className="text-3xl font-bold">
              {stats.total.toLocaleString('ar-EG')}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div className="text-sm opacity-90 mb-1">👥 موظفين</div>
            <div className="text-3xl font-bold">
              {stats.byCategory.employees || 0}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div className="text-sm opacity-90 mb-1">⏰ حضور</div>
            <div className="text-3xl font-bold">
              {stats.byCategory.attendance || 0}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div className="text-sm opacity-90 mb-1">🛒 مبيعات</div>
            <div className="text-3xl font-bold">
              {stats.byCategory.sales || 0}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div className="text-sm opacity-90 mb-1">💸 خصومات</div>
            <div className="text-3xl font-bold">
              {stats.byCategory.deductions || 0}
            </div>
          </div>
        </div>
      )}

      {/* الفلاتر */}
      {showFilters && (
        <div className="bg-white p-6 rounded-xl shadow-lg border mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-black">
              <span>🔍</span>
              <span>تصفية السجلات</span>
            </h3>
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
            >
              🔄 إعادة تعيين
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* الفئة */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الفئة
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">الكل</option>
                <option value="employees">👥 موظفين</option>
                <option value="attendance">⏰ حضور</option>
                <option value="deductions">💸 خصومات</option>
                <option value="sales">🛒 مبيعات</option>
                <option value="system">⚙️ نظام</option>
              </select>
            </div>
            
            {/* من تاريخ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                من تاريخ
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* إلى تاريخ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* البحث النصي */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البحث (اسم موظف، رقم فاتورة، وصف...)
              </label>
              <input
                type="text"
                placeholder="ابحث في السجلات..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* قائمة السجلات */}
      <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2 text-black">
            <span>📋</span>
            <span>السجلات ({logs.length})</span>
          </h3>
          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>🔄</span>
            <span>تحديث</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">جاري التحميل...</p>
            </div>
          ) : logs.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">التوقيت</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">الفئة</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">العملية</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">الوصف</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">الهدف</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">المستخدم</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, index) => {
                  const date = new Date(log.timestamp);
                  return (
                    <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">
                          {date.toLocaleDateString('ar-EG')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {date.toLocaleTimeString('ar-EG', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true 
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <span>{getCategoryIcon(log.category)}</span>
                          <span>{getCategoryLabel(log.category)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(log.action)}`}>
                          <span>{getActionIcon(log.action)}</span>
                          <span className="whitespace-nowrap">{getActionLabel(log.action)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                        {log.description}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {log.target?.name ? (
                          <div>
                            <div className="font-medium text-gray-900">{log.target.name}</div>
                            <div className="text-xs text-gray-500">{log.target.id}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">
                          {log.performedBy?.name || 'System'}
                        </div>
                        {log.performedBy?.type && (
                          <div className="text-xs text-gray-500">{log.performedBy.type}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg font-medium text-gray-900">لا توجد سجلات</p>
              <p className="text-sm text-gray-500 mt-2">
                {Object.values(filters).some(v => v) 
                  ? 'جرب تغيير الفلاتر أو إعادة تعيينها'
                  : 'لم يتم تسجيل أي عمليات بعد'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
