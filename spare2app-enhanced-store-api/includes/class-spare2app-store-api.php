<?php
/**
 * Main API Class for Enhanced Store API
 * 
 * @package Spare2App_Enhanced_Store_API
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Enhanced_Store_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Initialize API filters
        if (class_exists('Spare2App_API_Filters')) {
            new Spare2App_API_Filters();
        }
        
        // Initialize diverse products endpoint
        if (class_exists('Spare2App_Diverse_Products_Endpoint')) {
            $diverse_endpoint = new Spare2App_Diverse_Products_Endpoint();
            add_action('rest_api_init', array($diverse_endpoint, 'register_routes'));
        }
        
        // Initialize category vendors endpoint
        if (class_exists('Spare2App_Category_Vendors_Endpoint')) {
            $category_vendors_endpoint = new Spare2App_Category_Vendors_Endpoint();
            add_action('rest_api_init', array($category_vendors_endpoint, 'register_routes'));
        }
        
        // Initialize vendors search endpoint
        if (class_exists('Spare2App_Vendors_Search_Endpoint')) {
            $vendors_search_endpoint = new Spare2App_Vendors_Search_Endpoint();
            add_action('rest_api_init', array($vendors_search_endpoint, 'register_routes'));
        }
        
        // Initialize categories vendors subcategories endpoint
        if (class_exists('Spare2App_Categories_Vendors_Subcategories_Endpoint')) {
            $categories_vendors_subcategories_endpoint = new Spare2App_Categories_Vendors_Subcategories_Endpoint();
            add_action('rest_api_init', array($categories_vendors_subcategories_endpoint, 'register_routes'));
        }
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Spare2App Store API',
            'Store API',
            'manage_options',
            'spare2app-store-api',
            array($this, 'admin_page')
        );
    }
    
    /**
     * Admin page content
     */
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Spare2App Enhanced Store API</h1>
            <div class="card">
                <h2>API Endpoints</h2>
                <p><strong>Base URL:</strong> <code><?php echo site_url(); ?>/wp-json/spare2app/v2/</code></p>
                
                <h3>Available Endpoints:</h3>
                <ul>
                    <li><code>GET /store/{vendor_id}</code> - Enhanced store information</li>
                    <li><code>GET /store/{vendor_id}/categories</code> - Categories with statistics</li>
                    <li><code>GET /store/{vendor_id}/category/{category_id}</code> - Single category details</li>
                    <li><code>GET /store/{vendor_id}/products</code> - Products with advanced filtering</li>
                    <li><code>GET /store/{vendor_id}/analytics</code> - Store analytics dashboard</li>
                    <li><code>GET /store/{vendor_id}/category-tree</code> - Category hierarchy</li>
                    <li><code>GET /category/{category_id}/tags</code> - Get all tags in a category</li>
                    <li><code>GET /store/{vendor_id}/category/{category_id}/tags</code> - Get store category tags</li>
                    <li><code>GET /store/{vendor_id}/tag/{tag_slug}/products</code> - Get store products by tag</li>
                    <li><code>GET /store/{vendor_id}/category/{category_id}/tag/{tag_slug}/products</code> - Get store products by category and tag</li>
                </ul>
                
                <h3>Test API:</h3>
                <p>You can test the API using tools like Postman or browser:</p>
                <code><?php echo site_url(); ?>/wp-json/spare2app/v2/store/1</code>
            </div>
            
            <div class="card">
                <h2>Plugin Information</h2>
                <p><strong>Version:</strong> <?php echo SPARE2APP_STORE_API_VERSION; ?></p>
                <p><strong>Status:</strong> <span style="color: green;">Active</span></p>
            </div>
        </div>
        <?php
    }
    
    public function register_routes() {
        $namespace = 'spare2app/v2';
        
        // Store info with enhanced data
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_enhanced_store_info'),
            'permission_callback' => '__return_true',
        ));
        
        // Store categories with stats
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/categories', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_categories_with_stats'),
            'permission_callback' => '__return_true',
        ));
        
        // NEW: Single category details with insights
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/category/(?P<category_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_single_category_details'),
            'permission_callback' => '__return_true',
        ));
        
        // Enhanced products with advanced filtering
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_products_advanced'),
            'permission_callback' => '__return_true',
        ));
        
        // Store analytics dashboard
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_analytics'),
            'permission_callback' => '__return_true',
        ));
        
        // Category hierarchy (parent/child relationships)
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/category-tree', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_category_hierarchy'),
            'permission_callback' => '__return_true',
        ));
        
        // Category tags - Get all tags used in a specific category
        register_rest_route($namespace, '/category/(?P<category_id>\d+)/tags', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_category_tags'),
            'permission_callback' => '__return_true',
        ));
        
        // Store category tags - Get all tags used in a specific category within a store
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/category/(?P<category_id>\d+)/tags', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_category_tags'),
            'permission_callback' => '__return_true',
        ));
        
        // Store tag products - Get all products with a specific tag in a store
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/tag/(?P<tag_slug>[a-zA-Z0-9-_%]+)/products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_tag_products'),
            'permission_callback' => '__return_true',
        ));
        
        // Store category tag products - Get products with specific tag in specific category in store
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/category/(?P<category_id>\d+)/tag/(?P<tag_slug>[a-zA-Z0-9-_%]+)/products', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_store_category_tag_products'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Enhanced Store Info
     */
    public function get_enhanced_store_info($request) {
        $vendor_id = $request['vendor_id'];
        
        // Get basic vendor info
        $vendor_data = get_userdata($vendor_id);
        if (!$vendor_data) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Get data from WCFM API first (most reliable source)
        $wcfm_data = $this->get_wcfm_vendor_data($vendor_id);
        
        // Get profile settings as fallback
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        if (!is_array($profile_settings)) {
            $profile_settings = array();
        }
        
        // Use WCFM data if available, otherwise build from profile settings
        $vendor_shop_logo = '';
        $vendor_list_logo = '';
        $vendor_banner = '';
        $mobile_banner = '';
        
        if ($wcfm_data) {
            // Use WCFM data which already has URLs
            $vendor_shop_logo = isset($wcfm_data->vendor_shop_logo) ? $wcfm_data->vendor_shop_logo : '';
            $vendor_list_logo = isset($wcfm_data->vendor_list_logo) ? $wcfm_data->vendor_list_logo : '';
            $vendor_banner = isset($wcfm_data->vendor_banner) ? $wcfm_data->vendor_banner : '';
            $mobile_banner = isset($wcfm_data->mobile_banner) ? $wcfm_data->mobile_banner : '';
        } else {
            // Fallback: Get from profile settings and convert IDs to URLs
            if (isset($profile_settings['logo']) && !empty($profile_settings['logo'])) {
                $logo_value = $profile_settings['logo'];
                if (is_numeric($logo_value)) {
                    $logo_url = wp_get_attachment_url($logo_value);
                    $vendor_shop_logo = $logo_url ? $logo_url : '';
                } else {
                    $vendor_shop_logo = $logo_value;
                }
            }
            
            if (isset($profile_settings['list_logo']) && !empty($profile_settings['list_logo'])) {
                $list_logo_value = $profile_settings['list_logo'];
                if (is_numeric($list_logo_value)) {
                    $logo_url = wp_get_attachment_url($list_logo_value);
                    $vendor_list_logo = $logo_url ? $logo_url : '';
                } else {
                    $vendor_list_logo = $list_logo_value;
                }
            }
            
            if (isset($profile_settings['banner']) && !empty($profile_settings['banner'])) {
                $banner_value = $profile_settings['banner'];
                if (is_numeric($banner_value)) {
                    $banner_url = wp_get_attachment_url($banner_value);
                    $vendor_banner = $banner_url ? $banner_url : '';
                } else {
                    $vendor_banner = $banner_value;
                }
            }

            if (isset($profile_settings['mobile_banner']) && !empty($profile_settings['mobile_banner'])) {
                $mobile_banner_value = $profile_settings['mobile_banner'];
                if (is_numeric($mobile_banner_value)) {
                    $mobile_banner_url = wp_get_attachment_url($mobile_banner_value);
                    $mobile_banner = $mobile_banner_url ? $mobile_banner_url : '';
                } else {
                    $mobile_banner = $mobile_banner_value;
                }
            }
        }
        
        // Enhanced store data
        $store_data = array(
            'vendor_id' => $vendor_id,
            'vendor_display_name' => isset($profile_settings['store_name']) ? $profile_settings['store_name'] : $vendor_data->display_name,
            'vendor_shop_name' => isset($profile_settings['store_name']) ? $profile_settings['store_name'] : '',
            'vendor_shop_logo' => $vendor_shop_logo,
            'vendor_list_logo' => $vendor_list_logo,
            'vendor_banner' => $vendor_banner,
            'mobile_banner' => $mobile_banner,
            'vendor_description' => isset($profile_settings['shop_description']) ? $profile_settings['shop_description'] : '',
            'vendor_address' => isset($profile_settings['address']) ? $profile_settings['address'] : array(),
            'vendor_phone' => isset($profile_settings['phone']) ? $profile_settings['phone'] : '',
            'vendor_email' => $vendor_data->user_email,
            'vendor_rating' => $this->get_vendor_rating($vendor_id),
            'vendor_total_sales' => $this->get_vendor_total_sales($vendor_id),
            'total_products' => $this->get_vendor_product_count($vendor_id),
            'total_categories' => $this->get_vendor_category_count($vendor_id),
            'store_policies' => isset($profile_settings['policies']) ? $profile_settings['policies'] : array(),
            'social_links' => $this->get_vendor_social_links($vendor_id),
            'store_hours' => isset($profile_settings['store_hours']) ? $profile_settings['store_hours'] : array(),
            'featured_products_count' => $this->get_vendor_featured_products_count($vendor_id),
            'recent_products_count' => $this->get_vendor_recent_products_count($vendor_id),
        );
        
        return rest_ensure_response($store_data);
    }
    
    /**
     * Get vendor data from WCFM API
     */
    private function get_wcfm_vendor_data($vendor_id) {
        // Make internal API call to WCFM endpoint
        $url = rest_url('wcfmmp/v1/store-vendors/' . $vendor_id);
        $response = wp_remote_get($url);
        
        if (is_wp_error($response)) {
            return null;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body);
        
        return $data;
    }
    
    /**
     * NEW: Single Category Details with Insights
     */
    public function get_single_category_details($request) {
        $vendor_id = $request['vendor_id'];
        $category_id = $request['category_id'];
        
        // Verify vendor exists
        if (!get_userdata($vendor_id)) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Get category details
        $category = get_term($category_id, 'product_cat');
        if (is_wp_error($category) || !$category) {
            return new WP_Error('category_not_found', 'Category not found', array('status' => 404));
        }
        
        // Get products in this category for this vendor
        $products = $this->get_vendor_products_by_category($vendor_id, $category_id);
        
        // Calculate category insights
        $insights = $this->calculate_category_insights($products, $category_id);
        
        // Get subcategories
        $subcategories = get_terms(array(
            'taxonomy' => 'product_cat',
            'parent' => $category_id,
            'hide_empty' => false,
        ));
        
        // Get related categories (same parent)
        $related_categories = array();
        if ($category->parent) {
            $related_categories = get_terms(array(
                'taxonomy' => 'product_cat',
                'parent' => $category->parent,
                'exclude' => array($category_id),
                'number' => 5,
            ));
        }
        
        // Category image
        $category_image = '';
        $thumbnail_id = get_term_meta($category_id, 'thumbnail_id', true);
        if ($thumbnail_id) {
            $category_image = wp_get_attachment_url($thumbnail_id);
        }
        
        $category_data = array(
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'parent' => $category->parent,
            'count' => count($products),
            'image' => $category_image,
            'insights' => $insights,
            'subcategories' => $this->format_categories($subcategories),
            'related_categories' => $this->format_categories($related_categories),
            'vendor_info' => array(
                'vendor_id' => $vendor_id,
                'vendor_name' => get_user_meta($vendor_id, 'wcfmmp_profile_settings', true)['store_name'] ?? get_userdata($vendor_id)->display_name,
            ),
            'seo' => array(
                'title' => $category->name . ' - ' . (get_user_meta($vendor_id, 'wcfmmp_profile_settings', true)['store_name'] ?? ''),
                'description' => $category->description ?: 'تسوق من مجموعة ' . $category->name . ' عالية الجودة',
                'keywords' => array($category->name, 'spare parts', 'قطع غيار'),
            ),
            'last_updated' => current_time('mysql'),
        );
        
        return rest_ensure_response($category_data);
    }
    
    /**
     * Enhanced Categories with Stats
     */
    public function get_store_categories_with_stats($request) {
        $vendor_id = $request['vendor_id'];
        
        if (!get_userdata($vendor_id)) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Get all products for this vendor
        $products = get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'author' => $vendor_id,
            'post_status' => 'publish'
        ));
        
        $categories_data = array();
        $category_stats = array();
        
        foreach ($products as $product) {
            $product_categories = wp_get_post_terms($product->ID, 'product_cat');
            $product_obj = wc_get_product($product->ID);
            $price = $product_obj ? floatval($product_obj->get_price()) : 0;
            
            foreach ($product_categories as $category) {
                if (!isset($category_stats[$category->term_id])) {
                    // Category image
                    $category_image = '';
                    $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
                    if ($thumbnail_id) {
                        $category_image = wp_get_attachment_url($thumbnail_id);
                    }
                    
                    $category_stats[$category->term_id] = array(
                        'id' => $category->term_id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'description' => $category->description,
                        'parent' => $category->parent,
                        'image' => $category_image,
                        'count' => 0,
                        'total_sales' => 0,
                        'min_price' => PHP_INT_MAX,
                        'max_price' => 0,
                        'avg_price' => 0,
                        'in_stock' => 0,
                        'on_sale' => 0,
                        'featured' => 0,
                        'products' => array(),
                    );
                }
                
                $category_stats[$category->term_id]['count']++;
                $category_stats[$category->term_id]['products'][] = $product->ID;
                
                if ($price > 0) {
                    $category_stats[$category->term_id]['min_price'] = min($category_stats[$category->term_id]['min_price'], $price);
                    $category_stats[$category->term_id]['max_price'] = max($category_stats[$category->term_id]['max_price'], $price);
                }
                
                if ($product_obj) {
                    if ($product_obj->is_in_stock()) {
                        $category_stats[$category->term_id]['in_stock']++;
                    }
                    if ($product_obj->is_on_sale()) {
                        $category_stats[$category->term_id]['on_sale']++;
                    }
                    if ($product_obj->is_featured()) {
                        $category_stats[$category->term_id]['featured']++;
                    }
                    
                    $category_stats[$category->term_id]['total_sales'] += intval($product_obj->get_total_sales());
                }
            }
        }
        
        // Calculate averages and format data
        foreach ($category_stats as &$category) {
            if ($category['min_price'] == PHP_INT_MAX) {
                $category['min_price'] = 0;
            }
            
            $prices = array();
            foreach ($category['products'] as $product_id) {
                $product_obj = wc_get_product($product_id);
                if ($product_obj && $product_obj->get_price() > 0) {
                    $prices[] = floatval($product_obj->get_price());
                }
            }
            
            $category['avg_price'] = !empty($prices) ? array_sum($prices) / count($prices) : 0;
            $category['availability_percentage'] = $category['count'] > 0 ? ($category['in_stock'] / $category['count']) * 100 : 0;
            
            // Remove products array from output (too much data)
            unset($category['products']);
        }
        
        // Sort by count (most popular first)
        uasort($category_stats, function($a, $b) {
            return $b['count'] - $a['count'];
        });
        
        return rest_ensure_response(array(
            'categories' => array_values($category_stats),
            'total' => count($category_stats),
        ));
    }
    
    /**
     * Advanced Product Filtering
     */
    public function get_store_products_advanced($request) {
        $vendor_id = $request['vendor_id'];
        $category = $request->get_param('category');
        $min_price = $request->get_param('min_price');
        $max_price = $request->get_param('max_price');
        $in_stock = $request->get_param('in_stock');
        $on_sale = $request->get_param('on_sale');
        $featured = $request->get_param('featured');
        $sort = $request->get_param('sort') ?: 'date';
        $page = intval($request->get_param('page') ?: 1);
        $per_page = intval($request->get_param('per_page') ?: 24);
        
        if (!get_userdata($vendor_id)) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'author' => $vendor_id,
            'post_status' => 'publish',
        );
        
        // Category filter
        if ($category) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category,
                ),
            );
        }
        
        // Price filter via meta_query
        if ($min_price || $max_price) {
            $args['meta_query'] = array();
            
            if ($min_price) {
                $args['meta_query'][] = array(
                    'key' => '_price',
                    'value' => $min_price,
                    'compare' => '>=',
                    'type' => 'NUMERIC',
                );
            }
            
            if ($max_price) {
                $args['meta_query'][] = array(
                    'key' => '_price',
                    'value' => $max_price,
                    'compare' => '<=',
                    'type' => 'NUMERIC',
                );
            }
        }
        
        // Sort options
        switch ($sort) {
            case 'price':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'ASC';
                break;
            case 'price-desc':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'DESC';
                break;
            case 'popularity':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = 'total_sales';
                $args['order'] = 'DESC';
                break;
            case 'rating':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_wc_average_rating';
                $args['order'] = 'DESC';
                break;
            case 'title':
                $args['orderby'] = 'title';
                $args['order'] = 'ASC';
                break;
            default:
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
        }
        
        $query = new WP_Query($args);
        $products = array();
        
        while ($query->have_posts()) {
            $query->the_post();
            $product_id = get_the_ID();
            $product = wc_get_product($product_id);
            
            if (!$product) continue;
            
            // Apply additional filters
            $skip_product = false;
            
            if ($in_stock && !$product->is_in_stock()) {
                $skip_product = true;
            }
            
            if ($on_sale && !$product->is_on_sale()) {
                $skip_product = true;
            }
            
            if ($featured && !$product->is_featured()) {
                $skip_product = true;
            }
            
            if ($skip_product) continue;
            
            $product_data = $this->format_product_data($product);
            $products[] = $product_data;
        }
        
        wp_reset_postdata();
        
        // Pagination info
        $pagination = array(
            'page' => $page,
            'per_page' => $per_page,
            'total' => $query->found_posts,
            'total_pages' => $query->max_num_pages,
            'has_more' => $page < $query->max_num_pages,
        );
        
        return rest_ensure_response(array(
            'products' => $products,
            'pagination' => $pagination,
            'filters_applied' => array(
                'category' => $category,
                'min_price' => $min_price,
                'max_price' => $max_price,
                'in_stock' => $in_stock,
                'on_sale' => $on_sale,
                'featured' => $featured,
                'sort' => $sort,
            ),
        ));
    }
    
    /**
     * Category Hierarchy (Parent/Child)
     */
    public function get_category_hierarchy($request) {
        $vendor_id = $request['vendor_id'];
        
        if (!get_userdata($vendor_id)) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        $all_categories = $this->get_vendor_categories($vendor_id);
        $hierarchy = $this->build_category_tree($all_categories);
        
        return rest_ensure_response(array(
            'category_tree' => $hierarchy,
            'total_categories' => count($all_categories),
        ));
    }
    
    /**
     * Store Analytics Dashboard
     */
    public function get_store_analytics($request) {
        $vendor_id = $request['vendor_id'];
        
        if (!get_userdata($vendor_id)) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        $analytics = array(
            'overview' => array(
                'total_products' => $this->get_vendor_product_count($vendor_id),
                'total_categories' => $this->get_vendor_category_count($vendor_id),
                'total_sales' => $this->get_vendor_total_sales($vendor_id),
                'average_rating' => $this->get_vendor_rating($vendor_id),
                'products_in_stock' => $this->get_vendor_in_stock_count($vendor_id),
                'featured_products' => $this->get_vendor_featured_products_count($vendor_id),
            ),
            'top_categories' => $this->get_vendor_top_categories($vendor_id, 5),
            'recent_products' => $this->get_vendor_recent_products($vendor_id, 5),
            'popular_products' => $this->get_vendor_popular_products($vendor_id, 5),
            'price_analysis' => $this->get_vendor_price_analysis($vendor_id),
        );
        
        return rest_ensure_response($analytics);
    }
    
    // Include all the helper methods from the original file...
    // (Due to length limits, I'll include the key ones)
    
    private function get_vendor_products_by_category($vendor_id, $category_id) {
        return get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'author' => $vendor_id,
            'post_status' => 'publish',
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category_id,
                ),
            ),
        ));
    }
    
    private function calculate_category_insights($products, $category_id) {
        $insights = array(
            'total_products' => count($products),
            'in_stock' => 0,
            'out_of_stock' => 0,
            'on_sale' => 0,
            'featured' => 0,
            'price_range' => array('min' => PHP_INT_MAX, 'max' => 0, 'avg' => 0),
            'total_sales' => 0,
            'average_rating' => 0,
            'recent_products' => array(),
            'popular_products' => array(),
        );
        
        if (empty($products)) {
            $insights['price_range'] = array('min' => 0, 'max' => 0, 'avg' => 0);
            return $insights;
        }
        
        $prices = array();
        $ratings = array();
        $sales_data = array();
        
        foreach ($products as $post) {
            $product = wc_get_product($post->ID);
            if (!$product) continue;
            
            // Stock status
            if ($product->is_in_stock()) {
                $insights['in_stock']++;
            } else {
                $insights['out_of_stock']++;
            }
            
            // Sale status
            if ($product->is_on_sale()) {
                $insights['on_sale']++;
            }
            
            // Featured status
            if ($product->is_featured()) {
                $insights['featured']++;
            }
            
            // Price data
            $price = floatval($product->get_price());
            if ($price > 0) {
                $prices[] = $price;
                $insights['price_range']['min'] = min($insights['price_range']['min'], $price);
                $insights['price_range']['max'] = max($insights['price_range']['max'], $price);
            }
            
            // Sales data
            $total_sales = intval($product->get_total_sales());
            $insights['total_sales'] += $total_sales;
            $sales_data[] = array('id' => $post->ID, 'sales' => $total_sales);
            
            // Rating data
            $rating = floatval($product->get_average_rating());
            if ($rating > 0) {
                $ratings[] = $rating;
            }
        }
        
        // Calculate averages
        if (!empty($prices)) {
            $insights['price_range']['avg'] = array_sum($prices) / count($prices);
        } else {
            $insights['price_range'] = array('min' => 0, 'max' => 0, 'avg' => 0);
        }
        
        if (!empty($ratings)) {
            $insights['average_rating'] = array_sum($ratings) / count($ratings);
        }
        
        // Get top products by sales
        usort($sales_data, function($a, $b) { return $b['sales'] - $a['sales']; });
        $insights['popular_products'] = array_slice($sales_data, 0, 5);
        
        // Get recent products
        $recent_posts = array_slice($products, 0, 5);
        foreach ($recent_posts as $post) {
            $insights['recent_products'][] = $post->ID;
        }
        
        return $insights;
    }
    
    private function format_categories($categories) {
        $formatted = array();
        
        foreach ($categories as $category) {
            $category_image = '';
            $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
            if ($thumbnail_id) {
                $category_image = wp_get_attachment_url($thumbnail_id);
            }
            
            $formatted[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => $category->description,
                'count' => $category->count,
                'parent' => $category->parent,
                'image' => $category_image,
            );
        }
        
        return $formatted;
    }
    
    private function format_product_data($product, $vendor_id = null) {
        $categories = array();
        $product_categories = wp_get_post_terms($product->get_id(), 'product_cat');
        
        foreach ($product_categories as $category) {
            $categories[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
            );
        }
        
        $images = array();
        $attachment_ids = $product->get_gallery_image_ids();
        array_unshift($attachment_ids, $product->get_image_id());
        
        foreach ($attachment_ids as $attachment_id) {
            if ($attachment_id) {
                $images[] = array(
                    'id' => $attachment_id,
                    'src' => wp_get_attachment_url($attachment_id),
                    'thumbnail' => wp_get_attachment_image_url($attachment_id, 'thumbnail'),
                );
            }
        }
        
        // Get product attributes (for variable products)
        $attributes = array();
        $product_attributes = $product->get_attributes();
        foreach ($product_attributes as $attribute) {
            if (is_a($attribute, 'WC_Product_Attribute')) {
                $attributes[] = array(
                    'id' => $attribute->get_id(),
                    'name' => wc_attribute_label($attribute->get_name()),
                    'slug' => $attribute->get_name(),
                    'position' => $attribute->get_position(),
                    'visible' => $attribute->get_visible(),
                    'variation' => $attribute->get_variation(),
                    'options' => $attribute->get_options(),
                );
            }
        }
        
        // Get variation IDs (for variable products)
        $variations = array();
        if ($product->is_type('variable')) {
            $variations = $product->get_children(); // Returns array of variation IDs
        }
        
        $formatted_data = array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'type' => $product->get_type(), // simple, variable, grouped, external
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'price_html' => $product->get_price_html(), // "200 - 500 جنيه" for variable
            'on_sale' => $product->is_on_sale(),
            'stock_status' => $product->get_stock_status(),
            'in_stock' => $product->is_in_stock(),
            'featured' => $product->is_featured(),
            'categories' => $categories,
            'images' => $images,
            'attributes' => $attributes,
            'variations' => $variations, // Array of variation IDs
            'has_options' => !empty($attributes) && $product->is_type('variable'),
            'rating' => $product->get_average_rating(),
            'rating_count' => $product->get_rating_count(),
            'total_sales' => $product->get_total_sales(),
            'date_created' => $product->get_date_created()->date('Y-m-d H:i:s'),
        );
        
        // Add vendor info if vendor_id is provided
        if ($vendor_id) {
            $vendor_data = get_userdata($vendor_id);
            if ($vendor_data) {
                $formatted_data['vendor'] = array(
                    'id' => $vendor_id,
                    'name' => $vendor_data->display_name,
                    'shop_name' => get_user_meta($vendor_id, 'wcfmmp_profile_settings', true)['store_name'] ?? $vendor_data->display_name,
                );
            }
        }
        
        return $formatted_data;
    }
    
    // Additional helper methods...
    private function get_vendor_rating($vendor_id) {
        return 0; // Placeholder - implement rating calculation
    }
    
    private function get_vendor_total_sales($vendor_id) {
        return 0; // Placeholder - implement sales calculation
    }
    
    private function get_vendor_product_count($vendor_id) {
        return count(get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish'
        )));
    }
    
    private function get_vendor_category_count($vendor_id) {
        $products = get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish'
        ));
        
        $categories = array();
        foreach ($products as $product) {
            $product_categories = wp_get_post_terms($product->ID, 'product_cat');
            foreach ($product_categories as $category) {
                $categories[$category->term_id] = true;
            }
        }
        
        return count($categories);
    }
    
    private function get_vendor_social_links($vendor_id) {
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        return $profile_settings['social'] ?? array();
    }
    
    private function get_vendor_featured_products_count($vendor_id) {
        return count(get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'meta_query' => array(
                array(
                    'key' => '_featured',
                    'value' => 'yes',
                ),
            ),
        )));
    }
    
    private function get_vendor_recent_products_count($vendor_id, $days = 30) {
        return count(get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'date_query' => array(
                array(
                    'after' => $days . ' days ago',
                ),
            ),
        )));
    }
    
    private function get_vendor_categories($vendor_id) {
        $products = get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish'
        ));
        
        $categories = array();
        foreach ($products as $product) {
            $product_categories = wp_get_post_terms($product->ID, 'product_cat');
            foreach ($product_categories as $category) {
                if (!isset($categories[$category->term_id])) {
                    $categories[$category->term_id] = $category;
                }
            }
        }
        
        return array_values($categories);
    }
    
    private function build_category_tree($categories) {
        $tree = array();
        $lookup = array();
        
        // First, create a lookup array
        foreach ($categories as $category) {
            $lookup[$category->term_id] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'parent' => $category->parent,
                'children' => array(),
            );
        }
        
        // Build the tree
        foreach ($lookup as $id => $category) {
            if ($category['parent'] == 0) {
                $tree[$id] = &$lookup[$id];
            } else {
                if (isset($lookup[$category['parent']])) {
                    $lookup[$category['parent']]['children'][$id] = &$lookup[$id];
                }
            }
        }
        
        return array_values($tree);
    }
    
    private function get_vendor_in_stock_count($vendor_id) {
        return count(get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'meta_query' => array(
                array(
                    'key' => '_stock_status',
                    'value' => 'instock',
                ),
            ),
        )));
    }
    
    private function get_vendor_top_categories($vendor_id, $limit = 5) {
        return array(); // Placeholder
    }
    
    private function get_vendor_recent_products($vendor_id, $limit = 5) {
        $products = get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => $limit,
            'post_status' => 'publish',
            'orderby' => 'date',
            'order' => 'DESC'
        ));
        
        $formatted_products = array();
        foreach ($products as $post) {
            $product = wc_get_product($post->ID);
            if ($product) {
                $formatted_products[] = $this->format_product_data($product);
            }
        }
        
        return $formatted_products;
    }
    
    private function get_vendor_popular_products($vendor_id, $limit = 5) {
        $products = get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => $limit,
            'post_status' => 'publish',
            'orderby' => 'meta_value_num',
            'meta_key' => 'total_sales',
            'order' => 'DESC'
        ));
        
        $formatted_products = array();
        foreach ($products as $post) {
            $product = wc_get_product($post->ID);
            if ($product) {
                $formatted_products[] = $this->format_product_data($product);
            }
        }
        
        return $formatted_products;
    }
    
    private function get_vendor_price_analysis($vendor_id) {
        $products = get_posts(array(
            'post_type' => 'product',
            'author' => $vendor_id,
            'posts_per_page' => -1,
            'post_status' => 'publish'
        ));
        
        $prices = array();
        foreach ($products as $post) {
            $product = wc_get_product($post->ID);
            if ($product && $product->get_price() > 0) {
                $prices[] = floatval($product->get_price());
            }
        }
        
        if (empty($prices)) {
            return array('min' => 0, 'max' => 0, 'avg' => 0, 'median' => 0);
        }
        
        sort($prices);
        $count = count($prices);
        
        return array(
            'min' => min($prices),
            'max' => max($prices),
            'avg' => array_sum($prices) / $count,
            'median' => $count % 2 ? $prices[intval($count/2)] : ($prices[intval($count/2) - 1] + $prices[intval($count/2)]) / 2,
        );
    }
    
    /**
     * Get all tags used in products of a specific category
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function get_category_tags($request) {
        $category_id = $request['category_id'];
        
        // Verify category exists
        $category = get_term($category_id, 'product_cat');
        if (is_wp_error($category) || !$category) {
            return new WP_Error('category_not_found', 'Category not found', array('status' => 404));
        }
        
        // Get all products in this category
        $products = get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category_id,
                    'include_children' => false,
                ),
            ),
        ));
        
        $tags_map = array();
        
        // Collect all tags from products
        foreach ($products as $product_post) {
            $product_tags = wp_get_post_terms($product_post->ID, 'product_tag');
            
            foreach ($product_tags as $tag) {
                if (!isset($tags_map[$tag->term_id])) {
                    $tags_map[$tag->term_id] = array(
                        'id' => $tag->term_id,
                        'name' => $tag->name,
                        'slug' => $tag->slug,
                        'description' => $tag->description,
                        'count' => 0,
                    );
                }
                $tags_map[$tag->term_id]['count']++;
            }
        }
        
        // Sort by count (most used first)
        uasort($tags_map, function($a, $b) {
            return $b['count'] - $a['count'];
        });
        
        $tags = array_values($tags_map);
        
        return rest_ensure_response(array(
            'category_id' => (int) $category_id,
            'category_name' => $category->name,
            'category_slug' => $category->slug,
            'tags' => $tags,
            'total_tags' => count($tags),
            'total_products' => count($products),
        ));
    }
    
    /**
     * Get all tags used in a specific category within a store
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function get_store_category_tags($request) {
        $vendor_id = $request['vendor_id'];
        $category_id = $request['category_id'];
        
        // Verify vendor exists
        $vendor_data = get_userdata($vendor_id);
        if (!$vendor_data) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Verify category exists
        $category = get_term($category_id, 'product_cat');
        if (is_wp_error($category) || !$category) {
            return new WP_Error('category_not_found', 'Category not found', array('status' => 404));
        }
        
        // Get all products in this category for this vendor
        $products = get_posts(array(
            'post_type' => 'product',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'author' => $vendor_id,
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category_id,
                    'include_children' => false,
                ),
            ),
        ));
        
        $tags_map = array();
        
        // Collect all tags from products
        foreach ($products as $product_post) {
            $product_tags = wp_get_post_terms($product_post->ID, 'product_tag');
            
            foreach ($product_tags as $tag) {
                if (!isset($tags_map[$tag->term_id])) {
                    $tags_map[$tag->term_id] = array(
                        'id' => $tag->term_id,
                        'name' => $tag->name,
                        'slug' => $tag->slug,
                        'description' => $tag->description,
                        'count' => 0,
                    );
                }
                $tags_map[$tag->term_id]['count']++;
            }
        }
        
        // Sort by count (most used first)
        uasort($tags_map, function($a, $b) {
            return $b['count'] - $a['count'];
        });
        
        $tags = array_values($tags_map);
        
        return rest_ensure_response(array(
            'vendor_id' => (int) $vendor_id,
            'category_id' => (int) $category_id,
            'category_name' => $category->name,
            'category_slug' => $category->slug,
            'tags' => $tags,
            'total_tags' => count($tags),
            'total_products' => count($products),
        ));
    }
    
    /**
     * Get all products with a specific tag in a store
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function get_store_tag_products($request) {
        $vendor_id = $request['vendor_id'];
        $tag_slug = urldecode($request['tag_slug']);
        
        // Verify vendor exists
        $vendor_data = get_userdata($vendor_id);
        if (!$vendor_data) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Verify tag exists
        $tag = get_term_by('slug', $tag_slug, 'product_tag');
        if (!$tag) {
            return new WP_Error('tag_not_found', 'Tag not found', array('status' => 404));
        }
        
        // Get pagination parameters
        $page = max(1, $request->get_param('page') ?: 1);
        $per_page = max(1, min(100, $request->get_param('per_page') ?: 12));
        
        // Get products with this tag from this vendor
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish',
            'author' => $vendor_id,
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_tag',
                    'field' => 'slug',
                    'terms' => $tag_slug,
                ),
            ),
        );
        
        // Add sorting
        $sort = $request->get_param('sort');
        switch ($sort) {
            case 'price':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'ASC';
                break;
            case 'price-desc':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'DESC';
                break;
            case 'popularity':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = 'total_sales';
                $args['order'] = 'DESC';
                break;
            case 'rating':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_wc_average_rating';
                $args['order'] = 'DESC';
                break;
            default:
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
        }
        
        $query = new WP_Query($args);
        $products = array();
        
        foreach ($query->posts as $product_post) {
            $product = wc_get_product($product_post->ID);
            if ($product) {
                $products[] = $this->format_product_data($product, $vendor_id);
            }
        }
        
        return rest_ensure_response(array(
            'vendor_id' => (int) $vendor_id,
            'tag_id' => $tag->term_id,
            'tag_name' => $tag->name,
            'tag_slug' => $tag->slug,
            'products' => $products,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $query->found_posts,
                'total_pages' => $query->max_num_pages,
                'has_more' => $page < $query->max_num_pages,
            ),
        ));
    }
    
    /**
     * Get products with specific tag in specific category in store
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function get_store_category_tag_products($request) {
        $vendor_id = $request['vendor_id'];
        $category_id = $request['category_id'];
        $tag_slug = urldecode($request['tag_slug']);
        
        // Verify vendor exists
        $vendor_data = get_userdata($vendor_id);
        if (!$vendor_data) {
            return new WP_Error('vendor_not_found', 'Vendor not found', array('status' => 404));
        }
        
        // Verify category exists
        $category = get_term($category_id, 'product_cat');
        if (is_wp_error($category) || !$category) {
            return new WP_Error('category_not_found', 'Category not found', array('status' => 404));
        }
        
        // Verify tag exists
        $tag = get_term_by('slug', $tag_slug, 'product_tag');
        if (!$tag) {
            return new WP_Error('tag_not_found', 'Tag not found', array('status' => 404));
        }
        
        // Get pagination parameters
        $page = max(1, $request->get_param('page') ?: 1);
        $per_page = max(1, min(100, $request->get_param('per_page') ?: 12));
        
        // Get products with this tag and category from this vendor
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'post_status' => 'publish',
            'author' => $vendor_id,
            'tax_query' => array(
                'relation' => 'AND',
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category_id,
                    'include_children' => false,
                ),
                array(
                    'taxonomy' => 'product_tag',
                    'field' => 'slug',
                    'terms' => $tag_slug,
                ),
            ),
        );
        
        // Add sorting
        $sort = $request->get_param('sort');
        switch ($sort) {
            case 'price':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'ASC';
                break;
            case 'price-desc':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_price';
                $args['order'] = 'DESC';
                break;
            case 'popularity':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = 'total_sales';
                $args['order'] = 'DESC';
                break;
            case 'rating':
                $args['orderby'] = 'meta_value_num';
                $args['meta_key'] = '_wc_average_rating';
                $args['order'] = 'DESC';
                break;
            default:
                $args['orderby'] = 'date';
                $args['order'] = 'DESC';
        }
        
        $query = new WP_Query($args);
        $products = array();
        
        foreach ($query->posts as $product_post) {
            $product = wc_get_product($product_post->ID);
            if ($product) {
                $products[] = $this->format_product_data($product, $vendor_id);
            }
        }
        
        return rest_ensure_response(array(
            'vendor_id' => (int) $vendor_id,
            'category_id' => (int) $category_id,
            'category_name' => $category->name,
            'category_slug' => $category->slug,
            'tag_id' => $tag->term_id,
            'tag_name' => $tag->name,
            'tag_slug' => $tag->slug,
            'products' => $products,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $query->found_posts,
                'total_pages' => $query->max_num_pages,
                'has_more' => $page < $query->max_num_pages,
            ),
        ));
    }
}
