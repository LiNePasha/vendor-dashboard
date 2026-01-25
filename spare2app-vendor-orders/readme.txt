=== Spare2App Vendor Orders ===
Contributors: spare2app
Tags: woocommerce, wcfm, orders, api, rest-api, vendor
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: Proprietary
License URI: https://spare2app.com/license

Enhanced REST API endpoints for WCFM vendor orders with proper filtering support.

== Description ==

Spare2App Vendor Orders provides a robust REST API endpoint for managing vendor orders in WooCommerce with WCFM Marketplace. This plugin addresses limitations in the default WCFM API by providing proper server-side filtering, search, and pagination.

= Key Features =

* **Server-Side Filtering**: Filter orders by status, search terms, and date ranges
* **Vendor-Specific**: Automatically shows only orders belonging to the authenticated vendor
* **Smart Search**: Search by order ID, customer name, or phone number
* **Proper Pagination**: Accurate total counts and "load more" support
* **Full Order Data**: Complete order information including line items and metadata
* **Secure Authentication**: JWT token-based authentication with permission checks
* **Performance Optimized**: Efficient database queries for fast response times

= Requirements =

* WordPress 5.0 or higher
* WooCommerce 3.0 or higher
* WCFM Marketplace (recommended)
* PHP 7.4 or higher

= API Endpoints =

**Get Vendor Orders**
`GET /wp-json/spare2app/v1/vendor-orders`

Query parameters:
- `status`: Filter by order status
- `search`: Search orders
- `after`: Orders after date
- `before`: Orders before date
- `per_page`: Results per page (default 20, max 100)
- `page`: Page number

**Get Single Order**
`GET /wp-json/spare2app/v1/vendor-orders/{id}`

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/spare2app-vendor-orders`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. The API endpoint will be automatically registered
4. Use JWT authentication to access the endpoints

== Frequently Asked Questions ==

= Do I need WCFM Marketplace? =

While the plugin is designed to work with WCFM Marketplace, it can function without it. Admins will see all orders, while vendors require WCFM.

= How do I authenticate API requests? =

Use JWT authentication by including the Bearer token in the Authorization header:
`Authorization: Bearer YOUR_JWT_TOKEN`

= What order statuses are supported? =

All WooCommerce order statuses: pending, processing, on-hold, completed, cancelled, refunded, failed

= Can I search orders? =

Yes, the search parameter searches in order ID, customer name, and phone number.

= Is pagination supported? =

Yes, the API returns pagination metadata including total count, current page, total pages, and whether more results are available.

== Changelog ==

= 1.0.0 =
* Initial release
* Vendor orders endpoint with comprehensive filtering
* Search functionality across order ID, customer name, and phone
* Date range filtering
* Pagination support with accurate counts
* Single order endpoint
* JWT authentication and permission checks
* Performance optimizations

== Upgrade Notice ==

= 1.0.0 =
Initial release of Spare2App Vendor Orders plugin.

== Screenshots ==

1. API endpoint returning filtered vendor orders
2. Order details with full line items
3. Pagination information in response

== Development ==

This plugin is actively maintained by the Spare2App development team.

For bug reports and feature requests, please contact support.

== Technical Notes ==

**Database Queries**
The plugin uses efficient database queries by first fetching vendor-specific order IDs from the WCFM marketplace orders table, then using WooCommerce's built-in functions for filtering.

**Caching**
No caching is implemented by default to ensure real-time order data. Consider adding your own caching layer for high-traffic sites.

**Permissions**
- Vendors see only their own orders
- Administrators with `manage_woocommerce` capability see all orders
- Unauthenticated requests are rejected with 401 status
- Unauthorized users receive 403 status

**Response Format**
All responses follow a consistent format with `success`, `orders` (or `order`), and `pagination` keys.
