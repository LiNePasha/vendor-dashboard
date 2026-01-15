"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeesStorage } from "@/app/lib/employees-storage";
import { getCurrentEgyptTime, formatEgyptTime } from "@/app/lib/time-helpers";

export default function AdvancedDemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateEmployeeId = () => {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `EMP-${random}`;
  };

  const generateId = (prefix) => {
    const now = getCurrentEgyptTime();
    const dateStr = formatEgyptTime(now, 'yyyyMMdd');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${dateStr}-${random}`;
  };

  const getRandomTime = (baseHour, minuteVariation = 30) => {
    const hour = baseHour;
    const minute = Math.floor(Math.random() * minuteVariation);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const addMinutesToTime = (time, minutes) => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newHour = Math.floor(totalMinutes / 60) % 24;
    const newMinute = totalMinutes % 60;
    return `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const isWorkDay = (date, workDays) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    return workDays.includes(dayName);
  };

  const generateComprehensiveDemo = async () => {
    setLoading(true);
    setProgress("بدء توليد البيانات التجريبية...");
    
    try {
      const now = getCurrentEgyptTime();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);

      // إحصائيات
      let totalStats = {
        employees: 0,
        attendance: 0,
        deductions: 0,
        advances: 0,
        leaves: 0
      };

      // 1. إنشاء الموظفين
      setProgress("📝 إنشاء الموظفين...");
      
      const employees = [
        {
          id: generateEmployeeId(),
          name: "أحمد محمود السيد",
          nationalId: "29012012345678",
          phone: "01012345678",
          email: "ahmed.mahmoud@spare2app.com",
          address: "القاهرة، مصر الجديدة",
          photo: null,
          jobTitle: "مدير المبيعات",
          department: "المبيعات",
          hireDate: "2023-01-15",
          basicSalary: 8000,
          allowances: 1500,
          workSchedule: {
            startTime: "09:00",
            endTime: "17:00",
            workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
            gracePeriod: 15
          },
          status: "active",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        },
        {
          id: generateEmployeeId(),
          name: "فاطمة حسن علي",
          nationalId: "29506012345679",
          phone: "01112345678",
          email: "fatma.hassan@spare2app.com",
          address: "الجيزة، المهندسين",
          photo: null,
          jobTitle: "محاسبة",
          department: "المالية",
          hireDate: "2023-06-01",
          basicSalary: 6000,
          allowances: 800,
          workSchedule: {
            startTime: "08:30",
            endTime: "16:30",
            workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
            gracePeriod: 10
          },
          status: "active",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        },
        {
          id: generateEmployeeId(),
          name: "محمد عبد الرحمن",
          nationalId: "29103012345680",
          phone: "01212345678",
          email: "mohamed.abdelrahman@spare2app.com",
          address: "القاهرة، مدينة نصر",
          photo: null,
          jobTitle: "فني صيانة",
          department: "الصيانة",
          hireDate: "2024-02-10",
          basicSalary: 5000,
          allowances: 500,
          workSchedule: {
            startTime: "08:00",
            endTime: "16:00",
            workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday", "saturday"],
            gracePeriod: 15
          },
          status: "active",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        },
        {
          id: generateEmployeeId(),
          name: "نور الدين خالد",
          nationalId: "29807012345681",
          phone: "01512345678",
          email: "noureldeen.khaled@spare2app.com",
          address: "الجيزة، الدقي",
          photo: null,
          jobTitle: "موظف استقبال",
          department: "الإدارة",
          hireDate: "2024-08-01",
          basicSalary: 4500,
          allowances: 300,
          workSchedule: {
            startTime: "09:00",
            endTime: "18:00",
            workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday", "saturday"],
            gracePeriod: 20
          },
          status: "active",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        },
        {
          id: generateEmployeeId(),
          name: "سارة أحمد محمد",
          nationalId: "29204012345682",
          phone: "01612345678",
          email: "sara.ahmed@spare2app.com",
          address: "القاهرة، التجمع الخامس",
          photo: null,
          jobTitle: "مسؤولة موارد بشرية",
          department: "الموارد البشرية",
          hireDate: "2023-03-20",
          basicSalary: 7000,
          allowances: 1000,
          workSchedule: {
            startTime: "08:00",
            endTime: "16:00",
            workDays: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
            gracePeriod: 10
          },
          status: "active",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        }
      ];

      // حفظ الموظفين
      for (const emp of employees) {
        await employeesStorage.saveEmployee(emp);
        totalStats.employees++;
      }

      setProgress(`✅ تم إنشاء ${employees.length} موظفين`);

      // 2. إنشاء سجلات الحضور لشهر كامل
      setProgress("⏰ إنشاء سجلات الحضور للشهر...");

      for (const employee of employees) {
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(currentYear, currentMonth - 1, day);
          const dateStr = formatEgyptTime(date, 'yyyy-MM-dd');
          
          // تخطي الأيام المستقبلية
          if (date > now) continue;

          // تحقق من يوم العمل
          if (!isWorkDay(date, employee.workSchedule.workDays)) continue;

          // احتمال الإجازة (5%)
          if (Math.random() < 0.05) {
            // إضافة إجازة
            const leave = {
              id: generateId('LEAVE'),
              employeeId: employee.id,
              employeeName: employee.name,
              type: Math.random() > 0.5 ? 'sick' : 'personal',
              startDate: dateStr,
              endDate: dateStr,
              days: 1,
              reason: Math.random() > 0.5 ? 'ظرف طارئ' : 'مرض',
              status: 'approved',
              createdAt: date.toISOString(),
              updatedAt: date.toISOString()
            };
            await employeesStorage.saveLeave(leave);
            totalStats.leaves++;
            continue;
          }

          // احتمال الغياب (3%)
          if (Math.random() < 0.03) {
            continue; // غياب بدون تسجيل
          }

          // توليد وقت الحضور
          const scheduleStart = employee.workSchedule.startTime;
          const [startHour, startMinute] = scheduleStart.split(':').map(Number);
          
          // احتمالات التأخير
          let checkInTime = scheduleStart;
          let lateMinutes = 0;
          let gracePeriodUsed = false;
          
          const lateChance = Math.random();
          if (lateChance < 0.15) {
            // تأخير كبير (15-60 دقيقة)
            lateMinutes = 15 + Math.floor(Math.random() * 45);
            checkInTime = addMinutesToTime(scheduleStart, lateMinutes);
          } else if (lateChance < 0.30) {
            // تأخير بسيط (5-15 دقيقة)
            lateMinutes = 5 + Math.floor(Math.random() * 10);
            checkInTime = addMinutesToTime(scheduleStart, lateMinutes);
            if (lateMinutes <= employee.workSchedule.gracePeriod) {
              gracePeriodUsed = true;
            }
          } else {
            // حضور مبكر أو في الوقت
            const earlyMinutes = Math.floor(Math.random() * 15);
            checkInTime = addMinutesToTime(scheduleStart, -earlyMinutes);
          }

          const checkInDateTime = new Date(`${dateStr}T${checkInTime}:00`);

          // توليد وقت الانصراف
          const scheduleEnd = employee.workSchedule.endTime;
          const [endHour, endMinute] = scheduleEnd.split(':').map(Number);
          
          let checkOutTime = scheduleEnd;
          let earlyMinutes = 0;
          let overtimeMinutes = 0;
          
          const earlyChance = Math.random();
          if (earlyChance < 0.10) {
            // انصراف مبكر (15-60 دقيقة)
            earlyMinutes = 15 + Math.floor(Math.random() * 45);
            checkOutTime = addMinutesToTime(scheduleEnd, -earlyMinutes);
          } else if (earlyChance < 0.25) {
            // عمل إضافي (30-120 دقيقة)
            overtimeMinutes = 30 + Math.floor(Math.random() * 90);
            checkOutTime = addMinutesToTime(scheduleEnd, overtimeMinutes);
          } else {
            // انصراف في الوقت أو متأخر قليلاً
            const variance = Math.floor(Math.random() * 20) - 5;
            checkOutTime = addMinutesToTime(scheduleEnd, variance);
          }

          const checkOutDateTime = new Date(`${dateStr}T${checkOutTime}:00`);

          // حساب ساعات العمل
          const workMinutes = (checkOutDateTime - checkInDateTime) / (1000 * 60);
          const workHours = workMinutes / 60;

          const attendance = {
            id: generateId('ATT'),
            employeeId: employee.id,
            employeeName: employee.name,
            date: dateStr,
            dayName: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()],
            checkIn: {
              time: checkInTime,
              timestamp: checkInDateTime.toISOString(),
              late: lateMinutes > (gracePeriodUsed ? employee.workSchedule.gracePeriod : 0),
              lateMinutes: lateMinutes,
              gracePeriodUsed: gracePeriodUsed,
              note: lateMinutes > 30 ? 'تأخير' : ''
            },
            checkOut: {
              time: checkOutTime,
              timestamp: checkOutDateTime.toISOString(),
              early: earlyMinutes > 0,
              earlyMinutes: earlyMinutes,
              overtime: overtimeMinutes > 0,
              overtimeMinutes: overtimeMinutes,
              note: overtimeMinutes > 0 ? 'عمل إضافي' : earlyMinutes > 0 ? 'انصراف مبكر' : ''
            },
            calculations: {
              totalMinutes: Math.round(workMinutes),
              totalHours: parseFloat(workHours.toFixed(2)),
              regularHours: Math.min(workHours, 8),
              overtimeHours: Math.max(0, workHours - 8)
            },
            status: 'completed',
            createdAt: checkInDateTime.toISOString(),
            updatedAt: checkOutDateTime.toISOString()
          };

          await employeesStorage.saveAttendance(attendance);
          totalStats.attendance++;
        }
      }

      setProgress(`✅ تم إنشاء ${totalStats.attendance} سجل حضور`);

      // 3. إنشاء الخصومات
      setProgress("💸 إنشاء الخصومات...");

      for (const employee of employees) {
        // سُلفة (50% احتمال)
        if (Math.random() < 0.5) {
          const day = Math.floor(Math.random() * 15) + 1;
          const date = new Date(currentYear, currentMonth - 1, day);
          if (date <= now) {
            const deduction = {
              id: generateId('DED'),
              employeeId: employee.id,
              employeeName: employee.name,
              type: 'advance',
              amount: [500, 1000, 1500, 2000][Math.floor(Math.random() * 4)],
              reason: ['سُلفة شخصية', 'سُلفة عاجلة', 'سُلفة طارئة'][Math.floor(Math.random() * 3)],
              note: 'سيتم الخصم من المرتب',
              date: formatEgyptTime(date, 'yyyy-MM-dd'),
              time: getRandomTime(10, 60),
              dateTime: date.toISOString(),
              status: 'active',
              createdAt: date.toISOString(),
              updatedAt: date.toISOString()
            };
            await employeesStorage.saveDeduction(deduction);
            totalStats.deductions++;
            
            // إضافة كـ advance أيضاً
            const advance = {
              id: generateId('ADV'),
              employeeId: employee.id,
              employeeName: employee.name,
              amount: deduction.amount,
              reason: deduction.reason,
              date: deduction.date,
              status: 'pending',
              createdAt: date.toISOString(),
              updatedAt: date.toISOString()
            };
            await employeesStorage.saveAdvance(advance);
            totalStats.advances++;
          }
        }

        // جزاء (30% احتمال)
        if (Math.random() < 0.3) {
          const day = Math.floor(Math.random() * 20) + 5;
          const date = new Date(currentYear, currentMonth - 1, day);
          if (date <= now) {
            const deduction = {
              id: generateId('DED'),
              employeeId: employee.id,
              employeeName: employee.name,
              type: 'penalty',
              amount: [100, 200, 300, 500][Math.floor(Math.random() * 4)],
              reason: ['تأخير متكرر', 'مخالفة سلوكية', 'عدم الالتزام'][Math.floor(Math.random() * 3)],
              note: Math.random() > 0.5 ? 'إنذار' : 'خصم مباشر',
              date: formatEgyptTime(date, 'yyyy-MM-dd'),
              time: getRandomTime(14, 60),
              dateTime: date.toISOString(),
              status: 'active',
              createdAt: date.toISOString(),
              updatedAt: date.toISOString()
            };
            await employeesStorage.saveDeduction(deduction);
            totalStats.deductions++;
          }
        }

        // خصم آخر (20% احتمال)
        if (Math.random() < 0.2) {
          const day = Math.floor(Math.random() * 25) + 1;
          const date = new Date(currentYear, currentMonth - 1, day);
          if (date <= now) {
            const deduction = {
              id: generateId('DED'),
              employeeId: employee.id,
              employeeName: employee.name,
              type: 'other',
              amount: [50, 100, 150, 250][Math.floor(Math.random() * 4)],
              reason: ['تأمينات', 'اشتراك نقابة', 'خصم إداري'][Math.floor(Math.random() * 3)],
              note: 'خصم شهري',
              date: formatEgyptTime(date, 'yyyy-MM-dd'),
              time: getRandomTime(11, 60),
              dateTime: date.toISOString(),
              status: 'active',
              createdAt: date.toISOString(),
              updatedAt: date.toISOString()
            };
            await employeesStorage.saveDeduction(deduction);
            totalStats.deductions++;
          }
        }
      }

      setProgress(`✅ تم إنشاء ${totalStats.deductions} خصم`);

      // النتيجة النهائية
      setStats(totalStats);
      setProgress("✅ اكتمل توليد البيانات بنجاح!");
      showToast("🎉 تم إنشاء بيانات تجريبية شاملة بنجاح!");

    } catch (error) {
      console.error("Error generating demo data:", error);
      showToast("حدث خطأ أثناء توليد البيانات", "error");
      setProgress(`❌ خطأ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    if (!confirm("⚠️ هل أنت متأكد من حذف جميع البيانات؟")) return;
    
    setLoading(true);
    setProgress("🗑️ جاري حذف جميع البيانات...");
    
    try {
      await employeesStorage.clearAllData();
      setStats(null);
      setProgress("✅ تم حذف جميع البيانات");
      showToast("تم حذف جميع البيانات بنجاح");
    } catch (error) {
      console.error("Error clearing data:", error);
      showToast("حدث خطأ أثناء الحذف", "error");
    } finally {
      setLoading(false);
    }
  };

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

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/employees')}
            className="text-blue-500 hover:text-blue-600 mb-4 flex items-center gap-2"
          >
            ← رجوع للموظفين
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🎲 مولّد البيانات التجريبية المتقدم</h1>
          <p className="text-gray-500">
            توليد بيانات واقعية شاملة لشهر كامل: موظفين، حضور، خصومات، إجازات
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <span>ℹ️</span>
            <span>ماذا سيتم توليده؟</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>5 موظفين</strong> بوظائف وأقسام مختلفة (مبيعات، مالية، صيانة، استقبال، موارد بشرية)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>حضور وانصراف كامل</strong> لكل أيام العمل في الشهر الحالي</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>تأخيرات واقعية</strong> (15% تأخير كبير، 30% تأخير بسيط، 55% في الوقت/مبكر)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>انصرافات متنوعة</strong> (10% مبكر، 25% عمل إضافي، 65% في الوقت)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>خصومات متنوعة</strong> (سُلف، جزاءات، خصومات أخرى) بتواريخ وأوقات مختلفة</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>إجازات عشوائية</strong> (5% من أيام العمل)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>غياب نادر</strong> (3% من الأيام بدون تسجيل)</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <div className="flex gap-4">
            <button
              onClick={generateComprehensiveDemo}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 rounded-lg transition-all shadow-lg"
            >
              {loading ? "⏳ جاري التوليد..." : "🎲 توليد بيانات تجريبية شاملة"}
            </button>
            <button
              onClick={clearAllData}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-all"
            >
              🗑️ مسح الكل
            </button>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
            <div className="flex items-center gap-3">
              {loading && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              )}
              <p className="text-gray-700 font-semibold">{progress}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">📊 إحصائيات البيانات المولدة:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.employees}</div>
                <div className="text-sm text-gray-600 mt-1">موظف</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.attendance}</div>
                <div className="text-sm text-gray-600 mt-1">سجل حضور</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{stats.deductions}</div>
                <div className="text-sm text-gray-600 mt-1">خصم</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.advances}</div>
                <div className="text-sm text-gray-600 mt-1">سُلفة</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.leaves}</div>
                <div className="text-sm text-gray-600 mt-1">إجازة</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => router.push('/employees')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                ✅ عرض الموظفين
              </button>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            <span>⚠️</span>
            <span>تحذير</span>
          </h3>
          <p className="text-sm text-yellow-800">
            سيتم توليد بيانات عشوائية واقعية. إذا كانت هناك بيانات موجودة، قد تحتاج لمسحها أولاً لتجنب التكرار.
          </p>
        </div>
      </div>
    </div>
  );
}
