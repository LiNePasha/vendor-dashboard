<?php
/**
 * Plugin Name: Spare2App Cashier API
 * Plugin URI: https://spare2app.com
 * Description: Ultra-fast POS API with delta sync, real-time updates, and smart caching for the fastest cashier system in Egypt
 * Version: 1.0.0
 * Author: Spare2App
 * Text Domain: spare2app-cashier
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
define('SPARE2APP_CASHIER_VERSION', '1.0.0');
define('SPARE2APP_CASHIER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SPARE2APP_CASHIER_PLUGIN_URL', plugin_dir_url(__FILE__));

// Check if WooCommerce is active
if (!function_exists('is_plugin_active')) {
    include_once(ABSPATH . 'wp-admin/includes/plugin.php');
}

if (!is_plugin_active('woocommerce/woocommerce.php')) {
    add_action('admin_notices', function() {
        echo '<div class="notice notice-error"><p>Spare2App Cashier API requires WooCommerce to be installed and active.</p></div>';
    });
    return;
}

// Include core classes
require_once SPARE2APP_CASHIER_PLUGIN_DIR . 'includes/class-cashier-api.php';
require_once SPARE2APP_CASHIER_PLUGIN_DIR . 'includes/class-pos-sync.php';
require_once SPARE2APP_CASHIER_PLUGIN_DIR . 'includes/class-changes-tracker.php';
require_once SPARE2APP_CASHIER_PLUGIN_DIR . 'includes/class-stream-handler.php';

// Initialize the plugin
function spare2app_cashier_init() {
    new Spare2App_Cashier_API();
}
add_action('plugins_loaded', 'spare2app_cashier_init');

// Activation hook - Create database tables
register_activation_hook(__FILE__, 'spare2app_cashier_activate');
function spare2app_cashier_activate() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'cashier_changes';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        vendor_id BIGINT(20) UNSIGNED NOT NULL,
        product_id BIGINT(20) UNSIGNED NOT NULL,
        change_type VARCHAR(20) NOT NULL,
        change_data LONGTEXT NULL,
        changed_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        INDEX vendor_time (vendor_id, changed_at),
        INDEX product_id (product_id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    // Set initial version
    update_option('spare2app_cashier_version', SPARE2APP_CASHIER_VERSION);
    
    // Log activation
    error_log('✅ Spare2App Cashier Plugin activated - Database tables created');
}

// Deactivation hook
register_deactivation_hook(__FILE__, 'spare2app_cashier_deactivate');
function spare2app_cashier_deactivate() {
    // Clear all transients
    delete_transient('cashier_full_sync_*');
    error_log('🔄 Spare2App Cashier Plugin deactivated - Transients cleared');
}
