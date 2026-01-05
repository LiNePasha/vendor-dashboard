import localforage from 'localforage';

/**
 * Cache للمدن والمناطق من Bosta
 * عشان ميحملش كل مرة
 */

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 أيام

/**
 * حفظ المدن في Cache
 */
export async function saveCitiesCache(cities) {
  try {
    await localforage.setItem('bosta_cities_cache', {
      cities,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('⚠️ فشل حفظ المدن في Cache:', error);
    // رمي الخطأ لمعالجته في المكون
    throw error;
  }
}

/**
 * جلب المدن من Cache
 */
export async function getCitiesCache() {
  try {
    const cache = await localforage.getItem('bosta_cities_cache');
    
    if (!cache) return null;
    
    // تحقق من صلاحية البيانات
    if (!cache.cities || !Array.isArray(cache.cities)) {
      console.warn('⚠️ بيانات Cache غير صالحة، سيتم حذفها');
      await localforage.removeItem('bosta_cities_cache');
      return null;
    }
    
    // تحقق من صلاحية Cache
    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      console.log('⏰ Cache منتهي الصلاحية');
      return null; // Cache منتهي
    }
    
    return cache.cities;
  } catch (error) {
    console.error('⚠️ خطأ في قراءة Cache:', error);
    // حاول حذف الـ cache الفاسد
    try {
      await localforage.removeItem('bosta_cities_cache');
    } catch (e) {
      console.error('فشل حذف cache الفاسد:', e);
    }
    throw error;
  }
}

/**
 * حفظ المناطق (Districts) لمدينة معينة
 */
export async function saveDistrictsCache(cityId, districts) {
  try {
    const key = `bosta_districts_${cityId}`;
    await localforage.setItem(key, {
      districts,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('⚠️ فشل حفظ المناطق في Cache:', error);
    // لا نرمي الخطأ هنا، فقط نسجله
  }
}

/**
 * جلب المناطق (Districts) من Cache
 */
export async function getDistrictsCache(cityId) {
  try {
    const key = `bosta_districts_${cityId}`;
    const cache = await localforage.getItem(key);
    
    if (!cache) return null;
    
    // تحقق من صلاحية البيانات
    if (!cache.districts || !Array.isArray(cache.districts)) {
      console.warn('⚠️ بيانات Districts غير صالحة، سيتم حذفها');
      await localforage.removeItem(key);
      return null;
    }
    
    // تحقق من صلاحية Cache
    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      return null;
    }
    
    return cache.districts;
  } catch (error) {
    console.error('⚠️ خطأ في قراءة Districts من Cache:', error);
    return null; // لا نرمي الخطأ، فقط نرجع null
  }
}

/**
 * حفظ الـ Zones لمدينة معينة
 */
export async function saveZonesCache(cityId, zones) {
  try {
    const key = `bosta_zones_${cityId}`;
    await localforage.setItem(key, {
      zones,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('⚠️ فشل حفظ الـ Zones في Cache:', error);
  }
}

/**
 * جلب الـ Zones من Cache
 */
export async function getZonesCache(cityId) {
  try {
    const key = `bosta_zones_${cityId}`;
    const cache = await localforage.getItem(key);
    
    if (!cache) return null;
    
    // تحقق من صلاحية البيانات
    if (!cache.zones || !Array.isArray(cache.zones)) {
      console.warn('⚠️ بيانات Zones غير صالحة، سيتم حذفها');
      await localforage.removeItem(key);
      return null;
    }
    
    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      return null;
    }
    
    return cache.zones;
  } catch (error) {
    console.error('⚠️ خطأ في قراءة Zones من Cache:', error);
    return null;
  }
}

/**
 * مسح كل الـ Cache - مفيد لو حصلت مشاكل
 */
export async function clearBostaCache() {
  try {
    const keys = await localforage.keys();
    const bostaKeys = keys.filter(key => key.startsWith('bosta_'));
    
    console.log(`🗑️ مسح ${bostaKeys.length} عنصر من Bosta Cache...`);
    
    for (const key of bostaKeys) {
      try {
        await localforage.removeItem(key);
      } catch (e) {
        console.error(`فشل حذف ${key}:`, e);
      }
    }
    
    console.log('✅ تم مسح Bosta Cache بنجاح');
    return { success: true, cleared: bostaKeys.length };
  } catch (error) {
    console.error('❌ فشل مسح Bosta Cache:', error);
    return { success: false, error: error.message };
  }
}
