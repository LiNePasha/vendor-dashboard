<?php
/**
 * Plugin Name: Spare2App Vendor Orders API
 * Plugin URI: https://spare2app.com
 * Description: Enhanced REST API for WCFM vendor orders with proper filtering, search, and pagination
 * Version: 1.0.0
 * Author: Spare2App
 * Text Domain: spare2app-vendor-orders
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SPARE2APP_VENDOR_ORDERS_VERSION', '1.0.0');
define('SPARE2APP_VENDOR_ORDERS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SPARE2APP_VENDOR_ORDERS_PLUGIN_URL', plugin_dir_url(__FILE__));

// Check if WooCommerce is active
if (!function_exists('is_plugin_active')) {
    include_once(ABSPATH . 'wp-admin/includes/plugin.php');
}

if (!is_plugin_active('woocommerce/woocommerce.php')) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p><strong>Spare2App Vendor Orders API</strong> requires WooCommerce to be installed and active.</p></div>';
    });
    return;
}

// Check if WCFM is active (optional but recommended)
$wcfm_active = is_plugin_active('wc-frontend-manager/wc_frontend_manager.php') || 
               is_plugin_active('wc-multivendor-marketplace/wc-multivendor-marketplace.php');

if (!$wcfm_active) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-warning"><p><strong>Spare2App Vendor Orders API</strong> works best with WCFM Marketplace plugin.</p></div>';
    });
}

// Include the endpoint classes
require_once SPARE2APP_VENDOR_ORDERS_PLUGIN_DIR . 'includes/class-vendor-orders-endpoint.php';
require_once SPARE2APP_VENDOR_ORDERS_PLUGIN_DIR . 'includes/class-vendor-analytics-endpoint.php';

// Initialize the plugin
function spare2app_vendor_orders_init() {
    new Spare2App_Vendor_Orders_Endpoint();
    new Spare2App_Vendor_Analytics_Endpoint();
}
add_action('plugins_loaded', 'spare2app_vendor_orders_init');

// Activation hook
register_activation_hook(__FILE__, 'spare2app_vendor_orders_activate');
function spare2app_vendor_orders_activate() {
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Add option to track activation
    add_option('spare2app_vendor_orders_activated', true);
    add_option('spare2app_vendor_orders_version', SPARE2APP_VENDOR_ORDERS_VERSION);
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'spare2app_vendor_orders_deactivate');
function spare2app_vendor_orders_deactivate() {
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Clean up options
    delete_option('spare2app_vendor_orders_activated');
}
