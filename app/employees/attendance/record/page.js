"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import { employeesStorage } from "@/app/lib/employees-storage";
import {
  getCurrentEgyptTime,
  getTodayEgypt,
  formatEgyptTime,
  formatArabicTime,
  getTimeAgo,
  generateAttendanceId
} from "@/app/lib/time-helpers";
import { format } from "date-fns";

export default function AttendanceRecordPage() {
  const router = useRouter();
  
  const employees = useEmployeesStore((state) => state.employees);
  const getActiveEmployees = useEmployeesStore((state) => state.getActiveEmployees);
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees);
  const loadTodayAttendance = useEmployeesStore((state) => state.loadTodayAttendance);
  const todayAttendance = useEmployeesStore((state) => state.todayAttendance);
  
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionType, setActionType] = useState('check-in'); // check-in, check-out
  const [note, setNote] = useState('');
  const [currentTime, setCurrentTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // 🆕 Manual time selection
  const [selectedDate, setSelectedDate] = useState(formatEgyptTime(new Date(), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState(formatEgyptTime(new Date(), 'HH:mm'));

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

  // Calculate late warning based on selected time
  const getLateWarning = (employee, customDateTime) => {
    if (!employee || !customDateTime) return null;
    
    const workStartTime = employee.workSchedule?.startTime || '09:00';
    const gracePeriod = employee.workSchedule?.gracePeriod || 15;
    
    const [hours, minutes] = workStartTime.split(':');
    const date = formatEgyptTime(customDateTime, 'yyyy-MM-dd');
    const scheduledStart = new Date(`${date}T${hours}:${minutes}:00+02:00`);
    const graceEnd = new Date(scheduledStart.getTime() + gracePeriod * 60000);
    
    if (customDateTime > graceEnd) {
      const lateMinutes = Math.floor((customDateTime - scheduledStart) / 60000);
      return {
        late: true,
        lateMinutes,
        message: `⚠️ متأخر ${lateMinutes} دقيقة!`
      };
    }
    
    if (customDateTime > scheduledStart) {
      const usedMinutes = Math.floor((customDateTime - scheduledStart) / 60000);
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
  
  // Format time to 12-hour format with Arabic AM/PM
  const formatTimeTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'م' : 'ص';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };
  
  // Get combined date-time object
  const getSelectedDateTime = () => {
    if (!selectedDate || !selectedTime) return null;
    return new Date(`${selectedDate}T${selectedTime}:00+02:00`);
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

  // Handle record attendance (manual time)
  const handleRecord = async () => {
    if (!selectedEmployee) {
      showToast('الرجاء اختيار موظف', 'error');
      return;
    }
    
    if (!selectedDate || !selectedTime) {
      showToast('الرجاء اختيار التاريخ والوقت', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const customDateTime = getSelectedDateTime();
      const date = selectedDate;
      const timeOnly = selectedTime;
      
      // Check if employee already has attendance record for this date
      const existingRecords = await employeesStorage.getAttendanceByDate(date, selectedEmployee.id);
      
      if (actionType === 'check-in') {
        // Prevent duplicate check-in
        if (existingRecords && existingRecords.length > 0) {
          const existing = existingRecords[0];
          if (existing.checkIn) {
            showToast('⚠️ تم تسجيل حضور هذا الموظف مسبقاً في هذا التاريخ!', 'error');
            setLoading(false);
            return;
          }
        }
        
        // Calculate late status
        const { late, lateMinutes, gracePeriodUsed } = calculateLateMinutes(
          selectedEmployee.workSchedule?.startTime || '09:00',
          customDateTime,
          selectedEmployee.workSchedule?.gracePeriod || 15
        );
        
        // Create check-in record
        const attendance = {
          id: generateAttendanceId(date),
          employeeId: selectedEmployee.id,
          date,
          dayName: format(customDateTime, 'EEEE').toLowerCase(),
          isWorkDay: true,
          
          checkIn: {
            time: timeOnly,
            timestamp: customDateTime.toISOString(),
            localTime: formatEgyptTime(customDateTime, 'HH:mm:ss'),
            late,
            lateMinutes,
            gracePeriodUsed,
            note,
            recordedBy: 'manual',
            method: 'manual'
          },
          
          checkOut: null,
          calculations: null,
          status: 'present',
          permissionDetails: null,
          adminNotes: '',
          
          flags: {
            missingCheckOut: false,
            manualEntry: true,
            edited: false,
            disputed: false
          },
          
          timezone: 'Africa/Cairo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'admin',
          updatedBy: null
        };
        
        await employeesStorage.saveAttendance(attendance);
        
        // Log in audit
        try {
          const { logAttendanceRecorded } = await import('@/app/lib/audit-logger');
          await logAttendanceRecorded({
            ...attendance,
            employeeName: selectedEmployee.name
          });
        } catch (err) {
          console.error('Failed to log attendance:', err);
        }
        
        showToast(`✅ تم تسجيل حضور ${selectedEmployee.name} بنجاح!`);
        
      } else if (actionType === 'check-out') {
        // Use existing records already fetched above
        const existing = existingRecords[0];
        
        if (!existing || !existing.checkIn) {
          showToast('⚠️ يجب تسجيل الحضور أولاً قبل تسجيل الانصراف!', 'error');
          setLoading(false);
          return;
        }
        
        if (existing.checkOut) {
          showToast('⚠️ تم تسجيل انصراف هذا الموظف مسبقاً!', 'error');
          setLoading(false);
          return;
        }
        
        // Validate check-out time is after check-in time
        const checkInDateTime = new Date(existing.checkIn.timestamp);
        if (customDateTime <= checkInDateTime) {
          showToast('⚠️ وقت الانصراف يجب أن يكون بعد وقت الحضور!', 'error');
          setLoading(false);
          return;
        }
        
        // Calculate early leave
        const workEndTime = selectedEmployee.workSchedule?.endTime || '17:00';
        const [endHours, endMinutes] = workEndTime.split(':');
        const scheduledEnd = new Date(`${date}T${endHours}:${endMinutes}:00+02:00`);
        
        const early = customDateTime < scheduledEnd;
        const earlyMinutes = early ? Math.floor((scheduledEnd - customDateTime) / 60000) : 0;
        
        // Calculate overtime
        const overtimeMinutes = !early ? Math.floor((customDateTime - scheduledEnd) / 60000) : 0;
        
        // Calculate work hours
        const totalMinutes = Math.floor((customDateTime - checkInDateTime) / 60000);
        const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
        
        // Update record
        const updated = {
          ...existing,
          checkOut: {
            time: timeOnly,
            timestamp: customDateTime.toISOString(),
            localTime: formatEgyptTime(customDateTime, 'HH:mm:ss'),
            early,
            earlyMinutes,
            note,
            recordedBy: 'manual',
            method: 'manual'
          },
          
          calculations: {
            totalMinutes,
            totalHours,
            regularHours: totalHours,
            overtimeMinutes,
            overtimeHours: parseFloat((overtimeMinutes / 60).toFixed(2)),
            breakMinutes: 0,
            actualWorkMinutes: totalMinutes
          },
          
          updatedAt: new Date().toISOString()
        };
        
        await employeesStorage.saveAttendance(updated);
        
        // Log in audit
        try {
          const { logAttendanceRecorded } = await import('@/app/lib/audit-logger');
          await logAttendanceRecorded({
            ...updated,
            employeeName: selectedEmployee.name
          });
        } catch (err) {
          console.error('Failed to log attendance:', err);
        }
        
        showToast(`✅ تم تسجيل انصراف ${selectedEmployee.name} بنجاح!`);
      }
      
      // Reload today's attendance
      await loadTodayAttendance();
      
      // Reset form
      setSelectedEmployee(null);
      setNote('');
      setActionType('check-in');
      setSelectedDate(formatEgyptTime(new Date(), 'yyyy-MM-dd'));
      setSelectedTime(formatEgyptTime(new Date(), 'HH:mm'));
      
    } catch (error) {
      showToast(error.message || 'حدث خطأ أثناء التسجيل', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to calculate late minutes
  const calculateLateMinutes = (startTime, arrivalTime, gracePeriod) => {
    const [hours, minutes] = startTime.split(':');
    const date = formatEgyptTime(arrivalTime, 'yyyy-MM-dd');
    const scheduledStart = new Date(`${date}T${hours}:${minutes}:00+02:00`);
    const graceEnd = new Date(scheduledStart.getTime() + gracePeriod * 60000);
    
    if (arrivalTime <= scheduledStart) {
      return { late: false, lateMinutes: 0, gracePeriodUsed: false };
    }
    
    if (arrivalTime <= graceEnd) {
      const usedMinutes = Math.floor((arrivalTime - scheduledStart) / 60000);
      return { late: false, lateMinutes: 0, gracePeriodUsed: true, gracePeriodMinutes: usedMinutes };
    }
    
    const lateMinutes = Math.floor((arrivalTime - scheduledStart) / 60000);
    return { late: true, lateMinutes, gracePeriodUsed: true };
  };

  // Filter employees by search
  const activeEmployees = getActiveEmployees();
  const filteredEmployees = searchQuery
    ? activeEmployees.filter((emp) =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeEmployees;

  const selectedDateTime = getSelectedDateTime();
  const lateWarning = selectedEmployee && selectedDateTime ? getLateWarning(selectedEmployee, selectedDateTime) : null;
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
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span>⏰</span>
              <span>تسجيل الحضور والانصراف</span>
            </h1>
            <p className="text-gray-500 mt-2">
              سجل حضور وانصراف الموظفين بمرونة كاملة - اختر الموظف والتاريخ والوقت
            </p>
          </div>
          <button
            onClick={() => router.push('/employees')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors font-semibold"
          >
            ← رجوع
          </button>
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
                        {formatTimeTo12Hour(selectedEmployee.workSchedule?.startTime || '09:00')}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">🏁 الانتهاء</div>
                      <div className="font-semibold text-gray-800">
                        {formatTimeTo12Hour(selectedEmployee.workSchedule?.endTime || '17:00')}
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

              {/* Date & Time Selection */}
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-3">
                  📅 التاريخ والوقت
                </label>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Date */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">التاريخ</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Time */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">الوقت</label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Preview */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
                  <div className="text-center">
                    <div className="text-sm opacity-90 mb-1">⏰ الوقت المحدد</div>
                    <div className="text-3xl font-bold">
                      {selectedTime ? formatTimeTo12Hour(selectedTime) : '--:--'}
                    </div>
                    <div className="text-sm opacity-90 mt-1">
                      {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'اختر التاريخ'}
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-2 text-center">
                  ص = صباحاً (AM) | م = مساءً (PM)
                </p>
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
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-5 mb-6 shadow-md">
                <div className="font-bold text-yellow-900 mb-3 flex items-center gap-2 text-lg">
                  <span>📋</span>
                  <span>ملخص التسجيل</span>
                </div>
                <div className="space-y-2 text-sm text-yellow-800">
                  <div className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                    <span className="font-medium">نوع التسجيل:</span>
                    <strong className={actionType === 'check-in' ? 'text-blue-700' : 'text-green-700'}>
                      {actionType === 'check-in' ? '✅ حضور' : '🏁 انصراف'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                    <span className="font-medium">التاريخ:</span>
                    <strong className="text-gray-900">
                      {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : '-'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                    <span className="font-medium">الوقت:</span>
                    <strong className="text-purple-700 text-lg">
                      {selectedTime ? formatTimeTo12Hour(selectedTime) : '--:--'}
                    </strong>
                  </div>
                  {actionType === 'check-in' && lateWarning?.late && (
                    <div className="flex items-center justify-between bg-red-100 border border-red-300 rounded-lg p-2">
                      <span className="font-medium text-red-700">⚠️ التأخير:</span>
                      <strong className="text-red-800">{lateWarning.lateMinutes} دقيقة</strong>
                    </div>
                  )}
                  {note && (
                    <div className="bg-white/50 rounded-lg p-2">
                      <span className="font-medium">💬 الملاحظة:</span>
                      <p className="text-gray-700 mt-1">{note}</p>
                    </div>
                  )}
                </div>
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
                              const [hours, minutes] = record.checkIn.time.split(':');
                              const hour = parseInt(hours);
                              const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                              return `${hour12}:${minutes} ${period}`;
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
                              const [hours, minutes] = record.checkOut.time.split(':');
                              const hour = parseInt(hours);
                              const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                              const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                              return `${hour12}:${minutes} ${period}`;
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
