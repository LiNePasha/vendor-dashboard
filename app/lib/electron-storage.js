/**
 * Electron File System Storage
 * يحفظ البيانات في ملفات JSON على الجهاز
 * ⚠️ هذا الملف يعمل فقط في Electron - لا يتم تحميله في المتصفح
 */

class ElectronStorage {
  constructor(filename) {
    this.filename = filename;
  }

  /**
   * Check if running in Electron - with better detection
   */
  isElectron() {
    if (typeof window === 'undefined') return false;
    
    // Check for window.require first
    if (typeof window.require === 'function') {
      try {
        window.require('electron');
        return true;
      } catch (e) {
        // Continue to other checks
      }
    }
    
    // Check for electron in user agent
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('electron') > -1) {
      return true;
    }
    
    // Check for process
    if (window.process && window.process.type) {
      return true;
    }
    
    return false;
  }

  /**
   * Get IPC Renderer safely
   */
  getIPC() {
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      // Method 1: Direct require (when nodeIntegration: true)
      if (typeof window.require === 'function') {
        const electron = window.require('electron');
        if (electron && electron.ipcRenderer) {
          console.log('✅ Got IPC via window.require');
          return electron.ipcRenderer;
        }
      }
    } catch (error) {
      console.warn('⚠️ window.require failed:', error.message);
    }
    
    try {
      // Method 2: Preloaded electron object (if contextBridge used)
      if (window.electron && window.electron.ipcRenderer) {
        console.log('✅ Got IPC via window.electron');
        return window.electron.ipcRenderer;
      }
    } catch (error) {
      console.warn('⚠️ window.electron failed:', error.message);
    }
    
    console.error('❌ No IPC method available');
    return null;
  }

  /**
   * Read data from file via IPC
   */
  async read() {
    const ipc = this.getIPC();
    
    if (!ipc) {
      console.warn('⚠️ IPC not available, cannot read from Electron storage');
      return null;
    }

    try {
      const data = await ipc.invoke('storage:read', this.filename);
      console.log(`✅ Read from Electron: ${this.filename}`, data ? 'Has data' : 'Empty');
      return data;
    } catch (error) {
      console.error('❌ خطأ في قراءة الملف:', this.filename, error);
      return null;
    }
  }

  /**
   * Write data to file via IPC
   */
  async write(data) {
    const ipc = this.getIPC();
    
    if (!ipc) {
      throw new Error('IPC not available - cannot write to Electron storage');
    }

    try {
      await ipc.invoke('storage:write', this.filename, data);
      console.log(`✅ Wrote to Electron: ${this.filename}`);
    } catch (error) {
      console.error('❌ خطأ في كتابة الملف:', this.filename, error);
      throw error;
    }
  }

  /**
   * Delete file via IPC
   */
  async delete() {
    const ipc = this.getIPC();
    
    if (!ipc) {
      throw new Error('IPC not available - cannot delete from Electron storage');
    }

    try {
      await ipc.invoke('storage:delete', this.filename);
      console.log(`✅ Deleted from Electron: ${this.filename}`);
    } catch (error) {
      console.error('❌ خطأ في حذف الملف:', this.filename, error);
      throw error;
    }
  }

  /**
   * Get user data path
   */
  static async getUserDataPath() {
    if (typeof window === 'undefined') return null;
    
    try {
      if (typeof window.require === 'function') {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('storage:getUserDataPath');
      }
      
      if (window.electron && window.electron.ipcRenderer) {
        return await window.electron.ipcRenderer.invoke('storage:getUserDataPath');
      }
    } catch (error) {
      console.error('❌ خطأ في الحصول على مسار البيانات:', error);
    }
    
    return null;
  }
}

export default ElectronStorage;
