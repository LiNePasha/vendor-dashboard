<?php
/**
 * Vendor Analytics Endpoint
 * 
 * Comprehensive analytics and reports for vendor sales and orders
 * 
 * @package Spare2App_Vendor_Orders
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Vendor_Analytics_Endpoint {
    
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
        // Main analytics endpoint
        register_rest_route('spare2app/v1', '/vendor-analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_vendor_analytics'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'period' => array(
                    'description' => 'Period for analytics (today, week, month, year, custom)',
                    'type' => 'string',
                    'default' => 'month',
                    'enum' => array('today', 'yesterday', 'week', 'month', 'year', 'custom'),
                ),
                'start_date' => array(
                    'description' => 'Start date for custom period (Y-m-d)',
                    'type' => 'string',
                ),
                'end_date' => array(
                    'description' => 'End date for custom period (Y-m-d)',
                    'type' => 'string',
                ),
            ),
        ));
        
        // Sales over time endpoint
        register_rest_route('spare2app/v1', '/vendor-analytics/sales-chart', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_sales_chart_data'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'period' => array(
                    'type' => 'string',
                    'default' => 'month',
                ),
                'start_date' => array('type' => 'string'),
                'end_date' => array('type' => 'string'),
            ),
        ));
        
        // Top products endpoint
        register_rest_route('spare2app/v1', '/vendor-analytics/top-products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_top_products'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'period' => array('type' => 'string', 'default' => 'month'),
                'limit' => array('type' => 'integer', 'default' => 10),
            ),
        ));
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
        
        return new WP_Error('rest_forbidden', 'You do not have permission to access analytics.', array('status' => 403));
    }
    
    /**
     * Get comprehensive vendor analytics
     */
    public function get_vendor_analytics($request) {
        global $wpdb;
        
        $current_user_id = get_current_user_id();
        $period = $request->get_param('period');
        $start_date = $request->get_param('start_date');
        $end_date = $request->get_param('end_date');
        
        // Get date range
        $date_range = $this->get_date_range($period, $start_date, $end_date);
        
        // Get vendor order IDs
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return $this->empty_analytics_response();
        }
        
        // Get all paid orders in date range
        $paid_orders = $this->get_paid_orders($vendor_order_ids, $date_range['start'], $date_range['end']);
        
        // Calculate totals
        $total_revenue = 0;
        $total_orders = count($paid_orders);
        $total_items_sold = 0;
        $orders_by_status = array();
        $payment_methods = array();
        
        foreach ($paid_orders as $order) {
            // Calculate order total without shipping
            $order_subtotal = floatval($order->get_subtotal());
            $total_revenue += $order_subtotal;
            $total_items_sold += $order->get_item_count();
            
            // Count by status
            $status = $order->get_status();
            if (!isset($orders_by_status[$status])) {
                $orders_by_status[$status] = 0;
            }
            $orders_by_status[$status]++;
            
            // Count by payment method
            $payment_method = $order->get_payment_method_title();
            if (!isset($payment_methods[$payment_method])) {
                $payment_methods[$payment_method] = array('count' => 0, 'total' => 0);
            }
            $payment_methods[$payment_method]['count']++;
            $payment_methods[$payment_method]['total'] += $order_subtotal;
        }
        
        // Get comparison with previous period
        $previous_period = $this->get_previous_period($date_range['start'], $date_range['end']);
        $previous_orders = $this->get_paid_orders($vendor_order_ids, $previous_period['start'], $previous_period['end']);
        $previous_revenue = 0;
        foreach ($previous_orders as $order) {
            $previous_revenue += floatval($order->get_subtotal());
        }
        
        $revenue_growth = $previous_revenue > 0 ? (($total_revenue - $previous_revenue) / $previous_revenue) * 100 : 0;
        $orders_growth = count($previous_orders) > 0 ? ((count($paid_orders) - count($previous_orders)) / count($previous_orders)) * 100 : 0;
        
        // Get average order value
        $avg_order_value = $total_orders > 0 ? $total_revenue / $total_orders : 0;
        
        // Get top selling products
        $top_products = $this->get_top_products_in_period($vendor_order_ids, $date_range['start'], $date_range['end'], 5);
        
        // Get daily sales for chart
        $daily_sales = $this->get_daily_sales($vendor_order_ids, $date_range['start'], $date_range['end']);
        
        return array(
            'success' => true,
            'period' => array(
                'type' => $period,
                'start' => $date_range['start'],
                'end' => $date_range['end'],
            ),
            'summary' => array(
                'total_revenue' => round($total_revenue, 2),
                'total_orders' => $total_orders,
                'total_items_sold' => $total_items_sold,
                'avg_order_value' => round($avg_order_value, 2),
                'revenue_growth' => round($revenue_growth, 2),
                'orders_growth' => round($orders_growth, 2),
            ),
            'orders_by_status' => $orders_by_status,
            'payment_methods' => $payment_methods,
            'top_products' => $top_products,
            'daily_sales' => $daily_sales,
        );
    }
    
    /**
     * Get sales chart data
     */
    public function get_sales_chart_data($request) {
        $current_user_id = get_current_user_id();
        $period = $request->get_param('period');
        $start_date = $request->get_param('start_date');
        $end_date = $request->get_param('end_date');
        
        $date_range = $this->get_date_range($period, $start_date, $end_date);
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return array('success' => true, 'data' => array());
        }
        
        $daily_sales = $this->get_daily_sales($vendor_order_ids, $date_range['start'], $date_range['end']);
        
        return array(
            'success' => true,
            'data' => $daily_sales,
            'period' => array(
                'start' => $date_range['start'],
                'end' => $date_range['end'],
            ),
        );
    }
    
    /**
     * Get top products
     */
    public function get_top_products($request) {
        $current_user_id = get_current_user_id();
        $period = $request->get_param('period');
        $limit = $request->get_param('limit') ?: 10;
        
        $date_range = $this->get_date_range($period, null, null);
        $vendor_order_ids = $this->get_vendor_order_ids($current_user_id);
        
        if (empty($vendor_order_ids)) {
            return array('success' => true, 'products' => array());
        }
        
        $products = $this->get_top_products_in_period($vendor_order_ids, $date_range['start'], $date_range['end'], $limit);
        
        return array(
            'success' => true,
            'products' => $products,
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
     * Get paid orders in date range
     */
    private function get_paid_orders($order_ids, $start_date, $end_date) {
        $args = array(
            'post__in' => $order_ids,
            'limit' => -1,
            'status' => array('wc-processing', 'wc-completed'),
            'date_created' => $start_date . '...' . $end_date,
            'return' => 'objects',
        );
        
        return wc_get_orders($args);
    }
    
    /**
     * Get daily sales data for chart
     */
    private function get_daily_sales($order_ids, $start_date, $end_date) {
        $orders = $this->get_paid_orders($order_ids, $start_date, $end_date);
        
        $daily_data = array();
        
        // Initialize all dates in range with zero
        $start = new DateTime($start_date);
        $end = new DateTime($end_date);
        $interval = new DateInterval('P1D');
        $period = new DatePeriod($start, $interval, $end->modify('+1 day'));
        
        foreach ($period as $date) {
            $date_key = $date->format('Y-m-d');
            $daily_data[$date_key] = array(
                'date' => $date_key,
                'revenue' => 0,
                'orders' => 0,
                'items' => 0,
            );
        }
        
        // Fill in actual data
        foreach ($orders as $order) {
            $date_key = $order->get_date_created()->date('Y-m-d');
            if (isset($daily_data[$date_key])) {
                $daily_data[$date_key]['revenue'] += floatval($order->get_subtotal());
                $daily_data[$date_key]['orders']++;
                $daily_data[$date_key]['items'] += $order->get_item_count();
            }
        }
        
        // Round revenue values
        foreach ($daily_data as $date => $data) {
            $daily_data[$date]['revenue'] = round($data['revenue'], 2);
        }
        
        return array_values($daily_data);
    }
    
    /**
     * Get top products in period
     */
    private function get_top_products_in_period($order_ids, $start_date, $end_date, $limit = 10) {
        $orders = $this->get_paid_orders($order_ids, $start_date, $end_date);
        
        $products_data = array();
        
        foreach ($orders as $order) {
            foreach ($order->get_items() as $item) {
                $product_id = $item->get_product_id();
                $product = $item->get_product();
                
                if (!$product) continue;
                
                if (!isset($products_data[$product_id])) {
                    $products_data[$product_id] = array(
                        'product_id' => $product_id,
                        'name' => $item->get_name(),
                        'sku' => $product->get_sku(),
                        'quantity' => 0,
                        'revenue' => 0,
                        'orders' => 0,
                    );
                }
                
                $products_data[$product_id]['quantity'] += $item->get_quantity();
                $products_data[$product_id]['revenue'] += floatval($item->get_total());
                $products_data[$product_id]['orders']++;
            }
        }
        
        // Sort by revenue
        usort($products_data, function($a, $b) {
            return $b['revenue'] - $a['revenue'];
        });
        
        // Round revenue and limit
        $top_products = array_slice($products_data, 0, $limit);
        foreach ($top_products as $key => $product) {
            $top_products[$key]['revenue'] = round($product['revenue'], 2);
        }
        
        return $top_products;
    }
    
    /**
     * Get date range based on period
     */
    private function get_date_range($period, $custom_start = null, $custom_end = null) {
        $now = new DateTime();
        $start = clone $now;
        $end = clone $now;
        
        switch ($period) {
            case 'today':
                $start->setTime(0, 0, 0);
                $end->setTime(23, 59, 59);
                break;
                
            case 'yesterday':
                $start->modify('-1 day')->setTime(0, 0, 0);
                $end->modify('-1 day')->setTime(23, 59, 59);
                break;
                
            case 'week':
                $start->modify('-7 days')->setTime(0, 0, 0);
                $end->setTime(23, 59, 59);
                break;
                
            case 'month':
                $start->modify('first day of this month')->setTime(0, 0, 0);
                $end->modify('last day of this month')->setTime(23, 59, 59);
                break;
                
            case 'year':
                $start->modify('first day of January this year')->setTime(0, 0, 0);
                $end->modify('last day of December this year')->setTime(23, 59, 59);
                break;
                
            case 'custom':
                if ($custom_start && $custom_end) {
                    $start = new DateTime($custom_start);
                    $end = new DateTime($custom_end);
                    $start->setTime(0, 0, 0);
                    $end->setTime(23, 59, 59);
                }
                break;
        }
        
        return array(
            'start' => $start->format('Y-m-d H:i:s'),
            'end' => $end->format('Y-m-d H:i:s'),
        );
    }
    
    /**
     * Get previous period for comparison
     */
    private function get_previous_period($start_date, $end_date) {
        $start = new DateTime($start_date);
        $end = new DateTime($end_date);
        
        $diff = $start->diff($end);
        $days = $diff->days + 1;
        
        $prev_end = clone $start;
        $prev_end->modify('-1 day');
        
        $prev_start = clone $prev_end;
        $prev_start->modify('-' . $days . ' days');
        
        return array(
            'start' => $prev_start->format('Y-m-d H:i:s'),
            'end' => $prev_end->format('Y-m-d H:i:s'),
        );
    }
    
    /**
     * Empty analytics response
     */
    private function empty_analytics_response() {
        return array(
            'success' => true,
            'summary' => array(
                'total_revenue' => 0,
                'total_orders' => 0,
                'total_items_sold' => 0,
                'avg_order_value' => 0,
                'revenue_growth' => 0,
                'orders_growth' => 0,
            ),
            'orders_by_status' => array(),
            'payment_methods' => array(),
            'top_products' => array(),
            'daily_sales' => array(),
        );
    }
}
