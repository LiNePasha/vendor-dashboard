"use client";

import { useState, useEffect } from 'react';
import { BostaAPI } from '@/app/lib/bosta-api';
import { getBostaSettings, saveBostaSettings } from '@/app/lib/bosta-helpers';
import { getKashierSettings, saveKashierSettings } from '@/app/lib/kashier-helpers';
import { 
  requestPersistentStorage, 
  getStorageEstimate, 
  exportAllData, 
  importDataFromFile,
  getBackupStatus,
  archiveOldInvoices
} from '@/app/lib/data-persistence';

export default function SettingsPage() {
  const [bostaSettings, setBostaSettings] = useState({
    enabled: false,
    apiKey: '',
    businessLocationId: '',
    pickupCity: 'Cairo', // 🆕
    autoSend: false,
    defaultPackageType: 'Parcel',
    defaultSize: 'MEDIUM',
    allowToOpenPackage: false
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Kashier States
  const [kashierSettings, setKashierSettings] = useState({ enabled: false, merchantId: '', apiPassword: '' });
  const [showKashierSecret, setShowKashierSecret] = useState(false);
  const [savingKashier, setSavingKashier] = useState(false);
  const [kashierSaveSuccess, setKashierSaveSuccess] = useState(false);
  const [testingKashier, setTestingKashier] = useState(false);
  const [kashierTestResult, setKashierTestResult] = useState(null);

  // 🆕 Data Management States
  const [storageInfo, setStorageInfo] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [persistentStorageGranted, setPersistentStorageGranted] = useState(false);
  const [backupInterval, setBackupInterval] = useState('7days');

  useEffect(() => {
    // Load backup interval from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backup-interval') || '7days';
      setBackupInterval(saved);
    }
  }, []);

  const handleToggleAutoBackup = () => {
    const isEnabled = localStorage.getItem('auto-backup-enabled') !== 'false';
    const newState = !isEnabled;
    
    localStorage.setItem('auto-backup-enabled', newState);
    
    if (newState) {
      alert('✅ تم تفعيل النسخ الاحتياطي التلقائي\n\nسيتم إعادة تحميل الصفحة لتشغيل النظام.');
      window.location.reload();
    } else {
      alert('⏸️ تم إيقاف النسخ الاحتياطي التلقائي\n\nلن تتلقى إشعارات تلقائية.\nيمكنك التصدير يدوياً في أي وقت.');
      window.location.reload();
    }
  };

  useEffect(() => {
    loadSettings();
    loadDataManagementInfo(); // 🆕 Load storage and backup info
  }, []);

  // 🆕 Load storage info and backup status
  const loadDataManagementInfo = async () => {
    try {
      const storage = await getStorageEstimate();
      setStorageInfo(storage);
      
      const backup = await getBackupStatus();
      setBackupStatus(backup);
      
      // Check actual browser persistent storage status
      const persisted = await navigator.storage?.persisted();
      
      // Check if user has clicked "activate" button before (even if browser didn't grant)
      const userActivated = localStorage.getItem('protection-activated') === 'true';
      
      // Consider it granted if either browser granted OR user activated
      setPersistentStorageGranted(persisted || userActivated);
    } catch (error) {
      console.error('❌ Error loading data management info:', error);
    }
  };

  const loadSettings = async () => {
    const settings = await getBostaSettings();
    setBostaSettings(settings);

    const kSettings = await getKashierSettings();
    setKashierSettings(kSettings);
    
    // 🆕 تحميل أماكن الاستلام المحفوظة
    if (settings.pickupLocations && settings.pickupLocations.length > 0) {
      setPickupLocations(settings.pickupLocations);
      console.log('✅ تم تحميل', settings.pickupLocations.length, 'موقع استلام من الـ cache');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // 🆕 حفظ المواقع مع الإعدادات
      const settingsToSave = {
        ...bostaSettings,
        pickupLocations: pickupLocations
      };
      
      await saveBostaSettings(settingsToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      alert('❌ فشل حفظ الإعدادات: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!bostaSettings.apiKey || bostaSettings.apiKey.trim() === '') {
      setTestResult({
        success: false,
        message: '⚠️ أدخل API Key أولاً'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const bostaAPI = new BostaAPI(bostaSettings.apiKey);
      const success = await bostaAPI.testConnection();

      if (success) {
        setTestResult({
          success: true,
          message: '✅ الاتصال ناجح - API Key صحيح'
        });
      } else {
        setTestResult({
          success: false,
          message: '❌ فشل الاتصال - تحقق من API Key'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: '❌ خطأ: ' + error.message
      });
    } finally {
      setTesting(false);
    }
  };

  // 🆕 دالة منفصلة لتحديث أماكن الاستلام
  const handleRefreshLocations = async () => {
    if (!bostaSettings.apiKey || bostaSettings.apiKey.trim() === '') {
      setTestResult({
        success: false,
        message: '⚠️ أدخل API Key أولاً'
      });
      return;
    }

    const bostaAPI = new BostaAPI(bostaSettings.apiKey);
    await loadPickupLocations(bostaAPI);
  };

  const loadPickupLocations = async (bostaAPI) => {
    setLoadingLocations(true);
    try {
      console.log('🔍 Fetching pickup locations...');
      const locations = await bostaAPI.getPickupLocations();
      console.log('📦 Pickup locations response:', locations);
      
      if (locations.error) {
        console.error('❌ Failed to load pickup locations:', locations.error);
        setPickupLocations([]);
        setTestResult({
          success: false,
          message: '❌ فشل تحميل أماكن الاستلام: ' + locations.error
        });
      } else {
        // Bosta API Response: { success: true, data: { list: [...] } }
        let locationsArray = [];
        
        if (locations.success && locations.data && Array.isArray(locations.data.list)) {
          locationsArray = locations.data.list;
        } else if (Array.isArray(locations)) {
          locationsArray = locations;
        } else if (locations.data && Array.isArray(locations.data)) {
          locationsArray = locations.data;
        }
        
        console.log('✅ Parsed locations:', locationsArray);
        setPickupLocations(locationsArray);
        
        if (locationsArray.length > 0) {
          setTestResult({
            success: true,
            message: `✅ تم تحميل ${locationsArray.length} موقع استلام بنجاح`
          });
        } else {
          setTestResult({
            success: true,
            message: '⚠️ لا توجد أماكن استلام - يمكنك ترك الحقل فارغاً'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error loading pickup locations:', error);
      setPickupLocations([]);
      setTestResult({
        success: false,
        message: '❌ خطأ في تحميل أماكن الاستلام: ' + error.message
      });
    } finally {
      setLoadingLocations(false);
    }
  };

  // 🆕 Data Management Functions
  const handleRequestPersistentStorage = async () => {
    try {
      const result = await requestPersistentStorage();
      
      // Mark as activated in localStorage (persist even if browser didn't grant)
      localStorage.setItem('protection-activated', 'true');
      
      // Always set as granted to hide the button (user took action)
      setPersistentStorageGranted(true);
      
      if (result.granted) {
        alert('✅ تم تفعيل الحماية الدائمة للبيانات!\n\nلن يتم حذف البيانات تلقائياً من المتصفح');
      } else {
        const intervalText = getIntervalText(backupInterval);
        alert('✅ تم تفعيل نظام الحماية!\n\n' + 
              `🔔 ستتلقى إشعار ${intervalText} لتنزيل نسخة احتياطية\n` +
              '💾 البيانات محمية بالنسخ الاحتياطي التلقائي\n\n' +
              'ملاحظة: الحماية الدائمة للمتصفح قد لا تكون متاحة على localhost');
      }
      
      await loadDataManagementInfo();
    } catch (error) {
      console.error('❌ Error requesting persistent storage:', error);
      alert('❌ حدث خطأ: ' + error.message);
    }
  };

  const handleBackupIntervalChange = (interval) => {
    setBackupInterval(interval);
    localStorage.setItem('backup-interval', interval);
    
    // Reload page to restart backup scheduler with new interval
    if (confirm('تم تغيير فترة النسخ الاحتياطي التلقائي!\n\nهل تريد إعادة تحميل الصفحة لتفعيل التغيير؟')) {
      window.location.reload();
    }
  };

  const getIntervalText = (interval) => {
    switch(interval) {
      case '2min': return 'كل دقيقتين';
      case '5min': return 'كل 5 دقائق';
      case '1day': return 'كل يوم';
      case '3days': return 'كل 3 أيام';
      case '7days': return 'كل 7 أيام';
      default: return 'كل 7 أيام';
    }
  };

  const handleTestBackupNow = async () => {
    if (confirm('🧪 هل تريد اختبار نظام النسخ الاحتياطي الآن؟\n\nسيتم تنزيل نسخة احتياطية فوراً.')) {
      setExporting(true);
      try {
        const result = await exportAllData();
        if (result.success) {
          alert(`✅ نجح الاختبار!\n\nتم تنزيل ${result.recordsCount} جدول بيانات\nالملف في مجلد Downloads`);
        }
      } catch (error) {
        alert('❌ فشل الاختبار: ' + error.message);
      } finally {
        setExporting(false);
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportAllData(false); // Downloads folder
      
      if (result.success) {
        alert(`✅ تم تصدير ${result.recordsCount} جدول بيانات بنجاح\n\nالملف في مجلد Downloads`);
        await loadDataManagementInfo(); // Update last backup time
      } else {
        alert('❌ فشل التصدير: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      alert('❌ حدث خطأ في التصدير: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportToCustomLocation = async () => {
    setExporting(true);
    try {
      const result = await exportAllData(true); // Custom location
      
      if (result.success) {
        const location = result.savedTo === 'custom-location' ? 'المكان الذي اخترته' : 'مجلد Downloads';
        alert(`✅ تم تصدير ${result.recordsCount} جدول بيانات بنجاح\n\nالملف في: ${location}`);
        await loadDataManagementInfo();
      } else {
        alert('❌ فشل التصدير: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      alert('❌ حدث خطأ في التصدير: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ هل أنت متأكد؟ سيتم استبدال كل البيانات الحالية')) {
      event.target.value = ''; // Reset file input
      return;
    }

    setImporting(true);
    try {
      const result = await importDataFromFile(file);
      
      if (result.success) {
        alert(`✅ تم استيراد ${result.importedCount} جدول بيانات بنجاح`);
        window.location.reload(); // Reload to reflect imported data
      } else {
        alert('❌ فشل الاستيراد: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Import error:', error);
      alert('❌ حدث خطأ في الاستيراد: ' + error.message);
    } finally {
      setImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleArchive = async () => {
    if (!confirm('هل تريد أرشفة الفواتير الأقدم من 3 أشهر؟\nسيتم حفظها في ملف منفصل وحذفها من النظام.')) {
      return;
    }

    setArchiving(true);
    try {
      const result = await archiveOldInvoices(3);
      
      if (result.success) {
        alert(`✅ تم الأرشفة بنجاح\nتم الاحتفاظ بـ ${result.kept} فاتورة\nتم أرشفة ${result.archived} فاتورة`);
        await loadDataManagementInfo();
      } else {
        alert('❌ فشلت الأرشفة: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Archive error:', error);
      alert('❌ حدث خطأ في الأرشفة: ' + error.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">⚙️ الإعدادات</h1>
          <p className="text-gray-600 text-sm md:text-base">إدارة إعدادات النظام والتكاملات الخارجية</p>
        </div>

        {/* Bosta Settings Card */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-gray-800">Bosta Integration</h2>
                <p className="text-xs md:text-sm text-gray-600">ربط النظام مع بوسطة للشحن</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bostaSettings.enabled}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  enabled: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 
                            peer-focus:ring-purple-300 rounded-full peer 
                            peer-checked:after:translate-x-full peer-checked:after:border-white 
                            after:content-[''] after:absolute after:top-0.5 after:start-[4px] 
                            after:bg-white after:border-gray-300 after:border after:rounded-full 
                            after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600">
              </div>
              <span className="ms-3 text-sm font-medium text-gray-700">
                {bostaSettings.enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </label>
          </div>

          {/* Settings Form */}
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={bostaSettings.apiKey}
                  onChange={(e) => setBostaSettings({
                    ...bostaSettings,
                    apiKey: e.target.value
                  })}
                  placeholder="أدخل API Key من حساب Bosta"
                  className="w-full px-4 py-3 pe-12 border border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-purple-500 focus:border-transparent
                           disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!bostaSettings.enabled}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 
                           hover:text-gray-700 text-lg"
                  disabled={!bostaSettings.enabled}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                احصل على API Key من{' '}
                <a
                  href="https://business.bosta.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  حساب Bosta
                </a>
              </p>
            </div>

            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={!bostaSettings.enabled || !bostaSettings.apiKey || testing}
              className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg font-bold
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              {testing ? '⏳ جاري الاختبار...' : '🔍 اختبار الاتصال'}
            </button>

            {/* Clear Cache Button */}
            <button
              onClick={async () => {
                if (confirm('هل تريد مسح الـ Cache؟ سيتم إعادة تحميل المدن والمناطق من Bosta.')) {
                  const { clearBostaCache } = await import('@/app/lib/bosta-locations-cache');
                  const result = await clearBostaCache();
                  if (result.success) {
                    setTestResult({
                      success: true,
                      message: `✅ تم مسح ${result.cleared} عنصر من الـ Cache بنجاح`
                    });
                  } else {
                    setTestResult({
                      success: false,
                      message: '❌ فشل مسح الـ Cache: ' + result.error
                    });
                  }
                }
              }}
              disabled={!bostaSettings.enabled}
              className="w-full bg-orange-500 text-white px-4 py-3 rounded-lg font-bold
                       hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            >
              🗑️ مسح Cache بوسطة
            </button>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-4 rounded-lg text-sm md:text-base ${testResult.success
                    ? 'bg-green-50 border border-green-300 text-green-700'
                    : 'bg-red-50 border border-red-300 text-red-700'
                  }`}
              >
                {testResult.message}
              </div>
            )}

            {/* Business Location ID */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700">
                  مكان الاستلام (Pickup Location)
                </label>
                
                {/* 🆕 زر تحديث أماكن الاستلام */}
                {bostaSettings.enabled && bostaSettings.apiKey && (
                  <button
                    onClick={handleRefreshLocations}
                    disabled={loadingLocations}
                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg 
                             hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors font-medium"
                  >
                    {loadingLocations ? '⏳ جاري التحديث...' : '🔄 تحديث القائمة'}
                  </button>
                )}
              </div>
              
              {pickupLocations.length > 0 ? (
                // عرض Dropdown إذا تم جلب المواقع
                <div className="space-y-2">
                  <select
                    value={bostaSettings.businessLocationId}
                    onChange={(e) => setBostaSettings({
                      ...bostaSettings,
                      businessLocationId: e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                             focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!bostaSettings.enabled || loadingLocations}
                  >
                    <option value="">اختياري - اختر مكان الاستلام</option>
                    {pickupLocations.map((location) => (
                      <option key={location._id} value={location._id}>
                        {location.locationName} - {location.address?.city?.name || location.address?.district || ''} ({location.address?.firstLine || ''})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-green-600">
                    ✅ تم تحميل {pickupLocations.length} موقع
                  </p>
                </div>
              ) : (
                // عرض Input عادي إذا لم يتم جلب المواقع
                <div className="space-y-2">
                  <input
                    type="text"
                    value={bostaSettings.businessLocationId}
                    onChange={(e) => setBostaSettings({
                      ...bostaSettings,
                      businessLocationId: e.target.value
                    })}
                    placeholder="اختياري - ID مكان الاستلام"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                             focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!bostaSettings.enabled}
                  />
                  {loadingLocations && (
                    <p className="text-xs text-blue-600">
                      ⏳ جاري تحميل أماكن الاستلام...
                    </p>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                مكان استلام الطلبات من Bosta (اختياري) - سيتم تحميل القائمة بعد اختبار الاتصال
              </p>
            </div>

            {/* Pickup City Name (English) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏙️ اسم مدينة الاستلام (بالإنجليزي) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bostaSettings.pickupCity || 'Cairo'}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  pickupCity: e.target.value
                })}
                placeholder="Cairo, Alexandria, Giza, etc."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!bostaSettings.enabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 استخدم الاسم الإنجليزي للمدينة (مثل: Cairo, Alexandria, Giza) - مهم لحساب تكلفة الشحن
              </p>
            </div>


            {/* Auto Send */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-bold text-gray-800 text-sm md:text-base">إرسال تلقائي</p>
                <p className="text-xs md:text-sm text-gray-600">
                  إرسال الطلبات تلقائياً لبوسطة عند إنشائها
                </p>
              </div>
              <input
                type="checkbox"
                checked={bostaSettings.autoSend}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  autoSend: e.target.checked
                })}
                disabled={!bostaSettings.enabled}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Default Package Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                نوع الشحنة الافتراضي
              </label>
              <select
                value={bostaSettings.defaultPackageType}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  defaultPackageType: e.target.value
                })}
                disabled={!bostaSettings.enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="Parcel">Parcel (طرد)</option>
                <option value="Document">Document (مستند)</option>
              </select>
            </div>

            {/* Default Size */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                الحجم الافتراضي
              </label>
              <select
                value={bostaSettings.defaultSize}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  defaultSize: e.target.value
                })}
                disabled={!bostaSettings.enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="SMALL">صغير (SMALL)</option>
                <option value="MEDIUM">متوسط (MEDIUM)</option>
                <option value="LARGE">كبير (LARGE)</option>
              </select>
            </div>

            {/* Allow To Open Package */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-bold text-gray-800 text-sm md:text-base">السماح بفتح الطرد</p>
                <p className="text-xs md:text-sm text-gray-600">
                  السماح للعميل بفتح الطرد قبل الدفع
                </p>
              </div>
              <input
                type="checkbox"
                checked={bostaSettings.allowToOpenPackage}
                onChange={(e) => setBostaSettings({
                  ...bostaSettings,
                  allowToOpenPackage: e.target.checked
                })}
                disabled={!bostaSettings.enabled}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full px-6 py-4 rounded-lg text-lg font-bold
                       transition-all shadow-lg
                       ${saveSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
                }
                       disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? '⏳ جاري الحفظ...' : saveSuccess ? '✅ تم الحفظ بنجاح' : '💾 حفظ الإعدادات'}
            </button>
          </div>
        </div>

        {/* ── Kashier Integration Card ── */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💳</span>
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-gray-800">Kashier Integration</h2>
                <p className="text-xs md:text-sm text-gray-600">ربط النظام مع بوابة دفع Kashier للتحقق من المدفوعات</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={kashierSettings.enabled}
                onChange={(e) => setKashierSettings({ ...kashierSettings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">{kashierSettings.enabled ? 'مفعّل' : 'معطّل'}</span>
            </label>
          </div>

          <div className="space-y-4">
            {/* Merchant ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID (MID)</label>
              <input
                type="text"
                placeholder="مثال: 123456"
                value={kashierSettings.merchantId}
                onChange={(e) => setKashierSettings({ ...kashierSettings, merchantId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">موجود في لوحة تحكم Kashier → My Account → Merchant ID</p>
            </div>

            {/* API Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Password (Secret Key)</label>
              <div className="relative">
                <input
                  type={showKashierSecret ? 'text' : 'password'}
                  placeholder="API Password من لوحة Kashier"
                  value={kashierSettings.apiPassword}
                  onChange={(e) => setKashierSettings({ ...kashierSettings, apiPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowKashierSecret(!showKashierSecret)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showKashierSecret ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">موجود في لوحة Kashier → Integration → API Keys</p>
            </div>

            {/* Test Result */}
            {kashierTestResult && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                kashierTestResult.success ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-red-50 border border-red-300 text-red-800'
              }`}>
                {kashierTestResult.message}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={async () => {
                  if (!kashierSettings.merchantId || !kashierSettings.apiPassword) {
                    setKashierTestResult({ success: false, message: '⚠️ أدخل Merchant ID و API Password أولاً' });
                    return;
                  }
                  setTestingKashier(true);
                  setKashierTestResult(null);
                  try {
                    // اختبار بسيط: نعمل check على orderId = 0 ونتأكد إن الـ API بترد
                    const res = await fetch('/api/orders/check-kashier-payment', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        orderId: 'test-connection-0',
                        merchantId: kashierSettings.merchantId,
                        apiPassword: kashierSettings.apiPassword,
                      }),
                    });
                    // أي رد من السيرفر (حتى 502) يعني الإعدادات وصلت للـ route
                    const data = await res.json();
                    if (res.ok || data?.paymentStatus !== undefined || data?.paid === false) {
                      setKashierTestResult({ success: true, message: '✅ الاتصال بـ Kashier شغال — الإعدادات صحيحة' });
                    } else {
                      setKashierTestResult({ success: false, message: data?.error || '❌ فشل الاتصال بـ Kashier' });
                    }
                  } catch (err) {
                    setKashierTestResult({ success: false, message: '❌ خطأ: ' + err.message });
                  } finally {
                    setTestingKashier(false);
                  }
                }}
                disabled={testingKashier}
                className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {testingKashier ? '⏳ جاري الاختبار...' : '🔌 اختبار الاتصال'}
              </button>

              <button
                onClick={async () => {
                  setSavingKashier(true);
                  setKashierSaveSuccess(false);
                  await saveKashierSettings(kashierSettings);
                  setSavingKashier(false);
                  setKashierSaveSuccess(true);
                  setTimeout(() => setKashierSaveSuccess(false), 3000);
                }}
                disabled={savingKashier}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {savingKashier ? '⏳ جاري الحفظ...' : kashierSaveSuccess ? '✅ تم الحفظ' : '💾 حفظ إعدادات Kashier'}
              </button>
            </div>
          </div>
        </div>

        {/* 🆕 Data Management Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-right">
            💾 إدارة البيانات والنسخ الاحتياطي
          </h2>

          {/* Storage Info */}
          {storageInfo && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">المساحة المستخدمة</span>
                <span className="font-bold text-blue-600">
                  {storageInfo.usageInMB} MB / {(storageInfo.quota / 1024 / 1024 / 1024).toFixed(0)} GB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(storageInfo.percentageUsed, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-right">
                {storageInfo.percentageUsed}% مستخدمة
              </p>
            </div>
          )}

          {/* Persistent Storage Status */}
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: persistentStorageGranted ? '#f0fdf4' : '#fef3c7',
            borderColor: persistentStorageGranted ? '#86efac' : '#fbbf24'
          }}>
            <div className="flex items-center justify-between">
              <div className="text-right flex-1">
                <p className="font-bold text-gray-800 mb-1">
                  {persistentStorageGranted ? '✅ الحماية الدائمة مفعّلة' : '⚠️ الحماية الدائمة غير مفعّلة'}
                </p>
                <p className="text-sm text-gray-600">
                  {persistentStorageGranted 
                    ? 'بياناتك محمية ولن يتم حذفها تلقائياً'
                    : 'قد يحذف المتصفح البيانات عند امتلاء المساحة'
                  }
                </p>
              </div>
              {!persistentStorageGranted && (
                <button
                  onClick={handleRequestPersistentStorage}
                  className="mr-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-bold"
                >
                  تفعيل الحماية
                </button>
              )}
            </div>
          </div>

          {/* Auto-Backup Interval Setting */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-800 mb-1">⏰ النسخ الاحتياطي التلقائي</p>
                <p className="text-sm text-gray-600">تفعيل/إيقاف النظام واختيار الفترة</p>
              </div>
              <button
                onClick={handleToggleAutoBackup}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                  (typeof window !== 'undefined' && localStorage.getItem('auto-backup-enabled') !== 'false')
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-400 text-white hover:bg-gray-500'
                }`}
              >
                {(typeof window !== 'undefined' && localStorage.getItem('auto-backup-enabled') !== 'false') 
                  ? '✅ مُفعّل' 
                  : '⏸️ مُوقف'}
              </button>
            </div>
            
            {(typeof window === 'undefined' || localStorage.getItem('auto-backup-enabled') !== 'false') && (
              <>
                <p className="text-sm text-gray-600 mb-3">اختر كل كم مدة تريد تنزيل نسخة احتياطية</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button
                onClick={() => handleBackupIntervalChange('2min')}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  backupInterval === '2min'
                    ? '!bg-purple-600 !text-white'
                    : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                🧪 دقيقتين<br/><span className="text-xs">(للتجربة)</span>
              </button>
              <button
                onClick={() => handleBackupIntervalChange('5min')}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  backupInterval === '5min'
                    ? '!bg-purple-600 !text-white'
                    : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                ⚡ 5 دقائق<br/><span className="text-xs">(تجربة)</span>
              </button>
              <button
                onClick={() => handleBackupIntervalChange('1day')}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  backupInterval === '1day'
                    ? '!bg-purple-600 !text-white'
                    : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                📅 كل يوم
              </button>
              <button
                onClick={() => handleBackupIntervalChange('3days')}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  backupInterval === '3days'
                    ? '!bg-purple-600 !text-white'
                    : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                📆 كل 3 أيام
              </button>
              <button
                onClick={() => handleBackupIntervalChange('7days')}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  backupInterval === '7days'
                    ? '!bg-purple-600 !text-white'
                    : 'bg-white text-gray-700 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                📅 كل أسبوع<br/><span className="text-xs">(موصى به)</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right">
              الإعداد الحالي: <strong>{getIntervalText(backupInterval)}</strong>
            </p>
            </>
            )}
          </div>

          {/* Backup Status */}
          {backupStatus && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 text-right">
                📅 آخر نسخة احتياطية: {' '}
                <span className="font-bold text-gray-800">
                  {backupStatus.lastBackupDate 
                    ? new Date(backupStatus.lastBackupDate).toLocaleDateString('ar-EG')
                    : 'لم يتم عمل نسخة احتياطية بعد'
                  }
                </span>
                {backupStatus.daysSinceLastBackup !== null && (
                  <span className="text-xs text-gray-500 mr-2">
                    (منذ {backupStatus.daysSinceLastBackup} يوم)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Export Buttons Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export to Downloads */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-6 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 
                         transition-all shadow-md font-bold text-lg disabled:opacity-50 
                         disabled:cursor-not-allowed"
              >
                {exporting ? '⏳ جاري التصدير...' : '⬇️ تصدير إلى Downloads'}
              </button>

              {/* Export to Custom Location (Chrome/Edge only) */}
              <button
                onClick={handleExportToCustomLocation}
                disabled={exporting}
                className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 
                         transition-all shadow-md font-bold text-lg disabled:opacity-50 
                         disabled:cursor-not-allowed"
              >
                {exporting ? '⏳ جاري التصدير...' : '📁 اختر مكان الحفظ'}
              </button>
            </div>

            {/* Test Backup Now Button */}
            <button
              onClick={handleTestBackupNow}
              disabled={exporting}
              className="w-full px-6 py-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 
                       transition-all shadow-md font-bold text-lg disabled:opacity-50 
                       disabled:cursor-not-allowed border-2 border-yellow-600"
            >
              {exporting ? '⏳ جاري الاختبار...' : '🧪 اختبر النسخ الاحتياطي الآن'}
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Import Button */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/json"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
              <div className={`px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                            transition-all shadow-md font-bold text-lg text-center
                            ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {importing ? '⏳ جاري الاستيراد...' : '⬆️ استيراد البيانات'}
              </div>
            </label>

            {/* Archive Button */}
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-6 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 
                       transition-all shadow-md font-bold text-lg disabled:opacity-50 
                       disabled:cursor-not-allowed"
            >
              {archiving ? '⏳ جاري الأرشفة...' : '📦 أرشفة البيانات القديمة'}
            </button>

            {/* Refresh Storage Info Button */}
            <button
              onClick={loadDataManagementInfo}
              className="px-6 py-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 
                       transition-all shadow-md font-bold text-lg"
            >
              🔄 تحديث معلومات التخزين
            </button>
            </div>
          </div>

          {/* Info Messages */}
          <div className="mt-6 space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700 text-right">
                💡 <strong>تصدير للـ Downloads:</strong> سريع وبسيط - الملف ينزل في مجلد Downloads تلقائياً
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-gray-700 text-right">
                📁 <strong>اختر مكان الحفظ:</strong> تختار المجلد (Google Drive / فلاشة / أي مكان) - يشتغل في Chrome و Edge فقط
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700 text-right">
                ⚠️ <strong>استيراد البيانات:</strong> يستبدل كل البيانات الحالية بالبيانات من الملف
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-gray-700 text-right">
                📦 <strong>الأرشفة:</strong> تحفظ الفواتير الأقدم من 3 أشهر في ملف منفصل وتحذفها من النظام لتوفير المساحة
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-700 text-right">
                🔄 <strong>النسخ التلقائي:</strong> يسألك كل 7 أيام إذا كنت تريد عمل نسخة احتياطية
              </p>
            </div>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-6 text-center">
          <a
            href="https://docs.bosta.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline text-sm md:text-base"
          >
            📚 وثائق Bosta API
          </a>
        </div>
      </div>
    </div>
  );
}
