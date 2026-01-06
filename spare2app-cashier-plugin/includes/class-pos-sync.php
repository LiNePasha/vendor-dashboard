<?php
/**
 * POS Sync Class - Smart product synchronization
 * 
 * Handles initial sync, delta updates, and optimized queries
 * 
 * @package Spare2App_Cashier
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_POS_Sync {
    
    /**
     * Get initial full sync data
     * 
     * Returns all products with smart caching
     */
    public function get_pos_initial($request) {
        $vendor_id = $request['vendor_id'];
        $all = $request->get_param('all') === 'true' || $request->get_param('all') === '1';
        $page = $request->get_param('page') ?: 1;
        $per_page = $request->get_param('per_page') ?: 100;
        $force = $request->get_param('force') === '1' || $request->get_param('force') === 'true';
        
        // 🚀 إذا كان all=true، نرجع كل المنتجات مرة واحدة
        if ($all) {
            return $this->get_all_products_sync($vendor_id);
        }
        
        // Ensure per_page doesn't exceed limit
        $per_page = min($per_page, 100);
        
        // Try cache first (5 minutes TTL)
        $cache_key = "cashier_full_sync_{$vendor_id}_p{$page}";
        
        if ($force) {
            delete_transient($cache_key);
            error_log("⚡ FORCE REFRESH - Deleted cache for vendor {$vendor_id} page {$page}");
        }
        
        $cached = get_transient($cache_key);
        
        if ($cached !== false && !$force) {
            error_log("✅ Cache HIT for vendor {$vendor_id} page {$page}");
            return rest_ensure_response($cached);
        }
        
        error_log("⚙️ Cache MISS for vendor {$vendor_id} page {$page} - Fetching from DB");
        
        // Fetch products
        $products = $this->fetch_products_optimized($vendor_id, $page, $per_page);
        $total_products = $this->get_total_products_count($vendor_id);
        $total_pages = ceil($total_products / $per_page);
        
        // Fetch categories (only on first page)
        $categories = array();
        if ($page === 1) {
            $categories = $this->fetch_categories($vendor_id);
        }
        
        // Build response
        $response = array(
            'products' => $products,
            'categories' => $categories,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total_products' => $total_products,
                'total_pages' => $total_pages,
                'has_more' => $page < $total_pages
            ),
            'metadata' => array(
                'sync_timestamp' => current_time('Y-m-d\TH:i:s\Z', true),
                'vendor_id' => $vendor_id,
                'hash' => md5(json_encode($products)), // للتحقق من التغييرات
                'cache' => false
            )
        );
        
        // Cache for 30 seconds only (for testing)
        set_transient($cache_key, $response, 30);
        
        return rest_ensure_response($response);
    }
    
    /**
     * Get delta changes since timestamp
     */
    public function get_pos_changes($request) {
        $vendor_id = $request['vendor_id'];
        $since = $request['since'];
        
        global $wpdb;
        $changes_table = $wpdb->prefix . 'cashier_changes';
        
        // Get all changes since timestamp
        $changes = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $changes_table 
             WHERE vendor_id = %d 
             AND changed_at > %s 
             ORDER BY changed_at ASC
             LIMIT 200",
            $vendor_id,
            date('Y-m-d H:i:s', strtotime($since))
        ));
        
        $updates = array();
        
        foreach ($changes as $change) {
            $product_data = null;
            
            if ($change->change_type === 'updated' || $change->change_type === 'created') {
                // Fetch updated product data
                $product_data = $this->fetch_single_product($change->product_id);
            }
            
            $updates[] = array(
                'id' => $change->product_id,
                'type' => 'product_' . $change->change_type,
                'action' => $change->change_type, // 'updated', 'deleted', 'created'
                'data' => $product_data,
                'timestamp' => $change->changed_at
            );
        }
        
        return rest_ensure_response(array(
            'updates' => $updates,
            'metadata' => array(
                'changes_count' => count($updates),
                'sync_timestamp' => current_time('Y-m-d\TH:i:s\Z', true),
                'vendor_id' => $vendor_id
            )
        ));
    }
    
    /**
     * Get single product
     */
    public function get_single_product($request) {
        $product_id = $request['product_id'];
        
        $product = $this->fetch_single_product($product_id);
        
        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found', array('status' => 404));
        }
        
        return rest_ensure_response(array(
            'product' => $product,
            'timestamp' => current_time('Y-m-d\TH:i:s\Z', true)
        ));
    }
    
    /**
     * Get categories
     */
    public function get_categories($request) {
        $vendor_id = $request['vendor_id'];
        
        // Try cache
        $cache_key = "cashier_categories_{$vendor_id}";
        $cached = get_transient($cache_key);
        
        if ($cached !== false) {
            return rest_ensure_response($cached);
        }
        
        $categories = $this->fetch_categories($vendor_id);
        
        $response = array(
            'categories' => $categories,
            'total' => count($categories),
            'timestamp' => current_time('Y-m-d\TH:i:s\Z', true)
        );
        
        // Cache for 10 minutes
        set_transient($cache_key, $response, 600);
        
        return rest_ensure_response($response);
    }
    
    /**
     * Fetch products with optimized query
     */
    private function fetch_products_optimized($vendor_id, $page = 1, $per_page = 100) {
        // Use WP_Query instead of direct SQL for better compatibility
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'author' => $vendor_id,
            'post_status' => 'publish',
            'orderby' => 'modified',
            'order' => 'DESC',
        );
        
        $query = new WP_Query($args);
        $products = array();
        
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $product_id = get_the_ID();
                $product_obj = wc_get_product($product_id);
                
                if (!$product_obj) {
                    continue;
                }
                
                $product_type = $product_obj->get_type();
                
                // Get images array
                $images = array();
                $image_id = $product_obj->get_image_id();
                if ($image_id) {
                    $image_url = wp_get_attachment_url($image_id);
                    if ($image_url) {
                        $images[] = array('src' => $image_url);
                    }
                }
                
                // Add gallery images
                $gallery_ids = $product_obj->get_gallery_image_ids();
                if ($gallery_ids) {
                    foreach ($gallery_ids as $img_id) {
                        $img_url = wp_get_attachment_url($img_id);
                        if ($img_url) {
                            $images[] = array('src' => $img_url);
                        }
                    }
                }
                
                $product = array(
                    'id' => $product_id,
                    'name' => $product_obj->get_name(),
                    'price' => $product_obj->get_price() ?: '0',
                    'regular_price' => $product_obj->get_regular_price() ?: '',
                    'sale_price' => $product_obj->get_sale_price() ?: '',
                    'stock_quantity' => $product_obj->get_stock_quantity() ?: 0,
                    'manage_stock' => $product_obj->get_manage_stock(),
                    'stock_status' => $product_obj->get_stock_status(),
                    'in_stock' => $product_obj->is_in_stock(),
                    'sku' => $product_obj->get_sku() ?: '',
                    'type' => $product_type,
                    'images' => $images,
                    'categories' => $this->get_product_categories($product_id),
                    'last_modified' => $product_obj->get_date_modified() ? $product_obj->get_date_modified()->date('Y-m-d H:i:s') : null,
                    'test' => 'ahmed',
                );
                
                // Get attributes & variations for variable products
                if ($product_type === 'variable') {
                    $product['attributes'] = $this->get_product_attributes($product_id);
                    $product['variations'] = $this->get_product_variations($product_id);
                    error_log("✅ [WP_Query] Added attributes & variations for variable product ID: {$product_id}");
                } else {
                    $product['attributes'] = array();
                    $product['variations'] = array();
                }
                
                $products[] = $product;
            }
            
            wp_reset_postdata();
        }
        
        return $products;
    }
    
    /**
     * Fetch single product
     */
    private function fetch_single_product($product_id) {
        $product_obj = wc_get_product($product_id);
        
        if (!$product_obj) {
            return null;
        }
        
        // 🖼️ Get images array
        $images = array();
        $image_id = $product_obj->get_image_id();
        if ($image_id) {
            $image_url = wp_get_attachment_url($image_id);
            if ($image_url) {
                $images[] = array('src' => $image_url);
            }
        }
        
        // Add gallery images
        $gallery_ids = $product_obj->get_gallery_image_ids();
        if ($gallery_ids) {
            foreach ($gallery_ids as $img_id) {
                $img_url = wp_get_attachment_url($img_id);
                if ($img_url) {
                    $images[] = array('src' => $img_url);
                }
            }
        }
        
        $product_type = $product_obj->get_type();
        
        $product_data = array(
            'id' => $product_obj->get_id(),
            'name' => $product_obj->get_name(),
            'price' => $product_obj->get_price(),
            'regular_price' => $product_obj->get_regular_price(),
            'sale_price' => $product_obj->get_sale_price(),
            'stock_quantity' => $product_obj->get_stock_quantity() ?: 0,
            'manage_stock' => $product_obj->get_manage_stock(),
            'stock_status' => $product_obj->get_stock_status(),
            'in_stock' => $product_obj->is_in_stock(),
            'sku' => $product_obj->get_sku(),
            'type' => $product_type,
            'images' => $images,
            'categories' => $this->get_product_categories($product_obj->get_id()),
            'last_modified' => $product_obj->get_date_modified() ? $product_obj->get_date_modified()->date('Y-m-d H:i:s') : null,
            'test' => 'ahmed'
        );
        
        // 🔧 Get attributes & variations for variable products
        if ($product_type === 'variable') {
            $product_data['attributes'] = $this->get_product_attributes($product_obj->get_id());
            $product_data['variations'] = $this->get_product_variations($product_obj->get_id());
            error_log("✅ Added attributes & variations for variable product ID: {$product_obj->get_id()}");
        } else {
            // للمنتجات البسيطة، نضيف arrays فاضية للتناسق
            $product_data['attributes'] = array();
            $product_data['variations'] = array();
        }
        
        return $product_data;
    }
    
    /**
     * Get product categories
     */
    private function get_product_categories($product_id) {
        $terms = get_the_terms($product_id, 'product_cat');
        
        if (!$terms || is_wp_error($terms)) {
            return array();
        }
        
        $categories = array();
        foreach ($terms as $term) {
            $categories[] = array(
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug
            );
        }
        
        return $categories;
    }
    
    /**
     * Fetch categories
     */
    private function fetch_categories($vendor_id) {
        // Get all product IDs for this vendor
        global $wpdb;
        $product_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} 
             WHERE post_author = %d 
             AND post_type = 'product' 
             AND post_status = 'publish'",
            $vendor_id
        ));
        
        if (empty($product_ids)) {
            return array();
        }
        
        // Get all categories used by these products
        $categories = array();
        $terms = wp_get_object_terms($product_ids, 'product_cat');
        
        if (!is_wp_error($terms)) {
            foreach ($terms as $term) {
                $thumbnail_id = get_term_meta($term->term_id, 'thumbnail_id', true);
                $image_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : null;
                
                // ✅ Count products in this category for THIS VENDOR ONLY
                $count = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(DISTINCT p.ID) 
                     FROM {$wpdb->posts} p
                     INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
                     INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                     WHERE p.post_author = %d 
                     AND p.post_type = 'product' 
                     AND p.post_status = 'publish'
                     AND tt.term_id = %d",
                    $vendor_id,
                    $term->term_id
                ));
                
                $categories[] = array(
                    'id' => $term->term_id,
                    'name' => $term->name,
                    'slug' => $term->slug,
                    'count' => (int) $count, // ✅ العدد الصحيح للـvendor بس
                    'parent' => $term->parent,
                    'image' => $image_url
                );
            }
        }
        
        return $categories;
    }
    
    /**
     * Get total products count
     */
    private function get_total_products_count($vendor_id) {
        global $wpdb;
        
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} 
             WHERE post_author = %d 
             AND post_type = 'product' 
             AND post_status = 'publish'",
            $vendor_id
        ));
    }
    
    /**
     * 🚀 Get ALL products at once (no pagination)
     * 
     * Used for initial full sync - returns everything in one request
     */
    private function get_all_products_sync($vendor_id) {
        // 🔄 Check for force parameter to skip cache
        $force = isset($_GET['force']) && $_GET['force'] === '1';
        
        // Try cache first (10 minutes TTL for full sync)
        $cache_key = "cashier_full_sync_all_{$vendor_id}";
        
        if ($force) {
            error_log("⚡ FORCE REFRESH - Deleting cache for vendor {$vendor_id}");
            delete_transient($cache_key);
        }
        
        $cached = get_transient($cache_key);
        
        if ($cached !== false && !$force) {
            error_log("✅ FULL SYNC Cache HIT for vendor {$vendor_id}");
            return rest_ensure_response($cached);
        }
        
        error_log("⚙️ FULL SYNC Cache MISS for vendor {$vendor_id} - Fetching ALL products");
        
        $start_time = microtime(true);
        
        // Fetch ALL products at once
        $products = $this->fetch_all_products_no_limit($vendor_id);
        $categories = $this->fetch_categories($vendor_id);
        
        $total_products = count($products);
        $elapsed = round((microtime(true) - $start_time) * 1000, 2);
        
        error_log("✅ Fetched {$total_products} products in {$elapsed}ms");
        
        // Build response
        $response = array(
            'products' => $products,
            'categories' => $categories,
            'pagination' => array(
                'page' => 1,
                'per_page' => $total_products,
                'total_products' => $total_products,
                'total_pages' => 1,
                'has_more' => false,
                'all_loaded' => true
            ),
            'metadata' => array(
                'sync_timestamp' => current_time('Y-m-d\TH:i:s\Z', true),
                'vendor_id' => $vendor_id,
                'hash' => md5(json_encode($products)),
                'cache' => false,
                'load_time_ms' => $elapsed,
                'full_sync' => true
            )
        );
        
        // Cache for 30 seconds only (for testing)
        set_transient($cache_key, $response, 30);
        
        return rest_ensure_response($response);
    }
    
    /**
     * Fetch ALL products without limit
     */
    private function fetch_all_products_no_limit($vendor_id) {
        // Use WP_Query for better compatibility
        $args = array(
            'post_type' => 'product',
            'posts_per_page' => -1, // Get all products
            'author' => $vendor_id,
            'post_status' => 'publish',
            'orderby' => 'modified',
            'order' => 'DESC',
        );
        
        $query = new WP_Query($args);
        $products = array();
        
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $product_id = get_the_ID();
                $product_obj = wc_get_product($product_id);
                
                if (!$product_obj) {
                    continue;
                }
                
                $product_type = $product_obj->get_type();
                
                // Get images array
                $images = array();
                $image_id = $product_obj->get_image_id();
                if ($image_id) {
                    $image_url = wp_get_attachment_url($image_id);
                    if ($image_url) {
                        $images[] = array('src' => $image_url);
                    }
                }
                
                // Add gallery images
                $gallery_ids = $product_obj->get_gallery_image_ids();
                if ($gallery_ids) {
                    foreach ($gallery_ids as $img_id) {
                        $img_url = wp_get_attachment_url($img_id);
                        if ($img_url) {
                            $images[] = array('src' => $img_url);
                        }
                    }
                }
                
                $product = array(
                    'id' => $product_id,
                    'name' => $product_obj->get_name(),
                    'price' => $product_obj->get_price() ?: '0',
                    'regular_price' => $product_obj->get_regular_price() ?: '',
                    'sale_price' => $product_obj->get_sale_price() ?: '',
                    'stock_quantity' => $product_obj->get_stock_quantity() ?: 0,
                    'manage_stock' => $product_obj->get_manage_stock(),
                    'stock_status' => $product_obj->get_stock_status(),
                    'in_stock' => $product_obj->is_in_stock(),
                    'sku' => $product_obj->get_sku() ?: '',
                    'type' => $product_type,
                    'images' => $images,
                    'categories' => $this->get_product_categories($product_id),
                    'last_modified' => $product_obj->get_date_modified() ? $product_obj->get_date_modified()->date('Y-m-d H:i:s') : null,
                    'test' => 'ahmed',
                );
                
                // Get attributes & variations for variable products
                if ($product_type === 'variable') {
                    $product['attributes'] = $this->get_product_attributes($product_id);
                    $product['variations'] = $this->get_product_variations($product_id);
                    error_log("✅ [WP_Query ALL] Added attributes & variations for variable product ID: {$product_id}");
                } else {
                    $product['attributes'] = array();
                    $product['variations'] = array();
                }
                
                $products[] = $product;
            }
            
            wp_reset_postdata();
        }
        
        return $products;
    }
    
    /**
     * Get product attributes (for variable products)
     */
    private function get_product_attributes($product_id) {
        $product_obj = wc_get_product($product_id);
        
        if (!$product_obj || $product_obj->get_type() !== 'variable') {
            return array();
        }
        
        $attributes = array();
        $product_attributes = $product_obj->get_attributes();
        
        foreach ($product_attributes as $attribute) {
            // فقط نتعامل مع WC_Product_Attribute objects
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
        
        return $attributes;
    }
    
    /**
     * Get product variations (for variable products)
     */
    private function get_product_variations($product_id) {
        $product_obj = wc_get_product($product_id);
        
        if (!$product_obj || $product_obj->get_type() !== 'variable') {
            return array();
        }
        
        $variations = array();
        $variation_ids = $product_obj->get_children();
        
        foreach ($variation_ids as $variation_id) {
            $variation_obj = wc_get_product($variation_id);
            
            if (!$variation_obj) {
                continue;
            }
            
            // Get variation image
            $variation_images = array();
            $variation_image_id = $variation_obj->get_image_id();
            if ($variation_image_id) {
                $image_url = wp_get_attachment_url($variation_image_id);
                if ($image_url) {
                    $variation_images[] = array('src' => $image_url);
                }
            }
            
            $variations[] = array(
                'id' => $variation_obj->get_id(),
                'sku' => $variation_obj->get_sku(),
                'price' => $variation_obj->get_price(),
                'regular_price' => $variation_obj->get_regular_price(),
                'sale_price' => $variation_obj->get_sale_price(),
                'stock_quantity' => $variation_obj->get_stock_quantity() ?: 0,
                'stock_status' => $variation_obj->get_stock_status(),
                'in_stock' => $variation_obj->is_in_stock(),
                'manage_stock' => $variation_obj->get_manage_stock(),
                'attributes' => $variation_obj->get_variation_attributes(),
                'images' => $variation_images,
            );
        }
        
        return $variations;
    }
}
