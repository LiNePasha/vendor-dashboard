/**
 * Vendor Constants - Static vendor information
 * 
 * This is the single source of truth for vendor-specific data.
 * Add new vendors here and they will be reflected everywhere.
 */

export const VENDOR_LOGOS = {
  9: '/logos/9.png',
  // أضف باقي الـ vendors هنا
  27: '/logos/27.png',
  20: '/logos/20.webp',
  // 11: '/logos/11.png',
};

export const VENDOR_STORE_LINKS = {
  9: 'https://www.spare2app.com/stores/diesel363',
  27: 'https://www.spare2app.com/stores/aboyousef',
  20: 'https://www.spare2app.com/stores/ashrafhelmy55',
  // أضف باقي الـ vendors هنا
  // 11: 'https://www.spare2app.com/stores/another-vendor',
};

/**
 * Get vendor logo path by ID
 * @param {number|string} vendorId - The vendor ID
 * @returns {string} Logo path or placeholder
 */
export function getVendorLogo(vendorId) {
  return VENDOR_LOGOS[vendorId] || '/icons/placeholder.webp';
}

/**
 * Get vendor store link by ID
 * @param {number|string} vendorId - The vendor ID
 * @returns {string|null} Store link or null
 */
export function getVendorStoreLink(vendorId) {
  return VENDOR_STORE_LINKS[vendorId] || null;
}
