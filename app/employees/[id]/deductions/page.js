"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import { employeesStorage } from "@/app/lib/employees-storage";
import { getCurrentEgyptTime, formatEgyptTime } from "@/app/lib/time-helpers";

export default function DeductionsPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id;

  const employees = useEmployeesStore((state) => state.employees);
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees);

  const [employee, setEmployee] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [filter, setFilter] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'all', // all, advance, penalty, other
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    setEmployee(emp);
  }, [employees, employeeId]);

  useEffect(() => {
    if (employee) {
      loadDeductions();
    }
  }, [employee, filter]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDeductions = async () => {
    setLoading(true);
    try {
      const allDeductions = await employeesStorage.getDeductionsByEmployee(
        employee.id,
        filter.month,
        filter.year
      );

      let filtered = allDeductions;
      if (filter.type !== 'all') {
        filtered = allDeductions.filter((d) => d.type === filter.type);
      }

      setDeductions(filtered);
    } catch (error) {
      console.error("Error loading deductions:", error);
      showToast("حدث خطأ أثناء تحميل الخصومات", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deduction) => {
    try {
      await employeesStorage.deleteDeduction(deduction.id);
      
      // 📝 تسجيل في Audit Log
      try {
        const { logDeductionDeleted } = await import('@/app/lib/audit-logger');
        await logDeductionDeleted(deduction);
      } catch (error) {
        console.error('Failed to log deduction deletion:', error);
      }
      
      showToast("✅ تم حذف الخصم بنجاح");
      loadDeductions();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting deduction:", error);
      showToast("حدث خطأ أثناء حذف الخصم", "error");
    }
  };

  if (!employee) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const deductionTypes = {
    advance: { label: '💰 سُلفة', color: 'blue' },
    penalty: { label: '⚠️ جزاء', color: 'red' },
    other: { label: '📝 أخرى', color: 'gray' },
  };

  const formatDeductionDateTime = (deduction) => {
    const dateStr = new Date(deduction.date).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (deduction.time) {
      const [hours, minutes] = deduction.time.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'مساءً' : 'صباحاً';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${dateStr} • ${displayHour}:${minutes} ${period}`;
    }
    
    return dateStr;
  };

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

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
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
              <p className="text-gray-600">هل أنت متأكد من حذف هذا الخصم؟</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-right">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">النوع:</span>
                  <span className="font-semibold">{deductionTypes[deleteConfirm.type]?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">المبلغ:</span>
                  <span className="font-bold text-red-600">{deleteConfirm.amount.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">السبب:</span>
                  <span className="font-semibold">{deleteConfirm.reason}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/employees/${employee.id}`)}
            className="text-blue-500 hover:text-blue-600 mb-4 flex items-center gap-2"
          >
            ← رجوع
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">💸 خصومات الموظف</h1>
          <p className="text-gray-500">
            <strong>{employee.name}</strong> ({employee.jobTitle})
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-4 shadow-lg">
            <div className="text-sm opacity-90 mb-1">إجمالي الخصومات</div>
            <div className="text-3xl font-bold">{totalDeductions.toLocaleString()}</div>
            <div className="text-sm opacity-90">ج.م</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">💰 سُلف</div>
            <div className="text-2xl font-bold text-blue-600">
              {deductions.filter(d => d.type === 'advance').reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">({deductions.filter(d => d.type === 'advance').length} سُلفة)</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200">
            <div className="text-sm text-gray-600 mb-1">⚠️ جزاءات</div>
            <div className="text-2xl font-bold text-red-600">
              {deductions.filter(d => d.type === 'penalty').reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">({deductions.filter(d => d.type === 'penalty').length} جزاء)</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">📝 أخرى</div>
            <div className="text-2xl font-bold text-gray-700">
              {deductions.filter(d => d.type === 'other').reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">({deductions.filter(d => d.type === 'other').length} خصم)</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">الشهر</label>
              <select
                value={filter.month}
                onChange={(e) => setFilter({ ...filter, month: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i, 1).toLocaleDateString('ar-EG', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
              <select
                value={filter.year}
                onChange={(e) => setFilter({ ...filter, year: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">النوع</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">الكل</option>
                <option value="advance">💰 سُلف فقط</option>
                <option value="penalty">⚠️ جزاءات فقط</option>
                <option value="other">📝 أخرى فقط</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deductions List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {loading ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">⏳</div>
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          ) : deductions.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg mb-4">لا توجد خصومات لهذا الشهر</p>
              <button
                onClick={() => router.push(`/employees/${employee.id}`)}
                className="text-blue-500 hover:text-blue-600 font-semibold"
              >
                ← رجوع لصفحة الموظف
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {deductions.map((deduction) => (
                <div key={deduction.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{deductionTypes[deduction.type]?.label.split(' ')[0]}</span>
                        <div>
                          <div className="font-bold text-gray-800">{deduction.reason}</div>
                          <div className="text-sm text-gray-500">
                            {formatDeductionDateTime(deduction)}
                          </div>
                        </div>
                      </div>
                      {deduction.note && (
                        <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm text-gray-600">
                          📝 {deduction.note}
                        </div>
                      )}
                    </div>
                    <div className="text-left mr-4">
                      <div className="text-2xl font-bold text-red-600 mb-2">
                        {deduction.amount.toLocaleString()} ج.م
                      </div>
                      <button
                        onClick={() => setDeleteConfirm(deduction)}
                        className="text-red-500 hover:text-red-600 text-sm font-semibold"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
