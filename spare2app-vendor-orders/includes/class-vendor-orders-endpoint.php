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
                'min_total' => array(
                    'description' => 'Filter orders with total greater than or equal to this value',
                    'type' => 'number',
                    'sanitize_callback' => 'floatval',
                ),
                'max_total' => array(
                    'description' => 'Filter orders with total less than or equal to this value',
                    'type' => 'number',
                    'sanitize_callback' => 'floatval',
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
                'vendor_id' => array(
                    'description' => 'Filter by vendor ID (admin only)',
                    'type' => 'integer',
                    'sanitize_callback' => 'absint',
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
        
        // 🆕 Update order items endpoint with WCFM sync
        register_rest_route('spare2app/v1', '/vendor-orders/(?P<id>\d+)/update-items', array(
            'methods' => 'POST',
            'callback' => array($this, 'update_order_items'),
            'permission_callback' => array($this, 'check_vendor_permission'),
            'args' => array(
                'id' => array(
                    'description' => 'Order ID',
                    'type' => 'integer',
                    'required' => true,
                ),
                'line_items' => array(
                    'description' => 'Array of line items to update',
                    'type' => 'array',
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
        $min_total = $request->get_param('min_total');
        $max_total = $request->get_param('max_total');
        $per_page = $request->get_param('per_page') ?: 20;
        $page = $request->get_param('page') ?: 1;
        $vendor_id = absint($request->get_param('vendor_id'));
        $is_admin = current_user_can('manage_woocommerce');
        
        // 🔒 الأمان: التاجر يظل تاجر حتى لو عنده manage_woocommerce بسبب WCFM
        // wcfm_is_vendor أدق وأحق من capability check
        if ($is_admin && function_exists('wcfm_is_vendor') && wcfm_is_vendor($current_user_id)) {
            $is_admin = false;
        }
        
        // Debug logging
        error_log('📅 Spare2App Vendor Orders - Date Filters: after=' . $after . ', before=' . $before);
        if (!empty($after)) {
            error_log('📅 After timestamp: ' . strtotime($after) . ' (' . date('Y-m-d H:i:s', strtotime($after)) . ')');
        }
        if (!empty($before)) {
            error_log('📅 Before timestamp: ' . strtotime($before) . ' (' . date('Y-m-d H:i:s', strtotime($before)) . ')');
        }
        
        // Calculate offset
        $offset = ($page - 1) * $per_page;
        
        // Get orders based on role:
        // - Vendor: only their own orders
        // - Admin: all orders, or specific vendor orders when vendor_id is provided
        $target_vendor_id = $current_user_id;
        if ($is_admin) {
            $target_vendor_id = $vendor_id > 0 ? $vendor_id : 0;
        }

        $vendor_order_ids = $this->get_vendor_order_ids($target_vendor_id);
        
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
        
        // Don't use date_created in args - filter manually for better reliability
        
        // Get all matching orders
        $all_order_ids = wc_get_orders($args);
        
        error_log('📦 Total orders before date filter: ' . count($all_order_ids));
        
        // 🔥 Apply date filters manually for reliability
        if (!empty($after) || !empty($before)) {
            $after_timestamp = !empty($after) ? strtotime($after) : null;
            $before_timestamp = !empty($before) ? strtotime($before) : null;
            
            $all_order_ids = array_filter($all_order_ids, function($order_id) use ($after_timestamp, $before_timestamp) {
                $order = wc_get_order($order_id);
                if (!$order) return false;
                
                $order_date = $order->get_date_created();
                if (!$order_date) return false;
                
                $order_timestamp = $order_date->getTimestamp();
                
                // Debug first 3 orders
                static $debug_count = 0;
                if ($debug_count < 3) {
                    error_log("📅 Order #{$order_id} date: " . date('Y-m-d H:i:s', $order_timestamp) . " (timestamp: {$order_timestamp})");
                    if ($after_timestamp) error_log("   After check: " . ($order_timestamp >= $after_timestamp ? 'PASS' : 'FAIL') . " (need >= " . date('Y-m-d H:i:s', $after_timestamp) . ")");
                    if ($before_timestamp) error_log("   Before check: " . ($order_timestamp <= $before_timestamp ? 'PASS' : 'FAIL') . " (need <= " . date('Y-m-d H:i:s', $before_timestamp) . ")");
                    $debug_count++;
                }
                
                // Check after date (start of day)
                if ($after_timestamp !== null) {
                    if ($order_timestamp < $after_timestamp) {
                        return false;
                    }
                }
                
                // Check before date (end of day)
                if ($before_timestamp !== null) {
                    if ($order_timestamp > $before_timestamp) {
                        return false;
                    }
                }
                
                return true;
            });
            
            // Re-index array
            $all_order_ids = array_values($all_order_ids);
            
            error_log('📦 Total orders after date filter: ' . count($all_order_ids));
        }
        
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
        
        // 🆕 Apply price filters
        if (!empty($min_total) || !empty($max_total)) {
            $all_order_ids = array_filter($all_order_ids, function($order_id) use ($min_total, $max_total) {
                $order = wc_get_order($order_id);
                if (!$order) return false;
                
                $total = floatval($order->get_total());
                
                // Check min_total
                if (!empty($min_total) && $total < floatval($min_total)) {
                    return false;
                }
                
                // Check max_total
                if (!empty($max_total) && $total > floatval($max_total)) {
                    return false;
                }
                
                return true;
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
    private function get_vendor_order_ids($vendor_id = 0) {
        global $wpdb;

        // Admin without vendor filter => all orders
        if ($vendor_id <= 0) {
            // 🔒 الأمان: تحقق إنه أدمن فعلاً مش تاجر عنده manage_woocommerce
            $current_uid = get_current_user_id();
            $is_true_admin = current_user_can('manage_woocommerce') &&
                             !(function_exists('wcfm_is_vendor') && wcfm_is_vendor($current_uid));
            if (!$is_true_admin) {
                // تاجر بدون ID = ممنوع يشوف كل الأوردرات
                return array();
            }
            $args = array(
                'limit' => -1,
                'return' => 'ids',
                'orderby' => 'date',
                'order' => 'DESC',
            );
            return wc_get_orders($args);
        }

        $vendor_id = intval($vendor_id);
        if ($vendor_id <= 0) {
            return array();
        }
        
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
            
            if (!empty($order_ids)) {
                return array_map('intval', $order_ids);
            }
        }

        // Fallback for admin: derive orders from product authors
        if (current_user_can('manage_woocommerce')) {
            $all_order_ids = wc_get_orders(array(
                'limit' => -1,
                'return' => 'ids',
                'orderby' => 'date',
                'order' => 'DESC',
            ));

            $filtered = array();
            foreach ($all_order_ids as $order_id) {
                $order = wc_get_order($order_id);
                if (!$order) {
                    continue;
                }

                foreach ($order->get_items() as $item) {
                    $product = $item->get_product();
                    if (!$product) {
                        continue;
                    }

                    $product_author = intval(get_post_field('post_author', $product->get_id()));
                    if ($product_author === $vendor_id) {
                        $filtered[] = intval($order_id);
                        break;
                    }
                }
            }

            return $filtered;
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
    
    /**
     * 🆕 Update order items with automatic WCFM sync
     */
    public function update_order_items($request) {
        global $wpdb;
        
        $order_id = $request->get_param('id');
        $line_items = $request->get_param('line_items');
        
        if (!$order_id || !is_array($line_items)) {
            return new WP_Error('invalid_data', 'يجب إرسال رقم الطلب والمنتجات', array('status' => 400));
        }
        
        // Get order
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_Error('order_not_found', 'الطلب غير موجود', array('status' => 404));
        }
        
        // Check vendor permission
        $current_user_id = get_current_user_id();
        if (!$this->order_belongs_to_vendor($order_id, $current_user_id) && !current_user_can('manage_woocommerce')) {
            return new WP_Error('rest_forbidden', 'ليس لديك صلاحية لتعديل هذا الطلب', array('status' => 403));
        }
        
        // 1. Update line items via WooCommerce
        try {
            // Track which items should be kept
            $items_to_keep = array();
            $new_items = array();
            
            foreach ($line_items as $item_data) {
                // Handle deleted items (quantity = 0)
                if (isset($item_data['quantity']) && $item_data['quantity'] == 0) {
                    // Mark for deletion
                    if (!empty($item_data['id'])) {
                        $order->remove_item($item_data['id']);
                    }
                    continue;
                }
                
                // Handle existing item update
                if (!empty($item_data['id'])) {
                    $existing_item = $order->get_item($item_data['id']);
                    if ($existing_item) {
                        $existing_item->set_quantity($item_data['quantity']);
                        if (isset($item_data['price'])) {
                            $existing_item->set_subtotal($item_data['price'] * $item_data['quantity']);
                            $existing_item->set_total($item_data['price'] * $item_data['quantity']);
                        }
                        $existing_item->save();
                        continue;
                    }
                }
                
                // Add new item
                $product_id = isset($item_data['variation_id']) && $item_data['variation_id'] > 0 
                    ? $item_data['variation_id'] 
                    : $item_data['product_id'];
                
                $product = wc_get_product($product_id);
                if (!$product) {
                    continue;
                }
                
                // 🔥 Get product author (vendor)
                $product_author = get_post_field('post_author', $product->get_id());
                
                $item = new WC_Order_Item_Product();
                $item->set_product($product);
                $item->set_quantity($item_data['quantity']);
                
                if (isset($item_data['price'])) {
                    $item->set_subtotal($item_data['price'] * $item_data['quantity']);
                    $item->set_total($item_data['price'] * $item_data['quantity']);
                } else {
                    $price = $product->get_price();
                    $item->set_subtotal($price * $item_data['quantity']);
                    $item->set_total($price * $item_data['quantity']);
                }
                
                $order->add_item($item);
                
                // 🔥 Add vendor metadata to the item
                $item->add_meta_data('_wcfm_product_author', $product_author, true);
                $item->save();
            }
            
            $order->calculate_totals();
            $order->save();
            
        } catch (Exception $e) {
            return new WP_Error('update_failed', 'فشل تحديث المنتجات: ' . $e->getMessage(), array('status' => 500));
        }
        
        // 2. 🔥 Sync WCFM marketplace orders table
        $this->sync_wcfm_vendor_mapping($order_id);
        
        // 3. Return updated order
        return array(
            'success' => true,
            'message' => 'تم تحديث المنتجات بنجاح',
            'order' => $this->format_order($order),
        );
    }
    
    /**
     * 🔥 Sync vendor mapping in WCFM marketplace orders table
     */
    private function sync_wcfm_vendor_mapping($order_id) {
        global $wpdb;
        
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $table_name = $wpdb->prefix . 'wcfm_marketplace_orders';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
            return;
        }
        
        // Get all vendors from current line items
        $vendor_ids = array();
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if (!$product) {
                continue;
            }
            
            // Get vendor from product author
            $vendor_id = get_post_field('post_author', $product->get_id());
            if ($vendor_id && !in_array($vendor_id, $vendor_ids)) {
                $vendor_ids[] = intval($vendor_id);
            }
        }
        
        // Delete old mappings for this order
        $wpdb->delete($table_name, array('order_id' => $order_id), array('%d'));
        
        // Insert new mappings
        foreach ($vendor_ids as $vendor_id) {
            $wpdb->insert(
                $table_name,
                array(
                    'order_id' => $order_id,
                    'vendor_id' => $vendor_id,
                    'created' => current_time('mysql'),
                ),
                array('%d', '%d', '%s')
            );
        }
        
        error_log("🔄 WCFM sync: Order #{$order_id} mapped to vendors: " . implode(', ', $vendor_ids));
    }
}
