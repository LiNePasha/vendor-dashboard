/**
 * 💾 Employees Storage Manager
 * LocalForage-based storage for employee management system
 * Handles: Employees, Attendance, Payroll, Advances, Leaves
 */

import localforage from 'localforage';

// =====================================================
// 🗄️ Storage Instances
// =====================================================

const employeesDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'employees',
  description: 'Employee records'
});

const attendanceDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'attendance',
  description: 'Attendance records (check-in/out)'
});

const payrollDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'payroll',
  description: 'Monthly payroll records'
});

const advancesDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'advances',
  description: 'Employee advances and loans'
});

const leavesDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'leaves',
  description: 'Leave requests and permissions'
});

const deductionsDB = localforage.createInstance({
  name: 'Spare2App',
  storeName: 'deductions',
  description: 'Manual deductions (penalties, advances, etc.)'
});

// =====================================================
// 👥 EMPLOYEES CRUD
// =====================================================

export const employeesStorage = {
  
  // ===== Employees =====
  
  async saveEmployee(employee) {
    try {
      if (!employee.id) {
        throw new Error('Employee ID is required');
      }
      
      employee.updatedAt = new Date().toISOString();
      
      if (!employee.createdAt) {
        employee.createdAt = new Date().toISOString();
      }
      
      await employeesDB.setItem(employee.id, employee);
      return employee;
    } catch (error) {
      console.error('Error saving employee:', error);
      throw error;
    }
  },
  
  async getEmployee(id) {
    try {
      return await employeesDB.getItem(id);
    } catch (error) {
      console.error('Error getting employee:', error);
      return null;
    }
  },
  
  async getAllEmployees() {
    try {
      const employees = [];
      await employeesDB.iterate((value) => {
        employees.push(value);
      });
      
      // Sort by creation date (newest first)
      return employees.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      console.error('Error getting all employees:', error);
      return [];
    }
  },
  
  async getActiveEmployees() {
    try {
      const all = await this.getAllEmployees();
      return all.filter(emp => emp.status === 'active');
    } catch (error) {
      console.error('Error getting active employees:', error);
      return [];
    }
  },
  
  async deleteEmployee(id) {
    try {
      await employeesDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  },
  
  async searchEmployees(query) {
    try {
      const all = await this.getAllEmployees();
      const lowerQuery = query.toLowerCase();
      
      return all.filter(emp => 
        emp.name.toLowerCase().includes(lowerQuery) ||
        emp.id.toLowerCase().includes(lowerQuery) ||
        emp.nationalId?.includes(query) ||
        emp.phone?.includes(query)
      );
    } catch (error) {
      console.error('Error searching employees:', error);
      return [];
    }
  },
  
  // ===== Attendance =====
  
  async saveAttendance(attendance) {
    try {
      if (!attendance.id) {
        throw new Error('Attendance ID is required');
      }
      
      attendance.updatedAt = new Date().toISOString();
      
      if (!attendance.createdAt) {
        attendance.createdAt = new Date().toISOString();
      }
      
      await attendanceDB.setItem(attendance.id, attendance);
      return attendance;
    } catch (error) {
      console.error('Error saving attendance:', error);
      throw error;
    }
  },
  
  async getAttendance(id) {
    try {
      return await attendanceDB.getItem(id);
    } catch (error) {
      console.error('Error getting attendance:', error);
      return null;
    }
  },
  
  async getAllAttendance() {
    try {
      const records = [];
      await attendanceDB.iterate((value) => {
        records.push(value);
      });
      
      // Sort by date (newest first)
      return records.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
    } catch (error) {
      console.error('Error getting all attendance:', error);
      return [];
    }
  },
  
  async getAttendanceByEmployee(employeeId, month = null, year = null) {
    try {
      const all = await this.getAllAttendance();
      let filtered = all.filter(att => att.employeeId === employeeId);
      
      if (month !== null && year !== null) {
        filtered = filtered.filter(att => {
          const date = new Date(att.date);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
      }
      
      return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (error) {
      console.error('Error getting employee attendance:', error);
      return [];
    }
  },
  
  async getAttendanceByDate(date, employeeId = null) {
    try {
      const all = await this.getAllAttendance();
      let filtered = all.filter(att => att.date === date);
      
      if (employeeId) {
        filtered = filtered.filter(att => att.employeeId === employeeId);
      }
      
      return filtered;
    } catch (error) {
      console.error('Error getting attendance by date:', error);
      return [];
    }
  },
  
  async getTodayAttendance() {
    try {
      const today = new Date().toISOString().split('T')[0];
      return await this.getAttendanceByDate(today);
    } catch (error) {
      console.error('Error getting today attendance:', error);
      return [];
    }
  },
  
  async deleteAttendance(id) {
    try {
      await attendanceDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting attendance:', error);
      throw error;
    }
  },
  
  // ===== Payroll =====
  
  async savePayroll(payroll) {
    try {
      if (!payroll.id) {
        throw new Error('Payroll ID is required');
      }
      
      payroll.updatedAt = new Date().toISOString();
      
      if (!payroll.createdAt) {
        payroll.createdAt = new Date().toISOString();
      }
      
      await payrollDB.setItem(payroll.id, payroll);
      return payroll;
    } catch (error) {
      console.error('Error saving payroll:', error);
      throw error;
    }
  },
  
  async getPayroll(id) {
    try {
      return await payrollDB.getItem(id);
    } catch (error) {
      console.error('Error getting payroll:', error);
      return null;
    }
  },
  
  async getAllPayrolls(month = null, year = null) {
    try {
      const records = [];
      await payrollDB.iterate((value) => {
        records.push(value);
      });
      
      let filtered = records;
      
      if (month !== null && year !== null) {
        filtered = records.filter(p => p.month === month && p.year === year);
      }
      
      return filtered.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      });
    } catch (error) {
      console.error('Error getting all payrolls:', error);
      return [];
    }
  },
  
  async getPayrollByEmployee(employeeId, month = null, year = null) {
    try {
      const all = await this.getAllPayrolls(month, year);
      return all.filter(p => p.employeeId === employeeId);
    } catch (error) {
      console.error('Error getting employee payroll:', error);
      return [];
    }
  },
  
  async deletePayroll(id) {
    try {
      await payrollDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting payroll:', error);
      throw error;
    }
  },
  
  // ===== Advances =====
  
  async saveAdvance(advance) {
    try {
      if (!advance.id) {
        throw new Error('Advance ID is required');
      }
      
      advance.updatedAt = new Date().toISOString();
      
      if (!advance.createdAt) {
        advance.createdAt = new Date().toISOString();
      }
      
      await advancesDB.setItem(advance.id, advance);
      return advance;
    } catch (error) {
      console.error('Error saving advance:', error);
      throw error;
    }
  },
  
  async getAdvance(id) {
    try {
      return await advancesDB.getItem(id);
    } catch (error) {
      console.error('Error getting advance:', error);
      return null;
    }
  },
  
  async getAllAdvances() {
    try {
      const records = [];
      await advancesDB.iterate((value) => {
        records.push(value);
      });
      
      return records.sort((a, b) => 
        new Date(b.requestDate) - new Date(a.requestDate)
      );
    } catch (error) {
      console.error('Error getting all advances:', error);
      return [];
    }
  },
  
  async getAdvancesByEmployee(employeeId) {
    try {
      const all = await this.getAllAdvances();
      return all.filter(adv => adv.employeeId === employeeId);
    } catch (error) {
      console.error('Error getting employee advances:', error);
      return [];
    }
  },
  
  async getPendingAdvances(employeeId = null) {
    try {
      const all = await this.getAllAdvances();
      let filtered = all.filter(adv => 
        adv.status === 'approved' && 
        adv.installments.remaining > 0
      );
      
      if (employeeId) {
        filtered = filtered.filter(adv => adv.employeeId === employeeId);
      }
      
      return filtered;
    } catch (error) {
      console.error('Error getting pending advances:', error);
      return [];
    }
  },
  
  async deleteAdvance(id) {
    try {
      await advancesDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting advance:', error);
      throw error;
    }
  },
  
  // ===== Leaves =====
  
  async saveLeave(leave) {
    try {
      if (!leave.id) {
        throw new Error('Leave ID is required');
      }
      
      leave.updatedAt = new Date().toISOString();
      
      if (!leave.createdAt) {
        leave.createdAt = new Date().toISOString();
      }
      
      await leavesDB.setItem(leave.id, leave);
      return leave;
    } catch (error) {
      console.error('Error saving leave:', error);
      throw error;
    }
  },
  
  async getLeave(id) {
    try {
      return await leavesDB.getItem(id);
    } catch (error) {
      console.error('Error getting leave:', error);
      return null;
    }
  },
  
  async getAllLeaves() {
    try {
      const records = [];
      await leavesDB.iterate((value) => {
        records.push(value);
      });
      
      return records.sort((a, b) => 
        new Date(b.startDate) - new Date(a.startDate)
      );
    } catch (error) {
      console.error('Error getting all leaves:', error);
      return [];
    }
  },
  
  async getLeavesByEmployee(employeeId) {
    try {
      const all = await this.getAllLeaves();
      return all.filter(leave => leave.employeeId === employeeId);
    } catch (error) {
      console.error('Error getting employee leaves:', error);
      return [];
    }
  },
  
  async deleteLeave(id) {
    try {
      await leavesDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting leave:', error);
      throw error;
    }
  },

  // ===== Deductions (Manual Deductions) =====
  
  async saveDeduction(deduction) {
    try {
      if (!deduction.id) {
        throw new Error('Deduction ID is required');
      }
      
      deduction.updatedAt = new Date().toISOString();
      
      if (!deduction.createdAt) {
        deduction.createdAt = new Date().toISOString();
      }
      
      await deductionsDB.setItem(deduction.id, deduction);
      return deduction;
    } catch (error) {
      console.error('Error saving deduction:', error);
      throw error;
    }
  },
  
  async getDeduction(id) {
    try {
      return await deductionsDB.getItem(id);
    } catch (error) {
      console.error('Error getting deduction:', error);
      return null;
    }
  },
  
  async getAllDeductions() {
    try {
      const deductions = [];
      await deductionsDB.iterate((value) => {
        deductions.push(value);
      });
      
      return deductions.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      console.error('Error getting all deductions:', error);
      return [];
    }
  },
  
  async getDeductionsByEmployee(employeeId, month, year) {
    try {
      const all = await this.getAllDeductions();
      return all.filter(ded => {
        const matchEmployee = ded.employeeId === employeeId;
        if (!month || !year) return matchEmployee;
        
        const dedDate = new Date(ded.date);
        return matchEmployee && 
               dedDate.getMonth() + 1 === month && 
               dedDate.getFullYear() === year;
      });
    } catch (error) {
      console.error('Error getting employee deductions:', error);
      return [];
    }
  },
  
  async deleteDeduction(id) {
    try {
      await deductionsDB.removeItem(id);
      return true;
    } catch (error) {
      console.error('Error deleting deduction:', error);
      throw error;
    }
  },
  
  // ===== Utility Functions =====
  
  async clearAllData() {
    try {
      await employeesDB.clear();
      await attendanceDB.clear();
      await payrollDB.clear();
      await advancesDB.clear();
      await leavesDB.clear();
      await deductionsDB.clear();
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  },
  
  async exportAllData() {
    try {
      const data = {
        employees: await this.getAllEmployees(),
        attendance: await this.getAllAttendance(),
        payrolls: await this.getAllPayrolls(),
        advances: await this.getAllAdvances(),
        leaves: await this.getAllLeaves(),
        exportedAt: new Date().toISOString()
      };
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  },
  
  async importData(data) {
    try {
      // Import employees
      if (data.employees) {
        for (const emp of data.employees) {
          await this.saveEmployee(emp);
        }
      }
      
      // Import attendance
      if (data.attendance) {
        for (const att of data.attendance) {
          await this.saveAttendance(att);
        }
      }
      
      // Import payrolls
      if (data.payrolls) {
        for (const pay of data.payrolls) {
          await this.savePayroll(pay);
        }
      }
      
      // Import advances
      if (data.advances) {
        for (const adv of data.advances) {
          await this.saveAdvance(adv);
        }
      }
      
      // Import leaves
      if (data.leaves) {
        for (const leave of data.leaves) {
          await this.saveLeave(leave);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
};

export default employeesStorage;
