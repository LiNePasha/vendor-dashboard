"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useEmployeesStore from "@/app/stores/employees-store";
import { uploadToCloudinary } from "@/app/lib/cloudinary";

export default function AddEmployeePage() {
  const router = useRouter();
  const addEmployee = useEmployeesStore((state) => state.addEmployee);

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Personal Info
    name: "",
    nationalId: "",
    phone: "",
    email: "",
    address: "",
    photo: null,
    photoPreview: null,

    // Job Info
    jobTitle: "",
    department: "",
    hireDate: "",

    // Salary
    basicSalary: "",
    allowances: "",

    // Work Schedule
    startTime: "09:00",
    endTime: "17:00",
    workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
    gracePeriod: "15",

    // Status
    status: "active",
  });

  const [errors, setErrors] = useState({});

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
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

    // Required fields
    if (!formData.name.trim()) newErrors.name = "الاسم مطلوب";
    if (!formData.nationalId.trim()) newErrors.nationalId = "الرقم القومي مطلوب";
    if (!formData.phone.trim()) newErrors.phone = "رقم الهاتف مطلوب";
    if (!formData.jobTitle.trim()) newErrors.jobTitle = "المسمى الوظيفي مطلوب";
    if (!formData.hireDate) newErrors.hireDate = "تاريخ التعيين مطلوب";
    if (!formData.basicSalary || parseFloat(formData.basicSalary) <= 0) {
      newErrors.basicSalary = "المرتب الأساسي مطلوب ويجب أن يكون أكبر من 0";
    }

    // Work Days
    if (formData.workDays.length === 0) {
      newErrors.workDays = "يجب اختيار يوم عمل واحد على الأقل";
    }

    // National ID Format (14 digits)
    if (formData.nationalId && !/^\d{14}$/.test(formData.nationalId)) {
      newErrors.nationalId = "الرقم القومي يجب أن يكون 14 رقم";
    }

    // Phone Format (Egyptian)
    if (formData.phone && !/^01[0-2,5]\d{8}$/.test(formData.phone)) {
      newErrors.phone = "رقم الهاتف غير صحيح (مثال: 01012345678)";
    }

    // Email Format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "البريد الإلكتروني غير صحيح";
    }

    // Time Validation (allow night shifts where end time is next day)
    // Only validate if both times are provided and are the same (which would be invalid)
    if (formData.startTime && formData.endTime && formData.startTime === formData.endTime) {
      newErrors.startTime = "وقت البداية والنهاية لا يمكن أن يكونا متطابقين";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("يرجى تصحيح الأخطاء أولاً", "error");
      return;
    }

    setLoading(true);

    try {
      // Upload photo if exists
      let photoUrl = null;
      if (formData.photo) {
        setUploading(true);
        photoUrl = await uploadToCloudinary(formData.photo);
        setUploading(false);
      }

      // Prepare employee data
      const employeeData = {
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

      await addEmployee(employeeData);
      showToast(`✅ تم إضافة ${employeeData.name} بنجاح!`);
      
      // Redirect after 1 second
      setTimeout(() => {
        router.push("/employees");
      }, 1000);
    } catch (error) {
      console.error("Error adding employee:", error);
      showToast(error.message || "حدث خطأ أثناء إضافة الموظف", "error");
    } finally {
      setLoading(false);
    }
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
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-500 hover:text-blue-600 mb-4 flex items-center gap-2"
        >
          ← رجوع
        </button>
        <h1 className="text-3xl font-bold text-gray-800">➕ إضافة موظف جديد</h1>
        <p className="text-gray-500 mt-2">املأ البيانات التالية لإضافة موظف جديد</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        {/* Photo Upload */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📸 الصورة الشخصية</h2>
          
          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="relative">
              {formData.photoPreview ? (
                <div className="relative">
                  <img
                    src={formData.photoPreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, photo: null, photoPreview: null }))}
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
            </div>

            {/* Upload Button */}
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
              <p className="text-xs text-gray-500 mt-2">
                اختياري • الحد الأقصى 5 ميجابايت
              </p>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">👤 البيانات الشخصية</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
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
                  errors.name ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="مثال: أحمد محمد علي"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* National ID */}
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
                  errors.nationalId ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="12345678901234"
              />
              {errors.nationalId && <p className="text-red-500 text-sm mt-1">{errors.nationalId}</p>}
            </div>

            {/* Phone */}
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
                  errors.phone ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="01012345678"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                  errors.email ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="example@email.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                العنوان
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows="2"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: 15 شارع النصر، المنصورة، الدقهلية"
              />
            </div>
          </div>
        </div>

        {/* Job Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">💼 البيانات الوظيفية</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Title */}
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
                  errors.jobTitle ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="مثال: موظف مبيعات"
              />
              {errors.jobTitle && <p className="text-red-500 text-sm mt-1">{errors.jobTitle}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                القسم
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: المبيعات"
              />
            </div>

            {/* Hire Date */}
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
                  errors.hireDate ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
              />
              {errors.hireDate && <p className="text-red-500 text-sm mt-1">{errors.hireDate}</p>}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                الحالة
              </label>
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
            {/* Basic Salary */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                المرتب الأساسي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    handleInputChange({ target: { name: 'basicSalary', value: val } });
                  }
                }}
                className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${
                  errors.basicSalary ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
                placeholder="0.00"
              />
              {errors.basicSalary && <p className="text-red-500 text-sm mt-1">{errors.basicSalary}</p>}
            </div>

            {/* Allowances */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                البدلات
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="allowances"
                value={formData.allowances}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    handleInputChange({ target: { name: 'allowances', value: val } });
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Total Preview */}
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
          <h2 className="text-lg font-bold text-gray-800 mb-4">⏰ جدول العمل ) </h2>
          
          <div className="space-y-4">
            {/* Work Time */}
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
                    errors.startTime ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  فترة السماح (دقيقة)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="gracePeriod"
                  value={formData.gracePeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (/^\d+$/.test(val) && parseInt(val) <= 60)) {
                      handleInputChange({ target: { name: 'gracePeriod', value: val } });
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0-60"
                />
              </div>
            </div>

            {/* Work Days */}
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
            onClick={() => router.back()}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-lg transition-colors"
            disabled={loading}
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {uploading ? "⏳ جاري رفع الصورة..." : loading ? "⏳ جاري الحفظ..." : "✅ إضافة الموظف"}
          </button>
        </div>
      </form>
    </div>
  );
}
