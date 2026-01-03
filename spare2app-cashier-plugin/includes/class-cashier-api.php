<?php
/**
 * Main Cashier API Class
 * 
 * Registers REST API endpoints for ultra-fast POS operations
 * 
 * @package Spare2App_Cashier
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Cashier_API {
    
    private $sync;
    private $tracker;
    private $stream;
    
    public function __construct() {
        // Initialize dependencies
        $this->sync = new Spare2App_POS_Sync();
        $this->tracker = new Spare2App_Changes_Tracker();
        $this->stream = new Spare2App_Stream_Handler();
        
        // Register REST routes
        add_action('rest_api_init', array($this, 'register_routes'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        $namespace = 'cashier/v1';
        
        // 1️⃣ Initial Full Sync - تحميل كل المنتجات مرة واحدة
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/pos-initial', array(
            'methods' => 'GET',
            'callback' => array($this->sync, 'get_pos_initial'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'vendor_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ),
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint'
                ),
                'per_page' => array(
                    'default' => 100,
                    'sanitize_callback' => 'absint'
                )
            )
        ));
        
        // 2️⃣ Delta Sync - جلب التغييرات فقط
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/pos-changes', array(
            'methods' => 'GET',
            'callback' => array($this->sync, 'get_pos_changes'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'vendor_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                ),
                'since' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return strtotime($param) !== false;
                    }
                )
            )
        ));
        
        // 3️⃣ Single Product - جلب منتج واحد محدث
        register_rest_route($namespace, '/product/(?P<product_id>\d+)', array(
            'methods' => 'GET',
            'callback' => array($this->sync, 'get_single_product'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'product_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // 4️⃣ Real-time Stream - Server-Sent Events
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/pos-stream', array(
            'methods' => 'GET',
            'callback' => array($this->stream, 'start_stream'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'vendor_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // 5️⃣ Categories - جلب الكاتجوريز
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/categories', array(
            'methods' => 'GET',
            'callback' => array($this->sync, 'get_categories'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'vendor_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
        
        // 6️⃣ Stats - إحصائيات للمراقبة
        register_rest_route($namespace, '/store/(?P<vendor_id>\d+)/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_stats'),
            'permission_callback' => array($this, 'check_permission'),
            'args' => array(
                'vendor_id' => array(
                    'required' => true,
                    'validate_callback' => function($param) {
                        return is_numeric($param);
                    }
                )
            )
        ));
    }
    
    /**
     * Check permissions
     */
    public function check_permission($request) {
        // Allow public access for now
        // TODO: Add proper authentication (JWT tokens)
        return true;
    }
    
    /**
     * Get vendor stats
     */
    public function get_stats($request) {
        $vendor_id = $request['vendor_id'];
        
        global $wpdb;
        $changes_table = $wpdb->prefix . 'cashier_changes';
        
        // Count recent changes
        $recent_changes = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $changes_table 
             WHERE vendor_id = %d 
             AND changed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            $vendor_id
        ));
        
        // Count total products
        $total_products = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} 
             WHERE post_author = %d 
             AND post_type = 'product' 
             AND post_status = 'publish'",
            $vendor_id
        ));
        
        // Check cache status
        $cache_key = "cashier_full_sync_{$vendor_id}";
        $cache_exists = get_transient($cache_key) !== false;
        
        return rest_ensure_response(array(
            'vendor_id' => $vendor_id,
            'total_products' => (int) $total_products,
            'recent_changes_1h' => (int) $recent_changes,
            'cache_active' => $cache_exists,
            'timestamp' => current_time('mysql'),
            'version' => SPARE2APP_CASHIER_VERSION
        ));
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Cashier API',
            'Cashier API',
            'manage_options',
            'spare2app-cashier',
            array($this, 'admin_page')
        );
    }
    
    /**
     * Admin page content
     */
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>⚡ Spare2App Cashier API</h1>
            <p class="description">أسرع نظام كاشير في مصر - Ultra-fast POS with delta sync</p>
            
            <div class="card">
                <h2>🚀 API Endpoints</h2>
                <p><strong>Base URL:</strong> <code><?php echo site_url(); ?>/wp-json/cashier/v1/</code></p>
                
                <h3>Available Endpoints:</h3>
                <table class="widefat">
                    <thead>
                        <tr>
                            <th>Endpoint</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>GET /store/{vendor_id}/pos-initial</code></td>
                            <td>📦 Initial sync - تحميل كل المنتجات</td>
                        </tr>
                        <tr>
                            <td><code>GET /store/{vendor_id}/pos-changes?since={timestamp}</code></td>
                            <td>🔄 Delta sync - جلب التغييرات فقط</td>
                        </tr>
                        <tr>
                            <td><code>GET /product/{product_id}</code></td>
                            <td>📄 Single product - منتج واحد</td>
                        </tr>
                        <tr>
                            <td><code>GET /store/{vendor_id}/pos-stream</code></td>
                            <td>⚡ Real-time stream - تحديثات فورية</td>
                        </tr>
                        <tr>
                            <td><code>GET /store/{vendor_id}/categories</code></td>
                            <td>📂 Categories - الكاتجوريز</td>
                        </tr>
                        <tr>
                            <td><code>GET /store/{vendor_id}/stats</code></td>
                            <td>📊 Stats - إحصائيات</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="card">
                <h2>📊 System Status</h2>
                <p><strong>Version:</strong> <?php echo SPARE2APP_CASHIER_VERSION; ?></p>
                <p><strong>Status:</strong> <span style="color: green;">✅ Active</span></p>
                <p><strong>Database:</strong> <?php 
                    global $wpdb;
                    $table = $wpdb->prefix . 'cashier_changes';
                    $exists = $wpdb->get_var("SHOW TABLES LIKE '$table'") === $table;
                    echo $exists ? '<span style="color: green;">✅ Ready</span>' : '<span style="color: red;">❌ Not Found</span>';
                ?></p>
            </div>
        </div>
        <?php
    }
}
