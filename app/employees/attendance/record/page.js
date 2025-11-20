"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import {
  getCurrentEgyptTime,
  getTodayEgypt,
  formatEgyptTime,
  formatArabicTime,
  getTimeAgo
} from "@/app/lib/time-helpers";

export default function AttendanceRecordPage() {
  const router = useRouter();
  
  const employees = useEmployeesStore((state) => state.employees);
  const getActiveEmployees = useEmployeesStore((state) => state.getActiveEmployees);
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees);
  const clockIn = useEmployeesStore((state) => state.clockIn);
  const clockOut = useEmployeesStore((state) => state.clockOut);
  const loadTodayAttendance = useEmployeesStore((state) => state.loadTodayAttendance);
  const todayAttendance = useEmployeesStore((state) => state.todayAttendance);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionType, setActionType] = useState('check-in'); // check-in, check-out
  const [note, setNote] = useState('');
  const [currentTime, setCurrentTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(getCurrentEgyptTime());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Load employees and today's attendance on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadEmployees();
        await loadTodayAttendance();
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    init();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Get employee's attendance status today
  const getEmployeeAttendanceStatus = (employeeId) => {
    const record = todayAttendance.find((att) => att.employeeId === employeeId);
    
    if (!record) {
      return { status: 'not-checked-in', record: null };
    }
    
    if (record.checkIn && !record.checkOut) {
      return { status: 'checked-in', record };
    }
    
    if (record.checkIn && record.checkOut) {
      return { status: 'completed', record };
    }
    
    return { status: 'not-checked-in', record: null };
  };

  // Calculate late warning
  const getLateWarning = (employee) => {
    if (!employee || !currentTime) return null;
    
    const workStartTime = employee.workSchedule?.startTime || '09:00';
    const gracePeriod = employee.workSchedule?.gracePeriod || 15;
    
    const [hours, minutes] = workStartTime.split(':');
    const today = formatEgyptTime(currentTime, 'yyyy-MM-dd');
    const scheduledStart = new Date(`${today}T${hours}:${minutes}:00+02:00`);
    const graceEnd = new Date(scheduledStart.getTime() + gracePeriod * 60000);
    
    if (currentTime > graceEnd) {
      const lateMinutes = Math.floor((currentTime - scheduledStart) / 60000);
      return {
        late: true,
        lateMinutes,
        message: `⚠️ متأخر ${lateMinutes} دقيقة!`
      };
    }
    
    if (currentTime > scheduledStart) {
      const usedMinutes = Math.floor((currentTime - scheduledStart) / 60000);
      return {
        late: false,
        withinGrace: true,
        message: `⏱️ ضمن فترة السماح (${gracePeriod - usedMinutes} دقيقة متبقية)`
      };
    }
    
    return {
      late: false,
      onTime: true,
      message: `✅ في الموعد`
    };
  };

  // Handle employee selection
  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setSearchQuery('');
    
    // Determine default action based on status
    const { status } = getEmployeeAttendanceStatus(employee.id);
    if (status === 'not-checked-in') {
      setActionType('check-in');
    } else if (status === 'checked-in') {
      setActionType('check-out');
    }
  };

  // Handle record attendance
  const handleRecord = async () => {
    if (!selectedEmployee) {
      showToast('الرجاء اختيار موظف', 'error');
      return;
    }

    setLoading(true);
    
    try {
      if (actionType === 'check-in') {
        await clockIn(selectedEmployee.id, note);
        showToast(`✅ تم تسجيل حضور ${selectedEmployee.name} بنجاح!`);
      } else if (actionType === 'check-out') {
        await clockOut(selectedEmployee.id, note);
        showToast(`✅ تم تسجيل انصراف ${selectedEmployee.name} بنجاح!`);
      }
      
      // Reload today's attendance
      await loadTodayAttendance();
      
      // Reset form
      setSelectedEmployee(null);
      setNote('');
      setActionType('check-in');
      
    } catch (error) {
      showToast(error.message || 'حدث خطأ أثناء التسجيل', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter employees by search
  const activeEmployees = getActiveEmployees();
  const filteredEmployees = searchQuery
    ? activeEmployees.filter((emp) =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeEmployees;

  const lateWarning = selectedEmployee ? getLateWarning(selectedEmployee) : null;
  const employeeStatus = selectedEmployee ? getEmployeeAttendanceStatus(selectedEmployee.id) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">⏰ تسجيل الحضور والانصراف</h1>
            <p className="text-gray-500 mt-1">
              {currentTime ? formatArabicTime(currentTime, 'PPPP') : ''}
            </p>
          </div>
          <button
            onClick={() => router.push('/employees')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
          >
            ← رجوع
          </button>
        </div>
      </div>

      {/* Current Time Display */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white mb-6 shadow-xl">
        <div className="text-center">
          <div className="text-sm opacity-90 mb-2">📅 {formatEgyptTime(currentTime, 'EEEE، dd MMMM yyyy')}</div>
          <div className="text-6xl font-bold mb-2">
            {currentTime ? (
              <>
                {formatEgyptTime(currentTime, 'hh:mm:ss')}
                <span className="text-3xl ml-2">
                  {parseInt(formatEgyptTime(currentTime, 'HH')) >= 12 ? 'مساءً' : 'صباحاً'}
                </span>
              </>
            ) : '--:--:--'}
          </div>
          <div className="text-sm opacity-90">توقيت القاهرة (Africa/Cairo)</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Side - Form */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          {/* Employee Selection */}
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-3">
              🔍 اختر الموظف
            </label>
            
            {!selectedEmployee ? (
              <div>
                <input
                  type="text"
                  placeholder="🔍 ابحث عن موظف..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        لا توجد نتائج
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const status = getEmployeeAttendanceStatus(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => handleEmployeeSelect(emp)}
                            className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg w-12 h-12 flex items-center justify-center font-bold">
                                  {emp.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-800">{emp.name}</div>
                                  <div className="text-sm text-gray-500">{emp.id}</div>
                                  <div className="text-xs text-gray-400">{emp.jobTitle}</div>
                                </div>
                              </div>
                              <div>
                                {status.status === 'not-checked-in' && (
                                  <span className="text-gray-400 text-sm">❌ لم يسجل</span>
                                )}
                                {status.status === 'checked-in' && (
                                  <span className="text-blue-600 text-sm">✅ حاضر</span>
                                )}
                                {status.status === 'completed' && (
                                  <span className="text-green-600 text-sm">✅ انصرف</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg w-14 h-14 flex items-center justify-center font-bold text-xl">
                      {selectedEmployee.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-lg">{selectedEmployee.name}</div>
                      <div className="text-sm text-gray-600">{selectedEmployee.id}</div>
                      <div className="text-sm text-gray-500">{selectedEmployee.jobTitle}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="text-red-500 hover:text-red-600 font-medium text-sm"
                  >
                    ✕ تغيير
                  </button>
                </div>
                
                {/* Work Schedule Info */}
                <div className="bg-white rounded-lg p-3 mt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">📊 معلومات الدوام:</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">⏰ البدء</div>
                      <div className="font-semibold text-gray-800">
                        {selectedEmployee.workSchedule?.startTime || '09:00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">🏁 الانتهاء</div>
                      <div className="font-semibold text-gray-800">
                        {selectedEmployee.workSchedule?.endTime || '17:00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">⏱️ السماح</div>
                      <div className="font-semibold text-gray-800">
                        {selectedEmployee.workSchedule?.gracePeriod || 15} دقيقة
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Late Warning */}
                {actionType === 'check-in' && lateWarning && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    lateWarning.late 
                      ? 'bg-red-100 border border-red-300 text-red-700' 
                      : lateWarning.withinGrace
                      ? 'bg-yellow-100 border border-yellow-300 text-yellow-700'
                      : 'bg-green-100 border border-green-300 text-green-700'
                  }`}>
                    <div className="font-semibold text-sm">{lateWarning.message}</div>
                  </div>
                )}
                
                {/* Today's Status */}
                {employeeStatus && employeeStatus.status !== 'not-checked-in' && (
                  <div className="mt-3 bg-white rounded-lg p-3 border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-2">📋 حالة اليوم:</div>
                    <div className="text-sm">
                      {employeeStatus.record?.checkIn && (
                        <div className="mb-1">
                          ✅ حضور: {employeeStatus.record.checkIn.time}
                          {employeeStatus.record.checkIn.late && (
                            <span className="text-red-600 ml-2">
                              (متأخر {employeeStatus.record.checkIn.lateMinutes} دقيقة)
                            </span>
                          )}
                        </div>
                      )}
                      {employeeStatus.record?.checkOut && (
                        <div>
                          🏁 انصراف: {employeeStatus.record.checkOut.time}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedEmployee && (
            <>
              {/* Action Type */}
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-3">
                  نوع التسجيل
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActionType('check-in')}
                    disabled={employeeStatus?.status !== 'not-checked-in'}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                      actionType === 'check-in'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                    } ${employeeStatus?.status !== 'not-checked-in' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    ✅ تسجيل حضور
                  </button>
                  <button
                    onClick={() => setActionType('check-out')}
                    disabled={employeeStatus?.status !== 'checked-in'}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                      actionType === 'check-out'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                    } ${employeeStatus?.status !== 'checked-in' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    🏁 تسجيل انصراف
                  </button>
                </div>
              </div>

              {/* Time Display */}
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">
                  ⏰ الوقت المسجل
                </label>
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-800">
                    {currentTime ? (
                      <>
                        {formatEgyptTime(currentTime, 'hh:mm:ss')}
                        <span className="text-lg ml-2">
                          {parseInt(formatEgyptTime(currentTime, 'HH')) >= 12 ? 'مساءً' : 'صباحاً'}
                        </span>
                      </>
                    ) : '--:--:--'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">(تلقائي)</div>
                </div>
              </div>

              {/* Note */}
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">
                  💬 ملاحظة (اختياري)
                </label>
                <textarea
                  placeholder={actionType === 'check-in' ? 'عذر التأخير...' : 'سبب الانصراف المبكر...'}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="font-semibold text-yellow-800 mb-2">⚠️ سيتم تسجيل:</div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>
                    • نوع التسجيل: <strong>{actionType === 'check-in' ? 'حضور' : 'انصراف'}</strong>
                  </li>
                  <li>
                    • الوقت: <strong>
                      {currentTime ? (
                        <>
                          {formatEgyptTime(currentTime, 'hh:mm:ss')}
                          {' '}
                          {parseInt(formatEgyptTime(currentTime, 'HH')) >= 12 ? 'مساءً' : 'صباحاً'}
                        </>
                      ) : '--:--:--'}
                    </strong>
                  </li>
                  {actionType === 'check-in' && lateWarning?.late && (
                    <li className="text-red-600">
                      • التأخير: <strong>{lateWarning.lateMinutes} دقيقة</strong> (بعد فترة السماح)
                    </li>
                  )}
                  {note && (
                    <li>
                      • الملاحظة: <strong>{note}</strong>
                    </li>
                  )}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setNote('');
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
                  disabled={loading}
                >
                  ❌ إلغاء
                </button>
                <button
                  onClick={handleRecord}
                  disabled={loading}
                  className={`flex-1 font-bold py-3 rounded-lg transition-all shadow-md hover:shadow-lg ${
                    actionType === 'check-in'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? '⏳ جاري التسجيل...' : actionType === 'check-in' ? '✅ تأكيد الحضور' : '✅ تأكيد الانصراف'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Side - Today's Attendance */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📋</span>
            <span>سجل اليوم</span>
            <span className="bg-blue-500 text-white text-sm px-2 py-1 rounded-full ml-auto">
              {todayAttendance.length}
            </span>
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {todayAttendance.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-6xl mb-3">📭</div>
                <p>لا توجد تسجيلات اليوم</p>
              </div>
            ) : (
              todayAttendance.map((record) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                if (!employee) return null;

                return (
                  <div
                    key={record.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg w-10 h-10 flex items-center justify-center font-bold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.jobTitle}</div>
                        </div>
                      </div>
                      {record.checkIn && record.checkOut ? (
                        <span className="text-green-600 text-sm font-medium">✅ اكتمل</span>
                      ) : (
                        <span className="text-blue-600 text-sm font-medium">⏳ جاري</span>
                      )}
                    </div>

                    <div className="text-sm space-y-1">
                      {record.checkIn && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">✅ حضور:</span>
                          <span className="font-semibold text-gray-800">
                            {(() => {
                              const [hours, minutes, seconds] = record.checkIn.time.split(':');
                              const hour = parseInt(hours);
                              const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                              return `${hour12}:${minutes}:${seconds} ${period}`;
                            })()}
                            {record.checkIn.late && (
                              <span className="text-red-600 ml-2 text-xs">
                                (متأخر {record.checkIn.lateMinutes}د)
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {record.checkOut && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">🏁 انصراف:</span>
                          <span className="font-semibold text-gray-800">
                            {(() => {
                              const [hours, minutes, seconds] = record.checkOut.time.split(':');
                              const hour = parseInt(hours);
                              const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                              return `${hour12}:${minutes}:${seconds} ${period}`;
                            })()}
                          </span>
                        </div>
                      )}
                      {record.calculations && (
                        <div className="flex items-center justify-between pt-1 border-t border-gray-200 mt-1">
                          <span className="text-gray-600">⏱️ الإجمالي:</span>
                          <span className="font-semibold text-blue-600">
                            {record.calculations.totalHours} ساعة
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
