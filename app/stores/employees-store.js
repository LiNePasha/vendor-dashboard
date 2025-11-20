/**
 * 🗄️ Employees Global State Management
 * Zustand store with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { employeesStorage } from '@/app/lib/employees-storage';
import {
  getCurrentEgyptTime,
  getTodayEgypt,
  getCurrentTimeOnly,
  calculateLateMinutes,
  calculateEarlyMinutes,
  calculateActualWorkHours,
  calculateOvertimeMinutes,
  isWorkDay,
  getDayName,
  getTotalWorkDays,
  generateEmployeeId,
  generateAttendanceId,
  generatePayrollId,
  generateAdvanceId,
  generateLeaveId,
  formatEgyptTime
} from '@/app/lib/time-helpers';

const useEmployeesStore = create(
  persist(
    (set, get) => ({
      // =====================================================
      // 📊 STATE
      // =====================================================
      
      employees: [],
      selectedEmployee: null,
      attendance: [],
      todayAttendance: [],
      payrolls: [],
      advances: [],
      leaves: [],
      
      loading: false,
      error: null,
      
      // =====================================================
      // 👥 EMPLOYEES ACTIONS
      // =====================================================
      
      /**
       * Load all employees from storage
       */
      loadEmployees: async () => {
        set({ loading: true, error: null });
        try {
          const employees = await employeesStorage.getAllEmployees();
          set({ employees, loading: false });
          return employees;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Add new employee
       */
      addEmployee: async (employeeData) => {
        set({ loading: true, error: null });
        try {
          const employee = {
            id: generateEmployeeId(),
            ...employeeData,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await employeesStorage.saveEmployee(employee);
          
          // 📝 تسجيل في Audit Log
          try {
            const { logEmployeeCreated } = await import('@/app/lib/audit-logger');
            const result = await logEmployeeCreated(employee);
            console.log('✅ Employee creation logged:', result);
          } catch (err) {
            console.error('❌ Failed to log employee creation:', err);
          }
          
          set((state) => ({
            employees: [employee, ...state.employees],
            loading: false
          }));
          
          return employee;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Update employee
       */
      updateEmployee: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const employee = await employeesStorage.getEmployee(id);
          if (!employee) throw new Error('الموظف غير موجود');
          
          const updated = {
            ...employee,
            ...updates,
            updatedAt: new Date().toISOString()
          };
          
          await employeesStorage.saveEmployee(updated);
          
          // 📝 تسجيل في Audit Log
          try {
            const { logEmployeeUpdated } = await import('@/app/lib/audit-logger');
            await logEmployeeUpdated(employee, updated);
          } catch (err) {
            console.error('Failed to log employee update:', err);
          }
          
          set((state) => ({
            employees: state.employees.map((emp) =>
              emp.id === id ? updated : emp
            ),
            selectedEmployee: state.selectedEmployee?.id === id ? updated : state.selectedEmployee,
            loading: false
          }));
          
          return updated;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Delete employee (soft delete - set status to inactive)
       */
      deleteEmployee: async (id) => {
        const employee = await employeesStorage.getEmployee(id);
        if (!employee) throw new Error('الموظف غير موجود');
        
        // 📝 تسجيل في Audit Log قبل الحذف
        try {
          const { logEmployeeDeleted } = await import('@/app/lib/audit-logger');
          await logEmployeeDeleted(employee);
        } catch (err) {
          console.error('Failed to log employee deletion:', err);
        }
        
        return get().updateEmployee(id, { status: 'inactive' });
      },
      
      /**
       * Set selected employee
       */
      setSelectedEmployee: (employee) => {
        set({ selectedEmployee: employee });
      },
      
      /**
       * Search employees
       */
      searchEmployees: async (query) => {
        set({ loading: true, error: null });
        try {
          const results = await employeesStorage.searchEmployees(query);
          set({ loading: false });
          return results;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Get active employees only
       */
      getActiveEmployees: () => {
        return get().employees.filter((emp) => emp.status === 'active');
      },
      
      // =====================================================
      // ⏰ ATTENDANCE ACTIONS
      // =====================================================
      
      /**
       * Load today's attendance
       */
      loadTodayAttendance: async () => {
        set({ loading: true, error: null });
        try {
          const records = await employeesStorage.getTodayAttendance();
          set({ todayAttendance: records, loading: false });
          return records;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Load attendance for specific period
       */
      loadAttendance: async (employeeId = null, month = null, year = null) => {
        set({ loading: true, error: null });
        try {
          let records;
          if (employeeId) {
            records = await employeesStorage.getAttendanceByEmployee(employeeId, month, year);
          } else {
            records = await employeesStorage.getAllAttendance();
          }
          set({ attendance: records, loading: false });
          return records;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Validate attendance before recording
       */
      validateAttendance: async (employeeId, date, type) => {
        // Get employee
        const employee = get().employees.find((e) => e.id === employeeId);
        if (!employee) throw new Error('الموظف غير موجود');
        if (employee.status !== 'active') throw new Error('الموظف غير نشط');
        
        // Check if it's a work day
        const dayName = getDayName(date);
        if (!employee.workSchedule?.workDays?.includes(dayName)) {
          throw new Error('هذا اليوم ليس يوم عمل للموظف');
        }
        
        // Check for existing record
        const existing = await employeesStorage.getAttendanceByDate(date, employeeId);
        
        if (type === 'check-in') {
          if (existing.length > 0 && existing[0].checkIn) {
            throw new Error('تم تسجيل الحضور مسبقاً لهذا اليوم');
          }
        }
        
        if (type === 'check-out') {
          if (existing.length === 0 || !existing[0].checkIn) {
            throw new Error('يجب تسجيل الحضور أولاً');
          }
          if (existing[0].checkOut) {
            throw new Error('تم تسجيل الانصراف مسبقاً لهذا اليوم');
          }
        }
        
        return { employee, existing: existing[0] };
      },
      
      /**
       * Clock in (تسجيل حضور)
       */
      clockIn: async (employeeId, note = '') => {
        set({ loading: true, error: null });
        try {
          const date = getTodayEgypt();
          const currentTime = getCurrentEgyptTime();
          
          // Validate
          const { employee } = await get().validateAttendance(employeeId, date, 'check-in');
          
          // Calculate late
          const { late, lateMinutes, gracePeriodUsed } = calculateLateMinutes(
            employee.workSchedule.startTime,
            currentTime,
            employee.workSchedule.gracePeriod
          );
          
          // Create attendance record
          const attendance = {
            id: generateAttendanceId(date),
            employeeId,
            date,
            dayName: getDayName(date),
            isWorkDay: true,
            
            checkIn: {
              time: getCurrentTimeOnly(),
              timestamp: currentTime.toISOString(),
              localTime: formatEgyptTime(currentTime, 'HH:mm:ss'),
              late,
              lateMinutes,
              gracePeriodUsed,
              note,
              recordedBy: 'self',
              method: 'manual'
            },
            
            checkOut: null,
            
            calculations: null,
            
            status: 'present',
            permissionDetails: null,
            adminNotes: '',
            
            flags: {
              missingCheckOut: false,
              manualEntry: false,
              edited: false,
              disputed: false
            },
            
            timezone: 'Africa/Cairo',
            createdAt: currentTime.toISOString(),
            updatedAt: currentTime.toISOString(),
            createdBy: employeeId,
            updatedBy: null
          };
          
          await employeesStorage.saveAttendance(attendance);
          
          // 📝 تسجيل في Audit Log
          try {
            const { logAttendanceRecorded } = await import('@/app/lib/audit-logger');
            const result = await logAttendanceRecorded({
              ...attendance,
              employeeName: employee.name
            });
            console.log('✅ Check-in logged:', result);
          } catch (err) {
            console.error('❌ Failed to log check-in:', err);
          }
          
          set((state) => ({
            attendance: [attendance, ...state.attendance],
            todayAttendance: [attendance, ...state.todayAttendance],
            loading: false
          }));
          
          return attendance;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Clock out (تسجيل انصراف)
       */
      clockOut: async (employeeId, note = '') => {
        set({ loading: true, error: null });
        try {
          const date = getTodayEgypt();
          const currentTime = getCurrentEgyptTime();
          
          // Validate
          const { employee, existing } = await get().validateAttendance(employeeId, date, 'check-out');
          
          // Calculate early leave
          const { early, earlyMinutes } = calculateEarlyMinutes(
            employee.workSchedule.endTime,
            currentTime
          );
          
          // Calculate overtime
          const overtimeMinutes = calculateOvertimeMinutes(
            employee.workSchedule.endTime,
            currentTime
          );
          
          // Calculate work hours
          const checkInTime = new Date(existing.checkIn.timestamp);
          const workHours = calculateActualWorkHours(checkInTime, currentTime);
          
          // Update record
          const updated = {
            ...existing,
            checkOut: {
              time: getCurrentTimeOnly(),
              timestamp: currentTime.toISOString(),
              localTime: formatEgyptTime(currentTime, 'HH:mm:ss'),
              early,
              earlyMinutes,
              note,
              recordedBy: 'self',
              method: 'manual'
            },
            
            calculations: {
              totalMinutes: workHours.totalMinutes,
              totalHours: workHours.totalHours,
              regularHours: workHours.regularHours,
              overtimeMinutes,
              overtimeHours: workHours.overtimeHours,
              breakMinutes: 0,
              actualWorkMinutes: workHours.totalMinutes
            },
            
            updatedAt: currentTime.toISOString()
          };
          
          await employeesStorage.saveAttendance(updated);
          
          // 📝 تسجيل في Audit Log
          try {
            const { logAttendanceRecorded } = await import('@/app/lib/audit-logger');
            await logAttendanceRecorded({
              ...updated,
              employeeName: employee.name
            });
          } catch (err) {
            console.error('Failed to log check-out:', err);
          }
          
          set((state) => ({
            attendance: state.attendance.map((att) =>
              att.id === existing.id ? updated : att
            ),
            todayAttendance: state.todayAttendance.map((att) =>
              att.id === existing.id ? updated : att
            ),
            loading: false
          }));
          
          return updated;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Get employee attendance stats
       */
      getEmployeeStats: async (employeeId, month, year) => {
        try {
          const records = await employeesStorage.getAttendanceByEmployee(employeeId, month, year);
          const employee = get().employees.find((e) => e.id === employeeId);
          
          if (!employee) return null;
          
          const totalWorkDays = getTotalWorkDays(month, year, employee.workSchedule.workDays);
          
          const stats = {
            totalWorkDays,
            totalDays: records.length,
            presentDays: records.filter((r) => r.status === 'present').length,
            absentDays: totalWorkDays - records.filter((r) => r.status === 'present').length,
            lateDays: records.filter((r) => r.checkIn?.late).length,
            totalLateMinutes: records.reduce((sum, r) => sum + (r.checkIn?.lateMinutes || 0), 0),
            permissionDays: records.filter((r) => r.status === 'permission').length,
            sickLeaveDays: records.filter((r) => r.status === 'sick_leave').length,
            annualLeaveDays: records.filter((r) => r.status === 'annual_leave').length,
            totalOvertimeMinutes: records.reduce((sum, r) => sum + (r.calculations?.overtimeMinutes || 0), 0),
            totalWorkHours: records.reduce((sum, r) => sum + (r.calculations?.totalHours || 0), 0)
          };
          
          return stats;
        } catch (error) {
          console.error('Error getting employee stats:', error);
          return null;
        }
      },
      
      // =====================================================
      // 💰 PAYROLL ACTIONS
      // =====================================================
      
      /**
       * Generate payroll for employee
       */
      generatePayroll: async (employeeId, month, year, manualData = {}) => {
        set({ loading: true, error: null });
        try {
          const employee = get().employees.find((e) => e.id === employeeId);
          if (!employee) throw new Error('الموظف غير موجود');
          
          const stats = await get().getEmployeeStats(employeeId, month, year);
          if (!stats) throw new Error('لا توجد بيانات حضور');
          
          // Get pending advances
          const pendingAdvances = await employeesStorage.getPendingAdvances(employeeId);
          const advanceDeduction = pendingAdvances.reduce(
            (sum, adv) => sum + adv.installments.amount,
            0
          );
          
          // Calculate suggestions
          const dailySalary = employee.basicSalary / stats.totalWorkDays;
          const suggestedAbsentDeduction = dailySalary * stats.absentDays;
          const suggestedLateDeduction = Math.ceil(stats.totalLateMinutes / 15) * 10;
          
          // Create payroll
          const payroll = {
            id: generatePayrollId(month, year),
            employeeId,
            month,
            year,
            period: `${year}-${month.toString().padStart(2, '0')}-01 to ${year}-${month.toString().padStart(2, '0')}-${stats.totalWorkDays}`,
            
            attendanceSummary: stats,
            
            suggestions: {
              absentDeduction: parseFloat(suggestedAbsentDeduction.toFixed(2)),
              lateDeduction: parseFloat(suggestedLateDeduction.toFixed(2)),
              advanceDeduction: parseFloat(advanceDeduction.toFixed(2)),
              bonusSuggestion: 0
            },
            
            earnings: {
              basicSalary: employee.basicSalary,
              allowances: employee.allowances || 0,
              bonuses: manualData.bonuses || 0,
              overtimePay: manualData.overtimePay || 0,
              total: 0
            },
            
            deductions: {
              absentDeduction: manualData.absentDeduction ?? 0,
              lateDeduction: manualData.lateDeduction ?? 0,
              advanceDeduction: manualData.advanceDeduction ?? advanceDeduction,
              otherDeductions: manualData.otherDeductions || 0,
              total: 0
            },
            
            netSalary: 0,
            
            status: 'pending',
            paidDate: null,
            paymentMethod: null,
            notes: manualData.notes || '',
            
            createdBy: 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Calculate totals
          payroll.earnings.total = Object.values(payroll.earnings).reduce((sum, val) => 
            typeof val === 'number' ? sum + val : sum, 0
          );
          
          payroll.deductions.total = Object.values(payroll.deductions).reduce((sum, val) => 
            typeof val === 'number' ? sum + val : sum, 0
          );
          
          payroll.netSalary = parseFloat((payroll.earnings.total - payroll.deductions.total).toFixed(2));
          
          await employeesStorage.savePayroll(payroll);
          
          set((state) => ({
            payrolls: [payroll, ...state.payrolls],
            loading: false
          }));
          
          return payroll;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Load payrolls
       */
      loadPayrolls: async (month = null, year = null) => {
        set({ loading: true, error: null });
        try {
          const payrolls = await employeesStorage.getAllPayrolls(month, year);
          set({ payrolls, loading: false });
          return payrolls;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      /**
       * Update payroll
       */
      updatePayroll: async (id, updates) => {
        set({ loading: true, error: null });
        try {
          const payroll = await employeesStorage.getPayroll(id);
          if (!payroll) throw new Error('كشف الراتب غير موجود');
          
          const updated = {
            ...payroll,
            ...updates,
            updatedAt: new Date().toISOString()
          };
          
          // Recalculate if earnings or deductions changed
          if (updates.earnings || updates.deductions) {
            updated.earnings.total = Object.values(updated.earnings).reduce((sum, val) => 
              typeof val === 'number' ? sum + val : sum, 0
            );
            
            updated.deductions.total = Object.values(updated.deductions).reduce((sum, val) => 
              typeof val === 'number' ? sum + val : sum, 0
            );
            
            updated.netSalary = parseFloat((updated.earnings.total - updated.deductions.total).toFixed(2));
          }
          
          await employeesStorage.savePayroll(updated);
          
          set((state) => ({
            payrolls: state.payrolls.map((p) => (p.id === id ? updated : p)),
            loading: false
          }));
          
          return updated;
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },
      
      // =====================================================
      // 🔄 UTILITY ACTIONS
      // =====================================================
      
      /**
       * Clear error
       */
      clearError: () => set({ error: null }),
      
      /**
       * Reset store
       */
      reset: () => set({
        employees: [],
        selectedEmployee: null,
        attendance: [],
        todayAttendance: [],
        payrolls: [],
        advances: [],
        leaves: [],
        loading: false,
        error: null
      })
    }),
    {
      name: 'employees-storage',
      partialize: (state) => ({
        // Only persist essential data
        employees: state.employees,
        selectedEmployee: state.selectedEmployee
      })
    }
  )
);

export default useEmployeesStore;
