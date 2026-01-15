<?php
/**
 * Categories Vendors with Subcategories Endpoint
 * Optimized endpoint for multiple categories with their vendors and subcategories
 *
 * @package Spare2App_Enhanced_Store_API
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Categories_Vendors_Subcategories_Endpoint {
    
    /**
     * Register routes
     */
    public function register_routes() {
        register_rest_route('spare2app/v1', '/categories/vendors-with-subcategories', array(
            'methods' => 'POST',
            'callback' => array($this, 'get_categories_vendors_subcategories'),
            'permission_callback' => '__return_true',
            'args' => array(
                'category_ids' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_array($param) && !empty($param);
                    },
                    'sanitize_callback' => function($param) {
                        return array_map('intval', array_filter($param, 'is_numeric'));
                    }
                ),
            ),
        ));
    }
    
    /**
     * Main endpoint: Get multiple categories with their vendors and subcategories
     */
    public function get_categories_vendors_subcategories($request) {
        $category_ids = $request->get_param('category_ids');
        
        if (empty($category_ids)) {
            return new WP_REST_Response(array(
                'error' => 'Invalid category_ids',
                'message' => 'يجب إرسال مصفوفة من معرفات التصنيفات'
            ), 400);
        }
        
        // Get active vendors once (performance optimization)
        $active_vendors = $this->get_active_vendors();
        
        if (empty($active_vendors)) {
            return new WP_REST_Response(array(
                'categories' => array(),
                'message' => 'لا يوجد بائعين نشطين'
            ), 200);
        }
        
        // Get all vendor products count per category in one query (OPTIMIZED)
        $vendors_products_map = $this->get_vendors_products_count_batch($active_vendors, $category_ids);
        
        $categories_data = array();
        
        foreach ($category_ids as $category_id) {
            $category = get_term($category_id, 'product_cat');
            
            if (is_wp_error($category) || !$category) {
                continue; // Skip invalid categories
            }
            
            $vendors_data = array();
            
            foreach ($active_vendors as $vendor_id) {
                // Check if vendor has products in this category
                $vendor_products_count = isset($vendors_products_map[$vendor_id][$category_id]) 
                    ? $vendors_products_map[$vendor_id][$category_id] 
                    : 0;
                
                if ($vendor_products_count > 0) {
                    $vendor_info = $this->get_vendor_data($vendor_id);
                    
                    if ($vendor_info) {
                        // Get subcategories with product counts
                        $vendor_subcategories = $this->get_vendor_subcategories_with_counts(
                            $vendor_id, 
                            $category_id
                        );
                        
                        $vendors_data[] = array(
                            'id' => $vendor_info['id'],
                            'name' => $vendor_info['name'],
                            'slug' => $vendor_info['slug'],
                            'avatar' => $vendor_info['avatar'],
                            'banner' => $vendor_info['banner'],
                            'rating' => $vendor_info['rating'],
                            'location' => $vendor_info['location'],
                            'total_products_in_category' => $vendor_products_count,
                            'subcategories' => $vendor_subcategories,
                        );
                    }
                }
            }
            
            // Sort vendors by total_products_in_category (descending)
            usort($vendors_data, function($a, $b) {
                return $b['total_products_in_category'] - $a['total_products_in_category'];
            });
            
            // Only include category if it has vendors
            if (!empty($vendors_data)) {
                $categories_data[] = array(
                    'category' => $this->format_category($category),
                    'vendors' => $vendors_data,
                    'vendors_count' => count($vendors_data),
                );
            }
        }
        
        return new WP_REST_Response(array(
            'categories' => $categories_data,
            'total_categories' => count($categories_data),
            'total_vendors' => count($active_vendors),
        ), 200);
    }
    
    /**
     * OPTIMIZED: Get vendors products count for multiple categories in one query
     */
    private function get_vendors_products_count_batch($vendor_ids, $category_ids) {
        global $wpdb;
        
        if (empty($vendor_ids) || empty($category_ids)) {
            return array();
        }
        
        $vendor_ids_str = implode(',', array_map('intval', $vendor_ids));
        $category_ids_str = implode(',', array_map('intval', $category_ids));
        
        // One optimized query instead of multiple
        $sql = "SELECT p.post_author as vendor_id, tt.term_id as category_id, COUNT(DISTINCT p.ID) as product_count
                FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
                INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND p.post_author IN ({$vendor_ids_str})
                AND tt.taxonomy = 'product_cat'
                AND tt.term_id IN ({$category_ids_str})
                GROUP BY p.post_author, tt.term_id";
        
        $results = $wpdb->get_results($sql);
        
        // Map results: vendors_products_map[vendor_id][category_id] = count
        $map = array();
        foreach ($results as $row) {
            if (!isset($map[$row->vendor_id])) {
                $map[$row->vendor_id] = array();
            }
            $map[$row->vendor_id][$row->category_id] = (int) $row->product_count;
        }
        
        return $map;
    }
    
    /**
     * Get subcategories where vendor has products (optimized)
     */
    private function get_vendor_subcategories_with_counts($vendor_id, $parent_category_id) {
        global $wpdb;
        
        // Get all subcategories of the parent
        $subcategories = get_terms(array(
            'taxonomy' => 'product_cat',
            'parent' => $parent_category_id,
            'hide_empty' => false,
        ));
        
        if (empty($subcategories) || is_wp_error($subcategories)) {
            return array();
        }
        
        $subcategory_ids = array_map(function($term) {
            return $term->term_id;
        }, $subcategories);
        
        if (empty($subcategory_ids)) {
            return array();
        }
        
        $subcategory_ids_str = implode(',', array_map('intval', $subcategory_ids));
        
        // Get product counts for all subcategories in one query (OPTIMIZED)
        $sql = $wpdb->prepare(
            "SELECT tt.term_id, COUNT(DISTINCT p.ID) as product_count
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND p.post_author = %d
            AND tt.taxonomy = 'product_cat'
            AND tt.term_id IN ({$subcategory_ids_str})
            GROUP BY tt.term_id",
            $vendor_id
        );
        
        $counts = $wpdb->get_results($sql);
        
        // Map counts by term_id
        $counts_map = array();
        foreach ($counts as $row) {
            $counts_map[$row->term_id] = (int) $row->product_count;
        }
        
        // Build subcategories array with counts
        $vendor_subcategories = array();
        
        foreach ($subcategories as $subcategory) {
            $product_count = isset($counts_map[$subcategory->term_id]) 
                ? $counts_map[$subcategory->term_id] 
                : 0;
            
            // Only include subcategories where vendor has products
            if ($product_count > 0) {
                // Get subcategory image
                $thumbnail_id = get_term_meta($subcategory->term_id, 'thumbnail_id', true);
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
                
                $vendor_subcategories[] = array(
                    'id' => $subcategory->term_id,
                    'name' => $subcategory->name,
                    'slug' => $subcategory->slug,
                    'product_count' => $product_count,
                    'parent' => $parent_category_id,
                    'image' => $image,
                );
            }
        }
        
        // Sort by product_count descending
        usort($vendor_subcategories, function($a, $b) {
            return $b['product_count'] - $a['product_count'];
        });
        
        return $vendor_subcategories;
    }
    
    /**
     * Get active vendors (cached for performance)
     */
    private function get_active_vendors() {
        global $wpdb;
        
        // Get all users with WCFM vendor role
        $vendors = get_users(array(
            'role' => 'wcfm_vendor',
            'fields' => 'ID'
        ));
        
        // Also check for sellers role
        $sellers = get_users(array(
            'role' => 'seller',
            'fields' => 'ID'
        ));
        
        $all_vendors = array_merge($vendors, $sellers);
        
        // Fallback: get all product authors if no vendors found by role
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
            
            if ($is_store_offline !== 'yes' && $disable_vendor !== 'yes' && $disable_vendor != '1') {
                $filtered_vendors[] = (int) $vendor_id;
            }
        }
        
        return array_unique($filtered_vendors);
    }
    
    /**
     * Get vendor data
     */
    private function get_vendor_data($vendor_id) {
        $vendor = get_userdata($vendor_id);
        
        if (!$vendor) {
            return null;
        }
        
        // Get shop name
        $shop_name = get_user_meta($vendor_id, 'store_name', true);
        if (!$shop_name) {
            $shop_name = get_user_meta($vendor_id, '_wcfm_shop_name', true);
        }
        
        // Get profile settings
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        
        // Avatar
        $vendor_avatar = '';
        if (is_array($profile_settings) && !empty($profile_settings['gravatar'])) {
            $vendor_avatar = wp_get_attachment_url($profile_settings['gravatar']);
        }
        
        if (!$vendor_avatar) {
            $vendor_avatar = get_user_meta($vendor_id, '_vendor_profile_image', true);
            if ($vendor_avatar && is_numeric($vendor_avatar)) {
                $vendor_avatar = wp_get_attachment_url($vendor_avatar);
            }
        }
        
        // Banner
        $vendor_banner = '';
        if (is_array($profile_settings) && !empty($profile_settings['banner'])) {
            $vendor_banner = wp_get_attachment_url($profile_settings['banner']);
        } else {
            $vendor_banner = get_user_meta($vendor_id, '_vendor_banner', true);
            if ($vendor_banner && is_numeric($vendor_banner)) {
                $vendor_banner = wp_get_attachment_url($vendor_banner);
            }
        }
        
        $store_rating = get_user_meta($vendor_id, '_wcfm_store_rating', true);
        $vendor_city = get_user_meta($vendor_id, '_wcfm_vendor_city', true);
        $vendor_address = get_user_meta($vendor_id, '_wcfm_vendor_address', true);
        
        // Fallback avatar
        $gravatar = get_avatar_url($vendor->user_email, array('size' => 150));
        $final_avatar = $vendor_avatar ?: $gravatar;
        
        return array(
            'id' => $vendor_id,
            'name' => $shop_name ?: $vendor->display_name,
            'slug' => $vendor->display_name,
            'avatar' => $final_avatar,
            'banner' => $vendor_banner,
            'rating' => floatval($store_rating ?: 0),
            'location' => $vendor_city ?: $vendor_address,
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
