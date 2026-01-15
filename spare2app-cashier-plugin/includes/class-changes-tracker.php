<?php
/**
 * Changes Tracker Class
 * 
 * Tracks all product changes (create, update, delete) for delta sync
 * 
 * @package Spare2App_Cashier
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Changes_Tracker {
    
    public function __construct() {
        // Track product updates
        add_action('woocommerce_update_product', array($this, 'track_product_update'), 10, 1);
        add_action('woocommerce_new_product', array($this, 'track_product_create'), 10, 1);
        
        // Track product deletions
        add_action('before_delete_post', array($this, 'track_product_delete'), 10, 1);
        
        // Track stock changes
        add_action('woocommerce_product_set_stock', array($this, 'track_stock_change'), 10, 1);
        
        // Clear cache on changes
        add_action('woocommerce_update_product', array($this, 'clear_cache'), 10, 1);
        add_action('woocommerce_new_product', array($this, 'clear_cache'), 10, 1);
        
        error_log('✅ Changes Tracker initialized');
    }
    
    /**
     * Track product update
     */
    public function track_product_update($product_id) {
        $product = wc_get_product($product_id);
        if (!$product) return;
        
        $vendor_id = get_post_field('post_author', $product_id);
        
        $this->log_change($vendor_id, $product_id, 'updated', array(
            'name' => $product->get_name(),
            'price' => $product->get_price(),
            'stock' => $product->get_stock_quantity()
        ));
        
        error_log("📝 Product updated: {$product_id} (Vendor: {$vendor_id})");
    }
    
    /**
     * Track product creation
     */
    public function track_product_create($product_id) {
        $product = wc_get_product($product_id);
        if (!$product) return;
        
        $vendor_id = get_post_field('post_author', $product_id);
        
        $this->log_change($vendor_id, $product_id, 'created', array(
            'name' => $product->get_name()
        ));
        
        error_log("✅ Product created: {$product_id} (Vendor: {$vendor_id})");
    }
    
    /**
     * Track product deletion
     */
    public function track_product_delete($post_id) {
        $post_type = get_post_type($post_id);
        
        if ($post_type !== 'product') {
            return;
        }
        
        $vendor_id = get_post_field('post_author', $post_id);
        
        $this->log_change($vendor_id, $post_id, 'deleted', array(
            'deleted_at' => current_time('mysql')
        ));
        
        error_log("🗑️ Product deleted: {$post_id} (Vendor: {$vendor_id})");
    }
    
    /**
     * Track stock changes
     */
    public function track_stock_change($product) {
        $product_id = $product->get_id();
        $vendor_id = get_post_field('post_author', $product_id);
        
        $this->log_change($vendor_id, $product_id, 'updated', array(
            'stock_quantity' => $product->get_stock_quantity(),
            'change_reason' => 'stock_update'
        ));
        
        error_log("📊 Stock updated: {$product_id} → {$product->get_stock_quantity()}");
    }
    
    /**
     * Log change to database
     */
    private function log_change($vendor_id, $product_id, $change_type, $change_data = null) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'cashier_changes';
        
        $wpdb->insert(
            $table,
            array(
                'vendor_id' => $vendor_id,
                'product_id' => $product_id,
                'change_type' => $change_type,
                'change_data' => json_encode($change_data),
                'changed_at' => current_time('mysql')
            ),
            array('%d', '%d', '%s', '%s', '%s')
        );
        
        // Clean old changes (keep only last 7 days)
        $this->cleanup_old_changes();
    }
    
    /**
     * Clear vendor cache
     */
    public function clear_cache($product_id) {
        $vendor_id = get_post_field('post_author', $product_id);
        
        // Clear all cached pages for this vendor
        global $wpdb;
        $pattern = "cashier_full_sync_{$vendor_id}_*";
        
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} 
                 WHERE option_name LIKE %s",
                '_transient_' . $pattern
            )
        );
        
        // Clear categories cache
        delete_transient("cashier_categories_{$vendor_id}");
        
        error_log("🧹 Cache cleared for vendor {$vendor_id}");
    }
    
    /**
     * Cleanup old changes (keep last 7 days)
     */
    private function cleanup_old_changes() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'cashier_changes';
        
        // Run cleanup only occasionally (random 1% chance)
        if (rand(1, 100) > 1) {
            return;
        }
        
        $deleted = $wpdb->query(
            "DELETE FROM $table 
             WHERE changed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
             LIMIT 1000"
        );
        
        if ($deleted > 0) {
            error_log("🧹 Cleaned up {$deleted} old change records");
        }
    }
    
    /**
     * Get changes for vendor since timestamp
     */
    public function get_changes_since($vendor_id, $since_timestamp) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'cashier_changes';
        
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table 
             WHERE vendor_id = %d 
             AND changed_at > %s 
             ORDER BY changed_at ASC
             LIMIT 100",
            $vendor_id,
            date('Y-m-d H:i:s', $since_timestamp)
        ));
    }
}
