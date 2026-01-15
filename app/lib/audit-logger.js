"use client";

import localforage from 'localforage';

// قاعدة بيانات منفصلة تماماً للـ Audit Log - لا تُمسح أبداً
const auditDB = localforage.createInstance({
  name: 'spare2app-audit',
  storeName: 'audit_logs',
  description: 'Permanent audit trail - NEVER DELETE'
});

// ===== محرك التسجيل الرئيسي =====
export const auditLogger = {
  /**
   * تسجيل عملية في Audit Log
   * @param {Object} entry - بيانات العملية
   * @returns {Promise<Object>} - نتيجة العملية
   */
  async log(entry) {
    try {
      const id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      const fullEntry = {
        id,
        timestamp,
        ...entry
      };
      
      // حفظ في القاعدة
      const logs = await this.getAllLogs();
      logs.push(fullEntry);
      await auditDB.setItem('logs', logs);
      
      return { success: true, id };
    } catch (error) {
      console.error('Audit log error:', error);
      // لا نرمي خطأ - التسجيل يجب أن يكون صامت
      return { success: false, error };
    }
  },

  /**
   * جلب كل السجلات
   * @returns {Promise<Array>} - كل السجلات
   */
  async getAllLogs() {
    const logs = await auditDB.getItem('logs');
    return logs || [];
  },

  /**
   * فلترة السجلات
   * @param {Object} filters - الفلاتر
   * @returns {Promise<Array>} - السجلات المفلترة
   */
  async filterLogs(filters = {}) {
    const logs = await this.getAllLogs();
    let filtered = logs;
    
    // فلتر حسب الفئة
    if (filters.category) {
      filtered = filtered.filter(log => log.category === filters.category);
    }
    
    // فلتر حسب التاريخ
    if (filters.startDate) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) >= new Date(filters.startDate)
      );
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => 
        new Date(log.timestamp) <= endDate
      );
    }
    
    // فلتر حسب الموظف
    if (filters.employeeId) {
      filtered = filtered.filter(log => 
        log.target?.id === filters.employeeId
      );
    }
    
    // فلتر حسب نوع العملية
    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }
    
    // فلتر حسب البحث النصي
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.description?.toLowerCase().includes(searchLower) ||
        log.target?.name?.toLowerCase().includes(searchLower) ||
        log.target?.id?.toLowerCase().includes(searchLower)
      );
    }
    
    // ترتيب من الأحدث للأقدم
    filtered.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    return filtered;
  },

  /**
   * إحصائيات السجلات
   * @param {Object} filters - الفلاتر
   * @returns {Promise<Object>} - الإحصائيات
   */
  async getStats(filters = {}) {
    const logs = await this.filterLogs(filters);
    
    const stats = {
      total: logs.length,
      byCategory: {},
      byAction: {},
      byDate: {},
      byPerformer: {}
    };
    
    logs.forEach(log => {
      // حسب الفئة
      stats.byCategory[log.category] = 
        (stats.byCategory[log.category] || 0) + 1;
      
      // حسب العملية
      stats.byAction[log.action] = 
        (stats.byAction[log.action] || 0) + 1;
      
      // حسب التاريخ
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
      
      // حسب المستخدم
      const performer = log.performedBy?.name || 'Unknown';
      stats.byPerformer[performer] = (stats.byPerformer[performer] || 0) + 1;
    });
    
    return stats;
  },

  /**
   * ⚠️ مسح كل السجلات (استخدام حذر جداً!)
   * @returns {Promise<Object>} - نتيجة العملية
   */
  async clearAll() {
    // تحذير: هذه العملية خطرة!
    const confirmed = confirm(
      '⚠️ تحذير: هل أنت متأكد من حذف كل سجلات التدقيق؟\n' +
      'هذا سيؤدي لفقدان كل السجل التاريخي للنظام!\n\n' +
      'اضغط OK للمتابعة أو Cancel للإلغاء'
    );
    
    if (!confirmed) return { cancelled: true };
    
    await auditDB.setItem('logs', []);
    
    // تسجيل عملية المسح نفسها!
    await this.log({
      category: 'system',
      action: 'audit_cleared',
      description: '🚨 تم مسح كل سجلات التدقيق',
      target: { type: 'system', id: 'audit_logs' },
      data: { before: 'all_logs', after: 'empty' },
      performedBy: { type: 'admin', name: 'System Admin' }
    });
    
    return { success: true };
  }
};

// ===== دوال مساعدة سريعة للموظفين =====

/**
 * تسجيل إضافة موظف جديد
 */
export const logEmployeeCreated = async (employee) => {
  return await auditLogger.log({
    category: 'employees',
    action: 'employee_created',
    description: `تم إضافة موظف جديد: ${employee.name}`,
    target: {
      type: 'employee',
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode
    },
    data: {
      before: null,
      after: employee
    },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل تعديل بيانات موظف
 */
export const logEmployeeUpdated = async (before, after, changedFields = null) => {
  // حساب الحقول المتغيرة إذا لم يتم تمريرها
  const changes = changedFields || {};
  if (!changedFields) {
    Object.keys(after).forEach(key => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = { before: before[key], after: after[key] };
      }
    });
  }
  
  return await auditLogger.log({
    category: 'employees',
    action: 'employee_updated',
    description: `تم تعديل بيانات الموظف: ${after.name}`,
    target: {
      type: 'employee',
      id: after.id,
      name: after.name,
      employeeCode: after.employeeCode
    },
    data: { before, after },
    changes,
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل حذف موظف
 */
export const logEmployeeDeleted = async (employee) => {
  return await auditLogger.log({
    category: 'employees',
    action: 'employee_deleted',
    description: `تم حذف الموظف: ${employee.name}`,
    target: {
      type: 'employee',
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode
    },
    data: {
      before: employee,
      after: null
    },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل حذف جميع الموظفين
 */
export const logAllEmployeesDeleted = async (count, employees = []) => {
  return await auditLogger.log({
    category: 'employees',
    action: 'all_employees_deleted',
    description: `🚨 تم حذف جميع الموظفين (${count} موظف)`,
    target: {
      type: 'system',
      id: 'all_employees'
    },
    data: {
      before: { count, employees: employees.map(e => ({ id: e.id, name: e.name })) },
      after: { count: 0 }
    },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

// ===== دوال مساعدة للحضور =====

/**
 * تسجيل حضور/انصراف
 */
export const logAttendanceRecorded = async (record) => {
  return await auditLogger.log({
    category: 'attendance',
    action: record.checkOut ? 'checkout_recorded' : 'checkin_recorded',
    description: record.checkOut 
      ? `تسجيل انصراف: ${record.employeeName}`
      : `تسجيل حضور: ${record.employeeName}`,
    target: {
      type: 'employee',
      id: record.employeeId,
      name: record.employeeName
    },
    data: { after: record },
    performedBy: { type: 'system', name: 'Attendance System' }
  });
};

// ===== دوال مساعدة للخصومات =====

/**
 * تسجيل إضافة خصم
 */
export const logDeductionAdded = async (deduction) => {
  return await auditLogger.log({
    category: 'deductions',
    action: 'deduction_added',
    description: `إضافة خصم: ${deduction.type} - ${deduction.amount} ج.م للموظف ${deduction.employeeName}`,
    target: {
      type: 'employee',
      id: deduction.employeeId,
      name: deduction.employeeName
    },
    data: { after: deduction },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل تعديل خصم
 */
export const logDeductionUpdated = async (before, after) => {
  return await auditLogger.log({
    category: 'deductions',
    action: 'deduction_updated',
    description: `تعديل خصم: ${after.type} - ${after.amount} ج.م`,
    target: {
      type: 'employee',
      id: after.employeeId,
      name: after.employeeName
    },
    data: { before, after },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل حذف خصم
 */
export const logDeductionDeleted = async (deduction) => {
  return await auditLogger.log({
    category: 'deductions',
    action: 'deduction_deleted',
    description: `حذف خصم: ${deduction.type} - ${deduction.amount} ج.م`,
    target: {
      type: 'employee',
      id: deduction.employeeId,
      name: deduction.employeeName
    },
    data: { before: deduction, after: null },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

// ===== دوال مساعدة للمبيعات =====

/**
 * تسجيل فاتورة جديدة
 */
export const logSaleRecorded = async (invoice) => {
  // استخراج المبلغ الإجمالي من أماكن مختلفة محتملة
  const total = invoice.summary?.total || invoice.totalAmount || invoice.total || 0;
  const sellerName = invoice.soldBy?.employeeName || invoice.soldBy?.name || 'بدون بائع';
  
  return await auditLogger.log({
    category: 'sales',
    action: 'sale_recorded',
    description: `فاتورة جديدة: ${total.toFixed(2)} ج.م - ${sellerName}`,
    target: {
      type: 'invoice',
      id: invoice.id,
      name: `فاتورة #${invoice.id.slice(-8)}`
    },
    data: { 
      after: {
        id: invoice.id,
        total: total,
        items: invoice.items?.length || 0,
        services: invoice.services?.length || 0,
        paymentMethod: invoice.paymentMethod,
        soldBy: invoice.soldBy,
        summary: invoice.summary
      }
    },
    performedBy: {
      type: 'employee',
      id: invoice.soldBy?.employeeId || 'system',
      name: sellerName
    }
  });
};

// ===== دوال مساعدة للنظام =====

/**
 * تسجيل تصدير بيانات
 */
export const logDataExported = async (type, count) => {
  return await auditLogger.log({
    category: 'system',
    action: 'data_exported',
    description: `تم تصدير ${count} سجل من نوع: ${type}`,
    target: {
      type: 'system',
      id: 'data_export'
    },
    data: { after: { type, count } },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

/**
 * تسجيل تسجيل دخول/خروج
 */
export const logUserAuth = async (action, username) => {
  return await auditLogger.log({
    category: 'system',
    action: action, // 'login', 'logout'
    description: action === 'login' 
      ? `تسجيل دخول: ${username}`
      : `تسجيل خروج: ${username}`,
    target: {
      type: 'user',
      id: username
    },
    data: { after: { username, timestamp: new Date().toISOString() } },
    performedBy: { type: 'user', name: username }
  });
};
