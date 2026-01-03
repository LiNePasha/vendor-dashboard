<?php
/**
 * Category Vendors Endpoint
 * Provides vendors with their products filtered by category
 *
 * @package Spare2App_Enhanced_Store_API
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Category_Vendors_Endpoint {
    
    /**
     * Register routes
     */
    public function register_routes() {
        // Route by category ID
        register_rest_route('spare2app/v1', '/category/(?P<category_id>\d+)/vendors-products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_category_vendors_products'),
            'permission_callback' => '__return_true',
            'args' => array(
                'category_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ),
            ),
        ));
        
        // Route by category SLUG
        register_rest_route('spare2app/v1', '/category-slug/(?P<slug>[a-zA-Z0-9-]+)/vendors-products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_category_vendors_products_by_slug'),
            'permission_callback' => '__return_true',
            'args' => array(
                'slug' => array(
                    'required' => true,
                ),
            ),
        ));
    }
    
    /**
     * Get vendors with products by category SLUG
     */
    public function get_category_vendors_products_by_slug($request) {
        $slug = $request->get_param('slug');
        
        // Get category by slug
        $category = get_term_by('slug', $slug, 'product_cat');
        
        if (!$category || is_wp_error($category)) {
            return new WP_REST_Response(array(
                'error' => 'Category not found',
                'message' => 'التصنيف المطلوب غير موجود',
                'slug' => $slug
            ), 404);
        }
        
        // Set the category_id in request and call the main function
        $request->set_param('category_id', $category->term_id);
        return $this->get_category_vendors_products($request);
    }
    
    /**
     * Get vendors with products in a specific category
     */
    public function get_category_vendors_products($request) {
        $category_id = $request->get_param('category_id');
        $page = $request->get_param('page') ?: 1;
        $vendors_per_page = $request->get_param('vendors_per_page') ?: 5;
        $products_per_vendor = $request->get_param('products_per_vendor') ?: 8;
        
        // Get category info
        $category = get_term($category_id, 'product_cat');
        
        if (is_wp_error($category) || !$category) {
            return new WP_REST_Response(array(
                'error' => 'Category not found',
                'message' => 'التصنيف المطلوب غير موجود'
            ), 404);
        }
        
        // Get active vendors
        $active_vendors = $this->get_active_vendors();
        
        if (empty($active_vendors)) {
            return new WP_REST_Response(array(
                'category' => $this->format_category($category),
                'vendors' => array(),
                'pagination' => array(
                    'page' => (int)$page,
                    'vendors_per_page' => (int)$vendors_per_page,
                    'total_vendors' => 0,
                    'total_pages' => 0,
                )
            ), 200);
        }
        
        // Get vendors with products in this category
        $vendors_with_products = array();
        
        foreach ($active_vendors as $vendor_id) {
            // Get products for this vendor in this category
            $products = $this->get_vendor_products_in_category(
                $vendor_id, 
                $category_id, 
                $products_per_vendor
            );
            
            // Only include vendors that have products in this category
            if (!empty($products)) {
                $vendor_data = $this->get_vendor_data($vendor_id);
                
                if ($vendor_data) {
                    $vendors_with_products[] = array(
                        'vendor' => $vendor_data,
                        'products' => $products,
                        'total_products' => $this->get_vendor_total_products_in_category($vendor_id, $category_id)
                    );
                }
            }
        }
        
        // Sort vendors by number of products in category (descending)
        usort($vendors_with_products, function($a, $b) {
            return $b['total_products'] - $a['total_products'];
        });
        
        // Calculate pagination for vendors
        $total_vendors = count($vendors_with_products);
        $total_pages = ceil($total_vendors / $vendors_per_page);
        $offset = ($page - 1) * $vendors_per_page;
        
        // Get vendors for current page
        $paginated_vendors = array_slice($vendors_with_products, $offset, $vendors_per_page);
        
        return new WP_REST_Response(array(
            'category' => $this->format_category($category),
            'vendors' => $paginated_vendors,
            'pagination' => array(
                'page' => (int)$page,
                'vendors_per_page' => (int)$vendors_per_page,
                'total_vendors' => $total_vendors,
                'total_pages' => $total_pages,
            ),
            'debug' => array(
                'active_vendors_count' => count($active_vendors),
                'vendors_with_products_count' => $total_vendors,
            )
        ), 200);
    }
    
    /**
     * Get active vendors
     */
    private function get_active_vendors() {
        global $wpdb;
        
        // Get all users with WCFM vendor role
        $vendors = get_users(array(
            'role' => 'wcfm_vendor',
            'fields' => 'ID'
        ));
        
        // Also check for sellers role (common in WCFM)
        $sellers = get_users(array(
            'role' => 'seller',
            'fields' => 'ID'
        ));
        
        // Merge both arrays
        $all_vendors = array_merge($vendors, $sellers);
        
        // If no vendors found by role, get all users who have authored products
        if (empty($all_vendors)) {
            $sql = "SELECT DISTINCT post_author 
                    FROM {$wpdb->posts} 
                    WHERE post_type = 'product' 
                    AND post_status = 'publish'
                    AND post_author > 1";
            $all_vendors = $wpdb->get_col($sql);
        }
        
        // Filter out disabled/offline vendors
        $filtered_vendors = array();
        foreach ($all_vendors as $vendor_id) {
            $is_store_offline = get_user_meta($vendor_id, '_wcfm_is_store_offline', true);
            $disable_vendor = get_user_meta($vendor_id, '_disable_vendor', true);
            
            // Only include if not disabled AND not offline
            if ($is_store_offline !== 'yes' && $disable_vendor !== 'yes' && $disable_vendor != '1') {
                $filtered_vendors[] = $vendor_id;
            }
        }
        
        return $filtered_vendors;
    }
    
    /**
     * Get vendor products in specific category
     */
    private function get_vendor_products_in_category($vendor_id, $category_id, $limit = 8) {
        global $wpdb;
        
        // First, let's try direct SQL query to find products by vendor in category
        // WCFM typically uses post_author for vendor products
        $sql = $wpdb->prepare(
            "SELECT DISTINCT p.ID 
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND p.post_author = %d
            AND tt.taxonomy = 'product_cat'
            AND tt.term_id = %d
            ORDER BY p.post_date DESC
            LIMIT %d",
            $vendor_id,
            $category_id,
            $limit
        );
        
        $product_ids = $wpdb->get_col($sql);
        $products = array();
        
        foreach ($product_ids as $product_id) {
            $product = wc_get_product($product_id);
            
            if ($product) {
                $products[] = $this->format_product_for_api($product);
            }
        }
        
        return $products;
    }
    
    /**
     * Get total products count for vendor in category
     */
    private function get_vendor_total_products_in_category($vendor_id, $category_id) {
        global $wpdb;
        
        $sql = $wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) 
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND p.post_author = %d
            AND tt.taxonomy = 'product_cat'
            AND tt.term_id = %d",
            $vendor_id,
            $category_id
        );
        
        return (int) $wpdb->get_var($sql);
    }
    
    /**
     * Get vendor data
     */
    private function get_vendor_data($vendor_id) {
        $vendor = get_userdata($vendor_id);
        
        if (!$vendor) {
            return null;
        }
        
        // Get vendor meta - try multiple possible meta keys
        $shop_name = get_user_meta($vendor_id, 'store_name', true);
        if (!$shop_name) {
            $shop_name = get_user_meta($vendor_id, '_wcfm_shop_name', true);
        }
        
        // Get profile settings for logo/avatar
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        
        // Try to get gravatar (vendor logo) from profile settings
        $vendor_avatar = '';
        if (is_array($profile_settings) && !empty($profile_settings['gravatar'])) {
            $vendor_avatar = wp_get_attachment_url($profile_settings['gravatar']);
        }
        
        // Fallback to other avatar meta keys if gravatar not found
        if (!$vendor_avatar) {
            $vendor_avatar = get_user_meta($vendor_id, '_vendor_profile_image', true);
            if ($vendor_avatar && is_numeric($vendor_avatar)) {
                $vendor_avatar = wp_get_attachment_url($vendor_avatar);
            }
        }
        
        $vendor_banner = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        if (is_array($vendor_banner) && !empty($vendor_banner['banner'])) {
            $vendor_banner = wp_get_attachment_url($vendor_banner['banner']);
        } else {
            $vendor_banner = get_user_meta($vendor_id, '_vendor_banner', true);
            if ($vendor_banner && is_numeric($vendor_banner)) {
                $vendor_banner = wp_get_attachment_url($vendor_banner);
            }
        }
        
        $store_rating = get_user_meta($vendor_id, '_wcfm_store_rating', true);
        $vendor_address = get_user_meta($vendor_id, '_wcfm_vendor_address', true);
        $vendor_city = get_user_meta($vendor_id, '_wcfm_vendor_city', true);
        
        // Get total products for vendor
        $product_count = count_user_posts($vendor_id, 'product', true);
        
        // Generate gravatar as last fallback
        $gravatar = get_avatar_url($vendor->user_email, array('size' => 150));
        
        // Use vendor_avatar (from profile gravatar field), then email gravatar as fallback
        $final_avatar = $vendor_avatar ?: $gravatar;
        
        return array(
            'id' => $vendor_id,
            'name' => $shop_name ?: $vendor->display_name,
            'slug' => $vendor->display_name,
            'avatar' => $final_avatar,
            'banner' => $vendor_banner ?: '',
            'rating' => floatval($store_rating ?: 0),
            'total_products' => (int)$product_count,
            'location' => $vendor_city ?: $vendor_address,
        );
    }
    
    /**
     * Format product for API response
     */
    private function format_product_for_api($product) {
        $images = array();
        $image_ids = array_merge(
            array($product->get_image_id()), 
            $product->get_gallery_image_ids()
        );
        
        foreach ($image_ids as $image_id) {
            if ($image_id) {
                $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
                if ($image_url) {
                    $images[] = array(
                        'id' => $image_id,
                        'src' => $image_url,
                        'name' => get_the_title($image_id),
                        'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                    );
                }
            }
        }
        
        return array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'on_sale' => $product->is_on_sale(),
            'stock_status' => $product->get_stock_status(),
            'images' => $images,
        );
    }
    
    /**
     * Format category for API response
     */
    private function format_category($category) {
        $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
        $image = null;
        
        if ($thumbnail_id) {
            $image_url = wp_get_attachment_url($thumbnail_id);
            if ($image_url) {
                $image = array(
                    'id' => $thumbnail_id,
                    'src' => $image_url,
                    'name' => get_the_title($thumbnail_id),
                    'alt' => get_post_meta($thumbnail_id, '_wp_attachment_image_alt', true),
                );
            }
        }
        
        return array(
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'count' => $category->count,
            'image' => $image,
        );
    }
}
