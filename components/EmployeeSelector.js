"use client";

import Link from 'next/link';

export default function EmployeeSelector({ employees, selectedEmployee, onChange, required = true }) {
  const hasEmployees = employees && employees.length > 0;
  
  return (
    <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
      <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
        <span className="text-sm">👤</span>
        <span>البائع</span>
        {required && <span className="text-red-500">*</span>}
      </label>
      
      {!hasEmployees ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <p className="text-amber-800 font-semibold mb-2">⚠️ لا يوجد موظفين في النظام</p>
          {/* <p className="text-sm text-amber-700 mb-3">
            يجب إضافة موظف واحد على الأقل لتتمكن من البيع في نقطة البيع
          </p> */}
          <Link
            href="/employees/add"
            className="inline-block px-4 py-2 rounded-lg font-semibold transition-colors border border-blue-900 bg-[#232b3b] text-white hover:bg-blue-900 hover:text-white shadow-md"
            style={{ background: '#232b3b', color: '#fff', border: '1px solid #2d3748' }}
          >
            ➕ إضافة موظف الآن
          </Link>
        </div>
      ) : (
        <>
          <select
            value={selectedEmployee?.id || ''}
            onChange={(e) => {
              const emp = employees.find(employee => employee.id === e.target.value);
              onChange(emp || null);
            }}
            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-sm font-medium bg-white"
            required={required}
          >
            <option value="">-- اختر الموظف البائع --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeCode})
              </option>
            ))}
          </select>
          
          {/* {selectedEmployee && (
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <span className="font-medium">✅ تم اختيار:</span>
              <span className="font-bold text-blue-700">{selectedEmployee.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-500">الراتب: {selectedEmployee.basicSalary?.toLocaleString('ar-EG')} ج.م</span>
            </div>
          )} */}
          
          {!selectedEmployee && required && (
            <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <span>⚠️</span>
              <span>يرجى اختيار الموظف البائع قبل إتمام البيع</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
