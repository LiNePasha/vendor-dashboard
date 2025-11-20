# 🚀 خطة تطوير نظام الموظفين - Roadmap

## 📊 الحالة الحالية (ما تم إنجازه)

### ✅ **المرحلة الأساسية - مكتملة 100%**

| الميزة | الحالة | الملاحظات |
|--------|--------|-----------|
| إدارة الموظفين (CRUD) | ✅ مكتمل | إضافة، تعديل، حذف، بحث |
| صفحة تفاصيل الموظف | ✅ مكتمل | عرض كامل + وضع التعديل |
| نظام الحضور والانصراف | ✅ مكتمل | تسجيل + حسابات دقيقة |
| نظام الخصومات اليدوية | ✅ مكتمل | سُلف، جزاءات، خصومات أخرى |
| عرض سجلات الحضور | ✅ مكتمل | شهري مع accordion الأسابيع |
| التوقيت المصري (UTC+2) | ✅ مكتمل | date-fns-tz بتوقيت مصر |
| عرض الوقت 12 ساعة | ✅ مكتمل | صباحاً/مساءً بالعربي |
| رفع الصور (Cloudinary) | ✅ مكتمل | صور الموظفين |
| مولد بيانات تجريبية | ✅ مكتمل | شهر كامل واقعي |
| LocalForage Storage | ✅ مكتمل | 6 قواعد بيانات منفصلة |
| Zustand State Management | ✅ مكتمل | إدارة الحالة الشاملة |

### 📦 **الملفات المنجزة**

```
✅ app/lib/employees-storage.js (6 databases)
✅ app/lib/time-helpers.js (timezone utilities)
✅ app/lib/cloudinary.js (image upload)
✅ app/stores/employees-store.js (global state)
✅ app/employees/page.js (list + search)
✅ app/employees/add/page.js (add form)
✅ app/employees/[id]/page.js (details + edit)
✅ app/employees/[id]/deductions/page.js (list)
✅ app/employees/[id]/deductions/add/page.js (add)
✅ app/employees/attendance/record/page.js (check-in/out)
✅ app/employees/demo/page.js (simple demo)
✅ app/employees/demo/advanced/page.js (full month demo)
✅ components/AddDeductionModal.js (quick add popup)
✅ components/Sidebar.js (navigation)
```

---

## 🎯 المرحلة القادمة - التطويرات المقترحة

### **🔥 الأولوية القصوى - مطلوب فوراً** (أسبوعين)

---

#### **1️⃣ ربط الموظفين بنظام POS والفواتير + تقارير المبيعات** 💰🛒
**الأولوية**: ⭐⭐⭐⭐⭐ (مطلوب الآن!)  
**المدة**: 1.5 أسبوع  
**الصعوبة**: متوسطة

##### **الوصف**:
ربط نظام الموظفين بنظام POS لتتبع مبيعات كل موظف وعرض تقارير شهرية تفصيلية

##### **التحليل الفني الحالي**:
```javascript
✅ نظام POS موجود ويعمل (app/pos/page.js)
✅ نظام الفواتير موجود (invoiceStorage في localforage.js)
✅ نظام الموظفين موجود (employeesDB في employees-storage.js)
❌ لا يوجد ربط بين البائع والفاتورة
❌ لا توجد تقارير مبيعات للموظفين
```

##### **الملفات المطلوبة**:
```javascript
📁 app/pos/
  └── page.js                    // ✏️ تعديل: إضافة اختيار الموظف البائع

📁 app/employees/[id]/
  └── sales/
      └── page.js               // 🆕 صفحة تقارير مبيعات الموظف

📁 components/
  └── EmployeeSalesReport.js    // 🆕 كومبوننت التقارير
  └── EmployeeSelector.js       // 🆕 اختيار الموظف في POS

📁 lib/
  └── sales-calculator.js       // 🆕 حساب المبيعات والإحصائيات
  └── localforage.js            // ✏️ تحديث: إضافة employeeId للفاتورة
```

##### **التغييرات المطلوبة**:

**1️⃣ تحديث هيكل الفاتورة**:
```javascript
// في localforage.js - تحديث saveInvoice
{
  id: "INV-20241120-001",
  date: "2024-11-20T14:30:00+02:00",
  
  // 🆕 إضافة معلومات البائع
  soldBy: {
    employeeId: "EMP-001",
    employeeName: "أحمد محمود",
    employeeCode: "001"
  },
  
  items: [...],        // المنتجات
  services: [...],     // الخدمات
  
  subtotal: 1500,
  discount: 100,
  discountType: "amount",
  extraFee: 50,
  total: 1450,
  
  paymentMethod: "cash",
  synced: false,
  
  createdAt: "2024-11-20T14:30:00+02:00"
}
```

**2️⃣ إضافة اختيار الموظف في POS**:
```javascript
// في app/pos/page.js
const [selectedEmployee, setSelectedEmployee] = useState(null);
const [employees, setEmployees] = useState([]);

// Load employees
useEffect(() => {
  const loadEmployees = async () => {
    const { employeesDB } = await import('@/app/lib/employees-storage');
    const allEmployees = await employeesDB.getAllEmployees();
    setEmployees(allEmployees.filter(emp => emp.isActive));
  };
  loadEmployees();
}, []);

// عند الـ Checkout
const handleCheckout = async () => {
  if (!selectedEmployee) {
    return setToast({ 
      message: 'يرجى اختيار الموظف البائع أولاً', 
      type: 'error' 
    });
  }
  
  const result = await processCheckout({ 
    discount, 
    discountType, 
    extraFee, 
    paymentMethod,
    soldBy: {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeCode: selectedEmployee.employeeCode
    }
  });
  // ...
};
```

**3️⃣ UI اختيار الموظف**:
```jsx
// في Cart.jsx أو POS page
<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    👤 البائع
  </label>
  <select
    value={selectedEmployee?.id || ''}
    onChange={(e) => {
      const emp = employees.find(e => e.id === e.target.value);
      setSelectedEmployee(emp);
    }}
    className="w-full px-3 py-2 border rounded-lg"
    required
  >
    <option value="">-- اختر الموظف --</option>
    {employees.map(emp => (
      <option key={emp.id} value={emp.id}>
        {emp.name} ({emp.employeeCode})
      </option>
    ))}
  </select>
</div>
```

**4️⃣ صفحة تقارير المبيعات للموظف**:
```javascript
// app/employees/[id]/sales/page.js

"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function EmployeeSalesPage() {
  const params = useParams();
  const employeeId = params.id;
  
  const [employee, setEmployee] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalesData();
  }, [employeeId, month, year]);

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const { employeesDB } = await import('@/app/lib/employees-storage');
      const { invoiceStorage } = await import('@/app/lib/localforage');
      
      // تحميل بيانات الموظف
      const emp = await employeesDB.getEmployee(employeeId);
      setEmployee(emp);
      
      // تحميل كل الفواتير
      const allInvoices = await invoiceStorage.getAllInvoices();
      
      // فلترة فواتير الموظف في الشهر المحدد
      const employeeInvoices = allInvoices.filter(inv => {
        if (inv.soldBy?.employeeId !== employeeId) return false;
        
        const invDate = new Date(inv.date || inv.createdAt);
        return invDate.getMonth() + 1 === month && 
               invDate.getFullYear() === year;
      });
      
      // حساب الإحصائيات
      const stats = calculateSalesStats(employeeInvoices);
      
      setSalesData({
        invoices: employeeInvoices,
        stats: stats
      });
      
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSalesStats = (invoices) => {
    const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalInvoices = invoices.length;
    const averageInvoiceValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    // حساب المبيعات حسب طريقة الدفع
    const cashSales = invoices
      .filter(inv => inv.paymentMethod === 'cash')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    const cardSales = invoices
      .filter(inv => inv.paymentMethod === 'card')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    
    // أكبر فاتورة
    const largestInvoice = invoices.length > 0 
      ? Math.max(...invoices.map(inv => inv.total || 0))
      : 0;
    
    // المبيعات اليومية
    const salesByDay = {};
    invoices.forEach(inv => {
      const day = new Date(inv.date || inv.createdAt).getDate();
      salesByDay[day] = (salesByDay[day] || 0) + (inv.total || 0);
    });
    
    return {
      totalSales,
      totalInvoices,
      averageInvoiceValue,
      cashSales,
      cardSales,
      largestInvoice,
      salesByDay
    };
  };

  if (loading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  if (!employee) {
    return <div className="p-8 text-center">الموظف غير موجود</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          💰 تقرير مبيعات: {employee.name}
        </h1>
        <p className="text-gray-600">كود الموظف: {employee.employeeCode}</p>
      </div>

      {/* فلتر الشهر */}
      <div className="mb-6 flex gap-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg"
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2024, i, 1).toLocaleDateString('ar-EG', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg"
        >
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="text-sm opacity-90 mb-1">إجمالي المبيعات</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.totalSales.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="text-sm opacity-90 mb-1">عدد الفواتير</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.totalInvoices}
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="text-sm opacity-90 mb-1">متوسط الفاتورة</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.averageInvoiceValue.toLocaleString('ar-EG', {
              maximumFractionDigits: 0
            })} ج.م
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="text-sm opacity-90 mb-1">أكبر فاتورة</div>
          <div className="text-3xl font-bold">
            {salesData?.stats.largestInvoice.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
      </div>

      {/* مبيعات حسب طريقة الدفع */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">💵 المبيعات النقدية</h3>
          <div className="text-2xl font-bold text-green-600">
            {salesData?.stats.cashSales.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">💳 المبيعات بالبطاقة</h3>
          <div className="text-2xl font-bold text-blue-600">
            {salesData?.stats.cardSales.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
      </div>

      {/* قائمة الفواتير */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold">📋 الفواتير ({salesData?.invoices.length})</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">رقم الفاتورة</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الوقت</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">طريقة الدفع</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {salesData?.invoices.map(invoice => {
                const date = new Date(invoice.date || invoice.createdAt);
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono">{invoice.id}</td>
                    <td className="px-6 py-4 text-sm">
                      {date.toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {date.toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">
                      {invoice.total.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {invoice.paymentMethod === 'cash' ? '💵 نقدي' : '💳 بطاقة'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {salesData?.invoices.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              لا توجد فواتير في هذا الشهر
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

##### **UI المقترح**:
```
┌─────────────────────────────────────────────────────┐
│  🛒 نقطة البيع (POS)                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [المنتجات...]         │  📝 السلة               │
│                         │                          │
│                         │  👤 البائع:              │
│                         │  [أحمد محمود ▼]         │
│                         │                          │
│                         │  المنتجات:              │
│                         │  • منتج 1  x2  = 100    │
│                         │  • منتج 2  x1  = 50     │
│                         │                          │
│                         │  الإجمالي: 150 ج.م      │
│                         │  [💰 إتمام البيع]       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  💰 تقرير مبيعات: أحمد محمود - نوفمبر 2024        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 الإحصائيات السريعة:                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ 75,000   │ │ 150      │ │ 500      │ │ 2,500  ││
│  │ إجمالي   │ │ فاتورة   │ │ متوسط    │ │ أكبر   ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                     │
│  💵 نقدي: 50,000 ج.م    💳 بطاقة: 25,000 ج.م     │
│                                                     │
│  📋 الفواتير:                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ INV-001  20/11  2:30 م   500 ج.م   💵 نقدي  │  │
│  │ INV-002  20/11  3:45 م   750 ج.م   💳 بطاقة │  │
│  │ INV-003  20/11  4:20 م   300 ج.م   💵 نقدي  │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

##### **الفوائد**:
- 📊 **تتبع دقيق** لمبيعات كل موظف
- 💰 **حساب العمولات** بسهولة (لاحقاً)
- 🎯 **تقييم الأداء** بناءً على أرقام حقيقية
- 🏆 **تحفيز الموظفين** (أفضل بائع في الشهر)
- 🔍 **اكتشاف المشاكل** (موظف مبيعاته منخفضة؟)

---

#### **2️⃣ سجل التعديلات الشامل (Audit Log)** 📝
**الأولوية**: ⭐⭐⭐⭐⭐ (مطلوب الآن!)  
**المدة**: 3-5 أيام  
**الصعوبة**: سهلة إلى متوسطة

##### **الوصف**:
نظام تسجيل شامل لكل العمليات في النظام - **لا يتأثر بالحذف أبداً**

##### **المتطلبات الرئيسية**:
```javascript
✅ تسجيل كل عملية تحدث في النظام
✅ قاعدة بيانات منفصلة (auditDB) - لا تُمسح أبداً
✅ حتى لو حذفت كل الموظفين - السجل يبقى
✅ تسجيل التوقيت بدقة (تاريخ + وقت بالمللي ثانية)
✅ تسجيل التفاصيل الكاملة (قبل/بعد التعديل)
```

##### **الملفات المطلوبة**:
```javascript
📁 app/lib/
  └── audit-logger.js           // 🆕 محرك التسجيل الشامل

📁 app/employees/audit/
  └── page.js                   // 🆕 صفحة عرض السجل

📁 components/
  └── AuditLogViewer.js         // 🆕 عارض السجل بفلاتر

📁 app/lib/
  └── employees-storage.js      // ✏️ تحديث: إضافة audit logging
```

##### **هيكل قاعدة البيانات**:
```javascript
// في app/lib/audit-logger.js

import localforage from 'localforage';

// قاعدة بيانات منفصلة تماماً - لا تُمسح أبداً
const auditDB = localforage.createInstance({
  name: 'spare2app-audit',
  storeName: 'audit_logs',
  description: 'Permanent audit trail - NEVER DELETE'
});

// هيكل السجل
{
  id: "AUDIT-20241120-143025-789",  // معرف فريد بالمللي ثانية
  timestamp: "2024-11-20T14:30:25.789+02:00",  // توقيت دقيق جداً
  
  // نوع العملية
  category: "employees",  // employees, attendance, deductions, payroll, sales, system
  action: "employee_created",  // employee_created, employee_updated, employee_deleted, etc.
  
  // التفاصيل
  description: "تم إضافة موظف جديد",
  
  // الكائن المستهدف
  target: {
    type: "employee",
    id: "EMP-001",
    name: "أحمد محمود",
    employeeCode: "001"
  },
  
  // البيانات (snapshot كامل)
  data: {
    before: null,  // للإضافة = null
    after: {       // الحالة الجديدة
      id: "EMP-001",
      name: "أحمد محمود",
      employeeCode: "001",
      basicSalary: 5000,
      // ... كل البيانات
    }
  },
  
  // التغييرات (للتعديلات فقط)
  changes: null,  // للإضافة = null
  
  // من قام بالعملية
  performedBy: {
    type: "admin",  // admin, system, employee
    id: "ADMIN-001",
    name: "المدير",
    ipAddress: "192.168.1.100",  // إن أمكن
  },
  
  // معلومات إضافية
  metadata: {
    userAgent: "Mozilla/5.0...",
    source: "web_app",  // web_app, mobile_app, api
    sessionId: "SESSION-123"
  }
}
```

##### **وظائف التسجيل**:
```javascript
// app/lib/audit-logger.js

export const auditLogger = {
  // تسجيل عملية
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

  // جلب كل السجلات
  async getAllLogs() {
    const logs = await auditDB.getItem('logs');
    return logs || [];
  },

  // فلترة السجلات
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
      filtered = filtered.filter(log => 
        new Date(log.timestamp) <= new Date(filters.endDate)
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
    
    // ترتيب من الأحدث للأقدم
    filtered.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    return filtered;
  },

  // إحصائيات
  async getStats(filters = {}) {
    const logs = await this.filterLogs(filters);
    
    const stats = {
      total: logs.length,
      byCategory: {},
      byAction: {},
      byDate: {}
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
    });
    
    return stats;
  },

  // ⚠️ مسح كل السجلات (استخدام حذر جداً!)
  async clearAll() {
    // تحذير: هذه العملية خطرة!
    const confirmed = confirm(
      '⚠️ تحذير: هل أنت متأكد من حذف كل سجلات التدقيق؟\n' +
      'هذا سيؤدي لفقدان كل السجل التاريخي للنظام!'
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

// دوال مساعدة سريعة
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

export const logEmployeeUpdated = async (before, after, changedFields) => {
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
    changes: changedFields,
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

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

export const logAllEmployeesDeleted = async (count) => {
  return await auditLogger.log({
    category: 'employees',
    action: 'all_employees_deleted',
    description: `🚨 تم حذف جميع الموظفين (${count} موظف)`,
    target: {
      type: 'system',
      id: 'all_employees'
    },
    data: {
      before: { count },
      after: { count: 0 }
    },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

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

export const logDeductionAdded = async (deduction) => {
  return await auditLogger.log({
    category: 'deductions',
    action: 'deduction_added',
    description: `إضافة خصم: ${deduction.type} - ${deduction.amount} ج.م`,
    target: {
      type: 'employee',
      id: deduction.employeeId,
      name: deduction.employeeName
    },
    data: { after: deduction },
    performedBy: { type: 'admin', name: 'Admin' }
  });
};

export const logSaleRecorded = async (invoice) => {
  return await auditLogger.log({
    category: 'sales',
    action: 'sale_recorded',
    description: `فاتورة جديدة: ${invoice.total} ج.م`,
    target: {
      type: 'invoice',
      id: invoice.id
    },
    data: { after: invoice },
    performedBy: {
      type: 'employee',
      id: invoice.soldBy?.employeeId,
      name: invoice.soldBy?.employeeName || 'Unknown'
    }
  });
};
```

##### **دمج Audit Log في العمليات الموجودة**:
```javascript
// في app/lib/employees-storage.js

import { 
  logEmployeeCreated, 
  logEmployeeUpdated, 
  logEmployeeDeleted,
  logAllEmployeesDeleted 
} from './audit-logger';

// تحديث addEmployee
async addEmployee(employee) {
  const employees = await this.getAllEmployees();
  employees.push(employee);
  await employeesDB.setItem('employees', employees);
  
  // 🆕 تسجيل في Audit Log
  await logEmployeeCreated(employee);
  
  return employee;
},

// تحديث updateEmployee
async updateEmployee(id, updatedData) {
  const employees = await this.getAllEmployees();
  const index = employees.findIndex(emp => emp.id === id);
  
  if (index === -1) return null;
  
  const before = { ...employees[index] };
  const after = { ...employees[index], ...updatedData, updatedAt: new Date().toISOString() };
  
  // حساب الحقول المتغيرة
  const changes = {};
  Object.keys(updatedData).forEach(key => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { before: before[key], after: after[key] };
    }
  });
  
  employees[index] = after;
  await employeesDB.setItem('employees', employees);
  
  // 🆕 تسجيل في Audit Log
  await logEmployeeUpdated(before, after, changes);
  
  return after;
},

// تحديث deleteEmployee
async deleteEmployee(id) {
  const employees = await this.getAllEmployees();
  const employee = employees.find(emp => emp.id === id);
  
  if (!employee) return false;
  
  const filtered = employees.filter(emp => emp.id !== id);
  await employeesDB.setItem('employees', filtered);
  
  // 🆕 تسجيل في Audit Log
  await logEmployeeDeleted(employee);
  
  return true;
},

// تحديث clearAll
async clearAll() {
  const employees = await this.getAllEmployees();
  const count = employees.length;
  
  await employeesDB.setItem('employees', []);
  
  // 🆕 تسجيل في Audit Log
  await logAllEmployeesDeleted(count);
  
  return true;
}
```

##### **صفحة عرض Audit Log**:
```javascript
// app/employees/audit/page.js

"use client";

import { useState, useEffect } from 'react';
import { auditLogger } from '@/app/lib/audit-logger';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    startDate: '',
    endDate: '',
    employeeId: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
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
      sale_recorded: '🛒',
      audit_cleared: '⚠️'
    };
    return icons[action] || '📝';
  };

  const getActionColor = (action) => {
    if (action.includes('created')) return 'text-green-600 bg-green-50';
    if (action.includes('updated')) return 'text-blue-600 bg-blue-50';
    if (action.includes('deleted')) return 'text-red-600 bg-red-50';
    if (action.includes('sale')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📝 سجل التدقيق الشامل
        </h1>
        <p className="text-gray-600">
          كل العمليات المسجلة في النظام - سجل دائم لا يُمسح
        </p>
      </div>

      {/* الإحصائيات */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="text-sm text-gray-600 mb-1">إجمالي العمليات</div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.total.toLocaleString('ar-EG')}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="text-sm text-gray-600 mb-1">موظفين</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.byCategory.employees || 0}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="text-sm text-gray-600 mb-1">حضور</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.byCategory.attendance || 0}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="text-sm text-gray-600 mb-1">مبيعات</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.byCategory.sales || 0}
            </div>
          </div>
        </div>
      )}

      {/* الفلاتر */}
      <div className="bg-white p-6 rounded-lg shadow border mb-6">
        <h3 className="text-lg font-bold mb-4">🔍 تصفية السجلات</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الفئة
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">الكل</option>
              <option value="employees">موظفين</option>
              <option value="attendance">حضور</option>
              <option value="deductions">خصومات</option>
              <option value="sales">مبيعات</option>
              <option value="system">نظام</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              من تاريخ
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* قائمة السجلات */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            📋 السجلات ({logs.length})
          </h3>
          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 تحديث
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">التوقيت</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">العملية</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الوصف</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">الهدف</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">المستخدم</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(log => {
                const date = new Date(log.timestamp);
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium">
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
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getActionColor(log.action)}`}>
                        <span>{getActionIcon(log.action)}</span>
                        <span>{log.action.replace(/_/g, ' ')}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.description}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium">{log.target?.name || '-'}</div>
                      <div className="text-xs text-gray-500">{log.target?.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.performedBy?.name || 'System'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {loading && (
            <div className="p-12 text-center text-gray-500">
              جاري التحميل...
            </div>
          )}
          
          {!loading && logs.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              لا توجد سجلات
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

##### **الفوائد**:
- 🔒 **سجل دائم** لا يُمسح أبداً (حتى لو حذفت كل البيانات)
- 🕐 **تسجيل دقيق** للتوقيت (بالمللي ثانية)
- 🔍 **شفافية كاملة** (من عمل إيه ومتى)
- ⚖️ **حل النزاعات** (دليل قانوني)
- 🛡️ **اكتشاف التلاعب** (كل عملية مسجلة)
- 📊 **تحليل الأنماط** (الإحصائيات والفلاتر)

---

### **المستوى الأول: Critical Business Features** 🔴 (بعد الانتهاء من الأولويات)

---

#### **3️⃣ نظام المرتبات الشهرية** 💰 
**الأولوية**: ⭐⭐⭐⭐⭐ (أهم حاجة!)  
**المدة**: 2 أسابيع  
**الصعوبة**: متوسطة

##### **الوصف**:
نظام كامل لتوليد واعتماد وطباعة المرتبات الشهرية لكل الموظفين

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/payroll/
  ├── page.js                    // قائمة المرتبات (كل الأشهر)
  ├── generate/
  │   └── page.js               // توليد مرتبات الشهر
  ├── [id]/
  │   └── page.js               // كشف راتب موظف واحد
  └── print/
      └── [id]/
          └── page.js           // نسخة للطباعة (PDF style)

📁 components/
  └── PayrollCalculator.js      // حاسبة المرتب التفاعلية
  └── SalarySlipPrint.js        // كومبوننت الطباعة
```

##### **المميزات**:
- ✅ عرض كل الموظفين مع **الراتب المقترح** بناءً على:
  - الحضور من `attendanceDB`
  - الخصومات من `deductionsDB`
  - السُلف من `advancesDB`
  - الإجازات من `leavesDB`
- ✅ **مراجعة يدوية** قبل الاعتماد (Admin يعدل أي رقم)
- ✅ حفظ المرتبات في `payrollDB`
- ✅ **طباعة كشف راتب PDF** احترافي
- ✅ **حالات المرتب**: pending, approved, paid
- ✅ **تتبع الدفع**: تاريخ الدفع، طريقة الدفع

##### **هيكل البيانات**:
```javascript
// في payrollDB
{
  id: "PAY-202411-EMP001",
  employeeId: "EMP-001",
  employeeName: "أحمد محمود",
  month: 11,
  year: 2024,
  period: "2024-11-01 to 2024-11-30",
  
  // ملخص الحضور (للعرض)
  attendanceSummary: {
    totalWorkDays: 26,
    presentDays: 24,
    absentDays: 2,
    lateDays: 5,
    totalLateMinutes: 75,
    totalWorkHours: 192,
    overtimeHours: 5.5
  },
  
  // المستحقات
  earnings: {
    basicSalary: 5000,
    allowances: 500,
    bonuses: 300,        // Admin يدخلها
    overtimePay: 0,      // Admin يدخلها
    total: 5800
  },
  
  // الخصومات
  deductions: {
    absentDeduction: 384.62,    // من suggestions أو يدوي
    lateDeduction: 50,          // من suggestions أو يدوي
    advanceDeduction: 1000,     // من السُلف
    otherDeductions: 0,         // أي خصم إضافي
    total: 1434.62
  },
  
  // المقترحات (suggestions only)
  suggestions: {
    absentDeduction: 384.62,    // (5000/26) * 2
    lateDeduction: 50,          // حسب السياسة
    advanceDeduction: 1000,     // من السُلف المستحقة
    bonusSuggestion: 0
  },
  
  // الصافي
  netSalary: 4365.38,
  
  // الحالة
  status: "pending",           // pending, approved, paid
  approvedBy: null,
  approvedAt: null,
  paidDate: null,
  paymentMethod: null,         // cash, bank_transfer
  
  notes: "",
  createdAt: "2024-11-30T10:00:00+02:00",
  updatedAt: "2024-11-30T10:00:00+02:00"
}
```

##### **UI المقترح**:
```
┌─────────────────────────────────────────────────────┐
│  💰 المرتبات - نوفمبر 2024                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 الإحصائيات:                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 25 موظف  │ │ 125,000  │ │ 15,000   │           │
│  │ نشط      │ │ إجمالي   │ │ خصومات   │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│  [🧮 توليد مرتبات الشهر]  [📊 عرض الكل]          │
│                                                     │
│  ┌────────── قائمة المرتبات ──────────┐            │
│  │ أحمد محمد    5,000   -1,435  3,565  ✅ مدفوع │  │
│  │ فاطمة حسن    6,000   -800    5,200  ⏳ معلق  │  │
│  │ محمد علي     5,500   -500    5,000  ⏳ معلق  │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

##### **الفوائد**:
- ⏱️ **توفير 3-5 ساعات شهرياً** في حسابات المرتبات
- 📊 **دقة 100%** في الحسابات (لا أخطاء بشرية)
- 📄 **سجل كامل** لكل المرتبات المدفوعة
- 🔍 **شفافية** للموظفين (يشوفوا كشف راتبهم)

---

#### **2️⃣ Dashboard تحليلي** 📊
**الأولوية**: ⭐⭐⭐⭐⭐  
**المدة**: 1 أسبوع  
**الصعوبة**: سهلة

##### **الوصف**:
لوحة تحكم شاملة لمتابعة صحة البيزنس ونظرة سريعة على كل شيء

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/dashboard/
  └── page.js                   // Dashboard الرئيسي

📁 components/
  └── StatCard.js              // كارد إحصائية
  └── AttendanceChart.js       // Chart الحضور
  └── PerformanceChart.js      // Chart الأداء
```

##### **المميزات**:
- ✅ **إحصائيات فورية**:
  - عدد الموظفين النشطين
  - الحاضرين اليوم vs الغائبين
  - نسبة الحضور هذا الأسبوع
  - إجمالي المرتبات المستحقة
  - السُلف المعلقة
  
- ✅ **Charts تفاعلية**:
  - Line Chart: الحضور خلال الشهر
  - Pie Chart: نسبة الحضور/الغياب/الإجازات
  - Bar Chart: مقارنة أداء الموظفين
  - Heatmap: أيام الذروة/الضعف

- ✅ **Top Performers**:
  - أكثر 5 موظفين التزاماً
  - أكثر 5 موظفين تأخيراً
  - أكثر موظف ساعات إضافية

- ✅ **Alerts سريعة**:
  - موظفين غائبين اليوم
  - متأخرين أكثر من 30 دقيقة
  - سُلف تحتاج موافقة

##### **UI المقترح**:
```
┌─────────────────────────────────────────────────────┐
│  📊 Dashboard - نظام الموظفين                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📈 الإحصائيات السريعة:                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ 👥 25    │ │ ✅ 23    │ │ ❌ 2     │ │ ⏰ 3   ││
│  │ موظف    │ │ حاضر     │ │ غائب     │ │ متأخر  ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 💰 125K  │ │ 💸 15K   │ │ 📊 92%   │           │
│  │ مرتبات   │ │ خصومات   │ │ الحضور   │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│  📈 الحضور خلال الشهر:                             │
│  ┌──────────────────────────────────────────────┐  │
│  │         📊 Line Chart                        │  │
│  │   25 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │  │
│  │   20 ▓▓▓▓▓▓▓▓▓▓▓▓▓                          │  │
│  │   15 ▓▓▓▓▓▓▓▓                                │  │
│  │   10 ▓▓▓▓                                    │  │
│  │    1  5  10 15 20 25 30                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  🏆 Top Performers:                                │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. أحمد محمد    - 0 تأخير    ⭐⭐⭐⭐⭐      │  │
│  │ 2. فاطمة حسن    - 1 تأخير    ⭐⭐⭐⭐        │  │
│  │ 3. محمد علي     - 2 تأخير    ⭐⭐⭐          │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ⚠️ التنبيهات:                                     │
│  • موظفان غائبان اليوم (عمر، سارة)                │
│  • 3 موظفين متأخرين أكثر من 30 دقيقة              │
│  • 5 سُلف تحتاج موافقة                            │
└─────────────────────────────────────────────────────┘
```

##### **الفوائد**:
- 🎯 **قرارات أسرع** بناءً على بيانات حقيقية
- 🔍 **اكتشاف المشاكل مبكراً** (موظف متأخر باستمرار؟)
- 💪 **تحفيز الموظفين** (عرض الأداء المتميز)
- 📊 **نظرة شاملة** بدون تصفح كل الصفحات

---

#### **3️⃣ تقارير قابلة للطباعة/التصدير** 📄
**الأولوية**: ⭐⭐⭐⭐  
**المدة**: 1 أسبوع  
**الصعوبة**: متوسطة

##### **الوصف**:
تقارير شاملة للمحاسب، المراجعة، والسجلات الرسمية بصيغ Excel و PDF

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/reports/
  ├── page.js                    // صفحة التقارير الرئيسية
  ├── attendance/
  │   └── page.js               // تقرير الحضور
  ├── payroll/
  │   └── page.js               // تقرير المرتبات
  ├── advances/
  │   └── page.js               // تقرير السُلف
  └── performance/
      └── page.js               // تقرير الأداء

📁 lib/
  └── export-utils.js           // وظائف التصدير (Excel/PDF)
```

##### **المكتبات المطلوبة**:
```bash
npm install xlsx jspdf jspdf-autotable
```

##### **أنواع التقارير**:

**1. تقرير الحضور الشهري**:
```javascript
محتويات:
- كل موظف: الاسم، الكود، الوظيفة
- أيام الحضور / الغياب
- عدد مرات التأخير
- إجمالي الساعات
- الإجازات المأخوذة

تصدير: Excel, PDF
```

**2. تقرير المرتبات**:
```javascript
محتويات:
- المرتبات المدفوعة (شهر محدد أو سنة)
- تفصيل المستحقات والخصومات
- إجمالي التكاليف
- مقارنة بالأشهر السابقة

تصدير: Excel, PDF
```

**3. تقرير السُلف**:
```javascript
محتويات:
- السُلف المعلقة
- السُلف المدفوعة
- المتبقي من كل سُلفة
- إجمالي السُلف لكل موظف

تصدير: Excel
```

**4. تقرير الأداء**:
```javascript
محتويات:
- معدل الحضور لكل موظف
- معدل التأخير
- الساعات الإضافية
- تصنيف الموظفين (ممتاز، جيد، ضعيف)
- اقتراحات للتحسين

تصدير: PDF
```

##### **UI المقترح**:
```
┌─────────────────────────────────────────────────────┐
│  📊 التقارير                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────── اختر التقرير ──────────┐              │
│  │                                  │              │
│  │ ● تقرير الحضور الشهري           │              │
│  │ ○ تقرير المرتبات                │              │
│  │ ○ تقرير السُلف                  │              │
│  │ ○ تقرير الأداء                  │              │
│  └──────────────────────────────────┘              │
│                                                     │
│  📅 الفترة:                                        │
│  من: [2024-11-01]  إلى: [2024-11-30]              │
│                                                     │
│  👥 الموظفين:                                      │
│  ☑️ الكل  ☐ موظفين محددين                         │
│                                                     │
│  📄 التنسيق:                                       │
│  ● Excel (.xlsx)                                   │
│  ○ PDF (.pdf)                                      │
│                                                     │
│  [👁️ معاينة]     [📥 تصدير]                      │
└─────────────────────────────────────────────────────┘
```

##### **الفوائد**:
- 📤 **مشاركة** مع المحاسب/المدير/الجهات الرسمية
- 📁 **أرشفة** رسمية ومنظمة
- 🔍 **مراجعة سهلة** للبيانات التاريخية
- 📊 **تحليل** الاتجاهات والأنماط

---

### **المستوى الثاني: Process Optimization** 🟡 (شهر واحد)

---

#### **4️⃣ نظام الإجازات والأذونات** 🏖️
**الأولوية**: ⭐⭐⭐⭐  
**المدة**: 1.5 أسبوع  
**الصعوبة**: متوسطة

##### **الوصف**:
نظام متكامل لطلب، موافقة، وإدارة الإجازات والأذونات

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/leaves/
  ├── page.js                    // قائمة الإجازات
  ├── request/
  │   └── page.js               // طلب إجازة/إذن جديد
  ├── calendar/
  │   └── page.js               // تقويم الإجازات
  └── balance/
      └── page.js               // رصيد الإجازات

📁 components/
  └── LeaveRequestForm.js       // فورم طلب الإجازة
  └── LeaveCalendar.js          // تقويم تفاعلي
  └── LeaveCard.js              // كارد الإجازة
```

##### **أنواع الإجازات**:
```javascript
1. إجازة سنوية (Annual Leave)
   - 21 يوم في السنة
   - يستهلك من الرصيد
   - تحتاج موافقة مسبقة

2. إجازة مرضية (Sick Leave)
   - بتقرير طبي
   - 15 يوم مدفوعة الأجر
   - بعدها بدون أجر

3. إجازة طارئة (Emergency Leave)
   - 3 أيام في السنة
   - بدون خصم
   - بموافقة مباشرة

4. إذن (Permission)
   - بالساعات (2-4 ساعات)
   - من نفس اليوم
   - لا يؤثر على الرصيد
```

##### **هيكل البيانات**:
```javascript
// تحديث leavesDB
{
  id: "LEAVE-20241120-001",
  employeeId: "EMP-001",
  employeeName: "أحمد محمود",
  type: "annual_leave",  // annual, sick, emergency, permission
  
  startDate: "2024-12-01",
  endDate: "2024-12-05",
  totalDays: 5,
  hours: null,           // للإذن بالساعات
  
  reason: "ظروف عائلية",
  attachments: [],       // للتقارير الطبية
  
  // الموافقة
  status: "pending",     // pending, approved, rejected, cancelled
  requestedAt: "2024-11-20T10:00:00+02:00",
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: "",
  
  // تأثير على الراتب
  deductFromSalary: false,
  deductedAmount: 0,
  
  createdAt: "2024-11-20T10:00:00+02:00",
  updatedAt: "2024-11-20T10:00:00+02:00"
}

// رصيد الإجازات لكل موظف
{
  employeeId: "EMP-001",
  year: 2024,
  
  annualLeave: {
    total: 21,          // الرصيد الكلي
    used: 5,            // المستخدم
    pending: 3,         // تحت المراجعة
    remaining: 13       // المتبقي
  },
  
  sickLeave: {
    total: 15,
    used: 2,
    remaining: 13
  },
  
  emergencyLeave: {
    total: 3,
    used: 0,
    remaining: 3
  }
}
```

##### **المميزات**:
- ✅ **طلب إجازة** من الموظف نفسه
- ✅ **موافقة/رفض** من Admin/Manager
- ✅ **تقويم الإجازات** (منع التضارب)
- ✅ **حساب الرصيد** تلقائياً
- ✅ **تنبيهات** (رصيد منخفض، طلبات معلقة)
- ✅ **تأثير على الحضور** (الإجازة المعتمدة = حضور)

##### **الفوائد**:
- 🗓️ **تخطيط أفضل** (تجنب غياب كل الموظفين معاً)
- ⚖️ **عدالة** (كل موظف يعرف رصيده)
- 📊 **شفافية** (سجل كامل للإجازات)
- ⏱️ **توفير وقت** (لا حاجة لـ Excel منفصل)

---

#### **5️⃣ تنبيهات ذكية (Notifications)** 🔔
**الأولوية**: ⭐⭐⭐  
**المدة**: 1 أسبوع  
**الصعوبة**: سهلة

##### **الوصف**:
نظام تنبيهات ذكي لمتابعة الأحداث المهمة تلقائياً

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/notifications/
  └── page.js                    // صفحة التنبيهات

📁 components/
  └── NotificationBell.js        // أيقونة الجرس في Navbar
  └── NotificationDropdown.js    // قائمة التنبيهات المنبثقة
  └── NotificationCard.js        // كارد التنبيه

📁 lib/
  └── notifications-engine.js    // محرك التنبيهات
```

##### **أنواع التنبيهات**:

**1. تنبيهات الحضور**:
```javascript
- موظف متأخر أكثر من 30 دقيقة
- موظف غائب بدون عذر
- موظف متأخر 3 مرات في أسبوع
- موظف لم يسجل انصراف (نهاية اليوم)
```

**2. تنبيهات المرتبات**:
```javascript
- آخر 3 أيام من الشهر (تذكير بالمرتبات)
- مرتبات معلقة أكثر من أسبوع
- موظف عنده سُلفة تقترب من الانتهاء
```

**3. تنبيهات الإجازات**:
```javascript
- طلب إجازة جديد يحتاج موافقة
- موظف رصيده منخفض (أقل من 5 أيام)
- موظف عنده رصيد كبير (أكثر من 15 يوم - يحتاج استخدامه)
```

**4. تنبيهات الأداء**:
```javascript
- موظف أداؤه ممتاز (تحفيز)
- موظف أداؤه ضعيف (تحذير)
- موظف محتاج تدريب
```

##### **هيكل البيانات**:
```javascript
{
  id: "NOTIF-20241120-001",
  type: "attendance",      // attendance, payroll, leave, performance
  priority: "high",        // low, medium, high, urgent
  
  title: "موظف متأخر",
  message: "أحمد محمود متأخر 45 دقيقة اليوم",
  
  relatedTo: {
    type: "employee",
    id: "EMP-001",
    link: "/employees/EMP-001"
  },
  
  actionRequired: true,
  actionLabel: "عرض التفاصيل",
  
  read: false,
  readAt: null,
  
  createdAt: "2024-11-20T09:45:00+02:00"
}
```

##### **UI المقترح**:
```
Navbar:
┌─────────────────────────────────────┐
│ Spare2App  [🔔 5]  👤 Admin       │
└─────────────────────────────────────┘
               ↓ (عند الضغط)
         ┌──────────────────────────┐
         │ 🔴 موظف متأخر (عاجل)    │
         │ أحمد محمود 45 دقيقة      │
         ├──────────────────────────┤
         │ 🟡 طلب إجازة جديد       │
         │ فاطمة حسن تطلب 3 أيام    │
         ├──────────────────────────┤
         │ 🔵 تذكير المرتبات       │
         │ 3 أيام متبقية           │
         ├──────────────────────────┤
         │ [عرض الكل →]            │
         └──────────────────────────┘
```

##### **الفوائد**:
- 🎯 **proactive management** (اعرف المشاكل قبل ما تكبر)
- ⏱️ **لا تنسى شيء** (كل حاجة مهمة توصلك)
- 📊 **أولويات واضحة** (الأهم أولاً)
- 🚀 **سرعة في الاستجابة**

---

#### **6️⃣ Bulk Actions (عمليات جماعية)** ⚡
**الأولوية**: ⭐⭐⭐  
**المدة**: 1.5 أسبوع  
**الصعوبة**: متوسطة

##### **الوصف**:
القدرة على تنفيذ عمليات على عدة موظفين دفعة واحدة

##### **الملفات المطلوبة**:
```javascript
// تعديل الملفات الموجودة:
📁 app/employees/page.js          // إضافة checkboxes + bulk actions
📁 app/employees/payroll/generate/page.js  // bulk payroll

📁 components/
  └── BulkActionsBar.js           // شريط العمليات الجماعية
```

##### **العمليات المتاحة**:

**في صفحة الموظفين**:
```javascript
✅ تحديد متعدد (Multi-select)
✅ إضافة خصم جماعي (مثلاً: تأمينات 50 ج.م لكل الموظفين)
✅ إضافة بونص جماعي
✅ تصدير بيانات الموظفين المحددين (Excel)
✅ تغيير حالة جماعي (active/inactive)
✅ إضافة إلى قسم معين
```

**في صفحة المرتبات**:
```javascript
✅ توليد مرتبات جماعية (كل الموظفين دفعة واحدة)
✅ اعتماد مرتبات جماعي
✅ طباعة كشوف رواتب متعددة
✅ تصدير ملف المرتبات الشامل
```

**في صفحة الحضور**:
```javascript
✅ تسجيل إجازة جماعية (عطلة رسمية)
✅ تسجيل حضور جماعي (لو كلهم حضروا نفس الوقت)
```

##### **UI المقترح**:
```
┌─────────────────────────────────────────────────────┐
│  👥 الموظفين                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ☐ الكل  (5 محدد)                                  │
│                                                     │
│  ┌────── إجراءات جماعية ──────┐                   │
│  │ ➕ إضافة خصم     💰 بونص   │                   │
│  │ 📥 تصدير        🗑️ حذف    │                   │
│  └────────────────────────────┘                   │
│                                                     │
│  ☑️ أحمد محمود    موظف مبيعات    5000 ج.م        │
│  ☑️ فاطمة حسن     محاسبة         6000 ج.م        │
│  ☑️ محمد علي      فني صيانة     5500 ج.م        │
│  ☐ سارة أحمد      موارد بشرية   7000 ج.م        │
│  ☐ نور الدين      استقبال       4500 ج.م        │
└─────────────────────────────────────────────────────┘
```

##### **الفوائد**:
- ⚡ **توفير 80% من الوقت** (بدل ما تعمل واحد واحد)
- 🎯 **أقل أخطاء** (عملية واحدة بدل 50 عملية)
- 🚀 **كفاءة عالية** (خصوصاً مع موظفين كتير)

---

### **المستوى الثالث: Advanced Features** 🟢 (شهر واحد)

---

#### **7️⃣ نظام العمولات والحوافز** 💸
**الأولوية**: ⭐⭐⭐  
**المدة**: 1.5 أسبوع  
**الصعوبة**: متوسطة إلى صعبة

##### **الوصف**:
ربط أداء الموظف (المبيعات) بالمكافآت والعمولات

##### **المتطلبات**:
```javascript
✅ نظام POS موجود (لتتبع المبيعات)
✅ نظام الطلبات موجود
```

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/commissions/
  ├── page.js                    // قائمة العمولات
  ├── settings/
  │   └── page.js               // إعدادات العمولات
  └── [id]/
      └── page.js               // عمولات موظف واحد

📁 lib/
  └── commission-calculator.js   // حساب العمولات
```

##### **أنواع الحوافز**:
```javascript
1. عمولة على المبيعات (Sales Commission)
   - نسبة مئوية من إجمالي المبيعات
   - مثال: 2% من كل عملية بيع

2. أهداف شهرية (Monthly Targets)
   - بونص عند تحقيق الهدف
   - مثال: 50,000 ج.م مبيعات → 1000 ج.م بونص

3. حوافز الحضور (Attendance Bonus)
   - بونص للالتزام (0 تأخير في الشهر)
   - مثال: 200 ج.م بونص حضور

4. حوافز الأداء (Performance Bonus)
   - تقييم شامل (حضور + مبيعات + سلوك)
   - من 0 إلى 500 ج.م
```

##### **هيكل البيانات**:
```javascript
// في ملف الموظف - إضافة
{
  commissionSettings: {
    enabled: true,
    salesCommissionRate: 2,     // 2%
    monthlyTarget: 50000,       // 50K ج.م
    targetBonus: 1000,          // 1K ج.م
    attendanceBonus: 200,       // 200 ج.م
    performanceBonus: {
      max: 500,
      criteria: {
        attendance: 40,         // 40% من التقييم
        sales: 40,             // 40% من التقييم
        behavior: 20           // 20% من التقييم
      }
    }
  }
}

// Commission Record
{
  id: "COMM-202411-EMP001",
  employeeId: "EMP-001",
  month: 11,
  year: 2024,
  
  sales: {
    totalSales: 75000,
    commission: 1500,         // 2% من 75000
    targetAchieved: true,
    targetBonus: 1000
  },
  
  attendance: {
    perfect: true,
    bonus: 200
  },
  
  performance: {
    attendanceScore: 100,     // 100%
    salesScore: 150,          // 150% (تجاوز الهدف)
    behaviorScore: 100,       // 100%
    totalScore: 120,          // متوسط مرجح
    bonus: 500                // ممتاز
  },
  
  totalCommission: 3200,      // 1500 + 1000 + 200 + 500
  
  status: "approved",
  paidInPayroll: "PAY-202411-EMP001",
  
  createdAt: "2024-11-30T10:00:00+02:00"
}
```

##### **الربط مع POS/Orders**:
```javascript
// في كل عملية بيع/طلب
{
  orderId: "ORD-001",
  total: 5000,
  createdBy: "EMP-001",      // الموظف البائع
  commission: 100,           // 2% من 5000
  // ...
}

// حساب شهري تلقائي
function calculateMonthlySales(employeeId, month, year) {
  const orders = getOrdersByEmployee(employeeId, month, year);
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const commission = totalSales * (commissionRate / 100);
  
  return { totalSales, commission };
}
```

##### **الفوائد**:
- 🎯 **تحفيز حقيقي** (ربط الأداء بالمكافآت)
- 📈 **زيادة الإنتاجية** (الموظفين يسعون للأفضل)
- ⚖️ **عدالة** (الأداء الأفضل = راتب أفضل)
- 💰 **زيادة المبيعات** (بدافع شخصي)

---

#### **8️⃣ سجل التعديلات (Audit Log)** 📝
**الأولوية**: ⭐⭐  
**المدة**: 1 أسبوع  
**الصعوبة**: سهلة

##### **الوصف**:
تسجيل كل تعديل يحدث في النظام لأغراض المحاسبة والشفافية

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/audit/
  └── page.js                    // سجل التعديلات

📁 lib/
  └── audit-logger.js            // محرك التسجيل
```

##### **ما يُسجل**:
```javascript
- تعديل بيانات موظف
- تسجيل حضور/انصراف
- إضافة/تعديل خصم
- موافقة على إجازة
- اعتماد مرتب
- أي تغيير حساس
```

##### **هيكل البيانات**:
```javascript
{
  id: "AUDIT-20241120-001",
  action: "employee_updated",    // نوع العملية
  
  target: {
    type: "employee",
    id: "EMP-001",
    name: "أحمد محمود"
  },
  
  changes: {
    field: "basicSalary",
    oldValue: 5000,
    newValue: 5500,
    reason: "زيادة دورية"
  },
  
  performedBy: "Admin",
  performedAt: "2024-11-20T10:00:00+02:00",
  
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0..."
}
```

##### **الفوائد**:
- 🔍 **شفافية كاملة** (من عمل إيه ومتى)
- ⚖️ **حل النزاعات** (مين عدّل الراتب؟)
- 🛡️ **أمان** (اكتشاف التلاعب)
- 📊 **مراجعة دقيقة** (للمحاسبين)

---

#### **9️⃣ نظام الورديات (Shifts)** 🕐
**الأولوية**: ⭐⭐  
**المدة**: 1.5 أسبوع  
**الصعوبة**: متوسطة

##### **الوصف**:
إدارة الورديات المتعددة (صباحية/مسائية/ليلية)

##### **الاستخدام**:
```
✅ محلات/مصانع 24 ساعة
✅ مطاعم (وردية صباحية ومسائية)
✅ أمن (ورديات متغيرة)
```

##### **الملفات المطلوبة**:
```javascript
📁 app/employees/shifts/
  ├── page.js                    // إدارة الورديات
  ├── schedule/
  │   └── page.js               // جدول الورديات (تقويم)
  └── settings/
      └── page.js               // إعدادات الورديات

📁 components/
  └── ShiftCalendar.js          // تقويم الورديات التفاعلي
```

##### **تعريف الورديات**:
```javascript
{
  id: "SHIFT-MORNING",
  name: "وردية صباحية",
  startTime: "08:00",
  endTime: "16:00",
  daysOff: ["friday"],
  multiplier: 1.0,              // معامل الراتب (عادي)
  color: "#FFD700"              // للتقويم
}

{
  id: "SHIFT-EVENING",
  name: "وردية مسائية",
  startTime: "16:00",
  endTime: "00:00",
  daysOff: ["friday"],
  multiplier: 1.2,              // 20% زيادة
  color: "#FF8C00"
}

{
  id: "SHIFT-NIGHT",
  name: "وردية ليلية",
  startTime: "00:00",
  endTime: "08:00",
  daysOff: ["friday"],
  multiplier: 1.5,              // 50% زيادة
  color: "#4B0082"
}
```

##### **جدول الورديات**:
```javascript
// لكل موظف
{
  employeeId: "EMP-001",
  month: 11,
  year: 2024,
  
  schedule: [
    { date: "2024-11-01", shiftId: "SHIFT-MORNING" },
    { date: "2024-11-02", shiftId: "SHIFT-MORNING" },
    { date: "2024-11-03", shiftId: "SHIFT-EVENING" },
    { date: "2024-11-04", shiftId: "SHIFT-EVENING" },
    { date: "2024-11-05", shiftId: "SHIFT-NIGHT" },
    // ...
  ]
}
```

##### **التأثير على الحضور والراتب**:
```javascript
// عند تسجيل الحضور
- التحقق من الوردية الصحيحة
- حساب التأخير بناءً على وقت بدء الوردية
- مكافأة الوردية تُضاف للراتب

// في الراتب
earnings.shiftAllowance = totalShiftDays * dailySalary * (multiplier - 1);
```

##### **الفوائد**:
- 🕐 **تنظيم أفضل** لمحلات 24 ساعة
- ⚖️ **عدالة** في توزيع الورديات
- 💰 **حسابات دقيقة** لمكافآت الورديات
- 📊 **تخطيط مسبق** (تقويم شهري)

---

#### **🔟 Mobile App (PWA)** 📱
**الأولوية**: ⭐  
**المدة**: 2 أسابيع  
**الصعوبة**: متوسطة

##### **الوصف**:
تحويل السيستم لـ Progressive Web App للاستخدام من الموبايل

##### **المتطلبات التقنية**:
```javascript
📁 public/
  └── manifest.json             // PWA manifest
  └── service-worker.js         // للـ offline mode

📁 app/
  └── layout.js                 // تسجيل service worker
```

##### **المميزات**:
```javascript
✅ تثبيت على الموبايل (Add to Home Screen)
✅ Offline Mode (العمل بدون نت + مزامنة لاحقة)
✅ Push Notifications (إشعارات فورية)
✅ واجهة مخصصة للموبايل (Responsive++)
```

##### **للموظف**:
```javascript
- تسجيل حضور من موبايله
- شوف راتبه وخصوماته
- طلب إجازة
- شوف رصيد إجازاته
- استقبال تنبيهات
```

##### **للمدير/Admin**:
```javascript
- موافقة على الإجازات من الموبايل
- شوف Dashboard
- تنبيهات فورية (موظف متأخر/غائب)
- مراجعة سريعة
```

##### **الفوائد**:
- 📱 **سهولة للموظفين** (تسجيل من أي مكان)
- 🚀 **إدارة أسرع** (رد على الطلبات فوراً)
- 🌐 **عمل بدون نت** (في حالة انقطاع الإنترنت)
- 💪 **تجربة أفضل** (native-like experience)

---

## 📅 **الجدول الزمني الكامل** (3 شهور)

### **الشهر الأول** - Critical Features 🔴
```
الأسبوع 1-2:  💰 نظام المرتبات (Payroll)
الأسبوع 3:    📊 Dashboard التحليلي
الأسبوع 4:    📄 التقارير (Excel/PDF)
```

### **الشهر الثاني** - Process Optimization 🟡
```
الأسبوع 1-1.5: 🏖️ نظام الإجازات والأذونات
الأسبوع 2:     🔔 التنبيهات الذكية
الأسبوع 3-4:   ⚡ Bulk Actions (عمليات جماعية)
```

### **الشهر الثالث** - Advanced Features 🟢
```
الأسبوع 1-1.5: 💸 العمولات والحوافز
الأسبوع 2:     📝 Audit Log
الأسبوع 3:     🕐 نظام الورديات (اختياري)
الأسبوع 4:     📱 PWA (اختياري)
```

---

## 🎯 **الأولويات الموصى بها**

### **Must Have** (لازم تتعمل):
1. ✅ نظام المرتبات 💰
2. ✅ Dashboard 📊
3. ✅ التقارير 📄
4. ✅ الإجازات 🏖️

### **Should Have** (مهمة جداً):
5. ✅ التنبيهات 🔔
6. ✅ Bulk Actions ⚡
7. ✅ العمولات 💸

### **Nice to Have** (إضافات حلوة):
8. ✅ Audit Log 📝
9. ✅ الورديات 🕐
10. ✅ PWA 📱

---

## 💡 **نصائح التنفيذ**

### **من ناحية Business**:
1. ⭐ **ابدأ بالأهم**: المرتبات هي الأساس
2. 🎯 **اسأل المستخدمين**: إيه اللي محتاجينه فعلاً؟
3. 🚀 **MVP أولاً**: نسخة بسيطة ثم تطوير
4. 📊 **قيس النتائج**: الوقت الموفر، الأخطاء المتجنبة

### **من ناحية Technical**:
1. ✅ **Unit Tests**: خصوصاً للحسابات المالية
2. 💾 **Backup**: export تلقائي كل أسبوع
3. ⚡ **Performance**: pagination لو الموظفين > 50
4. 🔒 **Security**: حماية بيانات الموظفين

### **أفضل الممارسات**:
1. 📝 **توثيق الكود**: كل دالة مهمة
2. 🧪 **اختبار شامل**: كل ميزة قبل الإطلاق
3. 🎨 **UI متسق**: نفس الـ design language
4. ♿ **Accessibility**: سهولة الاستخدام للجميع

---

## 📊 **المقاييس المتوقعة**

### **توفير الوقت**:
- المرتبات: **3-5 ساعات/شهر**
- التقارير: **2-3 ساعات/شهر**
- الإجازات: **1-2 ساعات/شهر**
- **الإجمالي**: 6-10 ساعات شهرياً

### **تحسين الدقة**:
- الحسابات المالية: **99.9%** (بدل 95% يدوي)
- تتبع الحضور: **100%** (لا نسيان)
- تطبيق السياسات: **100%** (تلقائي)

### **رضا الموظفين**:
- شفافية الرواتب: **+40%**
- سهولة طلب الإجازات: **+50%**
- الثقة في النظام: **+60%**

---

## 🚀 **الخطوة التالية**

**عاوز تبدأ في إيه؟**

اختار من:
1. 💰 **نظام المرتبات** (الأهم والأكثر طلباً)
2. 📊 **Dashboard التحليلي** (نظرة شاملة سريعة)
3. 📄 **التقارير** (للمحاسب والمراجعة)
4. أي ميزة أخرى من القائمة

**ملاحظة**: الترتيب المقترح:
```
المرتبات → Dashboard → التقارير → الإجازات → ...
```

---

**تم إعداد هذه الخطة بناءً على**:
- ✅ تحليل السيستم الحالي
- ✅ أفضل الممارسات العالمية
- ✅ احتياجات البيزنس الحقيقية
- ✅ خبرة عملية في أنظمة مشابهة

**آخر تحديث**: 20 نوفمبر 2025
