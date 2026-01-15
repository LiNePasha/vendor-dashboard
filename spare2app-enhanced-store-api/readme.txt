=== Spare2App Enhanced Store API ===
Contributors: spare2app
Tags: woocommerce, rest-api, vendors, wcfm, marketplace
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 2.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Advanced REST API for WCFM vendor stores with comprehensive category and product management.

== Description ==

Spare2App Enhanced Store API provides a comprehensive REST API for WCFM marketplace vendors. This plugin extends the default WooCommerce REST API with vendor-specific endpoints, advanced filtering, and detailed analytics.

= Features =

* Enhanced vendor store information
* Category management with statistics
* Advanced product filtering
* Store analytics dashboard
* Category hierarchy support
* SEO-optimized data structure
* Comprehensive insights and statistics

= API Endpoints =

* `GET /wp-json/spare2app/v2/store/{vendor_id}` - Enhanced store information
* `GET /wp-json/spare2app/v2/store/{vendor_id}/categories` - Categories with statistics
* `GET /wp-json/spare2app/v2/store/{vendor_id}/category/{category_id}` - Single category details
* `GET /wp-json/spare2app/v2/store/{vendor_id}/products` - Products with advanced filtering
* `GET /wp-json/spare2app/v2/store/{vendor_id}/analytics` - Store analytics dashboard
* `GET /wp-json/spare2app/v2/store/{vendor_id}/category-tree` - Category hierarchy

= Requirements =

* WooCommerce 3.0+
* WCFM - WooCommerce Multivendor Marketplace
* PHP 7.4+
* WordPress 5.0+

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/spare2app-enhanced-store-api/` directory
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Navigate to Settings → Store API to view available endpoints
4. Test the API endpoints using tools like Postman

== Frequently Asked Questions ==

= How do I test the API? =

You can test the API by visiting any endpoint in your browser or using tools like Postman. For example:
`https://yoursite.com/wp-json/spare2app/v2/store/1`

= What data does the API return? =

The API returns comprehensive vendor information including store details, product statistics, category analytics, and more. All data is formatted in JSON.

= Is this compatible with WCFM? =

Yes, this plugin is specifically designed for WCFM marketplace installations and requires WCFM to function properly.

== Changelog ==

= 2.0.0 =
* Initial release
* Enhanced store information endpoint
* Category management with statistics
* Advanced product filtering
* Store analytics dashboard
* Category hierarchy support
* SEO-optimized data structure

== Upgrade Notice ==

= 2.0.0 =
Initial release of the Enhanced Store API plugin.