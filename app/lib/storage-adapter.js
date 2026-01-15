/**
 * Storage Adapter - Universal Storage Layer
 * يستخدم Electron Storage في Desktop App
 * يستخدم LocalForage في Web Browser
 */

const isElectron = () => {
  // Check multiple ways to detect Electron
  if (typeof window === 'undefined') return false;
  
  // Method 1: Check window.require
  if (typeof window.require === 'function') {
    try {
      window.require('electron');
      return true;
    } catch (e) {
      // electron not available
    }
  }
  
  // Method 2: Check process
  if (window.process && window.process.type === 'renderer') {
    return true;
  }
  
  // Method 3: Check user agent
  if (navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
    return true;
  }
  
  return false;
};

class StorageAdapter {
  constructor(storeName) {
    this.storeName = storeName;
    this.mode = null;
    this.storage = null;
    this.initialized = false;
  }

  /**
   * Initialize storage (lazy loading)
   */
  async init() {
    if (this.initialized) return;

    const electronDetected = isElectron();
    console.log('🔍 Storage Detection:', {
      isElectron: electronDetected,
      hasWindowRequire: typeof window !== 'undefined' && typeof window.require === 'function',
      hasProcess: typeof window !== 'undefined' && window.process,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      storeName: this.storeName
    });

    if (electronDetected) {
      // استخدم Electron File System
      try {
        const { default: ElectronStorage } = await import('./electron-storage.js');
        this.storage = new ElectronStorage(`${this.storeName}.json`);
        this.mode = 'electron';
        console.log(`✅ 📁 Storage Mode: Electron (${this.storeName}.json)`);
      } catch (error) {
        console.error('❌ Failed to load Electron Storage, falling back to LocalForage:', error);
        // Fallback to LocalForage if Electron fails
        const localforage = (await import('localforage')).default;
        this.storage = localforage.createInstance({
          name: 'vendor-pos',
          storeName: this.storeName
        });
        this.mode = 'web';
        console.log(`⚠️ 🌐 Storage Mode: Web (Fallback - ${this.storeName})`);
      }
    } else {
      // استخدم LocalForage للمتصفح
      if (typeof window !== 'undefined') {
        const localforage = (await import('localforage')).default;
        this.storage = localforage.createInstance({
          name: 'vendor-pos',
          storeName: this.storeName
        });
        this.mode = 'web';
        console.log(`✅ 🌐 Storage Mode: Web (${this.storeName})`);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Get item from storage
   */
  async getItem(key) {
    await this.init();
    
    try {
      if (this.mode === 'electron') {
        return await this.storage.read();
      } else {
        return await this.storage.getItem(key);
      }
    } catch (error) {
      console.error(`❌ خطأ في قراءة ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item in storage
   */
  async setItem(key, value) {
    await this.init();
    
    try {
      if (this.mode === 'electron') {
        await this.storage.write(value);
      } else {
        await this.storage.setItem(key, value);
      }
    } catch (error) {
      console.error(`❌ خطأ في حفظ ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key) {
    await this.init();
    
    try {
      if (this.mode === 'electron') {
        await this.storage.delete();
      } else {
        await this.storage.removeItem(key);
      }
    } catch (error) {
      console.error(`❌ خطأ في حذف ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  async clear() {
    await this.init();
    
    try {
      if (this.mode === 'electron') {
        await this.storage.delete();
      } else {
        await this.storage.clear();
      }
    } catch (error) {
      console.error('❌ خطأ في مسح البيانات:', error);
      throw error;
    }
  }

  /**
   * Get storage mode
   */
  getMode() {
    return this.mode;
  }
}

export default StorageAdapter;
