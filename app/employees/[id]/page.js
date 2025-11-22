"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import { uploadToCloudinary } from "@/app/lib/cloudinary";
import { employeesStorage } from "@/app/lib/employees-storage";
import { formatMinutesToArabic } from "@/app/lib/time-helpers";
import AddDeductionModal from "@/components/AddDeductionModal";

export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id;

  const employees = useEmployeesStore((state) => state.employees);
  const updateEmployee = useEmployeesStore((state) => state.updateEmployee);
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees);

  const [employee, setEmployee] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [showAddDeductionModal, setShowAddDeductionModal] = useState(false);
  const [openWeeks, setOpenWeeks] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Form data (for edit mode)
  const [formData, setFormData] = useState({
    name: "",
    nationalId: "",
    phone: "",
    email: "",
    address: "",
    photo: null,
    photoPreview: null,
    jobTitle: "",
    department: "",
    hireDate: "",
    basicSalary: "",
    allowances: "",
    startTime: "",
    endTime: "",
    workDays: [],
    gracePeriod: "",
    status: "active",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      setEmployee(emp);
      loadDeductions(emp.id);
      loadAttendance(emp.id);
      // Initialize form data
      setFormData({
        name: emp.name || "",
        nationalId: emp.nationalId || "",
        phone: emp.phone || "",
        email: emp.email || "",
        address: emp.address || "",
        photo: null,
        photoPreview: emp.photo || null,
        jobTitle: emp.jobTitle || "",
        department: emp.department || "",
        hireDate: emp.hireDate || "",
        basicSalary: emp.basicSalary?.toString() || "",
        allowances: emp.allowances?.toString() || "0",
        startTime: emp.workSchedule?.startTime || "09:00",
        endTime: emp.workSchedule?.endTime || "17:00",
        workDays: emp.workSchedule?.workDays || [],
        gracePeriod: emp.workSchedule?.gracePeriod?.toString() || "15",
        status: emp.status || "active",
      });
    }
  }, [employees, employeeId]);

  const loadDeductions = async (empId) => {
    try {
      const now = new Date();
      const allDeductions = await employeesStorage.getDeductionsByEmployee(
        empId,
        now.getMonth() + 1,
        now.getFullYear()
      );
      setDeductions(allDeductions);
    } catch (error) {
      console.error("Error loading deductions:", error);
    }
  };

  const loadAttendance = async (empId) => {
    try {
      const now = new Date();
      const allAttendance = await employeesStorage.getAttendanceByEmployee(
        empId,
        now.getMonth() + 1,
        now.getFullYear()
      );
      // Sort by date descending (newest first)
      const sorted = allAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendanceRecords(sorted);
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  const handleDeductionAdded = () => {
    showToast("✅ تم إضافة الخصم بنجاح!");
    if (employee) {
      loadDeductions(employee.id);
    }
  };

  const formatTimeTo12Hour = (time24) => {
    if (!time24) return '-';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'م' : 'ص';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleWorkDayToggle = (day) => {
    setFormData((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day],
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("حجم الصورة يجب ألا يتجاوز 5 ميجابايت", "error");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "الاسم مطلوب";
    if (!formData.nationalId.trim()) newErrors.nationalId = "الرقم القومي مطلوب";
    if (!formData.phone.trim()) newErrors.phone = "رقم الهاتف مطلوب";
    if (!formData.jobTitle.trim()) newErrors.jobTitle = "المسمى الوظيفي مطلوب";
    if (!formData.hireDate) newErrors.hireDate = "تاريخ التعيين مطلوب";
    if (!formData.basicSalary || parseFloat(formData.basicSalary) <= 0) {
      newErrors.basicSalary = "المرتب الأساسي مطلوب";
    }
    if (formData.workDays.length === 0) {
      newErrors.workDays = "يجب اختيار يوم عمل واحد على الأقل";
    }
    if (formData.nationalId && !/^\d{14}$/.test(formData.nationalId)) {
      newErrors.nationalId = "الرقم القومي يجب أن يكون 14 رقم";
    }
    if (formData.phone && !/^01[0-2,5]\d{8}$/.test(formData.phone)) {
      newErrors.phone = "رقم الهاتف غير صحيح";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "البريد الإلكتروني غير صحيح";
    }
    if (formData.startTime && formData.endTime && formData.startTime === formData.endTime) {
      newErrors.startTime = "وقت البداية والنهاية لا يمكن أن يكونا متطابقين";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showToast("يرجى تصحيح الأخطاء أولاً", "error");
      return;
    }

    setLoading(true);

    try {
      let photoUrl = employee.photo;
      
      if (formData.photo) {
        setUploading(true);
        photoUrl = await uploadToCloudinary(formData.photo);
        setUploading(false);
      }

      const updatedData = {
        ...employee,
        name: formData.name.trim(),
        nationalId: formData.nationalId.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        photo: photoUrl,
        jobTitle: formData.jobTitle.trim(),
        department: formData.department.trim() || undefined,
        hireDate: formData.hireDate,
        basicSalary: parseFloat(formData.basicSalary),
        allowances: parseFloat(formData.allowances) || 0,
        workSchedule: {
          startTime: formData.startTime,
          endTime: formData.endTime,
          workDays: formData.workDays,
          gracePeriod: parseInt(formData.gracePeriod) || 15,
        },
        status: formData.status,
      };

      await updateEmployee(employee.id, updatedData);
      showToast(`✅ تم تحديث بيانات ${updatedData.name} بنجاح!`);
      setIsEditMode(false);
    } catch (error) {
      console.error("Error updating employee:", error);
      showToast(error.message || "حدث خطأ أثناء التحديث", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data
    if (employee) {
      setFormData({
        name: employee.name || "",
        nationalId: employee.nationalId || "",
        phone: employee.phone || "",
        email: employee.email || "",
        address: employee.address || "",
        photo: null,
        photoPreview: employee.photo || null,
        jobTitle: employee.jobTitle || "",
        department: employee.department || "",
        hireDate: employee.hireDate || "",
        basicSalary: employee.basicSalary?.toString() || "",
        allowances: employee.allowances?.toString() || "0",
        startTime: employee.workSchedule?.startTime || "09:00",
        endTime: employee.workSchedule?.endTime || "17:00",
        workDays: employee.workSchedule?.workDays || [],
        gracePeriod: employee.workSchedule?.gracePeriod?.toString() || "15",
        status: employee.status || "active",
      });
    }
    setErrors({});
    setIsEditMode(false);
  };

  const weekDays = [
    { id: "saturday", label: "السبت" },
    { id: "sunday", label: "الأحد" },
    { id: "monday", label: "الاثنين" },
    { id: "tuesday", label: "الثلاثاء" },
    { id: "wednesday", label: "الأربعاء" },
    { id: "thursday", label: "الخميس" },
    { id: "friday", label: "الجمعة" },
  ];

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

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/employees')}
            className="text-blue-500 hover:text-blue-600 mb-2 flex items-center gap-2"
          >
            ← رجوع للقائمة
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            {isEditMode ? "✏️ تعديل بيانات الموظف" : "👤 بيانات الموظف"}
          </h1>
        </div>
        
        {!isEditMode && (
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/employees/${employeeId}/deductions`)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>💸</span>
              <span>الخصومات</span>
            </button>
            <button
              onClick={() => router.push(`/employees/${employee.id}/sales`)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>📊</span>
              <span>تقارير المبيعات</span>
            </button>
            <button
              onClick={() => setIsEditMode(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>✏️</span>
              <span>تعديل البيانات</span>
            </button>
          </div>
        )}
      </div>

      {/* View Mode */}
      {!isEditMode ? (
        <div className="max-w-4xl">
          {/* Photo & Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <div className="flex items-start gap-6">
              {/* Photo */}
              <div>
                {employee.photo ? (
                  <img
                    src={employee.photo}
                    alt={employee.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center text-5xl font-bold">
                    {employee.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl font-bold text-gray-800">{employee.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    employee.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {employee.status === 'active' ? '✅ نشط' : '❌ غير نشط'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">الكود:</span>
                    <span className="font-semibold text-gray-800 mr-2">{employee.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">الوظيفة:</span>
                    <span className="font-semibold text-gray-800 mr-2">{employee.jobTitle}</span>
                  </div>
                  {employee.department && (
                    <div>
                      <span className="text-gray-500">القسم:</span>
                      <span className="font-semibold text-gray-800 mr-2">{employee.department}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">تاريخ التعيين:</span>
                    <span className="font-semibold text-gray-800 mr-2">
                      {new Date(employee.hireDate).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📋 البيانات الشخصية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">الرقم القومي</label>
                <p className="font-semibold text-gray-800">{employee.nationalId}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">رقم الهاتف</label>
                <p className="font-semibold text-gray-800">{employee.phone}</p>
              </div>
              {employee.email && (
                <div>
                  <label className="text-sm text-gray-500">البريد الإلكتروني</label>
                  <p className="font-semibold text-gray-800">{employee.email}</p>
                </div>
              )}
              {employee.address && (
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500">العنوان</label>
                  <p className="font-semibold text-gray-800">{employee.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Salary Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">💰 بيانات المرتب</h3>
              <button
                onClick={() => setShowAddDeductionModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>إضافة خصم سريع</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-sm text-gray-500">المرتب الأساسي</label>
                <p className="text-xl font-bold text-gray-800">{employee.basicSalary?.toLocaleString()} ج.م</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">البدلات</label>
                <p className="text-xl font-bold text-gray-800">{(employee.allowances || 0).toLocaleString()} ج.م</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">الإجمالي</label>
                <p className="text-xl font-bold text-blue-600">
                  {((employee.basicSalary || 0) + (employee.allowances || 0)).toLocaleString()} ج.م
                </p>
              </div>
            </div>

            {/* Deductions Section */}
            {deductions.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">💸 الخصومات (الشهر الحالي)</h4>
                  <button
                    onClick={() => router.push(`/employees/${employee.id}/deductions`)}
                    className="text-blue-500 hover:text-blue-600 text-sm font-semibold"
                  >
                    عرض الكل ←
                  </button>
                </div>
                
                <div className="space-y-2 mb-4">
                  {deductions.slice(0, 3).map((deduction) => {
                    const typeInfo = {
                      advance: { icon: '💰', label: 'سُلفة', color: 'blue' },
                      penalty: { icon: '⚠️', label: 'جزاء', color: 'red' },
                      other: { icon: '📝', label: 'أخرى', color: 'gray' },
                    };
                    const info = typeInfo[deduction.type] || typeInfo.other;
                    
                    // Format date and time
                    let dateTimeStr = new Date(deduction.date).toLocaleDateString('ar-EG');
                    if (deduction.time) {
                      const [hours, minutes] = deduction.time.split(':');
                      const hour = parseInt(hours);
                      const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      dateTimeStr += ` • ${displayHour}:${minutes} ${period}`;
                    }
                    
                    return (
                      <div key={deduction.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{info.icon}</span>
                          <div>
                            <div className="font-semibold text-gray-800 text-sm">{deduction.reason}</div>
                            <div className="text-xs text-gray-500">
                              {dateTimeStr} • {info.label}
                            </div>
                          </div>
                        </div>
                        <div className="text-red-600 font-bold">
                          {deduction.amount.toLocaleString()} ج.م
                        </div>
                      </div>
                    );
                  })}
                  {deductions.length > 3 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      + {deductions.length - 3} خصم آخر
                    </div>
                  )}
                </div>

                <div className="bg-red-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">إجمالي الخصومات:</span>
                  <span className="text-xl font-bold text-red-600">
                    {deductions.reduce((sum, d) => sum + d.amount, 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Work Schedule */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⏰ جدول العمل  </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-500">وقت البداية</label>
                <p className="font-semibold text-gray-800">{formatTimeTo12Hour(employee.workSchedule?.startTime)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">وقت النهاية</label>
                <p className="font-semibold text-gray-800">{formatTimeTo12Hour(employee.workSchedule?.endTime)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">فترة السماح</label>
                <p className="font-semibold text-gray-800">{employee.workSchedule?.gracePeriod} دقيقة</p>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500 mb-2 block">أيام العمل</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <span
                    key={day.id}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                      employee.workSchedule?.workDays?.includes(day.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {day.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance Records */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">📊 سجلات الحضور (الشهر الحالي)</h3>
              <button
                onClick={() => router.push('/employees/attendance/record')}
                className="text-blue-500 hover:text-blue-600 text-sm font-semibold"
              >
                تسجيل حضور جديد ←
              </button>
            </div>

            {attendanceRecords.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-lg">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500">لا توجد سجلات حضور لهذا الشهر</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{attendanceRecords.length}</div>
                    <div className="text-xs text-gray-600">يوم حضور</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {attendanceRecords.filter(r => !r.checkIn.late).length}
                    </div>
                    <div className="text-xs text-gray-600">في الوقت</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {attendanceRecords.filter(r => r.checkIn.late).length}
                    </div>
                    <div className="text-xs text-gray-600">تأخير</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {attendanceRecords.filter(r => r.checkOut?.overtime).length}
                    </div>
                    <div className="text-xs text-gray-600">عمل إضافي</div>
                  </div>
                </div>

                {/* Group records by week */}
                {(() => {
                  // Group by week
                  const weeks = {};
                  attendanceRecords.forEach(record => {
                    const date = new Date(record.date);
                    const dayOfMonth = date.getDate();
                    let weekNum;
                    if (dayOfMonth <= 7) weekNum = 1;
                    else if (dayOfMonth <= 14) weekNum = 2;
                    else if (dayOfMonth <= 21) weekNum = 3;
                    else weekNum = 4;
                    
                    if (!weeks[weekNum]) weeks[weekNum] = [];
                    weeks[weekNum].push(record);
                  });

                  // Sort weeks descending (newest first)
                  const sortedWeeks = Object.keys(weeks).sort((a, b) => b - a);

                  return (
                    <div className="space-y-3">
                      {sortedWeeks.map(weekNum => {
                        const weekRecords = weeks[weekNum];
                        const isOpen = openWeeks[weekNum] !== false; // Open by default
                        
                        // Calculate week stats
                        const weekStats = {
                          total: weekRecords.length,
                          onTime: weekRecords.filter(r => !r.checkIn.late).length,
                          late: weekRecords.filter(r => r.checkIn.late).length,
                          overtime: weekRecords.filter(r => r.checkOut?.overtime).length,
                          totalHours: weekRecords.reduce((sum, r) => sum + (r.calculations?.totalHours || 0), 0)
                        };

                        return (
                          <div key={weekNum} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Week Header - Clickable */}
                            <button
                              onClick={() => setOpenWeeks(prev => ({ ...prev, [weekNum]: !isOpen }))}
                              className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 p-4 flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {isOpen ? '📂' : '📁'}
                                </span>
                                <div className="text-right">
                                  <div className="font-bold text-gray-800">
                                    الأسبوع {weekNum === '1' ? 'الأول' : weekNum === '2' ? 'الثاني' : weekNum === '3' ? 'الثالث' : 'الرابع'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {weekStats.total} يوم • {weekStats.totalHours.toFixed(1)} ساعة
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {/* Mini stats */}
                                <div className="flex gap-2 ml-4">
                                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-semibold">
                                    ✅ {weekStats.onTime}
                                  </span>
                                  {weekStats.late > 0 && (
                                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-semibold">
                                      ⚠️ {weekStats.late}
                                    </span>
                                  )}
                                  {weekStats.overtime > 0 && (
                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-semibold">
                                      ⭐ {weekStats.overtime}
                                    </span>
                                  )}
                                </div>
                                
                                <span className={`text-xl transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                  ▼
                                </span>
                              </div>
                            </button>

                            {/* Week Records - Collapsible */}
                            {isOpen && (
                              <div className="p-4 space-y-2 bg-white">
                                {weekRecords.map((record) => {
                                  // Format check-in time
                                  let checkInDisplay = '';
                                  if (record.checkIn?.time) {
                                    const [hours, minutes] = record.checkIn.time.split(':');
                                    const hour = parseInt(hours);
                                    const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                    checkInDisplay = `${displayHour}:${minutes} ${period}`;
                                  }

                                  // Format check-out time
                                  let checkOutDisplay = '';
                                  if (record.checkOut?.time) {
                                    const [hours, minutes] = record.checkOut.time.split(':');
                                    const hour = parseInt(hours);
                                    const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                    checkOutDisplay = `${displayHour}:${minutes} ${period}`;
                                  }

                                  return (
                                    <div key={record.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                          <div className="text-2xl">
                                            {record.checkIn.late ? '⚠️' : record.checkOut?.overtime ? '⭐' : '✅'}
                                          </div>
                                          <div>
                                            <div className="font-bold text-gray-800">
                                              {new Date(record.date).toLocaleDateString('ar-EG', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })}
                                            </div>
                                            <div className="text-xs text-gray-500">{record.dayName}</div>
                                          </div>
                                        </div>
                                        <div className="text-left">
                                          <div className="text-sm font-semibold text-gray-700">
                                            {record.calculations?.totalHours?.toFixed(1) || 0} ساعة
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                                        {/* Check In */}
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">الحضور</div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-blue-600">{checkInDisplay}</span>
                                            {record.checkIn.late && (
                                              <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                                تأخير {formatMinutesToArabic(record.checkIn.lateMinutes)}
                                              </span>
                                            )}
                                            {record.checkIn.gracePeriodUsed && (
                                              <span className="bg-yellow-100 text-yellow-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                                سماح
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Check Out */}
                                        <div>
                                          <div className="text-xs text-gray-500 mb-1">الانصراف</div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-green-600">{checkOutDisplay || '-'}</span>
                                            {record.checkOut?.early && (
                                              <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                                مبكر {formatMinutesToArabic(record.checkOut.earlyMinutes)}
                                              </span>
                                            )}
                                            {record.checkOut?.overtime && (
                                              <span className="bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                                إضافي {formatMinutesToArabic(record.checkOut.overtimeMinutes)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Admin Notes Section */}
                                      {record.adminNotes && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <div className="text-xs">
                                            <span className="text-gray-500">ملاحظات:</span>{' '}
                                            <span className="text-gray-700">{record.adminNotes}</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Add/Edit Note Button */}
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        <button
                                          onClick={() => {
                                            setEditingNote(record.id);
                                            setNoteText(record.adminNotes || '');
                                          }}
                                          className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1"
                                        >
                                          <span>📝</span>
                                          <span>{record.adminNotes ? 'تعديل الملاحظات' : 'إضافة ملاحظات'}</span>
                                        </button>
                                      </div>

                                      {(record.checkIn.note || record.checkOut?.note) && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <div className="text-xs text-gray-600">
                                            {record.checkIn.note && <span>📝 {record.checkIn.note}</span>}
                                            {record.checkIn.note && record.checkOut?.note && ' • '}
                                            {record.checkOut?.note && <span>📝 {record.checkOut.note}</span>}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <form className="max-w-4xl">
          {/* Photo Upload */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">📸 الصورة الشخصية</h2>
            <div className="flex items-center gap-6">
              {formData.photoPreview ? (
                <div className="relative">
                  <img
                    src={formData.photoPreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, photo: null, photoPreview: employee.photo }))}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-4xl text-gray-400">
                  👤
                </div>
              )}
              <div>
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors inline-block"
                >
                  {formData.photoPreview ? "تغيير الصورة" : "اختيار صورة"}
                </label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">👤 البيانات الشخصية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.name ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الرقم القومي <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nationalId"
                  value={formData.nationalId}
                  onChange={handleInputChange}
                  maxLength="14"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.nationalId ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.nationalId && <p className="text-red-500 text-sm mt-1">{errors.nationalId}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  رقم الهاتف <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.phone ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.email ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="2"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Job Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">💼 البيانات الوظيفية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المسمى الوظيفي <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.jobTitle ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.jobTitle && <p className="text-red-500 text-sm mt-1">{errors.jobTitle}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">القسم</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  تاريخ التعيين <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="hireDate"
                  value={formData.hireDate}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.hireDate ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.hireDate && <p className="text-red-500 text-sm mt-1">{errors.hireDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="active">✅ نشط</option>
                  <option value="inactive">❌ غير نشط</option>
                </select>
              </div>
            </div>
          </div>

          {/* Salary */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">💰 المرتب</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  المرتب الأساسي <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="basicSalary"
                  value={formData.basicSalary}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                    errors.basicSalary ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.basicSalary && <p className="text-red-500 text-sm mt-1">{errors.basicSalary}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البدلات</label>
                <input
                  type="number"
                  name="allowances"
                  value={formData.allowances}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-semibold">إجمالي المرتب:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {(parseFloat(formData.basicSalary || 0) + parseFloat(formData.allowances || 0)).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Work Schedule */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">⏰ جدول العمل</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    وقت البداية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                      errors.startTime ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">ص = صباحاً (AM) | م = مساءً (PM) • مثال: 9:00 ص</p>
                  {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    وقت النهاية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">ص = صباحاً (AM) | م = مساءً (PM) • مثال: 5:00 م</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">فترة السماح (دقيقة)</label>
                  <input
                    type="number"
                    name="gracePeriod"
                    value={formData.gracePeriod}
                    onChange={handleInputChange}
                    min="0"
                    max="60"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  أيام العمل <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleWorkDayToggle(day.id)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        formData.workDays.includes(day.id)
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {errors.workDays && <p className="text-red-500 text-sm mt-1">{errors.workDays}</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-lg transition-colors"
              disabled={loading}
            >
              ❌ إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || uploading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all"
            >
              {uploading ? "⏳ جاري رفع الصورة..." : loading ? "⏳ جاري الحفظ..." : "✅ حفظ التغييرات"}
            </button>
          </div>
        </form>
      )}

      {/* Add Deduction Modal */}
      <AddDeductionModal
        employee={employee}
        isOpen={showAddDeductionModal}
        onClose={() => setShowAddDeductionModal(false)}
        onSuccess={handleDeductionAdded}
      />

      {/* Notes Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📝 الملاحظات الإدارية</h3>
            
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="أضف ملاحظاتك هنا..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none"
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={async () => {
                  try {
                    // Update attendance record with note
                    const record = attendanceRecords.find(r => r.id === editingNote);
                    if (record) {
                      const updated = { ...record, adminNotes: noteText };
                      await employeesStorage.saveAttendance(updated);
                      
                      // Reload attendance records
                      const records = await employeesStorage.getAllAttendance();
                      const employeeRecords = records.filter(r => r.employeeId === employeeId);
                      setAttendanceRecords(employeeRecords);
                      
                      showToast('✅ تم حفظ الملاحظات بنجاح!');
                    }
                    setEditingNote(null);
                    setNoteText('');
                  } catch (error) {
                    console.error('Error saving note:', error);
                    showToast('❌ حدث خطأ أثناء حفظ الملاحظات', 'error');
                  }
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-bold transition-colors"
              >
                حفظ
              </button>
              <button
                onClick={() => {
                  setEditingNote(null);
                  setNoteText('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
