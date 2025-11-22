"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";

export default function EmployeesPage() {
  const router = useRouter();
  
  const employees = useEmployeesStore((state) => state.employees);
  const loading = useEmployeesStore((state) => state.loading);
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees);
  const getActiveEmployees = useEmployeesStore((state) => state.getActiveEmployees);
  const deleteEmployee = useEmployeesStore((state) => state.deleteEmployee);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active, inactive, all
  const [toast, setToast] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (employee) => {
    try {
      await deleteEmployee(employee.id);
      showToast(`تم إيقاف ${employee.name} بنجاح`);
      setShowDeleteConfirm(false);
      setSelectedEmployee(null);
    } catch (error) {
      showToast(error.message || 'حدث خطأ', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      const employeesCopy = [...employees]; // نسخة للتسجيل
      const count = employeesCopy.length;
      
      const { employeesStorage } = await import('@/app/lib/employees-storage');
      await employeesStorage.clearAllData();
      
      // 📝 تسجيل في Audit Log
      try {
        const { logAllEmployeesDeleted } = await import('@/app/lib/audit-logger');
        await logAllEmployeesDeleted(count, employeesCopy);
      } catch (error) {
        console.error('Failed to log employee deletion:', error);
      }
      
      await loadEmployees();
      showToast('✅ تم مسح جميع البيانات بنجاح');
      setShowClearAllConfirm(false);
    } catch (error) {
      showToast('حدث خطأ أثناء المسح', 'error');
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ? true : emp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const activeCount = employees.filter(e => e.status === 'active').length;
  const inactiveCount = employees.filter(e => e.status === 'inactive').length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white z-50 shadow-lg ${
            toast.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">⚠️ تأكيد الإيقاف</h3>
            <p className="text-gray-600 mb-6">
              هل أنت متأكد من إيقاف الموظف <strong>{selectedEmployee.name}</strong>؟
              <br />
              <span className="text-sm text-gray-500">سيتم تحويله لحالة "غير نشط" ولن يتمكن من تسجيل الحضور.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedEmployee(null);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(selectedEmployee)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                تأكيد الإيقاف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-4">🗑️ تحذير: مسح جميع البيانات!</h3>
            <p className="text-gray-600 mb-6">
              هل أنت متأكد من مسح <strong>جميع البيانات</strong>؟
              <br /><br />
              <span className="text-sm text-red-600 font-semibold">سيتم مسح:</span>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• كل الموظفين</li>
                <li>• سجلات الحضور والانصراف</li>
                <li>• المرتبات والخصومات</li>
                <li>• السلف والإجازات</li>
              </ul>
              <br />
              <span className="text-sm text-red-600 font-semibold">⚠️ هذا الإجراء لا يمكن التراجع عنه!</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
              >
                نعم، احذف كل شيء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">👥 الموظفين</h1>
        <div className="flex items-center justify-between">
          <p className="text-gray-500">
            إجمالي: {employees.length} • نشط: {activeCount} • غير نشط: {inactiveCount}
          </p>
          <div className="flex items-center gap-3">
            {/* {employees.length === 0 && (
              <button
                onClick={() => router.push('/employees/demo/advanced')}
                className="text-green-600 hover:text-green-700 text-sm font-semibold flex items-center gap-1"
              >
                <span>🎲</span>
                <span>بيانات تجريبية متقدمة</span>
              </button>
            )} */}
            {employees.length > 0 && (
              <button
                onClick={() => setShowClearAllConfirm(true)}
                className="text-red-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1"
              >
                <span>🗑️</span>
                <span>مسح جميع البيانات</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-3xl font-bold mb-1">{employees.length}</div>
          <div className="text-sm opacity-90">إجمالي الموظفين</div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-3xl font-bold mb-1">{activeCount}</div>
          <div className="text-sm opacity-90">موظف نشط</div>
        </div>
        <div className="bg-gradient-to-r from-gray-500 to-gray-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-3xl font-bold mb-1">{inactiveCount}</div>
          <div className="text-sm opacity-90">غير نشط</div>
        </div>
        <button
          onClick={() => router.push('/employees/add')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-xl p-6 text-white shadow-lg transition-all hover:scale-105 flex flex-col items-center justify-center"
        >
          <div className="text-3xl mb-1">➕</div>
          <div className="text-sm font-semibold">إضافة موظف جديد</div>
        </button>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 ابحث بالاسم، الكود، الوظيفة، أو القسم..."
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          {/* Status Filter */}
          <select
            className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">✅ نشط فقط</option>
            <option value="inactive">❌ غير نشط فقط</option>
            <option value="all">📊 الكل</option>
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={() => loadEmployees()}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
            title="تحديث البيانات"
          >
            🔄 تحديث
          </button>
          
          {/* Quick Actions */}
          {/* <button
            onClick={() => router.push('/employees/demo')}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            🎭 بيانات تجريبية
          </button> */}
          <button
            onClick={() => router.push('/employees/attendance/record')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            ⏰ تسجيل حضور
          </button>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          // Loading Skeletons
          Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm p-5 animate-pulse border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))
        ) : filteredEmployees.length === 0 ? (
          // Empty State
          <div className="col-span-full text-center py-16">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-gray-500 text-lg mb-2">
              {employees.length === 0 ? 'لا يوجد موظفين بعد' : 'لا توجد نتائج مطابقة'}
            </p>
            {employees.length === 0 ? (
              <button
                onClick={() => router.push('/employees/add')}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                ➕ إضافة موظف جديد
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('active');
                }}
                className="text-blue-500 hover:underline text-sm mt-2"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          // Employees List
          filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className={`bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border-2 ${
                employee.status === 'active'
                  ? 'border-gray-100 hover:border-blue-300'
                  : 'border-gray-300 opacity-60'
              }`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar */}
                  <div className="relative">
                    {employee.photo ? (
                      <img
                        src={employee.photo}
                        alt={employee.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
                        {employee.name.charAt(0)}
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                      employee.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">
                      {employee.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">{employee.id}</p>
                    <p className="text-sm text-gray-600 truncate">{employee.jobTitle}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4 text-sm">
                  {employee.department && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>🏢</span>
                      <span className="truncate">{employee.department}</span>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>📱</span>
                      <span className="truncate">{employee.phone}</span>
                    </div>
                  )}
                  {employee.basicSalary && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>💰</span>
                      <span className="font-semibold">{employee.basicSalary.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {employee.hireDate && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <span>📅</span>
                      <span>منذ {new Date(employee.hireDate).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="mb-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    employee.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {employee.status === 'active' ? '✅ نشط' : '❌ غير نشط'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/employees/${employee.id}`)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    📋 التفاصيل
                  </button>
                  {/* <button
                    onClick={() => router.push(`/employees/${employee.id}/edit`)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    ✏️
                  </button> */}
                  {employee.status === 'active' && (
                    <button
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setShowDeleteConfirm(true);
                      }}
                      className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      🚫
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => router.push('/employees/add')}
        className="md:hidden fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl transition-all hover:scale-110 z-40"
      >
        ➕
      </button>
    </div>
  );
}
