<?php
/**
 * Plugin Name: Spare2App Notifications API v2
 * Description: Custom REST API endpoints for vendor notifications with Basic Auth
 * Version: 2.0.0
 * Author: Spare2App
 */

if (!defined('ABSPATH')) {
    exit;
}

// Register REST API endpoints
add_action('rest_api_init', function () {
    // GET notifications with read status
    register_rest_route('spare2app/v1', '/notifications', [
        'methods' => 'GET',
        'callback' => 'spare2app_get_notifications',
        'permission_callback' => '__return_true', // Allow access, check inside function
    ]);

    // POST mark notification as read
    register_rest_route('spare2app/v1', '/notifications/(?P<id>\d+)/read', [
        'methods' => 'POST',
        'callback' => 'spare2app_mark_notification_read',
        'permission_callback' => '__return_true',
    ]);

    // POST mark all notifications as read
    register_rest_route('spare2app/v1', '/notifications/read-all', [
        'methods' => 'POST',
        'callback' => 'spare2app_mark_all_notifications_read',
        'permission_callback' => '__return_true',
    ]);
});

/**
 * Get current vendor ID from WordPress user
 */
function spare2app_get_vendor_id() {
    // Try to get from current user
    $user_id = get_current_user_id();
    
    if ($user_id > 0) {
        return $user_id;
    }
    
    // If no user, try to get from cookies
    if (isset($_COOKIE['vendor_id'])) {
        return intval($_COOKIE['vendor_id']);
    }
    
    // Try to get from query param (for testing)
    if (isset($_GET['vendor_id'])) {
        return intval($_GET['vendor_id']);
    }
    
    return 0;
}

/**
 * Get vendor notifications with read status
 */
function spare2app_get_notifications($request) {
    global $wpdb;
    
    $vendor_id = spare2app_get_vendor_id();
    
    if ($vendor_id === 0) {
        return new WP_Error('no_vendor', 'Vendor ID not found', ['status' => 401]);
    }
    
    $filter = $request->get_param('filter') ?: 'all';
    $per_page = intval($request->get_param('per_page') ?: 20);
    $page = intval($request->get_param('page') ?: 1);
    $offset = ($page - 1) * $per_page;
    
    // Build WHERE clause for filter
    $filter_clause = '';
    if ($filter === 'unread') {
        $filter_clause = 'AND (modifier.is_read IS NULL OR modifier.is_read = 0)';
    }
    
    // Get notifications with read status
    $query = $wpdb->prepare(
        "SELECT 
            m.ID,
            m.message,
            m.message_type,
            m.created,
            COALESCE(modifier.is_read, 0) as is_read,
            COALESCE(modifier.read_by, 0) as read_by,
            COALESCE(modifier.read_on, NULL) as read_on
        FROM {$wpdb->prefix}wcfm_messages m
        LEFT JOIN {$wpdb->prefix}wcfm_messages_modifier modifier 
            ON m.ID = modifier.message AND modifier.read_by = %d
        WHERE m.message_to = %d 
          AND m.is_direct_message = 1
          {$filter_clause}
        ORDER BY m.created DESC
        LIMIT %d OFFSET %d",
        $vendor_id,
        $vendor_id,
        $per_page,
        $offset
    );
    
    $notifications = $wpdb->get_results($query, ARRAY_A);
    
    // Get total count
    $count_query = $wpdb->prepare(
        "SELECT COUNT(*) 
        FROM {$wpdb->prefix}wcfm_messages m
        LEFT JOIN {$wpdb->prefix}wcfm_messages_modifier modifier 
            ON m.ID = modifier.message AND modifier.read_by = %d
        WHERE m.message_to = %d 
          AND m.is_direct_message = 1
          {$filter_clause}",
        $vendor_id,
        $vendor_id
    );
    
    $total = intval($wpdb->get_var($count_query));
    
    // Get unread count
    $unread_query = $wpdb->prepare(
        "SELECT COUNT(*) 
        FROM {$wpdb->prefix}wcfm_messages m
        LEFT JOIN {$wpdb->prefix}wcfm_messages_modifier modifier 
            ON m.ID = modifier.message AND modifier.read_by = %d
        WHERE m.message_to = %d 
          AND m.is_direct_message = 1
          AND (modifier.is_read IS NULL OR modifier.is_read = 0)",
        $vendor_id,
        $vendor_id
    );
    
    $unread_count = intval($wpdb->get_var($unread_query));
    
    return [
        'notifications' => $notifications,
        'total' => $total,
        'unread_count' => $unread_count,
        'page' => $page,
        'per_page' => $per_page,
        'total_pages' => ceil($total / $per_page),
        'vendor_id' => $vendor_id, // For debugging
    ];
}

/**
 * Mark a notification as read
 */
function spare2app_mark_notification_read($request) {
    global $wpdb;
    
    $vendor_id = spare2app_get_vendor_id();
    
    if ($vendor_id === 0) {
        return new WP_Error('no_vendor', 'Vendor ID not found', ['status' => 401]);
    }
    
    $notification_id = intval($request['id']);
    
    if (!$notification_id) {
        return new WP_Error('invalid_id', 'Invalid notification ID', ['status' => 400]);
    }
    
    // Check if notification exists and belongs to vendor
    $notification = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}wcfm_messages 
        WHERE ID = %d AND message_to = %d",
        $notification_id,
        $vendor_id
    ));
    
    if (!$notification) {
        return new WP_Error('not_found', 'Notification not found', ['status' => 404]);
    }
    
    // Check if already marked as read
    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}wcfm_messages_modifier 
        WHERE message = %d AND read_by = %d",
        $notification_id,
        $vendor_id
    ));
    
    if ($existing) {
        // Update existing record
        $wpdb->update(
            $wpdb->prefix . 'wcfm_messages_modifier',
            [
                'is_read' => 1,
                'read_on' => current_time('mysql')
            ],
            [
                'message' => $notification_id,
                'read_by' => $vendor_id
            ],
            ['%d', '%s'],
            ['%d', '%d']
        );
    } else {
        // Insert new record
        $wpdb->insert(
            $wpdb->prefix . 'wcfm_messages_modifier',
            [
                'message' => $notification_id,
                'is_read' => 1,
                'read_by' => $vendor_id,
                'read_on' => current_time('mysql')
            ],
            ['%d', '%d', '%d', '%s']
        );
    }
    
    return [
        'success' => true,
        'message' => 'Notification marked as read',
        'notification_id' => $notification_id,
        'vendor_id' => $vendor_id
    ];
}

/**
 * Mark all notifications as read
 */
function spare2app_mark_all_notifications_read($request) {
    global $wpdb;
    
    $vendor_id = spare2app_get_vendor_id();
    
    if ($vendor_id === 0) {
        return new WP_Error('no_vendor', 'Vendor ID not found', ['status' => 401]);
    }
    
    // Get all unread notification IDs for this vendor
    $unread_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT m.ID 
        FROM {$wpdb->prefix}wcfm_messages m
        LEFT JOIN {$wpdb->prefix}wcfm_messages_modifier modifier 
            ON m.ID = modifier.message AND modifier.read_by = %d
        WHERE m.message_to = %d 
          AND m.is_direct_message = 1
          AND (modifier.is_read IS NULL OR modifier.is_read = 0)",
        $vendor_id,
        $vendor_id
    ));
    
    $marked_count = 0;
    
    foreach ($unread_ids as $notification_id) {
        // Check if record exists
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}wcfm_messages_modifier 
            WHERE message = %d AND read_by = %d",
            $notification_id,
            $vendor_id
        ));
        
        if ($existing) {
            // Update existing record
            $wpdb->update(
                $wpdb->prefix . 'wcfm_messages_modifier',
                [
                    'is_read' => 1,
                    'read_on' => current_time('mysql')
                ],
                [
                    'message' => $notification_id,
                    'read_by' => $vendor_id
                ],
                ['%d', '%s'],
                ['%d', '%d']
            );
        } else {
            // Insert new record
            $wpdb->insert(
                $wpdb->prefix . 'wcfm_messages_modifier',
                [
                    'message' => $notification_id,
                    'is_read' => 1,
                    'read_by' => $vendor_id,
                    'read_on' => current_time('mysql')
                ],
                ['%d', '%d', '%d', '%s']
            );
        }
        
        $marked_count++;
    }
    
    return [
        'success' => true,
        'message' => 'All notifications marked as read',
        'marked_count' => $marked_count,
        'vendor_id' => $vendor_id
    ];
}
