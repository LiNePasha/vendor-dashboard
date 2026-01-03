<?php
/**
 * Enhanced Store API - Product Filters
 * 
 * Filters products to show only those with vendors
 * and implements smart sorting algorithms
 * 
 * @package Spare2App_Enhanced_Store_API
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_API_Filters {
    
    /**
     * Meta key for vendor ID - adjust based on your multi-vendor plugin
     * 
     * WCFM: _wcfm_product_author
     * Dokan: _dokan_vendor_id
     * WC Vendors: _vendor_id
     */
    private $vendor_meta_key = '_wcfm_product_author';
    
    public function __construct() {
        // Filter products in REST API to show only those with vendors
        add_filter('woocommerce_rest_product_object_query', array($this, 'filter_products_with_vendors'), 10, 2);
        
        // Add smart sorting options
        add_filter('woocommerce_rest_product_query', array($this, 'add_smart_sorting'), 10, 2);
        
        // Log API requests in development
        add_action('rest_api_init', array($this, 'log_api_access'));
    }
    
    /**
     * Filter products to show only those with assigned vendors
     */
    public function filter_products_with_vendors($args, $request) {
        // Only apply to product queries
        if (!isset($args['post_type']) || $args['post_type'] !== 'product') {
            return $args;
        }
        
        // Check if filtering is disabled via query param (for admin/debugging)
        $disable_vendor_filter = $request->get_param('_disable_vendor_filter');
        if ($disable_vendor_filter === 'true') {
            return $args;
        }
        
        // Initialize meta_query if not exists
        if (!isset($args['meta_query'])) {
            $args['meta_query'] = array();
        }
        
        // Add vendor exists check
        $args['meta_query'][] = array(
            'key' => $this->vendor_meta_key,
            'compare' => 'EXISTS'
        );
        
        // Also ensure product is published and not hidden
        $args['post_status'] = 'publish';
        
        // Exclude products marked as drafts or placeholders
        $args['meta_query'][] = array(
            'key' => '_placeholder_product',
            'compare' => 'NOT EXISTS'
        );
        
        // Log filtering (development only)
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('Spare2App API Filter: Filtering products with vendor meta_key: ' . $this->vendor_meta_key);
        }
        
        return $args;
    }
    
    /**
     * Add smart sorting options
     */
    public function add_smart_sorting($args, $request) {
        $orderby = $request->get_param('orderby');
        
        if (empty($orderby)) {
            return $args;
        }
        
        switch ($orderby) {
            case 'smart':
                // Smart sorting: Mix of recent, in-stock, and random
                $args = $this->apply_smart_sorting($args);
                break;
                
            case 'diverse':
                // Diversity sorting: Round-robin by vendor
                // This will be handled in the custom endpoint
                $args['meta_key'] = $this->vendor_meta_key;
                break;
                
            case 'random_daily':
                // Random but consistent per day
                $seed = date('Ymd');
                $args['orderby'] = 'RAND(' . $seed . ')';
                break;
                
            case 'vendor_random':
                // Random by vendor first, then products
                $args['meta_key'] = $this->vendor_meta_key;
                $args['orderby'] = array(
                    'meta_value' => 'ASC',
                    'RAND(' . date('Ymd') . ')' => 'ASC'
                );
                break;
        }
        
        return $args;
    }
    
    /**
     * Apply smart sorting algorithm
     */
    private function apply_smart_sorting($args) {
        global $wpdb;
        
        // Use daily seed for consistency
        $seed = date('Ymd');
        
        // Complex sorting:
        // 1. In stock products first
        // 2. Recent products (last 30 days) get priority
        // 3. Random within each group
        
        $args['meta_query'][] = array(
            'relation' => 'OR',
            'stock_clause' => array(
                'key' => '_stock_status',
                'value' => 'instock',
                'compare' => '='
            ),
            'no_stock_clause' => array(
                'key' => '_stock_status',
                'compare' => 'NOT EXISTS'
            )
        );
        
        $args['orderby'] = array(
            'stock_clause' => 'DESC',
            'date' => 'DESC',
            'RAND(' . $seed . ')' => 'ASC'
        );
        
        return $args;
    }
    
    /**
     * Log API access for development
     */
    public function log_api_access() {
        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }
        
        add_action('rest_pre_dispatch', function($result, $server, $request) {
            $route = $request->get_route();
            
            if (strpos($route, '/wc/v3/products') !== false) {
                error_log('Spare2App API: Products request - ' . $route);
                error_log('Params: ' . json_encode($request->get_params()));
            }
            
            return $result;
        }, 10, 3);
    }
    
    /**
     * Set vendor meta key (for flexibility)
     */
    public function set_vendor_meta_key($key) {
        $this->vendor_meta_key = $key;
    }
    
    /**
     * Get active vendor IDs
     */
    public function get_active_vendors($limit = 50) {
        global $wpdb;
        
        $query = $wpdb->prepare("
            SELECT DISTINCT pm.meta_value as vendor_id, COUNT(pm.post_id) as product_count
            FROM {$wpdb->postmeta} pm
            INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE pm.meta_key = %s
            AND p.post_type = 'product'
            AND p.post_status = 'publish'
            GROUP BY pm.meta_value
            ORDER BY RAND()
            LIMIT %d
        ", $this->vendor_meta_key, $limit);
        
        return $wpdb->get_results($query);
    }
}

// Initialize
new Spare2App_API_Filters();
