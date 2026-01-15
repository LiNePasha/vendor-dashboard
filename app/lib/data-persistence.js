/**
 * Data Persistence & Backup System
 * نظام حماية وأرشفة البيانات
 */

/**
 * Request persistent storage (البيانات لن تُحذف)
 */
export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    console.warn('⚠️ Persistent Storage API not supported');
    return { 
      granted: false, 
      reason: 'not-supported',
      message: 'المتصفح لا يدعم الحماية الدائمة للبيانات'
    };
  }

  try {
    // Check if already persistent
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      console.log('✅ البيانات محمية بالفعل من الحذف');
      return { 
        granted: true, 
        reason: 'already-granted',
        message: 'البيانات محمية بالفعل'
      };
    }

    // Request persistent storage
    const granted = await navigator.storage.persist();
    
    if (granted) {
      console.log('✅ تم تفعيل الحماية - البيانات لن تُحذف تلقائياً');
      return { 
        granted: true, 
        reason: 'newly-granted',
        message: 'تم تفعيل الحماية بنجاح'
      };
    } else {
      // Explain why permission was denied
      let reason = 'denied';
      let detailedMessage = '⚠️ لم يتم منح إذن الحماية الدائمة\n\n';
      
      detailedMessage += '📌 الأسباب المحتملة:\n\n';
      
      // Check if it's localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        detailedMessage += '💻 localhost: المتصفحات عادة لا تمنح الحماية الدائمة على localhost\n';
        detailedMessage += '   → هذا طبيعي في بيئة التطوير!\n\n';
      }
      
      // Check if it's because of HTTPS requirement
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        reason = 'not-https';
        detailedMessage += '🔒 الموقع ليس على HTTPS\n';
        detailedMessage += '   → يجب استخدام https:// للحصول على الحماية\n\n';
      }
      
      // Check browser
      const userAgent = window.navigator.userAgent.toLowerCase();
      let browserName = 'Unknown';
      if (userAgent.includes('chrome') && !userAgent.includes('edge')) browserName = 'Chrome';
      else if (userAgent.includes('edge')) browserName = 'Edge';
      else if (userAgent.includes('firefox')) browserName = 'Firefox';
      else if (userAgent.includes('safari')) browserName = 'Safari';
      
      detailedMessage += `🌐 المتصفح: ${browserName}\n`;
      
      if (browserName === 'Safari') {
        detailedMessage += '   → Safari له قيود صارمة على الحماية الدائمة\n';
        detailedMessage += '   → جرب Chrome أو Edge للحصول على دعم أفضل\n\n';
      } else if (browserName === 'Firefox') {
        detailedMessage += '   → Firefox يتطلب تفاعل أكثر مع الموقع\n';
        detailedMessage += '   → استخدم الموقع لفترة وجرب مرة أخرى\n\n';
      } else {
        detailedMessage += '   → جرب استخدام الموقع لفترة وأعد المحاولة\n\n';
      }
      
      // Check if site is added to home screen (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          window.navigator.standalone === true;
      
      if (isStandalone) {
        detailedMessage += '✅ الموقع يعمل كـ PWA\n\n';
      } else {
        detailedMessage += '📱 الموقع ليس مثبت كـ PWA\n';
        detailedMessage += '   → جرب تثبيته من قائمة المتصفح\n\n';
      }
      
      detailedMessage += '━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      detailedMessage += '✅ لا تقلق! بياناتك آمنة:\n\n';
      detailedMessage += '• النسخ الاحتياطي التلقائي كل 7 أيام\n';
      detailedMessage += '• يمكنك تصدير البيانات يدوياً أي وقت\n';
      detailedMessage += '• المتصفح نادراً ما يحذف البيانات\n';
      detailedMessage += '• الحماية الدائمة مجرد طبقة أمان إضافية\n\n';
      detailedMessage += '💡 النسخ الاحتياطية أهم من الحماية الدائمة!';
      
      console.warn('⚠️ لم يتم منح إذن حماية البيانات');
      console.log('Browser:', browserName);
      console.log('Protocol:', window.location.protocol);
      console.log('Hostname:', window.location.hostname);
      console.log('Standalone:', isStandalone);
      
      return { 
        granted: false, 
        reason: reason,
        message: detailedMessage
      };
    }
  } catch (error) {
    console.error('❌ خطأ في طلب حماية البيانات:', error);
    return { 
      granted: false, 
      reason: 'error',
      message: 'حدث خطأ: ' + error.message
    };
  }
}

/**
 * Get storage estimate (حجم البيانات المستخدمة)
 */
export async function getStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage, // Bytes used
      quota: estimate.quota, // Total bytes available
      usageInMB: (estimate.usage / 1024 / 1024).toFixed(2),
      quotaInMB: (estimate.quota / 1024 / 1024).toFixed(2),
      percentageUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
    };
  } catch (error) {
    console.error('❌ خطأ في قراءة حجم البيانات:', error);
    return null;
  }
}

/**
 * Export all data with optional File System Access API
 * (تصدير كل البيانات مع خيار اختيار المكان)
 */
export async function exportAllData(useFileSystemAPI = false) {
  try {
    const localforage = (await import('localforage')).default;
    
    // جمع كل البيانات من كل المخازن
    const allData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    // Get all keys from default store
    const keys = await localforage.keys();
    for (const key of keys) {
      const value = await localforage.getItem(key);
      allData.data[key] = value;
    }

    // Create JSON blob
    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `vendor-pos-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Try File System Access API first (Chrome/Edge only)
    if (useFileSystemAPI && 'showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'JSON Backup File',
            accept: { 'application/json': ['.json'] }
          }]
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        console.log('✅ تم حفظ النسخة الاحتياطية في المكان المحدد');
        return { success: true, recordsCount: keys.length, savedTo: 'custom-location' };
      } catch (fsError) {
        // User cancelled or API not supported, fall back to download
        if (fsError.name !== 'AbortError') {
          console.log('⚠️ File System Access غير مدعوم، استخدام Downloads');
        }
      }
    }

    // Fallback: Traditional download to Downloads folder
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ تم تصدير البيانات إلى مجلد Downloads');
    return { success: true, recordsCount: keys.length, savedTo: 'downloads' };
  } catch (error) {
    console.error('❌ خطأ في تصدير البيانات:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import data from file (استيراد البيانات من ملف)
 */
export async function importDataFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.data || typeof data.data !== 'object') {
      throw new Error('صيغة الملف غير صحيحة');
    }

    const localforage = (await import('localforage')).default;
    
    // استيراد كل البيانات
    let importedCount = 0;
    for (const [key, value] of Object.entries(data.data)) {
      await localforage.setItem(key, value);
      importedCount++;
    }

    console.log(`✅ تم استيراد ${importedCount} عنصر بنجاح`);
    return { success: true, importedCount, exportDate: data.exportDate };
  } catch (error) {
    console.error('❌ خطأ في استيراد البيانات:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-backup scheduler (نسخ احتياطي تلقائي)
 */
export function setupAutoBackup() {
  const LAST_BACKUP_KEY = 'last-auto-backup';
  
  // Check if auto-backup is enabled
  const isEnabled = localStorage.getItem('auto-backup-enabled') !== 'false';
  
  if (!isEnabled) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️ AUTO-BACKUP SYSTEM DISABLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('النسخ الاحتياطي التلقائي موقوف حالياً');
    console.log('يمكنك تفعيله من الإعدادات');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return; // Don't setup if disabled
  }
  
  // Get interval from localStorage (default: 7 days)
  const getBackupInterval = () => {
    const interval = localStorage.getItem('backup-interval') || '7days';
    switch(interval) {
      case '2min': return 2 * 60 * 1000; // 2 minutes (للتجربة)
      case '5min': return 5 * 60 * 1000; // 5 minutes (للتجربة)
      case '1day': return 24 * 60 * 60 * 1000; // 1 day
      case '3days': return 3 * 24 * 60 * 60 * 1000; // 3 days
      case '7days': return 7 * 24 * 60 * 60 * 1000; // 7 days (default)
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  };

  async function checkAndBackup() {
    try {
      const localforage = (await import('localforage')).default;
      const lastBackup = await localforage.getItem(LAST_BACKUP_KEY);
      const now = Date.now();
      const BACKUP_INTERVAL = getBackupInterval();

      console.log('🔍 Checking backup status:', {
        lastBackup: lastBackup ? new Date(lastBackup).toLocaleString('ar-EG') : 'never',
        timeSince: lastBackup ? Math.round((now - lastBackup) / 1000 / 60) + ' minutes' : 'N/A',
        interval: Math.round(BACKUP_INTERVAL / 1000 / 60) + ' minutes',
        needed: !lastBackup || (now - lastBackup) > BACKUP_INTERVAL
      });

      // Check if backup is needed
      if (!lastBackup || (now - lastBackup) > BACKUP_INTERVAL) {
        console.log('⏰ حان وقت النسخة الاحتياطية التلقائية');
        
        try {
          console.log('📊 Step 1: Checking notification support...');
          const hasNotificationAPI = 'Notification' in window;
          console.log('   Has Notification API:', hasNotificationAPI);
          
          if (!hasNotificationAPI) {
            console.log('❌ Notification API not supported!');
            throw new Error('Notifications not supported');
          }
          
          console.log('📊 Step 2: Checking permission...');
          const currentPermission = Notification.permission;
          console.log('   Current permission:', currentPermission);
          
          console.log('📊 Notification status:', {
            supported: hasNotificationAPI,
            permission: currentPermission,
            willShowNotification: hasNotificationAPI && currentPermission === 'granted'
          });
          
          // Request notification permission if not granted
          if (currentPermission === 'default') {
            console.log('🔔 Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('🔔 Permission result:', permission);
          }

        // Show notification instead of confirm dialog
        if ('Notification' in window && Notification.permission === 'granted') {
          console.log('✅ Step 3: Showing notification...');
          
          try {
            const notification = new Notification('⏰ وقت النسخة الاحتياطية!', {
              body: 'حان وقت عمل نسخة احتياطية لبيانات نظام POS.\nانقر هنا لتنزيل النسخة الآن.',
              icon: '/logos/logo-192x192.png',
              badge: '/logos/logo-192x192.png',
              tag: 'auto-backup',
              requireInteraction: true,
              vibrate: [200, 100, 200]
            });

            console.log('✅ Notification created successfully');
            console.log('👀 الإشعار المفروض يكون ظاهر على الشاشة دلوقتي!');

            notification.onclick = async () => {
              console.log('👆 User clicked notification');
              notification.close();
            
            // Export data
            const result = await exportAllData();
            
            if (result.success) {
              await localforage.setItem(LAST_BACKUP_KEY, now);
              
              // Show success notification
              new Notification('✅ تمت النسخة الاحتياطية!', {
                body: `تم تنزيل ${result.recordsCount} جدول بيانات.\nالملف في مجلد Downloads.`,
                icon: '/logos/logo-192x192.png',
                tag: 'backup-success'
              });
            } else {
              new Notification('❌ فشلت النسخة الاحتياطية', {
                body: 'حدث خطأ. جرب التصدير اليدوي من الإعدادات.',
                icon: '/logos/logo-192x192.png',
                tag: 'backup-failed'
              });
            }
          };
          
          notification.onerror = (error) => {
            console.error('❌ Notification error:', error);
          };
          
          } catch (notifError) {
            console.error('❌ Failed to create notification:', notifError);
            // Fallback to confirm dialog
            if (confirm('⏰ حان وقت النسخة الاحتياطية التلقائية\nهل تريد تنزيل نسخة احتياطية الآن؟')) {
              const result = await exportAllData();
              if (result.success) {
                await localforage.setItem(LAST_BACKUP_KEY, now);
                alert('✅ تم تنزيل النسخة الاحتياطية بنجاح!');
              }
            }
          }
        } else {
          console.log('⚠️ Step 3: Notification not available, using confirm dialog');
          console.log('   Permission:', Notification?.permission);
          console.log('   Will show confirm dialog...');
          // Fallback to old method if notifications not available
          if (confirm('⏰ حان وقت النسخة الاحتياطية التلقائية\nهل تريد تنزيل نسخة احتياطية الآن؟\n\n(سيتم حفظ الملف في مجلد Downloads)')) {
            const result = await exportAllData();
            
            if (result.success) {
              await localforage.setItem(LAST_BACKUP_KEY, now);
              alert(`✅ تم تنزيل النسخة الاحتياطية بنجاح!\n\nالملف في مجلد Downloads:\nvendor-pos-backup-${new Date().toISOString().split('T')[0]}.json\n\n💡 احفظ الملف في مكان آمن`);
            }
          } else {
            // User declined, remind them in 10% of interval (e.g., if 2 min interval, remind in ~12 seconds)
            const reminderDelay = BACKUP_INTERVAL * 0.1;
            await localforage.setItem(LAST_BACKUP_KEY, now - (BACKUP_INTERVAL - reminderDelay));
            console.log('⏭️ User declined, will remind in', Math.round(reminderDelay / 1000), 'seconds');
          }
        }
        
        } catch (mainError) {
          console.error('❌ ERROR in backup check:', mainError);
          console.error('   Stack:', mainError.stack);
        }
      }
    } catch (error) {
      console.error('❌ خطأ في النسخة الاحتياطية التلقائية:', error);
    }
  }

  // Get smart check frequency based on interval
  const getCheckFrequency = () => {
    const interval = localStorage.getItem('backup-interval') || '7days';
    switch(interval) {
      case '2min': return 30 * 1000; // Check every 30 seconds
      case '5min': return 1 * 60 * 1000; // Check every 1 minute
      case '1day': return 6 * 60 * 60 * 1000; // Check every 6 hours
      case '3days': return 12 * 60 * 60 * 1000; // Check every 12 hours
      case '7days': return 24 * 60 * 60 * 1000; // Check every 1 day
      default: return 24 * 60 * 60 * 1000;
    }
  };

  const checkFreq = getCheckFrequency();
  console.log('⏰ Auto-backup check frequency:', Math.round(checkFreq / 1000 / 60), 'minutes');
  setInterval(checkAndBackup, checkFreq);
  
  // Check on load (after 10 seconds to avoid blocking startup)
  setTimeout(checkAndBackup, 10000);
  
  // Request notification permission on setup
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('🔔 Notification permission:', permission);
    });
  }
  
  // Log setup info
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 AUTO-BACKUP SYSTEM INITIALIZED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const currentInterval = localStorage.getItem('backup-interval') || '7days';
  console.log('⏰ Backup interval:', currentInterval);
  console.log('🔍 Check frequency:', Math.round(checkFreq / 1000), 'seconds');
  console.log('📅 First check in: 10 seconds');
  console.log('🔔 Notification permission:', Notification.permission);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Get backup status
 */
export async function getBackupStatus() {
  try {
    const localforage = (await import('localforage')).default;
    const lastBackup = await localforage.getItem('last-auto-backup');
    
    if (!lastBackup) {
      return {
        hasBackup: false,
        message: 'لم يتم عمل نسخة احتياطية بعد'
      };
    }

    const daysSinceBackup = Math.floor((Date.now() - lastBackup) / (1000 * 60 * 60 * 24));
    
    return {
      hasBackup: true,
      lastBackupDate: new Date(lastBackup),
      daysSinceBackup,
      message: `آخر نسخة احتياطية منذ ${daysSinceBackup} يوم`
    };
  } catch (error) {
    console.error('❌ خطأ في قراءة حالة النسخ الاحتياطي:', error);
    return null;
  }
}

/**
 * Clear old data (> 3 months) - لتوفير المساحة
 */
export async function archiveOldInvoices(monthsToKeep = 3) {
  try {
    const { invoiceStorage } = await import('./localforage');
    const allInvoices = await invoiceStorage.getAllInvoices();
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
    
    const recentInvoices = allInvoices.filter(inv => {
      const invDate = new Date(inv.date || inv.createdAt);
      return invDate >= cutoffDate;
    });
    
    const archivedInvoices = allInvoices.filter(inv => {
      const invDate = new Date(inv.date || inv.createdAt);
      return invDate < cutoffDate;
    });

    // Export archived invoices before removing
    if (archivedInvoices.length > 0) {
      const archiveData = {
        exportDate: new Date().toISOString(),
        type: 'archive',
        period: `before-${cutoffDate.toISOString().split('T')[0]}`,
        invoices: archivedInvoices
      };

      const jsonString = JSON.stringify(archiveData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archived-invoices-${archiveData.period}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Keep only recent invoices
    const localforage = (await import('localforage')).default;
    await localforage.setItem('invoices', recentInvoices);

    return {
      success: true,
      kept: recentInvoices.length,
      archived: archivedInvoices.length
    };
  } catch (error) {
    console.error('❌ خطأ في الأرشفة:', error);
    return { success: false, error: error.message };
  }
}
