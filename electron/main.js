const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Check if running in development mode
const isDev = !app.isPackaged;

// Enable @electron/remote
require('@electron/remote/main').initialize();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Vendor POS - نظام نقاط البيع',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false, // للسماح بتحميل الصور من URLs خارجية
    },
    icon: path.join(__dirname, '../public/icons/icon-512x512.png'),
  });

  // Enable remote module for this window
  require('@electron/remote/main').enable(mainWindow.webContents);

  // Load Next.js app
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links - open in browser, not new window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // If it's an external link (starts with http/https but not localhost)
    if (url.startsWith('http') && !url.includes('localhost')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    // Allow internal navigation
    return { action: 'allow' };
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow localhost navigation
    if (url.includes('localhost') || url.startsWith('file://')) {
      return;
    }
    // Block external navigation in main window
    event.preventDefault();
    require('electron').shell.openExternal(url);
  });

  // Handle window ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-path', app.getPath('userData'));
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Storage Operations
ipcMain.handle('storage:read', async (event, filename) => {
  const fs = require('fs').promises;
  const filePath = path.join(app.getPath('userData'), 'data', filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    console.error('خطأ في قراءة الملف:', error);
    throw error;
  }
});

ipcMain.handle('storage:write', async (event, filename, data) => {
  const fs = require('fs').promises;
  const filePath = path.join(app.getPath('userData'), 'data', filename);
  
  try {
    // Create directory if not exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write with temp file for safety
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في كتابة الملف:', error);
    throw error;
  }
});

ipcMain.handle('storage:delete', async (event, filename) => {
  const fs = require('fs').promises;
  const filePath = path.join(app.getPath('userData'), 'data', filename);
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true }; // Already doesn't exist
    }
    console.error('خطأ في حذف الملف:', error);
    throw error;
  }
});

ipcMain.handle('storage:getUserDataPath', async () => {
  return app.getPath('userData');
});

console.log('✅ Electron Main Process Started');
console.log('📁 User Data Path:', app.getPath('userData'));
console.log('🔧 Dev Mode:', isDev);
