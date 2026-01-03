<?php
/**
 * Diverse Products Endpoint - FIXED VERSION
 * Provides fair distribution across vendors with ALL products
 *
 * @package Spare2App_Enhanced_Store_API
 * @version 2.1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Diverse_Products_Endpoint {
    
    /**
     * Register routes
     */
    public function register_routes() {
        register_rest_route('spare2app/v1', '/products/diverse', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_diverse_products'),
            'permission_callback' => '__return_true',
        ));
        
        register_rest_route('spare2app/v1', '/products/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_products_stats'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Get diverse products endpoint
     */
    public function get_diverse_products($request) {
        $page = $request->get_param('page') ?: 1;
        $per_page = $request->get_param('per_page') ?: 12;
        $category = $request->get_param('category');
        $search = $request->get_param('search');
        $min_price = $request->get_param('min_price');
        $max_price = $request->get_param('max_price');
        $in_stock = $request->get_param('in_stock');
        $on_sale = $request->get_param('on_sale');
        $featured = $request->get_param('featured');
        
        // Get active vendors
        $vendors = $this->get_active_vendors();
        
        if (empty($vendors)) {
            return new WP_REST_Response(array(
                'data' => array(),
                'pagination' => array(
                    'page' => (int)$page,
                    'per_page' => (int)$per_page,
                    'total' => 0,
                    'total_pages' => 0,
                ),
                'vendors_count' => 0,
                'algorithm' => 'round-robin-daily-shuffle',
                'message' => 'No active vendors found'
            ), 200);
        }
        
        // Get ALL products from ALL vendors with round-robin distribution
        $all_products = $this->get_all_vendor_products_round_robin(
            $vendors, 
            $category, 
            $search, 
            $min_price, 
            $max_price, 
            $in_stock, 
            $on_sale, 
            $featured
        );
        
        // NO shuffle - keep round-robin order for diversity
        $shuffled_products = $all_products;
        
        // Calculate pagination
        $total_products = count($shuffled_products);
        $total_pages = ceil($total_products / $per_page);
        $offset = ($page - 1) * $per_page;
        
        // Get products for current page
        $paginated_products = array_slice($shuffled_products, $offset, $per_page);
        
        // Format products for API response
        $formatted_products = array_map(array($this, 'format_product_for_api'), $paginated_products);
        
        return new WP_REST_Response(array(
            'data' => $formatted_products,
            'pagination' => array(
                'page' => (int)$page,
                'per_page' => (int)$per_page,
                'total' => $total_products,
                'total_pages' => $total_pages,
            ),
            'vendors_count' => count($vendors),
            'algorithm' => 'balanced-round-robin',
            'debug' => array(
                'total_before_pagination' => $total_products,
                'vendors' => count($vendors),
                'shuffle_seed' => date('Ymd') . $page
            )
        ), 200);
    }
    
    /**
     * Get active vendors (vendors with at least one product)
     * Excludes disabled vendors and offline stores
     * OPTIMIZED: Uses single database query instead of N queries per vendor
     */
    private function get_active_vendors() {
        global $wpdb;
        
        // Step 1: Get all vendors with products using a SINGLE optimized query
        $query = "
            SELECT DISTINCT p.post_author as vendor_id, COUNT(p.ID) as product_count
            FROM {$wpdb->posts} p
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            GROUP BY p.post_author
            HAVING product_count > 0
            ORDER BY vendor_id ASC
        ";
        
        $vendors_with_products = $wpdb->get_results($query);
        
        if (empty($vendors_with_products)) {
            error_log('Diverse Products: No vendors with published products found');
            return array();
        }
        
        error_log('Diverse Products: Found ' . count($vendors_with_products) . ' vendors with products in database');
        
        // Step 2: Get vendor statuses from WCFM API
        $wcfm_url = rest_url('wcfmmp/v1/store-vendors');
        $response = wp_remote_get($wcfm_url, array(
            'timeout' => 30,
        ));
        
        // Build vendor status map
        $vendor_status_map = array();
        
        if (!is_wp_error($response)) {
            $body = wp_remote_retrieve_body($response);
            $wcfm_vendors = json_decode($body, true);
            
            if (!empty($wcfm_vendors) && is_array($wcfm_vendors)) {
                foreach ($wcfm_vendors as $vendor) {
                    $vendor_id = isset($vendor['vendor_id']) ? intval($vendor['vendor_id']) : (isset($vendor['id']) ? intval($vendor['id']) : 0);
                    
                    if ($vendor_id > 0) {
                        $vendor_status_map[$vendor_id] = array(
                            'disabled' => isset($vendor['disable_vendor']) && $vendor['disable_vendor'] === 'yes',
                            'offline' => isset($vendor['is_store_offline']) && $vendor['is_store_offline'] === 'yes',
                        );
                    }
                }
            }
        }
        
        // Step 3: Filter vendors - must have products AND be active
        $active_vendors = array();
        
        foreach ($vendors_with_products as $vendor_data) {
            $vendor_id = intval($vendor_data->vendor_id);
            
            // Check vendor status (if we have WCFM data)
            if (isset($vendor_status_map[$vendor_id])) {
                $status = $vendor_status_map[$vendor_id];
                
                // Skip disabled or offline vendors
                if ($status['disabled']) {
                    error_log("Diverse Products: Vendor #$vendor_id is disabled - skipping");
                    continue;
                }
                
                if ($status['offline']) {
                    error_log("Diverse Products: Vendor #$vendor_id is offline - skipping");
                    continue;
                }
            }
            
            // Vendor is active and has products!
            $active_vendors[] = $vendor_id;
            error_log("Diverse Products: Vendor #$vendor_id is ACTIVE with {$vendor_data->product_count} products");
        }
        
        error_log('Diverse Products: Final active vendors count: ' . count($active_vendors));
        error_log('Diverse Products: Active vendor IDs: ' . implode(', ', $active_vendors));
        
        return $active_vendors;
    }
    
    /**
     * Get product count for a vendor
     */
    private function get_vendor_product_count($vendor_id) {
        global $wpdb;
        
        return intval($wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) 
            FROM {$wpdb->postmeta} pm
            INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE pm.meta_key = '_wcfm_product_author' 
            AND pm.meta_value = %s
            AND p.post_status = 'publish'
            AND p.post_type = 'product'
        ", $vendor_id)));
    }
    
    /**
     * Get ALL products from vendors using round-robin distribution
     * This ensures fair representation of each vendor
     */
    private function get_all_vendor_products_round_robin($vendors, $category = null, $search = null, $min_price = null, $max_price = null, $in_stock = null, $on_sale = null, $featured = null) {
        $vendor_products = array();
        
        // Get products for each vendor
        foreach ($vendors as $vendor_id) {
            $products = $this->get_vendor_products($vendor_id, $category, $search, $min_price, $max_price, $in_stock, $on_sale, $featured);
            
            if (!empty($products)) {
                $vendor_products[$vendor_id] = $products;
            }
        }
        
        if (empty($vendor_products)) {
            return array();
        }
        
        // Balanced round-robin distribution
        // Take limited products from each vendor per round to ensure diversity
        $distributed_products = array();
        $products_per_round = 1; // Max products per vendor per round (ensures maximum diversity)
        $max_rounds = 500; // Safety limit
        $round = 0;
        
        while (!empty($vendor_products) && $round < $max_rounds) {
            $round++;
            $vendors_in_round = array_keys($vendor_products);
            
            foreach ($vendors_in_round as $vendor_id) {
                // Take up to N products from this vendor in this round
                $taken = 0;
                while (!empty($vendor_products[$vendor_id]) && $taken < $products_per_round) {
                    $product = array_shift($vendor_products[$vendor_id]);
                    $distributed_products[] = $product;
                    $taken++;
                }
                
                // Remove vendor if no more products
                if (empty($vendor_products[$vendor_id])) {
                    unset($vendor_products[$vendor_id]);
                }
            }
        }
        
        return $distributed_products;
    }
    
    /**
     * Get products for a specific vendor with filters
     */
    private function get_vendor_products($vendor_id, $category = null, $search = null, $min_price = null, $max_price = null, $in_stock = null, $on_sale = null, $featured = null) {
        $args = array(
            'post_type' => 'product',
            'post_status' => 'publish',
            'posts_per_page' => -1, // Get ALL products from this vendor
            'meta_query' => array(
                'relation' => 'AND',
                array(
                    'key' => '_wcfm_product_author',
                    'value' => $vendor_id,
                    'compare' => '='
                )
            ),
            'orderby' => 'date',
            'order' => 'DESC'
        );
        
        // Category filter (supports both slug and term_id)
        if ($category) {
            // Determine if category is numeric (term_id) or string (slug)
            $field = is_numeric($category) ? 'term_id' : 'slug';
            
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => $field,
                    'terms' => $field === 'term_id' ? intval($category) : $category,
                )
            );
        }
        
        // Search filter
        if ($search) {
            $args['s'] = $search;
        }
        
        // Price range filter
        if ($min_price !== null || $max_price !== null) {
            if ($min_price !== null) {
                $args['meta_query'][] = array(
                    'key' => '_price',
                    'value' => floatval($min_price),
                    'compare' => '>=',
                    'type' => 'NUMERIC'
                );
            }
            
            if ($max_price !== null) {
                $args['meta_query'][] = array(
                    'key' => '_price',
                    'value' => floatval($max_price),
                    'compare' => '<=',
                    'type' => 'NUMERIC'
                );
            }
        }
        
        // Stock status filter
        if ($in_stock === 'true' || $in_stock === true) {
            $args['meta_query'][] = array(
                'key' => '_stock_status',
                'value' => 'instock',
                'compare' => '='
            );
        }
        
        // On sale filter
        if ($on_sale === 'true' || $on_sale === true) {
            $sale_ids = wc_get_product_ids_on_sale();
            if (!empty($sale_ids)) {
                $args['post__in'] = $sale_ids;
            } else {
                $args['post__in'] = array(0); // No products on sale
            }
        }
        
        // Featured filter
        if ($featured === 'true' || $featured === true) {
            if (!isset($args['tax_query'])) {
                $args['tax_query'] = array();
            }
            $args['tax_query'][] = array(
                'taxonomy' => 'product_visibility',
                'field' => 'name',
                'terms' => 'featured',
            );
        }
        
        $query = new WP_Query($args);
        return $query->posts;
    }
    
    /**
     * Apply daily shuffle to maintain consistency within the same day
     */
    private function apply_daily_shuffle($products, $page) {
        if (empty($products)) {
            return array();
        }
        
        // Create seed based on current date + page number
        // This ensures same results for same day and page
        $seed = intval(date('Ymd')) + intval($page);
        
        // Shuffle with seed
        mt_srand($seed);
        $shuffled = $products;
        
        // Fisher-Yates shuffle with seeded random
        $count = count($shuffled);
        for ($i = $count - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            $temp = $shuffled[$i];
            $shuffled[$i] = $shuffled[$j];
            $shuffled[$j] = $temp;
        }
        
        // Reset random seed
        mt_srand();
        
        return $shuffled;
    }
    
    /**
     * Format product for API response
     */
    private function format_product_for_api($post) {
        $product = wc_get_product($post->ID);
        
        if (!$product) {
            return null;
        }
        
        // Get vendor info
        $vendor_id = get_post_meta($post->ID, '_wcfm_product_author', true);
        $vendor_info = null;
        
        if ($vendor_id) {
            $vendor_data = get_userdata($vendor_id);
            if ($vendor_data) {
                $vendor_info = array(
                    'id' => $vendor_id,
                    'name' => $vendor_data->display_name,
                    'shop_name' => get_user_meta($vendor_id, 'wcfmmp_store_name', true) ?: $vendor_data->display_name,
                );
            }
        }
        
        // Get images
        $image_id = $product->get_image_id();
        $images = array();
        
        if ($image_id) {
            $images[] = array(
                'id' => $image_id,
                'src' => wp_get_attachment_url($image_id),
                'name' => get_the_title($image_id),
            );
        }
        
        // Get gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        foreach ($gallery_ids as $gallery_id) {
            $images[] = array(
                'id' => $gallery_id,
                'src' => wp_get_attachment_url($gallery_id),
                'name' => get_the_title($gallery_id),
            );
        }
        
        // Get categories
        $categories = array();
        $terms = get_the_terms($post->ID, 'product_cat');
        if ($terms && !is_wp_error($terms)) {
            foreach ($terms as $term) {
                $categories[] = array(
                    'id' => $term->term_id,
                    'name' => $term->name,
                    'slug' => $term->slug,
                );
            }
        }
        
        return array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'permalink' => get_permalink($product->get_id()),
            'type' => $product->get_type(),
            'status' => $product->get_status(),
            'featured' => $product->is_featured(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'on_sale' => $product->is_on_sale(),
            'stock_status' => $product->get_stock_status(),
            'stock_quantity' => $product->get_stock_quantity(),
            'manage_stock' => $product->get_manage_stock(),
            'rating_count' => $product->get_rating_count(),
            'average_rating' => $product->get_average_rating(),
            'images' => $images,
            'categories' => $categories,
            'vendor' => $vendor_info,
        );
    }
    
    /**
     * Get product statistics
     */
    public function get_products_stats($request) {
        global $wpdb;
        
        // Total products
        $total_products = wp_count_posts('product')->publish;
        
        // Products with vendors
        $products_with_vendors = $wpdb->get_var("
            SELECT COUNT(DISTINCT post_id) 
            FROM {$wpdb->postmeta} 
            WHERE meta_key = '_wcfm_product_author' 
            AND meta_value IS NOT NULL 
            AND meta_value != ''
        ");
        
        // Products without vendors
        $products_without_vendors = $total_products - $products_with_vendors;
        
        // Vendors count
        $vendors_count = $wpdb->get_var("
            SELECT COUNT(DISTINCT meta_value) 
            FROM {$wpdb->postmeta} 
            WHERE meta_key = '_wcfm_product_author' 
            AND meta_value IS NOT NULL 
            AND meta_value != ''
        ");
        
        // Top vendors
        $top_vendors = $wpdb->get_results("
            SELECT meta_value as vendor_id, COUNT(*) as product_count 
            FROM {$wpdb->postmeta} 
            WHERE meta_key = '_wcfm_product_author' 
            AND meta_value IS NOT NULL 
            AND meta_value != ''
            GROUP BY meta_value 
            ORDER BY product_count DESC
        ");
        
        return new WP_REST_Response(array(
            'total_products' => (int)$total_products,
            'products_with_vendors' => (int)$products_with_vendors,
            'products_without_vendors' => (int)$products_without_vendors,
            'vendors_count' => (int)$vendors_count,
            'top_vendors' => $top_vendors,
            'vendor_meta_key' => '_wcfm_product_author'
        ), 200);
    }
}
