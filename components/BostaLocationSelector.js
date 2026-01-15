"use client";

import { useState, useEffect } from 'react';
import { BostaAPI } from '@/app/lib/bosta-api';
import { getBostaSettings } from '@/app/lib/bosta-helpers';
import {
  getCitiesCache,
  saveCitiesCache,
  getDistrictsCache,
  saveDistrictsCache,
  getZonesCache,
  saveZonesCache
} from '@/app/lib/bosta-locations-cache';

/**
 * Component لاختيار المدينة والمنطقة من Bosta
 */
export default function BostaLocationSelector({ address, onAddressChange, disabled = false }) {
  const [bostaEnabled, setBostaEnabled] = useState(false);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [zones, setZones] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  
  // Search states
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);

  useEffect(() => {
    checkBostaAndLoadCities();
  }, []);

  // Set initial search values from address
  useEffect(() => {
    if (address.city) setCitySearch(address.city);
    if (address.district) setDistrictSearch(address.district);
  }, [address.city, address.district]);

  // Filtered lists
  const filteredCities = Array.isArray(cities) ? cities.filter(city => {
    const name = city.nameAr || city.name || '';
    return name.toLowerCase().includes(citySearch.toLowerCase());
  }) : [];

  const filteredDistricts = Array.isArray(districts) ? districts.filter(district => {
    const name = district.districtName || district.districtOtherName || '';
    return name.toLowerCase().includes(districtSearch.toLowerCase());
  }) : [];

  const filteredZones = Array.isArray(zones) ? zones.filter(zone => {
    const name = zone.name || '';
    return name.toLowerCase().includes(zoneSearch.toLowerCase());
  }) : [];

  const checkBostaAndLoadCities = async () => {
    // تحقق من تفعيل Bosta
    const settings = await getBostaSettings();
    console.log('🔍 Bosta Settings:', settings);
    
    if (!settings.enabled || !settings.apiKey) {
      console.log('❌ Bosta not enabled or no API key');
      setBostaEnabled(false);
      return;
    }

    console.log('✅ Bosta is enabled, loading cities...');
    setBostaEnabled(true);

    // جلب المدن
    await loadCities(settings.apiKey);
  };

  const loadCities = async (apiKey, retryCount = 0) => {
    setLoadingCities(true);
    try {
      console.log('🔑 Using API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'NO API KEY');
      
      // تحقق من Cache أولاً (فقط في المحاولة الأولى)
      if (retryCount === 0) {
        try {
          const cachedCities = await getCitiesCache();
          if (cachedCities && Array.isArray(cachedCities) && cachedCities.length > 0) {
            console.log('✅ تم تحميل المدن من Cache');
            setCities(cachedCities);
            setLoadingCities(false);
            return;
          }
        } catch (cacheError) {
          console.warn('⚠️ خطأ في قراءة Cache، سيتم المحاولة من API مباشرة:', cacheError);
          // نظف الـ cache الفاسد
          try {
            await localforage.removeItem('bosta_cities_cache');
          } catch (e) {
            console.error('فشل حذف cache الفاسد:', e);
          }
        }
      }

      // جلب من API
      const bostaAPI = new BostaAPI(apiKey);
      const result = await bostaAPI.getCities();
      console.log('📡 API Response:', result);

      if (result.error) {
        console.error('فشل تحميل المدن:', result.error);
        
        // إذا كان الخطأ من IndexedDB، جرب مرة أخرى
        if (result.error.includes('IndexedDB') && retryCount < 2) {
          console.log(`🔄 إعادة المحاولة (${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // انتظر ثانية
          return loadCities(apiKey, retryCount + 1);
        }
        
        setCities([]);
      } else {
        // Bosta يرجع { success: true, data: { list: [...] } }
        let citiesData = [];
        
        if (result.success && result.data && Array.isArray(result.data.list)) {
          // الـ response الجديد: data.list
          citiesData = result.data.list;
        } else if (result.success && Array.isArray(result.data)) {
          // الـ response القديم: data مباشرة
          citiesData = result.data;
        } else if (Array.isArray(result.data)) {
          citiesData = result.data;
        } else if (Array.isArray(result)) {
          citiesData = result;
        }
        
        if (citiesData.length === 0) {
          console.warn('⚠️ لم يتم العثور على مدن في الـ response');
        }
        
        console.log('✅ Cities loaded:', citiesData.length, citiesData);
        setCities(citiesData);
        
        // حاول حفظ في Cache، لو فشل استمر
        try {
          await saveCitiesCache(citiesData);
        } catch (cacheError) {
          console.warn('⚠️ فشل حفظ المدن في Cache، ولكن البيانات محملة:', cacheError);
        }
      }
    } catch (error) {
      console.error('خطأ في تحميل المدن:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCitySelect = async (city) => {
    const cityName = city.nameAr || city.name || city.cityName || city.cityOtherName;
    const cityNameEn = city.name || city.cityName;  // الاسم الإنجليزي للـ API
    const cityId = city._id || city.cityId;
    
    setCitySearch(cityName);
    setShowCityDropdown(false);
    
    // تحديث العنوان
    onAddressChange({
      ...address,
      city: cityName,
      cityNameEn: cityNameEn,  // حفظ الاسم الإنجليزي
      cityId: cityId,
      district: '',
      districtId: '',
      zoneId: ''
    });

    // جلب المناطق والـ Zones
    setDistricts([]);
    setZones([]);
    setDistrictSearch('');
    setZoneSearch('');

    const settings = await getBostaSettings();
    if (settings.apiKey) {
      const cityIdForAPI = cityId;
      await Promise.all([
        loadDistricts(settings.apiKey, cityIdForAPI),
        loadZones(settings.apiKey, cityIdForAPI)
      ]);
    }
  };

  const handleDistrictSelect = (district) => {
    const districtName = district.districtName || district.districtOtherName;
    setDistrictSearch(districtName);
    setShowDistrictDropdown(false);

    onAddressChange({
      ...address,
      district: districtName,
      districtId: district.districtId
    });
  };

  const handleZoneSelect = (zone) => {
    setZoneSearch(zone.name);
    setShowZoneDropdown(false);

    onAddressChange({
      ...address,
      zoneId: zone._id
    });
  };

  const loadDistricts = async (apiKey, cityId) => {
    setLoadingDistricts(true);
    try {
      // تحقق من Cache
      const cachedDistricts = await getDistrictsCache(cityId);
      if (cachedDistricts && Array.isArray(cachedDistricts)) {
        console.log('✅ تم تحميل المناطق من Cache');
        setDistricts(cachedDistricts);
        setLoadingDistricts(false);
        return;
      }

      // جلب من API
      const bostaAPI = new BostaAPI(apiKey);
      const result = await bostaAPI.getDistricts(cityId);

      if (result.error) {
        console.error('فشل تحميل المناطق:', result.error);
        setDistricts([]);
      } else {
        // Bosta يرجع { success: true, data: { list: [...] } } أو { success: true, data: [...] }
        let districtsData = [];
        
        if (result.success && result.data && Array.isArray(result.data.list)) {
          // الـ response الجديد: data.list
          districtsData = result.data.list;
        } else if (result.success && Array.isArray(result.data)) {
          // الـ response القديم: data مباشرة
          districtsData = result.data;
        } else if (Array.isArray(result.data)) {
          districtsData = result.data;
        } else if (Array.isArray(result)) {
          districtsData = result;
        }
        
        console.log('✅ Districts loaded:', districtsData.length);
        setDistricts(districtsData);
        
        // حفظ في Cache
        try {
          await saveDistrictsCache(cityId, districtsData);
        } catch (cacheError) {
          console.warn('⚠️ فشل حفظ Districts في Cache:', cacheError);
        }
      }
    } catch (error) {
      console.error('خطأ في تحميل المناطق:', error);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const loadZones = async (apiKey, cityId) => {
    setLoadingZones(true);
    try {
      // تحقق من Cache
      const cachedZones = await getZonesCache(cityId);
      if (cachedZones && Array.isArray(cachedZones)) {
        console.log('✅ تم تحميل الـ Zones من Cache');
        setZones(cachedZones);
        setLoadingZones(false);
        return;
      }

      // جلب من API
      const bostaAPI = new BostaAPI(apiKey);
      const result = await bostaAPI.getZones(cityId);

      if (result.error) {
        console.error('فشل تحميل الـ Zones:', result.error);
        setZones([]);
      } else {
        // Bosta يرجع { success: true, data: { list: [...] } } أو { success: true, data: [...] }
        let zonesData = [];
        
        if (result.success && result.data && Array.isArray(result.data.list)) {
          // الـ response الجديد: data.list
          zonesData = result.data.list;
        } else if (result.success && Array.isArray(result.data)) {
          // الـ response القديم: data مباشرة
          zonesData = result.data;
        } else if (Array.isArray(result.data)) {
          zonesData = result.data;
        } else if (Array.isArray(result)) {
          zonesData = result;
        }
        
        console.log('✅ Zones loaded:', zonesData.length);
        setZones(zonesData);
        
        // حفظ في Cache
        try {
          await saveZonesCache(cityId, zonesData);
        } catch (cacheError) {
          console.warn('⚠️ فشل حفظ Zones في Cache:', cacheError);
        }
      }
    } catch (error) {
      console.error('خطأ في تحميل الـ Zones:', error);
    } finally {
      setLoadingZones(false);
    }
  };

  const handleDistrictChange = (e) => {
    const selectedDistrictId = e.target.value;
    const selectedDistrict = districts.find(d => d.districtId === selectedDistrictId);

    if (!selectedDistrict) return;

    onAddressChange({
      ...address,
      district: selectedDistrict.districtName || selectedDistrict.districtOtherName,
      districtId: selectedDistrict.districtId
    });
  };

  const handleZoneChange = (e) => {
    const selectedZoneId = e.target.value;
    const selectedZone = zones.find(z => z._id === selectedZoneId);

    if (!selectedZone) return;

    onAddressChange({
      ...address,
      zoneId: selectedZone._id
    });
  };

  if (!bostaEnabled) {
    // إذا Bosta مش مفعلة - عرض inputs عادية
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
          <input
            type="text"
            value={address.city || ''}
            onChange={(e) => onAddressChange({ ...address, city: e.target.value })}
            placeholder="القاهرة"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة</label>
          <input
            type="text"
            value={address.district || ''}
            onChange={(e) => onAddressChange({ ...address, district: e.target.value })}
            placeholder="المعادي"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  // إذا Bosta مفعلة - عرض Searchable Dropdowns
  return (
    <div className="space-y-3">
      {/* City Searchable Selector */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          المحافظة (بوسطة) {loadingCities && <span className="text-xs text-gray-500">(جاري التحميل...)</span>}
        </label>
        <input
          type="text"
          value={citySearch}
          onChange={(e) => {
            setCitySearch(e.target.value);
            setShowCityDropdown(true);
          }}
          onFocus={() => setShowCityDropdown(true)}
          onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
          placeholder="ابحث عن المدينة..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled || loadingCities}
        />
        {console.log('🔍 City Search:', citySearch, 'Show Dropdown:', showCityDropdown, 'Filtered Cities:', filteredCities.length)}
        {showCityDropdown && filteredCities.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredCities.map((city) => (
              <div
                key={city._id || city.cityId}
                onClick={() => handleCitySelect(city)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800"
              >
                {city.nameAr || city.name || city.cityName}
              </div>
            ))}
          </div>
        )}
        {showCityDropdown && filteredCities.length === 0 && cities.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
            لا توجد مدن مطابقة للبحث
          </div>
        )}
      </div>

      {/* District Searchable Selector */}
      {address.cityId && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            المنطقة {loadingDistricts && <span className="text-xs text-gray-500">(جاري التحميل...)</span>}
          </label>
          <input
            type="text"
            value={districtSearch}
            onChange={(e) => {
              setDistrictSearch(e.target.value);
              setShowDistrictDropdown(true);
            }}
            onFocus={() => setShowDistrictDropdown(true)}
            onBlur={() => setTimeout(() => setShowDistrictDropdown(false), 200)}
            placeholder="ابحث عن المنطقة..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled || loadingDistricts}
          />
          {showDistrictDropdown && filteredDistricts.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredDistricts.map((district) => (
                <div
                  key={district.districtId}
                  onClick={() => handleDistrictSelect(district)}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800"
                >
                  {district.districtName || district.districtOtherName}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zone Searchable Selector (Optional) */}
      {address.cityId && zones.length > 0 && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zone (اختياري) {loadingZones && <span className="text-xs text-gray-500">(جاري التحميل...)</span>}
          </label>
          <input
            type="text"
            value={zoneSearch}
            onChange={(e) => {
              setZoneSearch(e.target.value);
              setShowZoneDropdown(true);
            }}
            onFocus={() => setShowZoneDropdown(true)}
            onBlur={() => setTimeout(() => setShowZoneDropdown(false), 200)}
            placeholder="ابحث عن Zone (اختياري)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled || loadingZones}
          />
          {showZoneDropdown && filteredZones.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredZones.map((zone) => (
                <div
                  key={zone._id}
                  onClick={() => handleZoneSelect(zone)}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800"
                >
                  {zone.nameAr || zone.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* معلومات إضافية */}
      {bostaEnabled && cities.length === 0 && !loadingCities && (
        <p className="text-xs text-red-600">
          ⚠️ فشل تحميل المدن - تأكد من صحة API Key في الإعدادات
        </p>
      )}
    </div>
  );
}
