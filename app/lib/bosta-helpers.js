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

/**
 * 🆕 التحقق من أن الأوردر متأخر (أكتر من 5 أيام ولم يتم إرساله لبوسطة)
 */
export function isOrderDelayed(order, bostaEnabled) {
  // إذا بوسطة مش متفعلة، مش هيكون في تأخير
  if (!bostaEnabled) return false;
  
  // الأوردرات المكتملة أو الملغية مش بتعتبر متأخرة
  const completedStatuses = ['completed', 'cancelled', 'refunded', 'failed'];
  if (completedStatuses.includes(order.status)) return false;
  
  // التحقق من أن الأوردر نوع توصيل (مش استلام من المتجر)
  const isStorePickup = order.meta_data?.some(m => 
    (m.key === '_is_store_pickup' && m.value === 'yes') || 
    (m.key === '_delivery_type' && m.value === 'store_pickup')
  );
  if (isStorePickup) return false; // أوردرات الاستلام مش محتاجة بوسطة
  
  // التحقق من أن الأوردر اتبعت لبوسطة ولا لأ
  const bostaSent = order.bosta?.sent || 
                    order.meta_data?.find(m => m.key === '_bosta_sent')?.value === 'yes';
  if (bostaSent) return false; // متبعتش يبقى مش متأخرة
  
  // حساب عمر الأوردر بالأيام
  const orderDate = new Date(order.date_created);
  const now = new Date();
  const ageInDays = (now - orderDate) / (1000 * 60 * 60 * 24);
  
  // الأوردر متأخر لو عمره أكتر من 5 أيام
  return ageInDays > 5;
}

/**
 * 🆕 فلترة الأوردرات المُرسلة لبوسطة اليوم فقط
 */
/**
 * 🆕 فلترة الأوردرات المُرسلة لبوسطة في تاريخ معين
 */
export function getOrdersDeliveredByDate(orders, targetDate) {
  // استخراج السنة/الشهر/اليوم من التاريخ المستهدف (بالـ local timezone)
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();
  
  console.log('🔍 Filtering orders sent to Bosta on:', {
    totalOrders: orders.length,
    targetDate: targetDate.toLocaleDateString('ar-EG'),
    targetYear,
    targetMonth: targetMonth + 1, // +1 لأن الشهر يبدأ من 0
    targetDay
  });
  
  // 🔍 أولاً: شوف كل الطلبات المبعوتة لبوسطة
  const bostaOrders = orders.filter(order => {
    const bostaSent = order.bosta?.sent || 
                      order.meta_data?.find(m => m.key === '_bosta_sent')?.value === 'yes';
    return bostaSent;
  });
  
  console.log(`📦 Total orders sent to Bosta: ${bostaOrders.length}`);
  
  const result = orders.filter(order => {
    // لازم يكون مبعوت لبوسطة أصلاً
    const bostaSent = order.bosta?.sent || 
                      order.meta_data?.find(m => m.key === '_bosta_sent')?.value === 'yes';
    
    if (!bostaSent) return false;
    
    // 🔍 Debug: شوف إيه البيانات اللي عند الطلب ده
    const sentAtStr = order.bosta?.sentAt || 
                     order.meta_data?.find(m => m.key === '_bosta_sent_at')?.value;
    const pickedUpAtStr = order.bosta?.pickedUpAt || 
                         order.meta_data?.find(m => m.key === '_bosta_picked_up_at')?.value;
    
    console.log(`🔍 Order #${order.id}:`, {
      hasSentAt: !!sentAtStr,
      hasPickedUpAt: !!pickedUpAtStr,
      sentAt: sentAtStr,
      pickedUpAt: pickedUpAtStr,
      bostaStatus: order.bosta?.status,
      note: !pickedUpAtStr && order.bosta?.sent 
        ? '⚠️ Order sent to Bosta but no pickedUpAt - needs sync!' 
        : undefined
    });
    
    // أولوية 1: تاريخ الإرسال (sentAt)
    if (sentAtStr) {
      const sentAt = new Date(sentAtStr);
      // مقارنة التاريخ فقط (يوم/شهر/سنة) بالـ local timezone
      if (sentAt.getFullYear() === targetYear && 
          sentAt.getMonth() === targetMonth && 
          sentAt.getDate() === targetDay) {
        console.log(`✅ Order #${order.id} - Sent on target date via sentAt:`, sentAtStr);
        return true;
      }
    }
    
    // أولوية 2: تاريخ الاستلام من المخزن (pickedUpAt)
    if (pickedUpAtStr) {
      const pickedUpAt = new Date(pickedUpAtStr);
      // مقارنة التاريخ فقط (يوم/شهر/سنة) بالـ local timezone
      if (pickedUpAt.getFullYear() === targetYear && 
          pickedUpAt.getMonth() === targetMonth && 
          pickedUpAt.getDate() === targetDay) {
        console.log(`✅ Order #${order.id} - Picked up on target date:`, {
          pickedUpAtStr,
          pickedUpLocalDate: pickedUpAt.toLocaleDateString('ar-EG'),
          pickedUpLocalTime: pickedUpAt.toLocaleTimeString('ar-EG')
        });
        return true;
      } else {
        console.log(`⏭️ Order #${order.id} - Picked up on different date:`, {
          pickedUpAtStr,
          pickedUpDate: `${pickedUpAt.getDate()}/${pickedUpAt.getMonth() + 1}/${pickedUpAt.getFullYear()}`,
          targetDate: `${targetDay}/${targetMonth + 1}/${targetYear}`
        });
      }
    }
    
    return false;
  });
  
  console.log(`✅ Found ${result.length} orders sent to Bosta on ${targetDate.toLocaleDateString('ar-EG')}`);
  
  // 🔔 تحذير لو في طلبات محتاجة sync
  const needsSyncCount = bostaOrders.length - bostaOrders.filter(o => {
    const pickedUpAtStr = o.bosta?.pickedUpAt || 
                         o.meta_data?.find(m => m.key === '_bosta_picked_up_at')?.value;
    return !!pickedUpAtStr;
  }).length;
  
  if (needsSyncCount > 0) {
    console.warn(`⚠️ ${needsSyncCount} orders sent to Bosta but missing pickedUpAt data - Please run Bosta sync!`);
  }
  
  return result;
}

/**
 * فلترة الأوردرات المُرسلة لبوسطة اليوم
 */
export function getOrdersDeliveredToday(orders) {
  return getOrdersDeliveredByDate(orders, new Date());
}

/**
 * 🆕 فلترة الأوردرات المُرسلة لبوسطة أمس
 */
export function getOrdersDeliveredYesterday(orders) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getOrdersDeliveredByDate(orders, yesterday);
}






