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
  // 11: '/logos/11.png',
};

export const VENDOR_STORE_LINKS = {
  9: 'spare2app.com/store/diesel',
  // أضف باقي الـ vendors هنا
  27: 'spare2app.com/store/aboyousef',
  // 11: 'spare2app.com/store/another-vendor',
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
 * @returns {string} Store link or default
 */
export function getVendorStoreLink(vendorId) {
  return VENDOR_STORE_LINKS[vendorId] || 'spare2app.com';
}
