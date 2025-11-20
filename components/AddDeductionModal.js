"use client";

import { useState } from "react";
import { employeesStorage } from "@/app/lib/employees-storage";
import { getCurrentEgyptTime, formatEgyptTime } from "@/app/lib/time-helpers";

export default function AddDeductionModal({ employee, isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'advance',
    amount: '',
    reason: '',
    note: '',
    date: formatEgyptTime(getCurrentEgyptTime(), 'yyyy-MM-dd'),
    time: formatEgyptTime(getCurrentEgyptTime(), 'HH:mm'),
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "المبلغ مطلوب ويجب أن يكون أكبر من صفر";
    }

    if (!formData.reason.trim()) {
      newErrors.reason = "السبب مطلوب";
    }

    if (!formData.date) {
      newErrors.date = "التاريخ مطلوب";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateDeductionId = () => {
    const now = getCurrentEgyptTime();
    const dateStr = formatEgyptTime(now, 'yyyyMMdd');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DED-${dateStr}-${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create full datetime from date + time
      const dateTimeStr = `${formData.date}T${formData.time}:00`;
      const deductionDateTime = new Date(dateTimeStr);

      const deduction = {
        id: generateDeductionId(),
        employeeId: employee.id,
        employeeName: employee.name,
        type: formData.type,
        amount: parseFloat(formData.amount),
        reason: formData.reason.trim(),
        note: formData.note.trim() || undefined,
        date: formData.date,
        time: formData.time,
        dateTime: deductionDateTime.toISOString(),
        status: 'active',
        createdAt: getCurrentEgyptTime().toISOString(),
        updatedAt: getCurrentEgyptTime().toISOString(),
      };

      await employeesStorage.saveDeduction(deduction);
      
      // 📝 تسجيل في Audit Log
      try {
        const { logDeductionAdded } = await import('@/app/lib/audit-logger');
        const result = await logDeductionAdded(deduction);
        console.log('✅ Deduction logged in audit (Modal):', result);
      } catch (error) {
        console.error('❌ Failed to log deduction (Modal):', error);
      }
      
      // Reset form
      setFormData({
        type: 'advance',
        amount: '',
        reason: '',
        note: '',
        date: formatEgyptTime(getCurrentEgyptTime(), 'yyyy-MM-dd'),
        time: formatEgyptTime(getCurrentEgyptTime(), 'HH:mm'),
      });
      setErrors({});
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error adding deduction:", error);
      setErrors({ submit: error.message || "حدث خطأ أثناء إضافة الخصم" });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const deductionTypes = [
    { value: 'advance', label: '💰 سُلفة', color: 'blue' },
    { value: 'penalty', label: '⚠️ جزاء / خصم', color: 'red' },
    { value: 'other', label: '📝 أخرى', color: 'gray' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">💸 إضافة خصم سريع</h2>
            <p className="text-sm text-gray-500 mt-1">
              للموظف: <strong>{employee.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
              {errors.submit}
            </div>
          )}

          {/* Deduction Type */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              نوع الخصم <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {deductionTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleInputChange({ target: { name: 'type', value: type.value } })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.type === type.value
                      ? `border-${type.color}-500 bg-${type.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">{type.label.split(' ')[0]}</div>
                    <div className="text-sm font-semibold">{type.label.split(' ').slice(1).join(' ')}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              المبلغ (ج.م) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              min="0"
              step="0.01"
              className={`w-full border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 ${
                errors.amount ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
              }`}
              placeholder="0.00"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                التاريخ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${
                  errors.date ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
              />
              {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                الوقت <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleInputChange}
                className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${
                  errors.time ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                }`}
              />
              {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
            </div>
          </div>

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              السبب <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${
                errors.reason ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
              }`}
              placeholder={
                formData.type === 'advance' ? 'مثال: سُلفة شخصية' :
                formData.type === 'penalty' ? 'مثال: تأخير متكرر' :
                'مثال: خصم آخر'
              }
            />
            {errors.reason && <p className="text-red-500 text-sm mt-1">{errors.reason}</p>}
          </div>

          {/* Note */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ملاحظات (اختياري)
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleInputChange}
              rows="3"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-700 mb-2">📝 ملخص الخصم:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">النوع:</span>
                <span className="font-semibold">
                  {deductionTypes.find(t => t.value === formData.type)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">المبلغ:</span>
                <span className="font-bold text-red-600">
                  {formData.amount ? parseFloat(formData.amount).toLocaleString() : '0'} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">التاريخ والوقت:</span>
                <span className="font-semibold">
                  {formData.date && formData.time ? (
                    <>
                      {new Date(formData.date).toLocaleDateString('ar-EG')}
                      {' • '}
                      {(() => {
                        const [hours, minutes] = formData.time.split(':');
                        const hour = parseInt(hours);
                        const period = hour >= 12 ? 'مساءً' : 'صباحاً';
                        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                        return `${displayHour}:${minutes} ${period}`;
                      })()}
                    </>
                  ) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition-colors"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 rounded-lg transition-all"
            >
              {loading ? "⏳ جاري الحفظ..." : "✅ إضافة الخصم"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
