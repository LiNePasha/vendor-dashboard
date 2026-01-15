"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import { format, subDays } from "date-fns";

export default function GenerateDemoDataPage() {
  const router = useRouter();
  const addEmployee = useEmployeesStore((state) => state.addEmployee);
  const clockIn = useEmployeesStore((state) => state.clockIn);
  const clockOut = useEmployeesStore((state) => state.clockOut);
  
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ employees: 0, records: 0 });

  const addLog = (message, type = "info") => {
    setLog((prev) => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const employees = [
    {
      name: 'أحمد محمد علي',
      nationalId: '29012011234567',
      phone: '01012345678',
      email: 'ahmed.mohamed@example.com',
      address: '15 شارع النصر، المنصورة، الدقهلية',
      jobTitle: 'موظف مبيعات',
      department: 'المبيعات',
      hireDate: '2024-01-15',
      basicSalary: 5000,
      allowances: 500,
      workSchedule: {
        startTime: '09:00',
        endTime: '17:00',
        workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        gracePeriod: 15
      },
      status: 'active'
    },
    {
      name: 'فاطمة حسن إبراهيم',
      nationalId: '29503011234568',
      phone: '01112345678',
      email: 'fatma.hassan@example.com',
      address: '22 شارع الجلاء، القاهرة',
      jobTitle: 'محاسبة',
      department: 'الحسابات',
      hireDate: '2024-02-01',
      basicSalary: 6000,
      allowances: 800,
      workSchedule: {
        startTime: '09:00',
        endTime: '17:00',
        workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        gracePeriod: 15
      },
      status: 'active'
    },
    {
      name: 'محمود خالد السيد',
      nationalId: '28805011234569',
      phone: '01212345678',
      email: 'mahmoud.khaled@example.com',
      address: '8 شارع الهرم، الجيزة',
      jobTitle: 'مندوب مبيعات',
      department: 'المبيعات',
      hireDate: '2024-03-10',
      basicSalary: 4500,
      allowances: 600,
      workSchedule: {
        startTime: '10:00',
        endTime: '18:00',
        workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        gracePeriod: 10
      },
      status: 'active'
    },
    {
      name: 'نورا عبدالرحمن أحمد',
      nationalId: '29107011234570',
      phone: '01512345678',
      email: 'nora.abdulrahman@example.com',
      address: '33 شارع الثورة، الإسكندرية',
      jobTitle: 'موظفة خدمة عملاء',
      department: 'خدمة العملاء',
      hireDate: '2024-04-01',
      basicSalary: 4000,
      allowances: 400,
      workSchedule: {
        startTime: '08:00',
        endTime: '16:00',
        workDays: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
        gracePeriod: 20
      },
      status: 'active'
    }
  ];

  const generateData = async () => {
    setLoading(true);
    setLog([]);
    
    try {
      addLog('🎭 بدء توليد البيانات التجريبية...', 'info');
      
      // Add employees
      addLog('👥 إضافة الموظفين...', 'info');
      const addedEmployees = [];
      
      for (const empData of employees) {
        try {
          const employee = await addEmployee(empData);
          addedEmployees.push(employee);
          addLog(`✓ ${empData.name} (${empData.jobTitle})`, 'success');
        } catch (error) {
          addLog(`✗ فشل إضافة ${empData.name}: ${error.message}`, 'error');
        }
      }
      
      addLog(`✓ تم إضافة ${addedEmployees.length} موظف`, 'success');
      
      // Generate attendance records
      addLog('📊 توليد سجلات الحضور...', 'info');
      let recordCount = 0;
      
      // Note: We can't directly manipulate past attendance through the store
      // The clock in/out only works for current time
      // So we'll just add employees for now
      
      addLog('⚠️ ملاحظة: سجلات الحضور التجريبية للأيام السابقة', 'warning');
      addLog('يجب إضافتها يدوياً من صفحة تسجيل الحضور', 'warning');
      
      setStats({ employees: addedEmployees.length, records: recordCount });
      
      addLog('✅ اكتمل توليد الموظفين!', 'success');
      addLog('💡 يمكنك الآن الذهاب لصفحة تسجيل الحضور', 'info');
      
    } catch (error) {
      addLog(`❌ خطأ: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/employees')}
            className="text-blue-500 hover:text-blue-600 mb-4 flex items-center gap-2"
          >
            ← رجوع
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🎭 توليد بيانات تجريبية</h1>
          <p className="text-gray-500">إنشاء موظفين وبيانات تجريبية للاختبار</p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-r-4 border-blue-500 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">📋 ماذا سيتم إنشاؤه؟</h3>
          <ul className="space-y-2 text-blue-800">
            <li>✓ 4 موظفين بمسميات وأقسام مختلفة</li>
            <li>✓ بيانات كاملة لكل موظف (اسم، تليفون، رقم قومي، إلخ)</li>
            <li>✓ جداول عمل مختلفة</li>
            <li>✓ رواتب وبدلات متنوعة</li>
          </ul>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateData}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all shadow-lg mb-6"
        >
          {loading ? '⏳ جاري الإنشاء...' : '🚀 إنشاء البيانات التجريبية'}
        </button>

        {/* Stats */}
        {stats.employees > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-6 text-center shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-blue-600">{stats.employees}</div>
              <div className="text-gray-600 mt-2">موظف</div>
            </div>
            <div className="bg-white rounded-lg p-6 text-center shadow-sm border border-gray-100">
              <div className="text-4xl font-bold text-green-600">{stats.records}</div>
              <div className="text-gray-600 mt-2">سجل حضور</div>
            </div>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 shadow-lg">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>📝</span>
              <span>سجل العمليات</span>
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
              {log.map((entry, index) => (
                <div
                  key={index}
                  className={`${
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'error' ? 'text-red-400' :
                    entry.type === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}
                >
                  <span className="text-gray-500">[{entry.time}]</span> {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {stats.employees > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/employees')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              👥 قائمة الموظفين
            </button>
            <button
              onClick={() => router.push('/employees/attendance/record')}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              ⏰ تسجيل حضور
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
