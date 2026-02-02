import localforage from 'localforage';

/**
 * الحصول على إعدادات Bosta من LocalForage
 */
export async function getBostaSettings() {
  const settings = await localforage.getItem('bosta_settings');
  return settings || {
    enabled: false,
    apiKey: '',
    businessLocationId: '',
    pickupCity: 'Cairo', // 🆕 اسم مدينة الاستلام بالإنجليزي
    autoSend: false,
    defaultPackageType: 'Parcel',
    defaultSize: 'MEDIUM',
    allowToOpenPackage: false,
    pickupLocations: [] // 🆕 حفظ المواقع مع الإعدادات
  };
}

/**
 * حفظ إعدادات Bosta
 */
export async function saveBostaSettings(settings) {
  await localforage.setItem('bosta_settings', settings);
}

/**
 * التحقق من صحة البيانات قبل الإرسال لبوسطة
 */
export function validateInvoiceForBosta(invoice) {
  const errors = [];

  // التحقق من نوع الطلب
  if (invoice.orderType !== 'delivery') {
    errors.push('الطلب ليس توصيل');
    return { valid: false, errors };
  }

  // التحقق من بيانات العميل
  const customer = invoice.delivery?.customer;
  if (!customer) {
    errors.push('بيانات العميل غير موجودة');
    return { valid: false, errors };
  }

  if (!customer.name || customer.name.trim() === '') {
    errors.push('اسم العميل مطلوب');
  }

  if (!customer.phone || customer.phone.trim() === '') {
    errors.push('رقم هاتف العميل مطلوب');
  }

  // التحقق من العنوان
  const address = customer?.address;
  if (!address) {
    errors.push('العنوان غير موجود');
    return { valid: false, errors };
  }

  if (!address.city || address.city.trim() === '') {
    errors.push('المدينة مطلوبة');
  }

  if (!address.districtId && !address.district) {
    errors.push('المنطقة (District) مطلوبة - يجب اختيار المنطقة من قائمة بوسطة');
  }

  // التحقق من firstLine (يجب أن يكون أكثر من 5 حروف)
  const firstLine = buildFirstLine(address);
  if (firstLine.length < 5) {
    errors.push('العنوان التفصيلي يجب أن يكون أكثر من 5 حروف');
  }

  // التحقق من المبلغ
  if (!invoice.summary?.total || invoice.summary.total <= 0) {
    errors.push('المبلغ الإجمالي غير صحيح');
  }

  // التحقق من وجود منتجات
  if (!invoice.items || invoice.items.length === 0) {
    errors.push('لا توجد منتجات في الطلب');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * بناء firstLine للعنوان (يجب أن يكون أكثر من 5 حروف)
 */
export function buildFirstLine(address) {
  if (!address) return '';

  const parts = [
    address.street,
    address.area
  ].filter(Boolean);

  let firstLine = parts.join(', ');

  // التحقق من الطول
  if (firstLine.length < 5) {
    // إضافة المدينة إذا كان العنوان قصير
    if (address.city) {
      firstLine = `${firstLine} - ${address.city}`.trim();
    }
    // إذا ما زال قصير، إضافة نص افتراضي
    if (firstLine.length < 5) {
      firstLine = address.city || 'عنوان العميل';
    }
  }

  return firstLine.trim();
}

/**
 * تنسيق حالة الشحنة للعرض بالعربي
 */
export function formatBostaStatus(status) {
  if (!status) return '';
  
  // تحويل للصغيرة للمقارنة
  const lowerStatus = status.toLowerCase();
  
  const statusMap = {
    // English status from Bosta API
    'pickup requested': '🆕 جديد - بانتظار الاستلام',
    'pending': '⏳ قيد الانتظار',
    'received at warehouse': '📦 تم الاستلام في المخزن',
    'picked up': '🚚 تم الاستلام من المندوب',
    'in transit': '🚗 في الطريق',
    'out for delivery': '🏃 خارج للتوصيل',
    'delivered': '✅ تم التوصيل',
    'cancelled': '❌ ملغي',
    'failed delivery': '⚠️ فشل التوصيل',
    'returned': '🔙 مرتجع',
    'created': '📦 تم الإنشاء',
    'exception': '⚠️ استثناء',
    'lost': '❓ مفقود',
    // Underscore versions
    'pickup_requested': '🆕 جديد - بانتظار الاستلام',
    'picked_up': '🚚 تم الاستلام من المندوب',
    'in_transit': '🚗 في الطريق',
    'out_for_delivery': '🏃 خارج للتوصيل',
    'failed_delivery': '⚠️ فشل التوصيل'
  };

  return statusMap[lowerStatus] || status;
}

/**
 * بناء رابط تتبع الشحنة
 */
export function getBostaTrackingUrl(trackingNumber) {
  return `https://bosta.co/tracking-shipment/?track_id=${trackingNumber}`;
}
