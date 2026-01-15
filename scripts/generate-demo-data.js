/**
 * 🎭 Generate Demo Attendance Data
 * This script creates sample employees and attendance records for testing
 */

import localforage from 'localforage';
import { format, subDays, addMinutes, setHours, setMinutes, setSeconds } from 'date-fns';

// Initialize LocalForage instances
const employeesDB = localforage.createInstance({ name: 'spare2app', storeName: 'employees' });
const attendanceDB = localforage.createInstance({ name: 'spare2app', storeName: 'attendance' });

const TIMEZONE_OFFSET = 2; // Egypt UTC+2

// Helper: Generate random number between min and max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Generate Egypt time
function createEgyptTime(date, hours, minutes, seconds = 0) {
  let d = new Date(date);
  d = setHours(d, hours);
  d = setMinutes(d, minutes);
  d = setSeconds(d, seconds);
  return d.toISOString();
}

// Helper: Format time as HH:mm:ss
function formatTime(date) {
  return format(new Date(date), 'HH:mm:ss');
}

// Sample Employees
const employees = [
  {
    id: 'EMP-001234',
    name: 'أحمد محمد علي',
    nationalId: '29012011234567',
    phone: '01012345678',
    email: 'ahmed.mohamed@example.com',
    address: '15 شارع النصر، المنصورة، الدقهلية',
    jobTitle: 'موظف مبيعات',
    department: 'المبيعات',
    hireDate: '2024-01-15',
    basicSalary: 5000,
    allowances: 500,
    workSchedule: {
      startTime: '09:00',
      endTime: '17:00',
      workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      gracePeriod: 15
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'EMP-001235',
    name: 'فاطمة حسن إبراهيم',
    nationalId: '29503011234568',
    phone: '01112345678',
    email: 'fatma.hassan@example.com',
    address: '22 شارع الجلاء، القاهرة',
    jobTitle: 'محاسبة',
    department: 'الحسابات',
    hireDate: '2024-02-01',
    basicSalary: 6000,
    allowances: 800,
    workSchedule: {
      startTime: '09:00',
      endTime: '17:00',
      workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      gracePeriod: 15
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'EMP-001236',
    name: 'محمود خالد السيد',
    nationalId: '28805011234569',
    phone: '01212345678',
    email: 'mahmoud.khaled@example.com',
    address: '8 شارع الهرم، الجيزة',
    jobTitle: 'مندوب مبيعات',
    department: 'المبيعات',
    hireDate: '2024-03-10',
    basicSalary: 4500,
    allowances: 600,
    workSchedule: {
      startTime: '10:00',
      endTime: '18:00',
      workDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      gracePeriod: 10
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'EMP-001237',
    name: 'نورا عبدالرحمن أحمد',
    nationalId: '29107011234570',
    phone: '01512345678',
    email: 'nora.abdulrahman@example.com',
    address: '33 شارع الثورة، الإسكندرية',
    jobTitle: 'موظفة خدمة عملاء',
    department: 'خدمة العملاء',
    hireDate: '2024-04-01',
    basicSalary: 4000,
    allowances: 400,
    workSchedule: {
      startTime: '08:00',
      endTime: '16:00',
      workDays: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
      gracePeriod: 20
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Generate attendance records
function generateAttendanceRecords() {
  const records = [];
  const today = new Date();
  
  employees.forEach((employee, empIndex) => {
    const workDays = employee.workSchedule.workDays;
    const [startHour, startMin] = employee.workSchedule.startTime.split(':').map(Number);
    const [endHour, endMin] = employee.workSchedule.endTime.split(':').map(Number);
    const gracePeriod = employee.workSchedule.gracePeriod;
    
    // Generate for last 30 days
    for (let i = 1; i <= 30; i++) {
      const date = subDays(today, i);
      const dayName = format(date, 'EEEE').toLowerCase();
      
      // Skip if not a work day
      if (!workDays.includes(dayName)) continue;
      
      // Generate different attendance patterns
      const pattern = randomInt(1, 100);
      
      let checkInTime, checkOutTime, late = false, lateMinutes = 0, gracePeriodUsed = 0;
      let early = false, earlyMinutes = 0, overtime = false, overtimeMinutes = 0;
      
      if (pattern <= 5) {
        // 5% - Absent (no record)
        continue;
      } else if (pattern <= 25) {
        // 20% - Late (after grace period)
        const delayMinutes = randomInt(gracePeriod + 1, 60); // 16-60 min late
        checkInTime = createEgyptTime(date, startHour, startMin + delayMinutes);
        late = true;
        lateMinutes = delayMinutes;
        gracePeriodUsed = gracePeriod;
      } else if (pattern <= 45) {
        // 20% - Within grace period
        const delayMinutes = randomInt(1, gracePeriod); // 1-15 min late
        checkInTime = createEgyptTime(date, startHour, startMin + delayMinutes);
        late = false;
        lateMinutes = 0;
        gracePeriodUsed = delayMinutes;
      } else if (pattern <= 70) {
        // 25% - On time (exact or early)
        const earlyMinutes = randomInt(0, 10);
        checkInTime = createEgyptTime(date, startHour, startMin - earlyMinutes);
        late = false;
        lateMinutes = 0;
        gracePeriodUsed = 0;
      } else {
        // 30% - Early arrival
        const earlyMinutes = randomInt(10, 30);
        checkInTime = createEgyptTime(date, startHour, startMin - earlyMinutes);
        late = false;
        lateMinutes = 0;
        gracePeriodUsed = 0;
      }
      
      // Check-out scenarios
      const checkOutPattern = randomInt(1, 100);
      
      if (checkOutPattern <= 10) {
        // 10% - Left early
        const earlyLeaveMinutes = randomInt(10, 60);
        checkOutTime = createEgyptTime(date, endHour, endMin - earlyLeaveMinutes);
        early = true;
        earlyMinutes = earlyLeaveMinutes;
      } else if (checkOutPattern <= 40) {
        // 30% - On time checkout
        const variance = randomInt(-5, 5);
        checkOutTime = createEgyptTime(date, endHour, endMin + variance);
        early = false;
        earlyMinutes = 0;
      } else if (checkOutPattern <= 70) {
        // 30% - Small overtime (15-60 min)
        const overtimeMin = randomInt(15, 60);
        checkOutTime = createEgyptTime(date, endHour, endMin + overtimeMin);
        overtime = true;
        overtimeMinutes = overtimeMin;
      } else {
        // 30% - Significant overtime (1-3 hours)
        const overtimeMin = randomInt(60, 180);
        checkOutTime = createEgyptTime(date, endHour, endMin + overtimeMin);
        overtime = true;
        overtimeMinutes = overtimeMin;
      }
      
      // Calculate work hours
      const checkInDate = new Date(checkInTime);
      const checkOutDate = new Date(checkOutTime);
      const totalMinutes = Math.floor((checkOutDate - checkInDate) / (1000 * 60));
      const totalHours = (totalMinutes / 60).toFixed(2);
      const regularHours = Math.min(totalHours, 8);
      const overtimeHours = Math.max(0, totalHours - 8).toFixed(2);
      
      const record = {
        id: `ATT-${format(date, 'yyyyMMdd')}-${(empIndex + 1).toString().padStart(3, '0')}`,
        employeeId: employee.id,
        date: format(date, 'yyyy-MM-dd'),
        dayName: dayName,
        
        checkIn: {
          time: formatTime(checkInTime),
          timestamp: checkInTime,
          late,
          lateMinutes,
          gracePeriodUsed,
          localTime: formatTime(checkInTime),
          note: late ? `متأخر ${lateMinutes} دقيقة` : gracePeriodUsed > 0 ? `ضمن فترة السماح (${gracePeriodUsed} دقيقة)` : 'في الموعد'
        },
        
        checkOut: {
          time: formatTime(checkOutTime),
          timestamp: checkOutTime,
          early,
          earlyMinutes,
          overtime,
          overtimeMinutes,
          localTime: formatTime(checkOutTime),
          note: early ? `انصراف مبكر ${earlyMinutes} دقيقة` : overtime ? `إضافي ${overtimeMinutes} دقيقة` : 'في الموعد'
        },
        
        calculations: {
          totalMinutes,
          totalHours: parseFloat(totalHours),
          regularHours: parseFloat(regularHours),
          overtimeHours: parseFloat(overtimeHours)
        },
        
        status: 'completed',
        createdAt: checkInTime,
        updatedAt: checkOutTime
      };
      
      records.push(record);
    }
  });
  
  return records;
}

// Main execution
async function generateDemoData() {
  console.log('🎭 Starting demo data generation...\n');
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await employeesDB.clear();
    await attendanceDB.clear();
    
    // Add employees
    console.log('\n👥 Adding employees...');
    for (const employee of employees) {
      await employeesDB.setItem(employee.id, employee);
      console.log(`  ✅ ${employee.name} (${employee.id})`);
    }
    
    // Generate and add attendance records
    console.log('\n📊 Generating attendance records...');
    const attendanceRecords = generateAttendanceRecords();
    
    for (const record of attendanceRecords) {
      await attendanceDB.setItem(record.id, record);
    }
    
    console.log(`  ✅ Generated ${attendanceRecords.length} attendance records`);
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`  👥 Employees: ${employees.length}`);
    console.log(`  📅 Attendance Records: ${attendanceRecords.length}`);
    console.log(`  📆 Days: Last 30 days`);
    
    console.log('\n✅ Demo data generation completed!');
    console.log('\n💡 Now you can:');
    console.log('  1. Go to /employees - See all employees');
    console.log('  2. Go to /employees/attendance/record - Try check-in/out');
    console.log('  3. View employee details to see their records');
    console.log('  4. Generate payroll (when implemented)');
    
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
  }
}

// Run the script
generateDemoData();
