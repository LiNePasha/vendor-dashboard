// وضعيات الوصول المحلية للوحة الإدارة.

export const ROLES = {
  OWNER: 'owner',
  CASHIER: 'cashier',
  ASSISTANT_MANAGER: 'assistant_manager',
  MANAGER: 'manager',
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

const ASSISTANT_MANAGER_ALLOWED_PREFIXES = ['/pos/invoices'];
const MANAGER_ALLOWED_PREFIXES = ['/pos/invoices', '/employees'];

export const APP_MODE_LABELS = {
  [ROLES.OWNER]: 'المالك',
  [ROLES.CASHIER]: 'الكاشير',
  [ROLES.ASSISTANT_MANAGER]: 'مساعد المدير',
  [ROLES.MANAGER]: 'المدير',
};

export const APP_MODE_OPTIONS = [ROLES.CASHIER, ROLES.ASSISTANT_MANAGER, ROLES.MANAGER];

export function getAppMode() {
  if (typeof window === 'undefined') return ROLES.OWNER;
  const cookieMode = document.cookie.match(/(?:^|;\s*)appMode=([^;]*)/)?.[1];
  const decodedCookieMode = cookieMode ? decodeURIComponent(cookieMode) : '';
  if (Object.values(ROLES).includes(decodedCookieMode)) return decodedCookieMode;
  const savedMode = localStorage.getItem('appMode');
  if (Object.values(ROLES).includes(savedMode)) return savedMode;
  return localStorage.getItem('isCashierMode') === 'true' ? ROLES.CASHIER : ROLES.OWNER;
}

function matchesAnyPrefix(pathname, prefixes) {
  return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPathAllowedForMode(pathname, mode = getAppMode()) {
  if (mode === ROLES.OWNER) return true;
  if (pathname === '/') return true;

  if (mode === ROLES.CASHIER) {
    const pageName = pathname.split('/')[1];
    return !CASHIER_BLOCKED_PAGES.includes(pageName);
  }

  if (mode === ROLES.ASSISTANT_MANAGER) {
    return matchesAnyPrefix(pathname, ASSISTANT_MANAGER_ALLOWED_PREFIXES) ||
      pathname === '/employees' ||
      /^\/employees\/[^/]+\/deductions\/add$/.test(pathname);
  }

  if (mode === ROLES.MANAGER) {
    return matchesAnyPrefix(pathname, MANAGER_ALLOWED_PREFIXES);
  }

  return false;
}

export function setAppMode(mode) {
  if (typeof window === 'undefined' || !Object.values(ROLES).includes(mode)) return false;

  const password = prompt('🔐 ادخل كلمة السر لتغيير وضع الصلاحيات:');
  if (password !== CASHIER_MODE_PASSWORD) {
    alert('❌ كلمة السر غير صحيحة');
    return false;
  }

  localStorage.setItem('appMode', mode);
  localStorage.setItem('isCashierMode', String(mode === ROLES.CASHIER));
  document.cookie = `appMode=${encodeURIComponent(mode)}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `isCashierMode=${mode === ROLES.CASHIER}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
  return true;
}

// فحص لو الصفحة مسموحة للكاشير
export function isPageAllowedForCashier(pathname) {
  return isPathAllowedForMode(pathname, ROLES.CASHIER);
}

// فحص لو اليوزر في وضع الكاشير
export function isCashierMode() {
  return getAppMode() === ROLES.CASHIER;
}

// تفعيل/إلغاء وضع الكاشير
export function toggleCashierMode(enabled) {
  return setAppMode(enabled ? ROLES.CASHIER : ROLES.OWNER);
}

// فلترة عناصر القائمة حسب الدور
export function filterMenuItemsForRole(menuItems, mode = getAppMode()) {
  return menuItems.filter(item => isPathAllowedForMode(item.href, mode));
}
