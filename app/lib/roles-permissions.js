// وضعيات الوصول المحلية للوحة الإدارة.

export const ROLES = {
  OWNER: 'owner',
  CASHIER: 'cashier',
  ASSISTANT_MANAGER: 'assistant_manager',
  MANAGER: 'manager',
};

const APP_MODE_PASSWORDS = {
  [ROLES.CASHIER]: '1234',
  [ROLES.ASSISTANT_MANAGER]: 'aa1234',
  [ROLES.MANAGER]: 'gg1234',
  [ROLES.OWNER]: 'gg1234',
};

// الصفحات الوحيدة المتاحة في وضع الكاشير
export const CASHIER_ALLOWED_PAGES = [
  '/pos',
  '/services',
  '/pos/invoices',
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

  if (mode === ROLES.CASHIER) {
    return CASHIER_ALLOWED_PAGES.includes(pathname) ||
      matchesAnyPrefix(pathname, ['/pos/invoices/print']);
  }

  if (pathname === '/') return true;

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

export function setAppMode(mode, password) {
  if (typeof window === 'undefined' || !Object.values(ROLES).includes(mode)) return false;

  if (password !== APP_MODE_PASSWORDS[mode]) {
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
