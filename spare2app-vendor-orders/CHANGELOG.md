# Changelog

All notable changes to Spare2App Vendor Orders will be documented in this file.

## [1.0.0] - 2024-01-15

### Added
- Initial release of Spare2App Vendor Orders plugin
- REST API endpoint `/wp-json/spare2app/v1/vendor-orders` for fetching vendor orders
- REST API endpoint `/wp-json/spare2app/v1/vendor-orders/{id}` for single order details
- Server-side filtering by order status
- Search functionality (order ID, customer name, phone number)
- Date range filtering (after/before parameters)
- Pagination support with accurate total counts
- Vendor-specific order filtering using WCFM marketplace orders table
- JWT authentication and permission checks
- Full order data formatting including:
  - Order details (ID, status, totals, dates)
  - Billing and shipping information
  - Line items with product details
  - Order meta data
- Admin override to view all orders
- Proper error handling with meaningful error messages
- Response format with success flag and pagination metadata

### Technical Details
- Uses WooCommerce `wc_get_orders()` for efficient order fetching
- Queries WCFM marketplace orders table for vendor-order relationships
- Implements WordPress REST API standards
- Follows WordPress coding standards
- Compatible with WordPress 5.0+ and WooCommerce 3.0+
- Requires PHP 7.4 or higher

### Security
- JWT token authentication required
- Vendor permission checks on all endpoints
- Validates user has vendor role via WCFM
- Admins require `manage_woocommerce` capability
- Sanitizes all input parameters
- Validates order ownership before returning data

### Performance
- Efficient database queries using WordPress prepared statements
- Single query to fetch vendor order IDs
- Bulk order fetching using WooCommerce functions
- No additional database tables required
- Optimized for large order volumes
