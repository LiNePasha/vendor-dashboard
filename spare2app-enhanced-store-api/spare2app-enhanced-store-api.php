<?php
/**
 * Plugin Name: Spare2App Enhanced Store API
 * Plugin URI: https://spare2app.com
 * Description: Advanced REST API for WCFM vendor stores with comprehensive category and product management
 * Version: 2.0.0
 * Author: Spare2App
 * Text Domain: spare2app-store-api
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
define('SPARE2APP_STORE_API_VERSION', '2.0.0');
define('SPARE2APP_STORE_API_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SPARE2APP_STORE_API_PLUGIN_URL', plugin_dir_url(__FILE__));

// Check if WooCommerce is active
if (!function_exists('is_plugin_active')) {
    include_once(ABSPATH . 'wp-admin/includes/plugin.php');
}

if (!is_plugin_active('woocommerce/woocommerce.php')) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p>Spare2App Store API requires WooCommerce to be installed and active.</p></div>';
    });
    return;
}

// Include the main class
require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-spare2app-store-api.php';

// Load API Filters - Hides products without vendors and adds smart sorting
require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-api-filters.php';

// Load Diverse Products Endpoint - Fair distribution across vendors
require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-diverse-products-endpoint.php';

// Load Category Vendors Endpoint - Vendors with products in specific category
if (file_exists(SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-category-vendors-endpoint.php')) {
    require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-category-vendors-endpoint.php';
}

// Load Vendors Search Endpoint - Search for vendors by name, description, or products
if (file_exists(SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-vendors-search-endpoint.php')) {
    require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-vendors-search-endpoint.php';
}

// Load Categories Vendors Subcategories Endpoint - Multiple categories with vendors and subcategories
if (file_exists(SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-categories-vendors-subcategories-endpoint.php')) {
    require_once SPARE2APP_STORE_API_PLUGIN_DIR . 'includes/class-categories-vendors-subcategories-endpoint.php';
}

// Initialize the plugin
function spare2app_store_api_init() {
    new Spare2App_Enhanced_Store_API();
}
add_action('plugins_loaded', 'spare2app_store_api_init');

// Activation hook
register_activation_hook(__FILE__, 'spare2app_store_api_activate');
function spare2app_store_api_activate() {
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Add option to track activation
    add_option('spare2app_store_api_activated', true);
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'spare2app_store_api_deactivate');
function spare2app_store_api_deactivate() {
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Remove activation option
    delete_option('spare2app_store_api_activated');
}