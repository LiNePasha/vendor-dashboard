<?php
/**
 * Vendors Search Endpoint
 * Search for vendors by name, description, or their products
 *
 * @package Spare2App_Enhanced_Store_API
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Vendors_Search_Endpoint {
    
    /**
     * Register routes
     */
    public function register_routes() {
        register_rest_route('spare2app/v1', '/vendors/search', array(
            'methods' => 'GET',
            'callback' => array($this, 'search_vendors'),
            'permission_callback' => '__return_true',
            'args' => array(
                'q' => array(
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'page' => array(
                    'default' => 1,
                    'type' => 'integer',
                ),
                'per_page' => array(
                    'default' => 20,
                    'type' => 'integer',
                ),
            ),
        ));
    }
    
    /**
     * Search vendors
     */
    public function search_vendors($request) {
        $keyword = $request->get_param('q');
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        
        if (empty($keyword) || strlen($keyword) < 2) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'يجب إدخال كلمة بحث (حرفين على الأقل)',
                'vendors' => array(),
            ), 400);
        }
        
        // Get vendor IDs with relevance scores
        $vendor_results = $this->find_matching_vendors($keyword);
        
        if (empty($vendor_results)) {
            return new WP_REST_Response(array(
                'success' => true,
                'vendors' => array(),
                'pagination' => array(
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => 0,
                    'total_pages' => 0,
                ),
            ), 200);
        }
        
        // Sort by relevance score (descending)
        usort($vendor_results, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        // Calculate pagination
        $total_vendors = count($vendor_results);
        $total_pages = ceil($total_vendors / $per_page);
        $offset = ($page - 1) * $per_page;
        
        // Get vendors for current page
        $paginated_results = array_slice($vendor_results, $offset, $per_page);
        
        // Format vendor data
        $vendors = array();
        foreach ($paginated_results as $result) {
            $vendor_data = $this->get_vendor_data($result['vendor_id']);
            if ($vendor_data) {
                $vendor_data['relevance_score'] = $result['score'];
                $vendors[] = $vendor_data;
            }
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'vendors' => $vendors,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total_vendors,
                'total_pages' => $total_pages,
            ),
            'debug' => array(
                'keyword' => $keyword,
                'matches_found' => $total_vendors,
            ),
        ), 200);
    }
    
    /**
     * Find vendors matching keyword with relevance scoring
     */
    private function find_matching_vendors($keyword) {
        global $wpdb;
        
        $vendor_scores = array();
        $keyword_lower = strtolower($keyword);
        
        // Get all active vendors
        $active_vendors = $this->get_active_vendors();
        
        if (empty($active_vendors)) {
            return array();
        }
        
        foreach ($active_vendors as $vendor_id) {
            $score = 0;
            
            // Get vendor profile settings
            $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
            
            if (is_array($profile_settings)) {
                // Check store_name (highest priority)
                if (!empty($profile_settings['store_name'])) {
                    $store_name = strtolower($profile_settings['store_name']);
                    
                    // Exact match at start = 100 points
                    if (strpos($store_name, $keyword_lower) === 0) {
                        $score += 100;
                    }
                    // Contains keyword = 50 points
                    elseif (strpos($store_name, $keyword_lower) !== false) {
                        $score += 50;
                    }
                    
                    // Each word match = 10 points
                    $keyword_words = explode(' ', $keyword_lower);
                    foreach ($keyword_words as $word) {
                        if (strlen($word) >= 2 && strpos($store_name, $word) !== false) {
                            $score += 10;
                        }
                    }
                }
                
                // Check shop_description
                if (!empty($profile_settings['shop_description'])) {
                    $description = strtolower($profile_settings['shop_description']);
                    
                    if (strpos($description, $keyword_lower) !== false) {
                        $score += 20;
                    }
                }
            }
            
            // Check user display_name as fallback
            $user = get_userdata($vendor_id);
            if ($user) {
                $display_name = strtolower($user->display_name);
                if (strpos($display_name, $keyword_lower) !== false) {
                    $score += 30;
                }
            }
            
            // Count matching products (each match = 3 points, max 30)
            $matching_products = $this->count_vendor_matching_products($vendor_id, $keyword);
            $score += min($matching_products * 3, 30);
            
            // Bonus for store rating
            $rating = get_user_meta($vendor_id, '_wcfm_store_rating', true);
            if ($rating) {
                $score += floatval($rating) * 2;
            }
            
            // Only include vendors with score > 0
            if ($score > 0) {
                $vendor_scores[] = array(
                    'vendor_id' => $vendor_id,
                    'score' => $score,
                );
            }
        }
        
        return $vendor_scores;
    }
    
    /**
     * Count products matching keyword for a vendor
     */
    private function count_vendor_matching_products($vendor_id, $keyword) {
        global $wpdb;
        
        $keyword_like = '%' . $wpdb->esc_like($keyword) . '%';
        
        $sql = $wpdb->prepare(
            "SELECT COUNT(ID) 
            FROM {$wpdb->posts} 
            WHERE post_type = 'product' 
            AND post_status = 'publish'
            AND post_author = %d
            AND post_title LIKE %s",
            $vendor_id,
            $keyword_like
        );
        
        return (int) $wpdb->get_var($sql);
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
        
        // Also check for sellers role
        $sellers = get_users(array(
            'role' => 'seller',
            'fields' => 'ID'
        ));
        
        // Merge both arrays
        $all_vendors = array_merge($vendors, $sellers);
        
        // If no vendors found by role, get all product authors
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
                $filtered_vendors[] = $vendor_id;
            }
        }
        
        return $filtered_vendors;
    }
    
    /**
     * Get vendor data
     */
    private function get_vendor_data($vendor_id) {
        $vendor = get_userdata($vendor_id);
        
        if (!$vendor) {
            return null;
        }
        
        // Get vendor meta
        $shop_name = get_user_meta($vendor_id, 'store_name', true);
        if (!$shop_name) {
            $shop_name = get_user_meta($vendor_id, '_wcfm_shop_name', true);
        }
        
        // Get profile settings for logo/avatar/banner
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        
        // Try to get gravatar (vendor logo) from profile settings
        $vendor_avatar = '';
        if (is_array($profile_settings) && !empty($profile_settings['gravatar'])) {
            $vendor_avatar = wp_get_attachment_url($profile_settings['gravatar']);
        }
        
        // Fallback to other avatar meta keys
        if (!$vendor_avatar) {
            $vendor_avatar = get_user_meta($vendor_id, '_vendor_profile_image', true);
            if ($vendor_avatar && is_numeric($vendor_avatar)) {
                $vendor_avatar = wp_get_attachment_url($vendor_avatar);
            }
        }
        
        // Get banner
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
        $vendor_address = get_user_meta($vendor_id, '_wcfm_vendor_address', true);
        $vendor_city = get_user_meta($vendor_id, '_wcfm_vendor_city', true);
        
        // Get shop description
        $shop_description = '';
        if (is_array($profile_settings) && !empty($profile_settings['shop_description'])) {
            $shop_description = $profile_settings['shop_description'];
        }
        
        // Get total products for vendor
        $product_count = count_user_posts($vendor_id, 'product', true);
        
        // Generate gravatar as last fallback
        $gravatar = get_avatar_url($vendor->user_email, array('size' => 150));
        
        // Use vendor_avatar (from profile gravatar field), then email gravatar as fallback
        $final_avatar = $vendor_avatar ?: $gravatar;
        
        return array(
            'id' => $vendor_id,
            'name' => $shop_name ?: $vendor->display_name,
            'slug' => sanitize_title($shop_name ?: $vendor->user_login),
            'avatar' => $final_avatar,
            'banner' => $vendor_banner ?: '',
            'description' => wp_trim_words($shop_description, 20),
            'rating' => floatval($store_rating ?: 0),
            'total_products' => (int)$product_count,
            'location' => $vendor_city ?: $vendor_address,
        );
    }
}
