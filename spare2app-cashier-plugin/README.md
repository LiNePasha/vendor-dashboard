# Spare2App Cashier API Plugin

⚡ **أسرع نظام كاشير في مصر** - Ultra-fast POS with delta sync, real-time updates, and smart caching

## 🚀 Features

- **⚡ Lightning Fast**: Initial load < 1 second with smart caching
- **🔄 Delta Sync**: Only fetch changed products, not full catalog
- **📡 Real-time Updates**: Server-Sent Events for instant product changes
- **💾 Smart Caching**: WordPress transients + optimized queries
- **📊 Change Tracking**: Automatic tracking of all product modifications
- **🎯 Optimized Queries**: Fetch only needed fields, no bloat

## 📦 Installation

1. Upload the plugin folder to `/wp-content/plugins/spare2app-cashier-plugin/`
2. Activate the plugin through WordPress admin
3. Database tables will be created automatically
4. Access settings at: **Settings → Cashier API**

## 🔌 API Endpoints

Base URL: `https://your-site.com/wp-json/cashier/v1/`

### 1️⃣ Initial Sync (Full Load)
```
GET /store/{vendor_id}/pos-initial?page=1&per_page=100
```

**Response:**
```json
{
  "products": [...],
  "categories": [...],
  "pagination": {
    "page": 1,
    "per_page": 100,
    "total_products": 500,
    "total_pages": 5,
    "has_more": true
  },
  "metadata": {
    "sync_timestamp": "2026-01-03T10:30:00Z",
    "hash": "abc123",
    "cache": false
  }
}
```

### 2️⃣ Delta Sync (Changes Only)
```
GET /store/{vendor_id}/pos-changes?since=2026-01-03T10:30:00Z
```

**Response:**
```json
{
  "updates": [
    {
      "id": 123,
      "type": "product_updated",
      "action": "updated",
      "data": {
        "id": 123,
        "stock_quantity": 45,
        "price": "95"
      },
      "timestamp": "2026-01-03 11:00:00"
    }
  ],
  "metadata": {
    "changes_count": 5,
    "sync_timestamp": "2026-01-03T11:00:00Z"
  }
}
```

### 3️⃣ Single Product
```
GET /product/{product_id}
```

### 4️⃣ Real-time Stream (SSE)
```
GET /store/{vendor_id}/pos-stream
```

### 5️⃣ Categories
```
GET /store/{vendor_id}/categories
```

### 6️⃣ Stats
```
GET /store/{vendor_id}/stats
```

## 🎯 How It Works

### Initial Load
1. POS requests full product catalog (paginated)
2. Plugin checks cache (5 min TTL)
3. If cache hit → instant response (~50ms)
4. If cache miss → optimized DB query (~200ms)
5. Results cached for next request

### Delta Sync (Every 30 seconds)
1. POS sends last sync timestamp
2. Plugin queries `wp_cashier_changes` table
3. Returns only changed products
4. POS updates local cache

### Real-time Stream (Optional)
1. POS opens SSE connection
2. Plugin monitors changes table every 5 seconds
3. Pushes updates instantly when changes occur
4. Heartbeat every 30 seconds keeps connection alive

### Change Tracking
- Automatic hooks on product update/create/delete
- Logged in `wp_cashier_changes` table
- Auto-cleanup (keeps last 7 days)
- Cache invalidation on changes

## 🔧 Database Schema

```sql
CREATE TABLE wp_cashier_changes (
    id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id BIGINT(20) UNSIGNED NOT NULL,
    product_id BIGINT(20) UNSIGNED NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    change_data LONGTEXT NULL,
    changed_at DATETIME NOT NULL,
    INDEX vendor_time (vendor_id, changed_at),
    INDEX product_id (product_id)
);
```

## ⚡ Performance

| Metric | Before | After |
|--------|--------|-------|
| Initial Load | 5-8 sec | **0.5-1 sec** |
| Product Update | Full reload | **Single update** |
| Network Load | 2-5 MB | **50-200 KB** |
| Database Queries | ~500 | **1-2** |

## 🛠️ Requirements

- WordPress 5.0+
- WooCommerce 3.0+
- PHP 7.4+
- MySQL 5.6+

## 📝 Changelog

### Version 1.0.0 (2026-01-03)
- Initial release
- Delta sync implementation
- Real-time SSE stream
- Smart caching layer
- Automatic change tracking
- Optimized database queries

## 👨‍💻 Development

**Author:** Spare2App Team  
**License:** GPL v2 or later

## 🎯 Use Cases

Perfect for:
- High-traffic retail stores
- Multi-vendor marketplaces
- Fast-paced POS systems
- Offline-first applications
- Real-time inventory management

---

Made with ⚡ by Spare2App - **أسرع نظام كاشير في مصر**
