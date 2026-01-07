/**
 * Vendor Constants - Static vendor information
 * 
 * This is the single source of truth for vendor-specific data.
 * Add new vendors here and they will be reflected everywhere.
 */

export const VENDOR_LOGOS = {
  9: '/logos/9.png',
  27: '/logos/27.png',
  20: '/logos/20.webp',
  19: '/logos/19.webp',
  22: '/logos/22.webp',
};

export const VENDOR_STORE_LINKS = {
  9: 'https://www.spare2app.com/stores/diesel363',
  27: 'https://www.spare2app.com/stores/aboyousef',
  20: 'https://www.spare2app.com/stores/ashrafhelmy55',
  19: 'https://www.spare2app.com/stores/samerpepo1',
  22: 'https://abosh3ban.com',
};

export const VENDOR_STORE_BUNDLE_LINKS = {
  9: 'https://www.spare2app.com/bundle/diesel363?ids=',
  27: 'https://www.spare2app.com/bundle/abo-yousef?ids=',
  74: 'https://www.spare2app.com/bundle/altayar?ids=',
  20: 'https://www.spare2app.com/bundle/ashrafhelmy55?ids=',
  19: 'https://www.spare2app.com/bundle/samerpepo1?ids=',
  46: 'https://www.spare2app.com/bundle/spare2appeg?ids=',
  22: 'https://abosh3ban.com/bundle?p=',
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
