/**
 * مكتبة إدارة العملاء الأوفلاين (Offline Customers Storage)
 * تستخدم localForage لتخزين بيانات العملاء المحليين الذين يتم إضافتهم من الكاشير
 */

import localforage from 'localforage';

// إنشاء instance منفصل للعملاء الأوفلاين
const offlineCustomersDB = localforage.createInstance({
  name: 'spare2app',
  storeName: 'offline_customers'
});

/**
 * إضافة عميل أوفلاين جديد
 */
export async function addOfflineCustomer(customerData) {
  try {
    const customerId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customer = {
      id: customerId,
      type: 'offline', // تمييز العملاء الأوفلاين
      name: customerData.name,
      phone: customerData.phone || '',
      email: customerData.email || '',
      address: {
        street: customerData.address?.street || '',
        city: customerData.address?.city || '',
        cityId: customerData.address?.cityId || '',
        state: customerData.address?.state || '',
        district: customerData.address?.district || '',
        districtId: customerData.address?.districtId || '',
        zoneId: customerData.address?.zoneId || '',
        area: customerData.address?.area || '',
        building: customerData.address?.building || '',
        floor: customerData.address?.floor || '',
        apartment: customerData.address?.apartment || '',
        landmark: customerData.address?.landmark || ''
      },
      notes: customerData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalOrders: 0,
      totalSpent: 0
    };

    await offlineCustomersDB.setItem(customerId, customer);
    return customer;
  } catch (error) {
    console.error('Error adding offline customer:', error);
    throw error;
  }
}

/**
 * تحديث بيانات عميل أوفلاين
 */
export async function updateOfflineCustomer(customerId, updates) {
  try {
    const customer = await offlineCustomersDB.getItem(customerId);
    if (!customer) {
      throw new Error('العميل غير موجود');
    }

    const updatedCustomer = {
      ...customer,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await offlineCustomersDB.setItem(customerId, updatedCustomer);
    return updatedCustomer;
  } catch (error) {
    console.error('Error updating offline customer:', error);
    throw error;
  }
}

/**
 * حذف عميل أوفلاين
 */
export async function deleteOfflineCustomer(customerId) {
  try {
    await offlineCustomersDB.removeItem(customerId);
    return true;
  } catch (error) {
    console.error('Error deleting offline customer:', error);
    throw error;
  }
}

/**
 * جلب جميع العملاء الأوفلاين
 */
export async function getAllOfflineCustomers() {
  try {
    const customers = [];
    await offlineCustomersDB.iterate((value, key) => {
      customers.push(value);
    });
    
    // ترتيب حسب آخر تحديث
    return customers.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  } catch (error) {
    console.error('Error getting offline customers:', error);
    return [];
  }
}

/**
 * جلب عميل أوفلاين محدد
 */
export async function getOfflineCustomer(customerId) {
  try {
    return await offlineCustomersDB.getItem(customerId);
  } catch (error) {
    console.error('Error getting offline customer:', error);
    return null;
  }
}

/**
 * البحث في العملاء الأوفلاين
 */
export async function searchOfflineCustomers(searchTerm) {
  try {
    const allCustomers = await getAllOfflineCustomers();
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) return allCustomers;
    
    return allCustomers.filter(customer => 
      customer.name.toLowerCase().includes(term) ||
      customer.phone.includes(term) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (customer.address?.city && customer.address.city.toLowerCase().includes(term))
    );
  } catch (error) {
    console.error('Error searching offline customers:', error);
    return [];
  }
}

/**
 * تحديث إحصائيات العميل (بعد الطلب)
 */
export async function updateCustomerStats(customerId, orderAmount) {
  try {
    const customer = await getOfflineCustomer(customerId);
    if (!customer) return null;

    const updatedCustomer = {
      ...customer,
      totalOrders: (customer.totalOrders || 0) + 1,
      totalSpent: (customer.totalSpent || 0) + orderAmount,
      lastOrderAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await offlineCustomersDB.setItem(customerId, updatedCustomer);
    return updatedCustomer;
  } catch (error) {
    console.error('Error updating customer stats:', error);
    throw error;
  }
}

/**
 * الحصول على آخر عملاء تم إضافتهم
 */
export async function getRecentCustomers(limit = 10) {
  try {
    const allCustomers = await getAllOfflineCustomers();
    return allCustomers.slice(0, limit);
  } catch (error) {
    console.error('Error getting recent customers:', error);
    return [];
  }
}

/**
 * تصدير دمج العملاء (أونلاين + أوفلاين)
 */
export async function getAllCustomers(onlineCustomers = []) {
  try {
    const offlineCustomers = await getAllOfflineCustomers();
    
    // دمج العملاء مع تمييز النوع
    const onlineWithType = onlineCustomers.map(c => ({
      ...c,
      type: 'online',
      id: c.id.toString()
    }));
    
    return [...offlineCustomers, ...onlineWithType];
  } catch (error) {
    console.error('Error getting all customers:', error);
    return onlineCustomers.map(c => ({ ...c, type: 'online' }));
  }
}

export default {
  addOfflineCustomer,
  updateOfflineCustomer,
  deleteOfflineCustomer,
  getAllOfflineCustomers,
  getOfflineCustomer,
  searchOfflineCustomers,
  updateCustomerStats,
  getRecentCustomers,
  getAllCustomers
};
