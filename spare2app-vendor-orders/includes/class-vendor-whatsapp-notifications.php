<?php
/**
 * Vendor WhatsApp Notifications
 *
 * Send WhatsApp notifications to vendors when new orders arrive.
 *
 * @package Spare2App_Vendor_Orders
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Spare2App_Vendor_WhatsApp_Notifications {

    const OPTION_KEY = 'spare2app_vendor_whatsapp_settings';
    const USER_META_WHATSAPP = 'spare2app_vendor_whatsapp_number';
    const ACTION_SEND_VENDOR_WHATSAPP = 'spare2app_send_vendor_whatsapp_notification';
    const DEFAULT_TEMPLATE_PARAM_KEYS = 'order_number,order_date,order_id,order_status,customer_name,customer_phone,customer_email,items_count,items_summary,items_detail,vendor_total,billing_address,shipping_address,payment_method,shipping_method,order_url';

    /**
     * Constructor
     */
    public function __construct() {
        // Admin settings
        add_action('admin_menu', array($this, 'register_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('rest_api_init', array($this, 'register_webhook_route'));
        add_action('admin_post_spare2app_send_whatsapp_test', array($this, 'handle_send_test_message'));
        add_action('admin_post_spare2app_diagnose_order_vendor', array($this, 'handle_diagnose_order_vendor'));
        add_action('admin_post_spare2app_retry_vendor_whatsapp', array($this, 'handle_retry_vendor_whatsapp'));

        // Vendor profile field
        add_action('show_user_profile', array($this, 'render_vendor_whatsapp_field'));
        add_action('edit_user_profile', array($this, 'render_vendor_whatsapp_field'));
        add_action('personal_options_update', array($this, 'save_vendor_whatsapp_field'));
        add_action('edit_user_profile_update', array($this, 'save_vendor_whatsapp_field'));

        // Trigger on order processing
        add_action('woocommerce_new_order', array($this, 'queue_order_vendor_notifications'), 10, 1);
        add_action('woocommerce_order_status_processing', array($this, 'queue_order_vendor_notifications'), 10, 1);
        add_action('woocommerce_order_status_completed', array($this, 'queue_order_vendor_notifications'), 10, 1);

        // Async worker
        add_action(self::ACTION_SEND_VENDOR_WHATSAPP, array($this, 'send_vendor_order_notification'), 10, 2);
    }

    /**
     * Settings page
     */
    public function register_settings_page() {
        add_options_page(
            'Vendor WhatsApp Notifications',
            'Vendor WhatsApp',
            'manage_options',
            'spare2app-vendor-whatsapp',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'spare2app_vendor_whatsapp_group',
            self::OPTION_KEY,
            array($this, 'sanitize_settings')
        );

        add_settings_section(
            'spare2app_vendor_whatsapp_main',
            'WhatsApp Cloud API Settings',
            function() {
                echo '<p>Configure Meta WhatsApp Cloud API to notify vendors about new orders.</p>';
            },
            'spare2app-vendor-whatsapp'
        );

        $fields = array(
            'enabled' => 'Enable notifications',
            'access_token' => 'Access Token',
            'phone_number_id' => 'Phone Number ID',
            'graph_api_version' => 'Graph API Version (e.g. v25.0)',
            'template_name' => 'Template Name (optional)',
            'template_lang' => 'Template Language (e.g. ar)',
            'template_param_keys' => 'Template Param Keys (comma-separated)',
            'force_test_to_number' => 'Force Test To Number (optional)',
            'webhook_verify_token' => 'Webhook Verify Token',
            'default_country_code' => 'Default Country Code (without +, e.g. 20)',
            'vendor_order_url_base' => 'Vendor Order URL Base',
        );

        foreach ($fields as $key => $label) {
            add_settings_field(
                $key,
                $label,
                array($this, 'render_field'),
                'spare2app-vendor-whatsapp',
                'spare2app_vendor_whatsapp_main',
                array('key' => $key, 'label' => $label)
            );
        }
    }

    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        $old = $this->get_settings();

        return array(
            'enabled' => !empty($input['enabled']) ? 1 : 0,
            'access_token' => isset($input['access_token']) ? sanitize_text_field($input['access_token']) : ($old['access_token'] ?? ''),
            'phone_number_id' => isset($input['phone_number_id']) ? sanitize_text_field($input['phone_number_id']) : '',
            'graph_api_version' => isset($input['graph_api_version']) ? sanitize_text_field($input['graph_api_version']) : 'v25.0',
            'template_name' => isset($input['template_name']) ? sanitize_text_field($input['template_name']) : '',
            'template_lang' => isset($input['template_lang']) ? sanitize_text_field($input['template_lang']) : 'ar',
            'template_param_keys' => isset($input['template_param_keys']) ? sanitize_text_field($input['template_param_keys']) : self::DEFAULT_TEMPLATE_PARAM_KEYS,
            'force_test_to_number' => isset($input['force_test_to_number']) ? sanitize_text_field($input['force_test_to_number']) : '',
            'webhook_verify_token' => isset($input['webhook_verify_token']) ? sanitize_text_field($input['webhook_verify_token']) : '',
            'default_country_code' => isset($input['default_country_code']) ? preg_replace('/\D+/', '', $input['default_country_code']) : '20',
            'vendor_order_url_base' => isset($input['vendor_order_url_base']) ? esc_url_raw($input['vendor_order_url_base']) : '',
        );
    }

    /**
     * Get settings with defaults
     */
    private function get_settings() {
        $settings = get_option(self::OPTION_KEY, array());

        return wp_parse_args($settings, array(
            'enabled' => 0,
            'access_token' => '',
            'phone_number_id' => '',
            'graph_api_version' => 'v25.0',
            'template_name' => '',
            'template_lang' => 'ar',
            'template_param_keys' => self::DEFAULT_TEMPLATE_PARAM_KEYS,
            'force_test_to_number' => '',
            'webhook_verify_token' => '',
            'default_country_code' => '20',
            'vendor_order_url_base' => '',
        ));
    }

    /**
     * Render settings field
     */
    public function render_field($args) {
        $settings = $this->get_settings();
        $key = $args['key'];
        $value = isset($settings[$key]) ? $settings[$key] : '';
        $name = self::OPTION_KEY . '[' . $key . ']';
        $field_id = 'spare2app_field_' . $key;

        if ($key === 'enabled') {
            echo '<label><input type="checkbox" name="' . esc_attr($name) . '" value="1" ' . checked(1, intval($value), false) . '> Enable sending WhatsApp to vendors when order becomes processing</label>';
            return;
        }

        $type = 'text';
        if ($key === 'access_token') {
            $type = 'password';
        }

        $placeholder = '';
        if ($key === 'vendor_order_url_base') {
            $placeholder = 'https://your-dashboard.com/orders';
        }

        echo '<input id="' . esc_attr($field_id) . '" type="' . esc_attr($type) . '" class="regular-text" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" placeholder="' . esc_attr($placeholder) . '">';

        if ($key === 'template_name') {
            echo '<p class="description">If empty, a plain text WhatsApp message will be sent (works only within active conversation window).</p>';
        }

        if ($key === 'graph_api_version') {
            echo '<p class="description">Recommended: v25.0</p>';
        }

        if ($key === 'template_param_keys') {
            echo '<p class="description">Available keys: order_number, order_date, order_id, order_status, customer_name, customer_phone, customer_email, items_count, items_summary, items_detail, vendor_total, billing_address, shipping_address, payment_method, shipping_method, order_url, thank_you_for</p>';
            echo '<p style="margin-top:8px;">';
            echo '<label for="spare2app_param_preset" style="display:block;margin-bottom:4px;"><strong>Quick Presets</strong></label>';
            echo '<select id="spare2app_param_preset" onchange="(function(sel){var input=document.getElementById(\'' . esc_js($field_id) . '\');if(!input||!sel.value){return;}input.value=sel.value;})(this)">';
            echo '<option value="">Select preset...</option>';
            echo '<option value="customer_name,thank_you_for,order_number,items_summary,order_date">Arabic Confirmation (5 params)</option>';
            echo '<option value="customer_name,order_number,order_date">Order Confirmation (3 params)</option>';
            echo '<option value="order_number,customer_name,customer_phone,items_summary,vendor_total,order_url">Vendor Order Details (6 params)</option>';
            echo '<option value="' . esc_attr(self::DEFAULT_TEMPLATE_PARAM_KEYS) . '">Full Order Details (16 params)</option>';
            echo '<option value="customer_name,order_number,customer_phone">Basic (3 params)</option>';
            echo '</select>';
            echo '</p>';
            echo '<p class="description">Choose a preset, then click Save Changes.</p>';
        }

        if ($key === 'force_test_to_number') {
            echo '<p class="description">If set, ALL order notifications will be sent only to this number (testing mode). Example: +201025338973</p>';
        }

        if ($key === 'webhook_verify_token') {
            echo '<p class="description">Any secret string you choose. Use the exact same value in Meta Webhooks Verify Token field.</p>';
        }
    }

    /**
     * Settings page HTML
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $test_status = isset($_GET['wa_test_status']) ? sanitize_text_field(wp_unslash($_GET['wa_test_status'])) : '';
        $test_message = isset($_GET['wa_test_message']) ? sanitize_text_field(wp_unslash($_GET['wa_test_message'])) : '';
        $diag_status = '';
        $diag_message = '';

        $diag_key = isset($_GET['wa_diag_key']) ? sanitize_key(wp_unslash($_GET['wa_diag_key'])) : '';
        if (!empty($diag_key)) {
            $diag_payload = get_transient($diag_key);
            if (is_array($diag_payload)) {
                $diag_status = isset($diag_payload['status']) ? sanitize_text_field((string) $diag_payload['status']) : '';
                $diag_message = isset($diag_payload['message']) ? (string) $diag_payload['message'] : '';
            }
            delete_transient($diag_key);
        } else {
            // Backward compatibility (older redirects).
            $diag_status = isset($_GET['wa_diag_status']) ? sanitize_text_field(wp_unslash($_GET['wa_diag_status'])) : '';
            $diag_message = isset($_GET['wa_diag_message']) ? sanitize_text_field(wp_unslash($_GET['wa_diag_message'])) : '';
        }

        // Check for retry params
        $retry_order_id = isset($_GET['retry_order_id']) ? intval(wp_unslash($_GET['retry_order_id'])) : 0;
        $retry_vendor_id = isset($_GET['retry_vendor_id']) ? intval(wp_unslash($_GET['retry_vendor_id'])) : 0;

        echo '<div class="wrap">';
        echo '<h1>Vendor WhatsApp Notifications</h1>';
        echo '<p><strong>Webhook Callback URL:</strong> <code>' . esc_html(rest_url('spare2app/v1/whatsapp-webhook')) . '</code></p>';

        if (!empty($test_status)) {
            $notice_class = $test_status === 'success' ? 'notice notice-success' : 'notice notice-error';
            echo '<div class="' . esc_attr($notice_class) . '"><p>' . esc_html($test_message) . '</p></div>';
        }

        if (!empty($diag_status)) {
            $notice_class = $diag_status === 'success' ? 'notice notice-success' : 'notice notice-error';
            echo '<div class="' . esc_attr($notice_class) . '"><p style="white-space:pre-line;">' . esc_html($diag_message) . '</p></div>';
        }

        echo '<form method="post" action="options.php">';
        settings_fields('spare2app_vendor_whatsapp_group');
        do_settings_sections('spare2app-vendor-whatsapp');
        submit_button();
        echo '</form>';

        echo '<hr style="margin:24px 0;">';
        echo '<h2>Send Test Message</h2>';
        echo '<p>Use this to verify Access Token, Phone Number ID and Template before creating any order.</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('spare2app_send_whatsapp_test');
        echo '<input type="hidden" name="action" value="spare2app_send_whatsapp_test">';
        echo '<table class="form-table" role="presentation">';
        echo '<tr>';
        echo '<th><label for="spare2app_test_phone">Test WhatsApp Number</label></th>';
        echo '<td><input type="text" name="test_phone" id="spare2app_test_phone" class="regular-text" placeholder="+2010XXXXXXX" required>'; 
        echo '<p class="description">Number to receive test message (international format preferred).</p></td>';
        echo '</tr>';
        echo '</table>';
        submit_button('Send Test WhatsApp', 'secondary', 'submit', false);
        echo '</form>';

        echo '<hr style="margin:24px 0;">';
        echo '<h2>Diagnose Order → Vendor Mapping</h2>';
        echo '<p>Enter an order ID to check detected vendor IDs, vendor WhatsApp number and if notification was already marked as sent.</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('spare2app_diagnose_order_vendor');
        echo '<input type="hidden" name="action" value="spare2app_diagnose_order_vendor">';
        echo '<table class="form-table" role="presentation">';
        echo '<tr>';
        echo '<th><label for="spare2app_diag_order_id">Order ID</label></th>';
        echo '<td><input type="number" min="1" name="order_id" id="spare2app_diag_order_id" class="regular-text" required>'; 
        echo '<p class="description">Example: 1234</p></td>';
        echo '</tr>';
        echo '</table>';
        submit_button('Diagnose Order', 'secondary', 'submit', false);
        echo '</form>';

        // Show retry form if vendor_id in URL
        $retry_order_id = isset($_GET['retry_order_id']) ? intval(wp_unslash($_GET['retry_order_id'])) : 0;
        $retry_vendor_id = isset($_GET['retry_vendor_id']) ? intval(wp_unslash($_GET['retry_vendor_id'])) : 0;

        if ($retry_order_id > 0 && $retry_vendor_id > 0) {
            $retry_order = wc_get_order($retry_order_id);
            $retry_user = get_user_by('id', $retry_vendor_id);
            if ($retry_order && $retry_user) {
                echo '<hr style="margin:24px 0;">';
                echo '<h2>Retry Send to Vendor</h2>';
                echo '<p>Send WhatsApp notification to vendor <strong>' . esc_html($retry_user->display_name) . '</strong> for order <strong>#' . $retry_order_id . '</strong></p>';
                echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
                wp_nonce_field('spare2app_retry_vendor_whatsapp');
                echo '<input type="hidden" name="action" value="spare2app_retry_vendor_whatsapp">';
                echo '<input type="hidden" name="order_id" value="' . intval($retry_order_id) . '">';
                echo '<input type="hidden" name="vendor_id" value="' . intval($retry_vendor_id) . '">';
                submit_button('Send WhatsApp Now', 'primary', 'submit', false);
                echo '</form>';
            }
        }

        echo '</div>';
    }

    /**
     * Send a test WhatsApp message from settings page
     */
    public function handle_send_test_message() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('spare2app_send_whatsapp_test');

        $settings = $this->get_settings();
        $raw_test_phone = isset($_POST['test_phone']) ? sanitize_text_field(wp_unslash($_POST['test_phone'])) : '';
        $test_phone = $this->normalize_phone($raw_test_phone, $settings['default_country_code']);

        if (empty($settings['access_token']) || empty($settings['phone_number_id'])) {
            $this->redirect_with_test_notice('error', 'Missing Access Token or Phone Number ID.');
        }

        if (empty($settings['template_name']) || empty($settings['template_lang'])) {
            $this->redirect_with_test_notice('error', 'For reliable delivery testing, set Template Name and Template Language first (text fallback is disabled for test).');
        }

        if (empty($test_phone)) {
            $this->redirect_with_test_notice('error', 'Invalid test phone number.');
        }

        $result = $this->send_whatsapp_message(
            $settings,
            $test_phone,
            array(
                'order_number' => 'TEST-1001',
                'order_date' => wp_date('M d, Y'),
                'order_id' => '1001',
                'order_status' => 'processing',
                'customer_name' => 'Test Customer',
                'thank_you_for' => 'طلبك',
                'customer_phone' => '+201000000000',
                'customer_email' => 'customer@example.com',
                'items_count' => '1',
                'items_summary' => 'Test Item x 1',
                'items_detail' => 'Test Item (x1) - 100.00 EGP',
                'vendor_total' => '100.00 EGP',
                'billing_address' => 'Test City, EG',
                'shipping_address' => 'Test City, EG',
                'payment_method' => 'Cash on Delivery',
                'shipping_method' => 'Standard',
                'order_url' => !empty($settings['vendor_order_url_base']) ? $settings['vendor_order_url_base'] : home_url('/'),
            )
        );

        if (!empty($result['success'])) {
            $response_json = json_decode((string) $result['response'], true);
            $message_id = '';
            if (is_array($response_json) && !empty($response_json['messages'][0]['id'])) {
                $message_id = (string) $response_json['messages'][0]['id'];
            }

            $delivery_note = 'Accepted by Meta API using TEMPLATE (final delivery depends on message status webhooks).';

            $notice = 'Test request success. ' . $delivery_note;
            if (!empty($message_id)) {
                $notice .= ' Message ID: ' . $message_id;
            }

            $this->redirect_with_test_notice('success', $notice);
        }

        $error_message = '';
        $response_json = json_decode((string) $result['response'], true);
        if (is_array($response_json) && !empty($response_json['error']['message'])) {
            $error_message = (string) $response_json['error']['message'];
            if (!empty($response_json['error']['code'])) {
                $error_message .= ' (code: ' . $response_json['error']['code'] . ')';
            }
        }

        if (empty($error_message)) {
            $error_body = is_string($result['response']) ? $result['response'] : wp_json_encode($result['response']);
            $error_message = mb_substr($error_body, 0, 240);
        }

        $this->redirect_with_test_notice('error', 'Failed to send test message: ' . $error_message);
    }

    /**
     * Redirect back to settings with status message
     */
    private function redirect_with_test_notice($status, $message) {
        $url = add_query_arg(
            array(
                'page' => 'spare2app-vendor-whatsapp',
                'wa_test_status' => $status,
                'wa_test_message' => $message,
            ),
            admin_url('options-general.php')
        );

        wp_safe_redirect($url);
        exit;
    }

    /**
     * Diagnose order -> vendor mapping and WhatsApp phone resolution.
     */
    public function handle_diagnose_order_vendor() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('spare2app_diagnose_order_vendor');

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        if ($order_id <= 0) {
            $this->redirect_with_diag_notice('error', 'Invalid order ID.');
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            $this->redirect_with_diag_notice('error', 'Order not found: #' . $order_id);
        }

        $settings = $this->get_settings();
        $forced_test_phone = $this->normalize_phone(
            isset($settings['force_test_to_number']) ? $settings['force_test_to_number'] : '',
            $settings['default_country_code']
        );

        $vendor_ids = $this->get_order_vendor_ids($order_id);

        $parts = array();
        $parts[] = 'Order #' . $order_id . ' (' . $order->get_status() . ')';
        $parts[] = !empty($forced_test_phone)
            ? 'Forced mode: ON (' . $forced_test_phone . ')'
            : 'Forced mode: OFF';

        if (empty($vendor_ids)) {
            $item_debug = array();
            $i = 0;
            foreach ($order->get_items() as $item) {
                $i++;
                if ($i > 5) {
                    $item_debug[] = '...';
                    break;
                }

                $resolved_vendor_id = $this->resolve_vendor_id_from_order_item($item);
                $item_debug[] = $item->get_name() . '=>vendor:' . ($resolved_vendor_id > 0 ? $resolved_vendor_id : 'none');
            }

            $parts[] = 'Vendors detected: NONE';
            if (!empty($item_debug)) {
                $parts[] = 'Item resolve sample: ' . implode(' | ', $item_debug);
            }

            $this->redirect_with_diag_notice('error', implode("\n", $parts));
        }

        $parts[] = 'Vendors detected: ' . implode(', ', array_map('intval', $vendor_ids));

        foreach ($vendor_ids as $vendor_id) {
            $vendor_id = intval($vendor_id);
            $user = get_user_by('id', $vendor_id);
            $display_name = $user ? $user->display_name : ('User #' . $vendor_id);

                $phone_data = $this->resolve_vendor_whatsapp_phone($vendor_id, $settings['default_country_code']);
                $raw_phone = $phone_data['raw'];
                $normalized_phone = $phone_data['normalized'];
                $phone_source = $phone_data['source'];
            $already_sent_key = '_spare2app_whatsapp_sent_vendor_' . $vendor_id;
            $already_sent = $order->get_meta($already_sent_key, true) ? 'yes' : 'no';

            $parts[] = sprintf(
                    'Vendor %d (%s): source=%s | raw_phone=%s | normalized=%s | sent_meta=%s',
                $vendor_id,
                $display_name,
                    (string) (!empty($phone_source) ? $phone_source : 'none'),
                (string) ($raw_phone !== '' ? $raw_phone : 'EMPTY'),
                (string) (!empty($normalized_phone) ? $normalized_phone : 'INVALID/EMPTY'),
                $already_sent
            );
        }

        // For single vendor, redirect directly to retry form
        if (count($vendor_ids) === 1) {
            $this->redirect_with_retry_params($order_id, intval($vendor_ids[0]), implode("\n", $parts));
        }

        $this->redirect_with_diag_notice('success', implode("\n", $parts));
    }

    /**
     * Redirect back to settings page with diagnose status.
     */
    private function redirect_with_diag_notice($status, $message) {
        $message = mb_substr((string) $message, 0, 1800);

        $diag_key = 'spare2app_wa_diag_' . get_current_user_id() . '_' . wp_generate_password(8, false, false);
        set_transient($diag_key, array(
            'status' => (string) $status,
            'message' => (string) $message,
        ), 5 * MINUTE_IN_SECONDS);

        $url = add_query_arg(
            array(
                'page' => 'spare2app-vendor-whatsapp',
                'wa_diag_key' => $diag_key,
            ),
            admin_url('options-general.php')
        );

        wp_safe_redirect($url);
        exit;
    }

    /**
     * Redirect with retry parameters for easy resend
     */
    private function redirect_with_retry_params($order_id, $vendor_id, $message = '') {
        $url = add_query_arg(
            array(
                'page' => 'spare2app-vendor-whatsapp',
                'retry_order_id' => intval($order_id),
                'retry_vendor_id' => intval($vendor_id),
                'wa_diag_message' => !empty($message) ? sanitize_text_field($message) : 'Ready to retry',
            ),
            admin_url('options-general.php')
        );

        wp_safe_redirect($url);
        exit;
    }

    /**
     * Retry sending WhatsApp notification for order vendor.
     */
    public function handle_retry_vendor_whatsapp() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('spare2app_retry_vendor_whatsapp');

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        $vendor_id = isset($_POST['vendor_id']) ? intval($_POST['vendor_id']) : 0;

        if ($order_id <= 0 || $vendor_id <= 0) {
            $this->redirect_with_diag_notice('error', 'Invalid order ID or vendor ID.');
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            $this->redirect_with_diag_notice('error', 'Order not found: #' . $order_id);
        }

        // Force send (clear the sent meta to allow resend)
        $already_sent_key = '_spare2app_whatsapp_sent_vendor_' . $vendor_id;
        $order->delete_meta_data($already_sent_key);
        $order->save();

        // Attempt send
        $result = $this->send_vendor_order_notification($order_id, $vendor_id);

        if ($result) {
            $this->redirect_with_diag_notice('success', 'WhatsApp notification sent successfully to vendor #' . $vendor_id);
        }

        // If failed, get more detailed error info
        $settings = $this->get_settings();
        $phone_data = $this->resolve_vendor_whatsapp_phone($vendor_id, $settings['default_country_code']);
        $phone = $phone_data['normalized'];
        $phone_source = $phone_data['source'];
        $raw_phone = $phone_data['raw'];

        $error_msg = 'Failed to send WhatsApp notification.';

        if (empty($settings['enabled'])) {
            $error_msg = 'WhatsApp notifications are disabled in settings.';
        } elseif (empty($settings['access_token'])) {
            $error_msg = 'Access Token is missing or empty.';
        } elseif (empty($settings['phone_number_id'])) {
            $error_msg = 'Phone Number ID is missing or empty.';
        } elseif (empty($phone)) {
            $error_msg = 'Vendor WhatsApp number is invalid or missing. Source: ' . $phone_source . ' | Raw: ' . $raw_phone;
        } else {
            $error_msg = 'Check WordPress debug log for detailed error information.';
        }

        $this->redirect_with_diag_notice('error', $error_msg);
    }

    /**
     * Redirect back to settings page with diagnose status (old location - kept for reference).
     */
    private function redirect_with_diag_notice_backup($status, $message) {
    }

    /**
     * Register webhook endpoint for Meta verification and events
     */
    public function register_webhook_route() {
        register_rest_route('spare2app/v1', '/whatsapp-webhook', array(
            array(
                'methods' => 'GET',
                'callback' => array($this, 'handle_webhook_request'),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => 'POST',
                'callback' => array($this, 'handle_webhook_request'),
                'permission_callback' => '__return_true',
            ),
        ));
    }

    /**
     * Handle webhook verification + events
     */
    public function handle_webhook_request($request) {
        $method = strtoupper($request->get_method());
        $settings = $this->get_settings();

        // Verification request (GET)
        if ($method === 'GET') {
            $mode = $this->get_request_value($request, array('hub.mode', 'hub_mode'));
            $verify_token = $this->get_request_value($request, array('hub.verify_token', 'hub_verify_token'));
            $challenge = $this->get_request_value($request, array('hub.challenge', 'hub_challenge'));

            if ($mode === 'subscribe' && !empty($settings['webhook_verify_token']) && hash_equals((string) $settings['webhook_verify_token'], (string) $verify_token)) {
                status_header(200);
                header('Content-Type: text/plain; charset=utf-8');
                echo (string) $challenge;
                exit;
            }

            return new WP_Error('forbidden', 'Invalid verify token', array('status' => 403));
        }

        // Event notification request (POST)
        $payload = $request->get_json_params();
        if (empty($payload)) {
            $payload = json_decode($request->get_body(), true);
        }

        $this->log('Incoming WhatsApp webhook', array(
            'event' => is_array($payload) ? $payload : array('raw' => $request->get_body()),
        ));

        return rest_ensure_response(array('success' => true));
    }

    /**
     * Get request value by possible keys
     */
    private function get_request_value($request, $keys = array()) {
        foreach ($keys as $key) {
            $value = $request->get_param($key);
            if ($value !== null && $value !== '') {
                return $value;
            }
        }
        return null;
    }

    /**
     * Render vendor WhatsApp profile field
     */
    public function render_vendor_whatsapp_field($user) {
        if (!current_user_can('edit_user', $user->ID)) {
            return;
        }

        $is_vendor = function_exists('wcfm_is_vendor') && wcfm_is_vendor($user->ID);
        if (!$is_vendor && !current_user_can('manage_woocommerce')) {
            return;
        }

        $value = get_user_meta($user->ID, self::USER_META_WHATSAPP, true);
        ?>
        <h2>Spare2App WhatsApp</h2>
        <table class="form-table" role="presentation">
            <tr>
                <th><label for="spare2app_vendor_whatsapp_number">Vendor WhatsApp Number</label></th>
                <td>
                    <input type="text" name="spare2app_vendor_whatsapp_number" id="spare2app_vendor_whatsapp_number" value="<?php echo esc_attr($value); ?>" class="regular-text" />
                    <p class="description">Use international format, e.g. +2010XXXXXXX</p>
                </td>
            </tr>
        </table>
        <?php
    }

    /**
     * Save vendor WhatsApp profile field
     */
    public function save_vendor_whatsapp_field($user_id) {
        if (!current_user_can('edit_user', $user_id)) {
            return;
        }

        if (!isset($_POST['spare2app_vendor_whatsapp_number'])) {
            return;
        }

        $raw = sanitize_text_field(wp_unslash($_POST['spare2app_vendor_whatsapp_number']));
        update_user_meta($user_id, self::USER_META_WHATSAPP, $raw);
    }

    /**
     * Queue notifications for all vendors in order
     */
    public function queue_order_vendor_notifications($order_id) {
        $settings = $this->get_settings();
        if (empty($settings['enabled'])) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        // Forced test mode: route every order notification to one fixed number.
        $forced_test_phone = $this->normalize_phone(
            isset($settings['force_test_to_number']) ? $settings['force_test_to_number'] : '',
            $settings['default_country_code']
        );
        if (!empty($forced_test_phone)) {
            $forced_sent_key = '_spare2app_whatsapp_forced_test_sent';
            if ($order->get_meta($forced_sent_key, true)) {
                return;
            }

            $result = $this->send_whatsapp_message(
                $settings,
                $forced_test_phone,
                array(
                    'order_number' => (string) $order->get_order_number(),
                    'order_date' => $order->get_date_created() ? $order->get_date_created()->date('M d, Y') : wp_date('M d, Y'),
                    'customer_name' => (string) trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
                    'customer_phone' => (string) ($order->get_billing_phone() ?: '-'),
                    'items_summary' => (string) $this->build_items_summary($order->get_items()),
                    'vendor_total' => (string) wc_format_localized_price(floatval($order->get_total())),
                    'order_url' => (string) $this->build_vendor_order_url($settings['vendor_order_url_base'], $order_id),
                )
            );

            $this->log('Forced test WhatsApp send result', array(
                'order_id' => $order_id,
                'phone' => $forced_test_phone,
                'success' => !empty($result['success']),
                'response' => isset($result['response']) ? $result['response'] : '',
            ));

            if (!empty($result['success'])) {
                $order->update_meta_data($forced_sent_key, current_time('mysql'));
                $order->save();
            }

            return;
        }

        $vendor_ids = $this->get_order_vendor_ids($order_id);
        if (empty($vendor_ids)) {
            $this->log('No vendor IDs found for order; WhatsApp not sent', array('order_id' => $order_id));
            return;
        }

        foreach ($vendor_ids as $vendor_id) {
            $sent = $this->send_vendor_order_notification(intval($order_id), intval($vendor_id));

            // Retry asynchronously if immediate send fails
            if (!$sent && function_exists('as_enqueue_async_action')) {
                as_enqueue_async_action(
                    self::ACTION_SEND_VENDOR_WHATSAPP,
                    array(
                        'order_id' => intval($order_id),
                        'vendor_id' => intval($vendor_id),
                    ),
                    'spare2app-vendor-orders'
                );
            }
        }
    }

    /**
     * Send notification for single vendor + order
     */
    public function send_vendor_order_notification($order_id, $vendor_id) {
        $order = wc_get_order($order_id);
        if (!$order || !$vendor_id) {
            return false;
        }

        $already_sent_key = '_spare2app_whatsapp_sent_vendor_' . intval($vendor_id);
        if ($order->get_meta($already_sent_key, true)) {
            $this->log('Vendor WhatsApp already sent; skipping duplicate', array(
                'order_id' => $order_id,
                'vendor_id' => $vendor_id,
            ));
            return true;
        }

        $settings = $this->get_settings();
        if (empty($settings['enabled']) || empty($settings['access_token']) || empty($settings['phone_number_id'])) {
            $this->log('WhatsApp settings incomplete; cannot send order notification', array(
                'order_id' => $order_id,
                'vendor_id' => $vendor_id,
            ));
            return false;
        }

        $phone_data = $this->resolve_vendor_whatsapp_phone($vendor_id, $settings['default_country_code']);
        $raw_phone = $phone_data['raw'];
        $phone = $phone_data['normalized'];
        $phone_source = $phone_data['source'];

        if (empty($phone)) {
            $this->log('Missing/invalid vendor WhatsApp number', array(
                'order_id' => $order_id,
                'vendor_id' => $vendor_id,
                'source' => $phone_source,
                'raw_phone' => $raw_phone,
            ));
            return false;
        }

        $items = $this->get_vendor_items_from_order($order, $vendor_id);
        $items_summary = $this->build_items_summary($items);

        $customer_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        $customer_phone = $order->get_billing_phone();
        $customer_email = $order->get_billing_email();
        $order_number = $order->get_order_number();
        $vendor_total = $this->calculate_vendor_total($items);
        $order_url = $this->build_vendor_order_url($settings['vendor_order_url_base'], $order_id);

        // Build template data with all relevant order info.
        $template_data = array(
            'order_number' => (string) $order_number,
            'order_date' => $order->get_date_created() ? $order->get_date_created()->date('M d, Y') : wp_date('M d, Y'),
            'order_id' => (string) $order_id,
            'order_status' => (string) $order->get_status(),
            'customer_name' => (string) ($customer_name ?: 'عميل'),
            'thank_you_for' => 'طلبك',
            'customer_phone' => (string) ($customer_phone ?: '-'),
            'customer_email' => (string) ($customer_email ?: '-'),
            'items_count' => (string) count($items),
            'items_summary' => (string) $items_summary,
            'items_detail' => (string) $this->format_items_detail($items),
            'vendor_total' => (string) wc_format_localized_price($vendor_total),
            'billing_address' => (string) $this->format_address($order->get_address('billing')),
            'shipping_address' => (string) $this->format_address($order->get_address('shipping')),
            'payment_method' => (string) ($order->get_payment_method_title() ?: 'N/A'),
            'shipping_method' => (string) ($order->get_shipping_method() ?: 'N/A'),
            'order_url' => (string) $order_url,
        );

        $result = $this->send_whatsapp_message(
            $settings,
            $phone,
            $template_data
        );

        if ($result['success']) {
            $order->update_meta_data($already_sent_key, current_time('mysql'));
            $order->save();
        }

        $this->log('Vendor WhatsApp send result', array(
            'order_id' => $order_id,
            'vendor_id' => $vendor_id,
            'phone' => $phone,
            'phone_source' => $phone_source,
            'success' => $result['success'],
            'response' => $result['response'],
            'template_data_keys' => array_keys($template_data),
        ));

        return !empty($result['success']);
    }

    /**
     * Resolve vendor IDs for order
     */
    private function get_order_vendor_ids($order_id) {
        global $wpdb;

        $vendor_ids = array();

        $table_name = $wpdb->prefix . 'wcfm_marketplace_orders';
        if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") == $table_name) {
            $vendor_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT vendor_id FROM {$table_name} WHERE order_id = %d",
                $order_id
            ));
            $vendor_ids = array_map('intval', array_filter((array) $vendor_ids));
        }

        if (!empty($vendor_ids)) {
            return array_values(array_unique($vendor_ids));
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return array();
        }

        foreach ($order->get_items() as $item) {
            $resolved_vendor_id = $this->resolve_vendor_id_from_order_item($item);
            if ($resolved_vendor_id > 0) {
                $vendor_ids[] = $resolved_vendor_id;
            }
        }

        $vendor_ids = array_values(array_unique(array_map('intval', $vendor_ids)));

        if (empty($vendor_ids)) {
            $this->log('Could not resolve vendor IDs from order items', array('order_id' => $order_id));
        } else {
            $this->log('Resolved vendor IDs from order items', array('order_id' => $order_id, 'vendor_ids' => $vendor_ids));
        }

        return $vendor_ids;
    }

    /**
     * Get only this vendor items from order
     */
    private function get_vendor_items_from_order($order, $vendor_id) {
        $vendor_items = array();

        foreach ($order->get_items() as $item) {
            $resolved_vendor_id = $this->resolve_vendor_id_from_order_item($item);
            if ($resolved_vendor_id !== intval($vendor_id)) {
                continue;
            }

            $vendor_items[] = $item;
        }

        return $vendor_items;
    }

    /**
     * Resolve vendor/user ID from an order item.
     */
    private function resolve_vendor_id_from_order_item($item) {
        if (!is_object($item)) {
            return 0;
        }

        // Some marketplace plugins store vendor directly in line item meta.
        $candidate_meta_keys = array('vendor_id', '_vendor_id', 'wcfm_vendor_id', '_wcfm_vendor_id', 'seller_id');
        foreach ($candidate_meta_keys as $meta_key) {
            $meta_value = $item->get_meta($meta_key, true);
            if (!empty($meta_value)) {
                $vendor_id = intval($meta_value);
                if ($vendor_id > 0) {
                    return $vendor_id;
                }
            }
        }

        $product = $item->get_product();
        if (!$product) {
            return 0;
        }

        // Product author as vendor (common in multi-vendor setups).
        $author_id = intval(get_post_field('post_author', $product->get_id()));
        if ($author_id > 0) {
            return $author_id;
        }

        // For variations, vendor may be on parent product.
        if ($product->is_type('variation')) {
            $parent_id = intval($product->get_parent_id());
            if ($parent_id > 0) {
                $parent_author_id = intval(get_post_field('post_author', $parent_id));
                if ($parent_author_id > 0) {
                    return $parent_author_id;
                }
            }
        }

        return 0;
    }

    /**
     * Build short items summary
     */
    private function build_items_summary($items) {
        if (empty($items)) {
            return 'لا توجد عناصر';
        }

        $chunks = array();
        $count = 0;

        foreach ($items as $item) {
            $count++;
            if ($count > 6) {
                $chunks[] = '...';
                break;
            }

            $chunks[] = $item->get_name() . ' × ' . intval($item->get_quantity());
        }

        return implode(' | ', $chunks);
    }

    /**
     * Calculate vendor subtotal from items
     */
    private function calculate_vendor_total($items) {
        $total = 0;
        foreach ($items as $item) {
            $total += floatval($item->get_total());
        }
        return round($total, 2);
    }

    /**
     * Build order URL
     */
    private function build_vendor_order_url($base_url, $order_id) {
        if (!empty($base_url)) {
            return add_query_arg('id', intval($order_id), $base_url);
        }

        return home_url('/wp-admin/post.php?post=' . intval($order_id) . '&action=edit');
    }

    /**
     * Send WhatsApp via Meta Cloud API
     */
    private function send_whatsapp_message($settings, $phone, $data) {
        $api_version = !empty($settings['graph_api_version']) ? $settings['graph_api_version'] : 'v25.0';
        $endpoint = 'https://graph.facebook.com/' . rawurlencode($api_version) . '/' . rawurlencode($settings['phone_number_id']) . '/messages';

        $payload = array(
            'messaging_product' => 'whatsapp',
            'to' => $phone,
        );

        if (!empty($settings['template_name'])) {
            $template_parameters = $this->build_template_parameters($settings, $data);
            $payload['type'] = 'template';
            $payload['template'] = array(
                'name' => $settings['template_name'],
                'language' => array('code' => $settings['template_lang']),
                'components' => array(
                    array(
                        'type' => 'body',
                        'parameters' => $template_parameters,
                    ),
                ),
            );
        } else {
            $payload['type'] = 'text';
            $payload['text'] = array(
                'preview_url' => false,
                'body' => "طلب جديد #{$data['order_number']}\nالعميل: {$data['customer_name']} ({$data['customer_phone']})\nالمنتجات: {$data['items_summary']}\nالإجمالي: {$data['vendor_total']}\n{$data['order_url']}",
            );
        }

        $response = wp_remote_post($endpoint, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $settings['access_token'],
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode($payload),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'response' => $response->get_error_message(),
            );
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        return array(
            'success' => $status >= 200 && $status < 300,
            'response' => $body,
        );
    }

    /**
     * Build template parameters based on configured keys
     */
    private function build_template_parameters($settings, $data) {
        $keys_csv = !empty($settings['template_param_keys'])
            ? (string) $settings['template_param_keys']
            : self::DEFAULT_TEMPLATE_PARAM_KEYS;

        $keys = array_filter(array_map('trim', explode(',', $keys_csv)));
        if (empty($keys)) {
            $keys = array_filter(array_map('trim', explode(',', self::DEFAULT_TEMPLATE_PARAM_KEYS)));
        }

        $params = array();
        foreach ($keys as $key) {
            $params[] = array(
                'type' => 'text',
                'text' => isset($data[$key]) ? (string) $data[$key] : '',
            );
        }

        return $params;
    }

    /**
     * Normalize phone to E.164-like format (digits only for WA API)
     */
    private function normalize_phone($phone, $default_country_code = '20') {
        if (empty($phone)) {
            return '';
        }

        $phone = trim($phone);

        // Convert leading 00 to +
        if (strpos($phone, '00') === 0) {
            $phone = '+' . substr($phone, 2);
        }

        // Keep + for parsing, then strip all non-digit
        $has_plus = strpos($phone, '+') === 0;
        $digits = preg_replace('/\D+/', '', $phone);

        if (empty($digits)) {
            return '';
        }

        // Local Egyptian-like number without country code
        if (!$has_plus && strpos($digits, '0') === 0 && !empty($default_country_code)) {
            $digits = $default_country_code . ltrim($digits, '0');
        }

        return $digits;
    }

    /**
     * Basic WhatsApp number validity check for normalized digits.
     */
    private function is_valid_whatsapp_digits($digits) {
        $digits = preg_replace('/\D+/', '', (string) $digits);
        $len = strlen($digits);

        // E.164 allows up to 15 digits; keep a practical minimum to avoid IDs like "46".
        return $len >= 10 && $len <= 15;
    }

    /**
     * Resolve vendor WhatsApp from common user meta sources.
     */
    private function resolve_vendor_whatsapp_phone($vendor_id, $default_country_code = '20') {
        $vendor_id = intval($vendor_id);
        if ($vendor_id <= 0) {
            return array('raw' => '', 'normalized' => '', 'source' => '');
        }

        $candidate_meta_keys = array(
            self::USER_META_WHATSAPP,
            'whatsapp_number',
            'whatsapp',
            'phone',
            'mobile',
            'billing_phone',
            'wcfm_phone',
            'wcfmmp_mobile',
            'wcfmmp_phone',
        );

        foreach ($candidate_meta_keys as $meta_key) {
            $raw = get_user_meta($vendor_id, $meta_key, true);
            if (!is_scalar($raw) || trim((string) $raw) === '') {
                continue;
            }

            $normalized = $this->normalize_phone((string) $raw, $default_country_code);
            if (!empty($normalized) && $this->is_valid_whatsapp_digits($normalized)) {
                return array('raw' => (string) $raw, 'normalized' => $normalized, 'source' => $meta_key);
            }
        }

        // WCFM profile settings often store contact info in a nested array.
        $profile_settings = get_user_meta($vendor_id, 'wcfmmp_profile_settings', true);
        if (is_array($profile_settings)) {
            $nested_keys = array('mobile', 'phone', 'store_phone', 'whatsapp');
            foreach ($nested_keys as $nested_key) {
                if (empty($profile_settings[$nested_key]) || !is_scalar($profile_settings[$nested_key])) {
                    continue;
                }

                $raw = (string) $profile_settings[$nested_key];
                $normalized = $this->normalize_phone($raw, $default_country_code);
                if (!empty($normalized) && $this->is_valid_whatsapp_digits($normalized)) {
                    return array('raw' => $raw, 'normalized' => $normalized, 'source' => 'wcfmmp_profile_settings.' . $nested_key);
                }
            }
        }

        return array('raw' => '', 'normalized' => '', 'source' => 'none');
    }

    /**
     * Format address array into readable string.
     */
    private function format_address($address) {
        if (!is_array($address)) {
            return 'N/A';
        }

        $parts = array();
        if (!empty($address['first_name'])) {
            $parts[] = $address['first_name'];
        }
        if (!empty($address['last_name'])) {
            $parts[] = $address['last_name'];
        }
        if (!empty($address['address_1'])) {
            $parts[] = $address['address_1'];
        }
        if (!empty($address['address_2'])) {
            $parts[] = $address['address_2'];
        }
        if (!empty($address['city'])) {
            $parts[] = $address['city'];
        }
        if (!empty($address['postcode'])) {
            $parts[] = $address['postcode'];
        }
        if (!empty($address['country'])) {
            $parts[] = $address['country'];
        }

        return !empty($parts) ? implode(', ', $parts) : 'N/A';
    }

    /**
     * Format detailed items list.
     */
    private function format_items_detail($items) {
        if (empty($items)) {
            return 'No items';
        }

        $details = array();
        $count = 0;
        foreach ($items as $item) {
            $count++;
            if ($count > 10) {
                $details[] = '...and more';
                break;
            }

            $line = $item->get_name() . ' (x' . intval($item->get_quantity()) . ')';
            $price = floatval($item->get_total());
            if ($price > 0) {
                $line .= ' - ' . wc_price($price);
            }

            $details[] = $line;
        }

        return implode("\n", $details);
    }

    /**
     * Log helper
     */
    private function log($message, $context = array()) {
        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }

        $line = '[Spare2App WhatsApp] ' . $message;
        if (!empty($context)) {
            $line .= ' | ' . wp_json_encode($context);
        }

        error_log($line);
    }
}
