<?php
/**
 * Vendor Customers Endpoint
 * 
 * Enhanced customers endpoint for WCFM vendors
 * Returns all unique customers who placed orders with the vendor
 * 
 * @package Spare2App_Vendor_Orders
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Vendor_Customers_Endpoint {
    
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
        // Main customers endpoint
        register_rest_route('spare2app/v1', '/vendor-customers', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_vendor_customers'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'search' => array(
                    'description' => 'Search in customer name, email, or phone',
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'per_page' => array(
                    'description' => 'Number of customers per page',
                    'type' => 'integer',
                    'default' => 50,
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
        
        // Customer stats endpoint (MUST be before single customer to avoid route conflict)
        register_rest_route('spare2app/v1', '/vendor-customers-stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_customers_stats'),
            'permission_callback' => array($this, 'check_vendor_permission'),
        ));
        
        // Single customer endpoint with order history
        register_rest_route('spare2app/v1', '/vendor-customers/(?P<identifier>[^/]+)', array(
    }
    
    /**
     * Check vendor permission
     */
    public function check_vendor_permission($request) {
        if (!is_user_logged_in()) {
            return new WP_Error('rest_forbidden', 'You are not authorized to access this endpoint.', array('status' => 401));
        }
        
        $current_user_id = get_current_user_id();
        
        if (function_exists('wcfm_is_vendor') && wcfm_is_vendor($current_user_id)) {
            return true;
        }
        
        if (current_user_can('manage_woocommerce')) {
            return true;
        }
        
        return new WP_Error('rest_forbidden', 'You do not have permission to access customer data.', array('status' => 403));
    }
    
    /**
     * Get vendor customers
     */
    public function get_vendor_customers($request) {
        global $wpdb;
        
        $current_user_id = get_current_user_id();
        $search = $request->get_param('search');
        $per_page = $request->get_param('per_page') ?: 50;
        $page = $request->get_param('page') ?: 1;
        
        // Get vendor order IDs
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return $this->prepare_response(array(), 0, $page, $per_page);
        }
        
        // Get all orders for this vendor
        $args = array(
            'post__in' => $vendor_order_ids,
            'limit' => -1,
            'return' => 'objects',
            'orderby' => 'date',
            'order' => 'DESC',
        );
        
        $orders = wc_get_orders($args);
        
        // Debug: Log order count
        error_log('📊 Vendor Customers API - Orders count: ' . count($orders) . ' for vendor ID: ' . $current_user_id);
        
        // Build customers map from orders
        $customers_map = array();
        
        foreach ($orders as $order) {
            $billing = array(
                'first_name' => $order->get_billing_first_name(),
                'last_name' => $order->get_billing_last_name(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'address_1' => $order->get_billing_address_1(),
                'address_2' => $order->get_billing_address_2(),
                'city' => $order->get_billing_city(),
                'state' => $order->get_billing_state(),
                'postcode' => $order->get_billing_postcode(),
                'country' => $order->get_billing_country(),
            );
            
            // Use email, phone, or name+phone combination as customer key
            // Priority: email > phone > name+phone > guest
            if (!empty($billing['email'])) {
                $customer_key = 'email:' . strtolower($billing['email']);
            } elseif (!empty($billing['phone'])) {
                // Clean phone number
                $clean_phone = preg_replace('/[^0-9+]/', '', $billing['phone']);
                $customer_key = 'phone:' . $clean_phone;
            } else {
                // Guest order - use guest ID
                $customer_key = 'guest-' . $order->get_id();
            }
            
            if (!isset($customers_map[$customer_key])) {
                $customers_map[$customer_key] = array(
                    'id' => $customer_key,
                    'name' => trim($billing['first_name'] . ' ' . $billing['last_name']) ?: 'عميل',
                    'email' => $billing['email'] ?: '',
                    'phone' => $billing['phone'] ?: '',
                    'address' => trim($billing['address_1'] . ' ' . $billing['address_2']),
                    'city' => $billing['city'] ?: '',
                    'state' => $billing['state'] ?: '',
                    'postcode' => $billing['postcode'] ?: '',
                    'country' => $billing['country'] ?: '',
                    'orders' => array(),
                    'total_spent' => 0,
                    'orders_count' => 0,
                    'first_order_date' => $order->get_date_created()->date('Y-m-d H:i:s'),
                    'last_order_date' => $order->get_date_created()->date('Y-m-d H:i:s'),
                );
            }
            
            $customer = &$customers_map[$customer_key];
            
            // Add order to customer's history
            $customer['orders'][] = array(
                'id' => $order->get_id(),
                'date' => $order->get_date_created()->date('Y-m-d H:i:s'),
                'status' => $order->get_status(),
                'total' => floatval($order->get_total()),
                'items_count' => count($order->get_items()),
            );
            
            // Count only completed and processing orders in total_spent
            if (in_array($order->get_status(), array('completed', 'processing'))) {
                $customer['total_spent'] += floatval($order->get_total());
                $customer['orders_count'] += 1;
            }
            
            // Update first and last order dates
            $order_date = $order->get_date_created()->date('Y-m-d H:i:s');
            if ($order_date < $customer['first_order_date']) {
                $customer['first_order_date'] = $order_date;
            }
            if ($order_date > $customer['last_order_date']) {
                $customer['last_order_date'] = $order_date;
            }
        }
        
        // Convert map to array and calculate average order value
        $customers = array_values($customers_map);
        foreach ($customers as &$customer) {
            $customer['average_order'] = $customer['orders_count'] > 0 
                ? $customer['total_spent'] / $customer['orders_count'] 
                : 0;
            $customer['average_order'] = round($customer['average_order'], 2);
            $customer['total_spent'] = round($customer['total_spent'], 2);
        }
        
        // Apply search filter
        if (!empty($search)) {
            $customers = array_filter($customers, function($customer) use ($search) {
                $search_lower = strtolower($search);
                return stripos($customer['name'], $search) !== false ||
                       stripos($customer['email'], $search) !== false ||
                       stripos($customer['phone'], $search) !== false;
            });
            $customers = array_values($customers);
        }
        
        // Sort by total spent (descending)
        usort($customers, function($a, $b) {
            return $b['total_spent'] - $a['total_spent'];
        });
        
        // Get total count
        $total_customers = count($customers);
        
        // Debug: Log customer stats
        error_log('📊 Vendor Customers API - Unique customers: ' . $total_customers . ', Total orders processed: ' . count($orders));
        error_log('📊 Customer keys breakdown:');
        $email_count = 0;
        $phone_count = 0;
        $guest_count = 0;
        foreach ($customers as $customer) {
            if (strpos($customer['id'], 'email:') === 0) $email_count++;
            elseif (strpos($customer['id'], 'phone:') === 0) $phone_count++;
            else $guest_count++;
        }
        error_log('  - Email customers: ' . $email_count);
        error_log('  - Phone customers: ' . $phone_count);
        error_log('  - Guest customers: ' . $guest_count);
        
        // Paginate
        $offset = ($page - 1) * $per_page;
        $customers = array_slice($customers, $offset, $per_page);
        
        return $this->prepare_response($customers, $total_customers, $page, $per_page);
    }
    
    /**
     * Get single customer with detailed order history
     */
    public function get_single_customer($request) {
        $identifier = $request->get_param('identifier');
        $current_user_id = get_current_user_id();
        
        // Get vendor order IDs
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return new WP_Error('no_orders', 'No orders found.', array('status' => 404));
        }
        
        // Get all orders for this vendor
        $args = array(
            'post__in' => $vendor_order_ids,
            'limit' => -1,
            'return' => 'objects',
        );
        
        $orders = wc_get_orders($args);
        
        // Find customer orders
        $customer_orders = array();
        $customer_data = null;
        
        foreach ($orders as $order) {
            $email = $order->get_billing_email();
            $phone = $order->get_billing_phone();
            
            // Match by email or phone
            if ($email === $identifier || $phone === $identifier) {
                if (!$customer_data) {
                    $customer_data = array(
                        'id' => $identifier,
                        'name' => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                        'email' => $email,
                        'phone' => $phone,
                        'address' => trim($order->get_billing_address_1() . ' ' . $order->get_billing_address_2()),
                        'city' => $order->get_billing_city(),
                        'state' => $order->get_billing_state(),
                        'country' => $order->get_billing_country(),
                    );
                }
                
                $customer_orders[] = array(
                    'id' => $order->get_id(),
                    'date' => $order->get_date_created()->date('Y-m-d H:i:s'),
                    'status' => $order->get_status(),
                    'total' => floatval($order->get_total()),
                    'items_count' => count($order->get_items()),
                    'items' => array_map(function($item) {
                        return array(
                            'name' => $item->get_name(),
                            'quantity' => $item->get_quantity(),
                            'total' => floatval($item->get_total()),
                        );
                    }, $order->get_items()),
                );
            }
        }
        
        if (!$customer_data) {
            return new WP_Error('customer_not_found', 'Customer not found.', array('status' => 404));
        }
        
        // Calculate stats
        $total_spent = 0;
        $orders_count = 0;
        foreach ($customer_orders as $order) {
            if (in_array($order['status'], array('completed', 'processing'))) {
                $total_spent += $order['total'];
                $orders_count++;
            }
        }
        
        $customer_data['orders'] = $customer_orders;
        $customer_data['total_spent'] = round($total_spent, 2);
        $customer_data['orders_count'] = $orders_count;
        $customer_data['average_order'] = $orders_count > 0 ? round($total_spent / $orders_count, 2) : 0;
        
        return array(
            'success' => true,
            'customer' => $customer_data,
        );
    }
    
    /**
     * Get customers statistics
     */
    public function get_customers_stats($request) {
        $current_user_id = get_current_user_id();
        
        // Get vendor order IDs
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return array(
                'success' => true,
                'stats' => array(
                    'total_customers' => 0,
                    'active_customers' => 0,
                    'total_revenue' => 0,
                    'average_order_value' => 0,
                ),
            );
        }
        
        // Get all orders
        $args = array(
            'post__in' => $vendor_order_ids,
            'limit' => -1,
            'return' => 'objects',
        );
        
        $orders = wc_get_orders($args);
        
        // Build customers map
        $customers_map = array();
        $total_revenue = 0;
        $completed_orders_count = 0;
        
        foreach ($orders as $order) {
            $customer_key = $order->get_billing_email() ?: $order->get_billing_phone() ?: 'guest-' . $order->get_id();
            
            if (!isset($customers_map[$customer_key])) {
                $customers_map[$customer_key] = 0;
            }
            
            if (in_array($order->get_status(), array('completed', 'processing'))) {
                $customers_map[$customer_key]++;
                $total_revenue += floatval($order->get_total());
                $completed_orders_count++;
            }
        }
        
        $total_customers = count($customers_map);
        $active_customers = count(array_filter($customers_map, function($orders_count) {
            return $orders_count > 0;
        }));
        
        $average_order_value = $completed_orders_count > 0 
            ? $total_revenue / $completed_orders_count 
            : 0;
        
        return array(
            'success' => true,
            'stats' => array(
                'total_customers' => $total_customers,
                'active_customers' => $active_customers,
                'total_revenue' => round($total_revenue, 2),
                'average_order_value' => round($average_order_value, 2),
            ),
        );
    }
    
    /**
     * Get vendor order IDs from WCFM
     */
    private function get_vendor_order_ids($vendor_id) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'wcfm_marketplace_orders';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") == $table_name) {
            $order_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT order_id FROM {$table_name} WHERE vendor_id = %d",
                $vendor_id
            ));
            return array_map('intval', $order_ids);
        }
        
        // Fallback for admins
        if (current_user_can('manage_woocommerce')) {
            $args = array('limit' => -1, 'return' => 'ids');
            return wc_get_orders($args);
        }
        
        return array();
    }
    
    /**
     * Prepare API response with pagination
     */
    private function prepare_response($customers, $total, $page, $per_page) {
        $total_pages = ceil($total / $per_page);
        $has_more = $page < $total_pages;
        
        return array(
            'success' => true,
            'customers' => $customers,
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
