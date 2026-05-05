import localforage from 'localforage';

const KASHIER_SETTINGS_KEY = 'kashier_settings';

/**
 * الحصول على إعدادات Kashier
 */
export async function getKashierSettings() {
  const settings = await localforage.getItem(KASHIER_SETTINGS_KEY);
  return settings || {
    enabled: false,
    merchantId: '',   // MID — من لوحة Kashier
    apiPassword: '',  // API Password / Secret Key
  };
}

/**
 * حفظ إعدادات Kashier
 */
export async function saveKashierSettings(settings) {
  await localforage.setItem(KASHIER_SETTINGS_KEY, settings);
}
