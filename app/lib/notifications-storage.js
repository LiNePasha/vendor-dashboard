/**
 * Notifications Storage - LocalStorage based
 * بيحفظ حالة الإشعارات (مقروء/غير مقروء)
 */

const STORAGE_KEY = 'spare2app_notifications';

export const notificationsStorage = {
  // Get all read notification IDs
  getReadNotifications: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (error) {
      console.error('Error reading notifications:', error);
      return new Set();
    }
  },

  // Mark notification as read
  markAsRead: (notificationId) => {
    try {
      const read = notificationsStorage.getReadNotifications();
      read.add(notificationId.toString());
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Mark multiple notifications as read
  markMultipleAsRead: (notificationIds) => {
    try {
      const read = notificationsStorage.getReadNotifications();
      notificationIds.forEach(id => read.add(id.toString()));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
      return true;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return false;
    }
  },

  // Check if notification is read
  isRead: (notificationId) => {
    const read = notificationsStorage.getReadNotifications();
    return read.has(notificationId.toString());
  },

  // Clear all read notifications (useful for cleanup)
  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  },

  // Clean old read notifications (older than 30 days)
  cleanOldNotifications: () => {
    // هنا ممكن نضيف logic للتنظيف لو عايزين
    // حالياً الـ API بيتعامل مع الإشعارات القديمة
  }
};
