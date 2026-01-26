<?php
/**
 * Vendor Orders Endpoint
 * 
 * Enhanced orders endpoint with proper filtering support for WCFM vendors
 * 
 * @package Spare2App_Vendor_Orders
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Vendor_Orders_Endpoint {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        register_rest_route('spare2app/v1', '/vendor-orders', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_vendor_orders'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'status' => array(
                    'description' => 'Filter by order status',
                    'type' => 'string',
                    'enum' => array('pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'),
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'search' => array(
                    'description' => 'Search in order ID or customer name',
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'after' => array(
                    'description' => 'Filter orders after this date (ISO 8601)',
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'before' => array(
                    'description' => 'Filter orders before this date (ISO 8601)',
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'per_page' => array(
                    'description' => 'Number of orders per page',
                    'type' => 'integer',
                    'default' => 20,
                    'minimum' => 1,
                    'maximum' => 100,
                ),
                'page' => array(
                    'description' => 'Current page number',
                    'type' => 'integer',
                    'default' => 1,
                    'minimum' => 1,
                ),
            ),
        ));
        
        // Single order endpoint
        register_rest_route('spare2app/v1', '/vendor-orders/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_single_order'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'id' => array(
                    'description' => 'Order ID',
                    'type' => 'integer',
                    'required' => true,
                ),
            ),
        ));
    }
    
    /**
     * Check if user has vendor permission
     */
    public function check_vendor_permission($request) {
        // Check if user is logged in
        if (!is_user_logged_in()) {
            return new WP_Error('rest_forbidden', 'You are not authorized to access this endpoint.', array('status' => 401));
        }
        
        $current_user_id = get_current_user_id();
        
        // Check if user is vendor (WCFM)
        if (function_exists('wcfm_is_vendor') && wcfm_is_vendor($current_user_id)) {
            return true;
        }
        
        // Check if user is admin
        if (current_user_can('manage_woocommerce')) {
            return true;
        }
        
        return new WP_Error('rest_forbidden', 'You do not have permission to access vendor orders.', array('status' => 403));
    }
    
    /**
     * Get single order
     */
    public function get_single_order($request) {
        $order_id = $request->get_param('id');
        $order = wc_get_order($order_id);
        
        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found.', array('status' => 404));
        }
        
        // Check if this order belongs to the vendor
        $current_user_id = get_current_user_id();
        if (!$this->order_belongs_to_vendor($order_id, $current_user_id)) {
            return new WP_Error('rest_forbidden', 'You do not have permission to access this order.', array('status' => 403));
        }
        
        return array(
            'success' => true,
            'order' => $this->format_order($order),
        );
    }
    
    /**
     * Get vendor orders with filters
     */
    public function get_vendor_orders($request) {
        global $wpdb;
        
        $current_user_id = get_current_user_id();
        
        // Get parameters
        $status = $request->get_param('status');
        $search = $request->get_param('search');
        $after = $request->get_param('after');
        $before = $request->get_param('before');
        $per_page = $request->get_param('per_page') ?: 20;
        $page = $request->get_param('page') ?: 1;
        
        // Calculate offset
        $offset = ($page - 1) * $per_page;
        
        // Get vendor orders from WCFM table
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return $this->prepare_response(array(), 0, $page, $per_page);
        }
        
        // Build the query args
        $args = array(
            'post__in' => $vendor_order_ids,
            'limit' => -1, // Get all first, then we'll slice for pagination after filtering
            'return' => 'ids',
            'orderby' => 'date',
            'order' => 'DESC',
        );
        
        // Add status filter
        if (!empty($status)) {
            $args['status'] = 'wc-' . $status;
        }
        
        // Add date filters
        if (!empty($after)) {
            $args['date_created'] = '>' . strtotime($after);
        }
        if (!empty($before)) {
            if (isset($args['date_created'])) {
                // Both after and before
                $args['date_created'] = array(
                    'after' => $after,
                    'before' => $before,
                );
            } else {
                $args['date_created'] = '<' . strtotime($before);
            }
        }
        
        // Get all matching orders
        $all_order_ids = wc_get_orders($args);
        
        // Apply search filter
        if (!empty($search)) {
            $all_order_ids = array_filter($all_order_ids, function($order_id) use ($search) {
                $order = wc_get_order($order_id);
                if (!$order) return false;
                
                // Search in order ID
                if (stripos($order_id, $search) !== false) {
                    return true;
                }
                
                // Search in customer name
                $billing_first_name = $order->get_billing_first_name();
                $billing_last_name = $order->get_billing_last_name();
                $full_name = $billing_first_name . ' ' . $billing_last_name;
                
                if (stripos($full_name, $search) !== false) {
                    return true;
                }
                
                // Search in phone
                $phone = $order->get_billing_phone();
                if (stripos($phone, $search) !== false) {
                    return true;
                }
                
                return false;
            });
            
            // Re-index array
            $all_order_ids = array_values($all_order_ids);
        }
        
        // Get total count
        $total_orders = count($all_order_ids);
        
        // Slice for pagination
        $paginated_order_ids = array_slice($all_order_ids, $offset, $per_page);
        
        // Format orders
        $formatted_orders = array();
        foreach ($paginated_order_ids as $order_id) {
            $order = wc_get_order($order_id);
            if ($order) {
                $formatted_orders[] = $this->format_order($order);
            }
        }
        
        return $this->prepare_response($formatted_orders, $total_orders, $page, $per_page);
    }
    
    /**
     * Get vendor order IDs from WCFM
     */
    private function get_vendor_order_ids($vendor_id) {
        global $wpdb;
        
        // Try WCFM table first
        $table_name = $wpdb->prefix . 'wcfm_marketplace_orders';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") == $table_name) {
            $order_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT order_id 
                FROM {$table_name} 
                WHERE vendor_id = %d 
                ORDER BY order_id DESC",
                $vendor_id
            ));
            
            return array_map('intval', $order_ids);
        }
        
        // Fallback: get all orders (for admin or non-WCFM setups)
        if (current_user_can('manage_woocommerce')) {
            $args = array(
                'limit' => -1,
                'return' => 'ids',
            );
            return wc_get_orders($args);
        }
        
        return array();
    }
    
    /**
     * Check if order belongs to vendor
     */
    private function order_belongs_to_vendor($order_id, $vendor_id) {
        // Admins can see all orders
        if (current_user_can('manage_woocommerce')) {
            return true;
        }
        
        $vendor_order_ids = $this->get_vendor_order_ids($vendor_id);
        return in_array($order_id, $vendor_order_ids);
    }
    
    /**
     * Format order data
     */
    private function format_order($order) {
        $data = array(
            'id' => $order->get_id(),
            'number' => $order->get_order_number(),
            'status' => $order->get_status(),
            'currency' => $order->get_currency(),
            'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
            'date_modified' => $order->get_date_modified()->date('Y-m-d H:i:s'),
            'total' => $order->get_total(),
            'total_tax' => $order->get_total_tax(),
            'shipping_total' => $order->get_shipping_total(),
            'payment_method' => $order->get_payment_method(),
            'payment_method_title' => $order->get_payment_method_title(),
            'customer_note' => $order->get_customer_note(),
            
            // Billing info
            'billing' => array(
                'first_name' => $order->get_billing_first_name(),
                'last_name' => $order->get_billing_last_name(),
                'company' => $order->get_billing_company(),
                'address_1' => $order->get_billing_address_1(),
                'address_2' => $order->get_billing_address_2(),
                'city' => $order->get_billing_city(),
                'state' => $order->get_billing_state(),
                'postcode' => $order->get_billing_postcode(),
                'country' => $order->get_billing_country(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
            ),
            
            // Shipping info
            'shipping' => array(
                'first_name' => $order->get_shipping_first_name(),
                'last_name' => $order->get_shipping_last_name(),
                'company' => $order->get_shipping_company(),
                'address_1' => $order->get_shipping_address_1(),
                'address_2' => $order->get_shipping_address_2(),
                'city' => $order->get_shipping_city(),
                'state' => $order->get_shipping_state(),
                'postcode' => $order->get_shipping_postcode(),
                'country' => $order->get_shipping_country(),
            ),
            
            // Line items
            'line_items' => array(),
            
            // Meta data
            'meta_data' => array(),
        );
        
        // Add line items with product images
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $product_id = $item->get_variation_id() ? $item->get_variation_id() : $item->get_product_id();
            
            // Get product image
            $image_id = null;
            $image_url = '';
            if ($product) {
                $image_id = $product->get_image_id();
                if ($image_id) {
                    $image_url = wp_get_attachment_image_url($image_id, 'thumbnail');
                }
            }
            
            // Calculate unit price
            $unit_price = $item->get_quantity() > 0 ? ($item->get_total() / $item->get_quantity()) : 0;
            
            $data['line_items'][] = array(
                'id' => $item->get_id(),
                'name' => $item->get_name(),
                'product_id' => $item->get_product_id(),
                'variation_id' => $item->get_variation_id(),
                'quantity' => $item->get_quantity(),
                'subtotal' => $item->get_subtotal(),
                'total' => $item->get_total(),
                'price' => number_format($unit_price, 2, '.', ''),
                'sku' => $product ? $product->get_sku() : '',
                'image_url' => $image_url ?: '', // Product image URL
            );
        }
        
        // Add meta data
        foreach ($order->get_meta_data() as $meta) {
            $data['meta_data'][] = array(
                'key' => $meta->key,
                'value' => $meta->value,
            );
        }
        
        return $data;
    }
    
    /**
     * Prepare API response with pagination
     */
    private function prepare_response($orders, $total, $page, $per_page) {
        $total_pages = ceil($total / $per_page);
        $has_more = $page < $total_pages;
        
        return array(
            'success' => true,
            'orders' => $orders,
            'pagination' => array(
                'total' => $total,
                'page' => $page,
                'per_page' => $per_page,
                'total_pages' => $total_pages,
                'has_more' => $has_more,
            ),
        );
    }
}
