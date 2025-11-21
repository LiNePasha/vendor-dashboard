// نظام الصلاحيات - دورين بس (Owner و Cashier)

export const ROLES = {
  OWNER: 'owner',
  CASHIER: 'cashier'
};

export const CASHIER_MODE_PASSWORD = '1234'; // ممكن تغيرها من هنا

// الصفحات اللي الكاشير ممنوع منها
export const CASHIER_BLOCKED_PAGES = [
  'warehouse',
  'suppliers', 
  'creditors',
  'employees'
];

// الصفحات اللي الكاشير يشوفها
export const CASHIER_ALLOWED_PAGES = [
  '/', // الرئيسية
  'orders',
  'products',
  'services',
  'pos',
  'invoices',
  'audit'
];

// فحص لو الصفحة مسموحة للكاشير
export function isPageAllowedForCashier(pathname) {
  // لو في الرئيسية
  if (pathname === '/') return true;
  
  // استخراج اسم الصفحة من الـ path
  const pageName = pathname.split('/')[1];
  
  // فحص لو في القائمة الممنوعة
  return !CASHIER_BLOCKED_PAGES.includes(pageName);
}

// فحص لو اليوزر في وضع الكاشير
export function isCashierMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isCashierMode') === 'true';
}

// تفعيل/إلغاء وضع الكاشير
export function toggleCashierMode(enabled) {
  if (typeof window === 'undefined') return false;
  
  const password = prompt('🔐 ادخل كلمة السر:');
  
  if (password === CASHIER_MODE_PASSWORD) {
    // حفظ في localStorage
    localStorage.setItem('isCashierMode', enabled.toString());
    
    // حفظ في cookie عشان الـ middleware يقدر يقراها
    document.cookie = `isCashierMode=${enabled}; path=/; max-age=31536000`; // سنة
    
    // إعادة تحميل الصفحة
    window.location.reload();
    return true;
  } else {
    alert('❌ كلمة سر غلط!');
    return false;
  }
}

// فلترة عناصر القائمة حسب الدور
export function filterMenuItemsForRole(menuItems) {
  const cashierMode = isCashierMode();
  
  if (!cashierMode) {
    // Owner - يشوف كل حاجة
    return menuItems;
  }
  
  // Cashier - فلترة العناصر الممنوعة
  return menuItems.filter(item => {
    const pageName = item.href.split('/')[1] || '/';
    return !CASHIER_BLOCKED_PAGES.includes(pageName);
  });
}
