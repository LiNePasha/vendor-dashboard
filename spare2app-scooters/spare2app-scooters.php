<?php
/**
 * Plugin Name: Spare2App Scooters
 * Plugin URI:  https://spare2app.com
 * Description: تسجيل Custom Post Types للإسكوترات الجديدة والمستعملة مع حقول ACF عبر REST API
 * Version:     1.0.0
 * Author:      Spare2App
 * Text Domain: spare2app-scooters
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/* ──────────────────────────────────────────────────────────────
   1. Register Custom Post Types
────────────────────────────────────────────────────────────── */
add_action( 'init', 'spare2app_register_scooter_cpts' );

function spare2app_register_scooter_cpts() {

    $shared = [
        'public'              => true,
        'show_in_rest'        => true,
        'supports'            => [ 'title', 'editor', 'thumbnail', 'custom-fields' ],
        'has_archive'         => true,
        'rewrite'             => [ 'with_front' => false ],
        'menu_icon'           => 'dashicons-buddicons-activity',
        'show_in_menu'        => true,
        'capability_type'     => 'post',
        'map_meta_cap'        => true,
    ];

    // ── إسكوترات جديدة ──────────────────────────────────────
    register_post_type( 'new_scooter', array_merge( $shared, [
        'labels' => [
            'name'               => 'إسكوترات جديدة',
            'singular_name'      => 'إسكوتر جديد',
            'add_new'            => 'إضافة',
            'add_new_item'       => 'إضافة إسكوتر جديد',
            'edit_item'          => 'تعديل الإسكوتر',
            'new_item'           => 'إسكوتر جديد',
            'view_item'          => 'عرض الإسكوتر',
            'search_items'       => 'بحث في الإسكوترات',
            'not_found'          => 'لا توجد إسكوترات',
            'not_found_in_trash' => 'لا توجد إسكوترات في المهملات',
            'menu_name'          => 'إسكوترات جديدة',
        ],
        'rest_base'    => 'new_scooter',
        'description'  => 'إسكوترات جديدة للبيع',
    ] ) );

    // ── إسكوترات مستعملة ────────────────────────────────────
    register_post_type( 'used_scooter', array_merge( $shared, [
        'labels' => [
            'name'               => 'إسكوترات مستعملة',
            'singular_name'      => 'إسكوتر مستعمل',
            'add_new'            => 'إضافة',
            'add_new_item'       => 'إضافة إسكوتر مستعمل',
            'edit_item'          => 'تعديل الإسكوتر',
            'new_item'           => 'إسكوتر مستعمل',
            'view_item'          => 'عرض الإسكوتر',
            'search_items'       => 'بحث في الإسكوترات',
            'not_found'          => 'لا توجد إسكوترات مستعملة',
            'not_found_in_trash' => 'لا توجد إسكوترات في المهملات',
            'menu_name'          => 'إسكوترات مستعملة',
        ],
        'rest_base'    => 'used_scooter',
        'description'  => 'إسكوترات مستعملة للبيع',
    ] ) );
}

/* ──────────────────────────────────────────────────────────────
   2. Allow ACF fields to be updated via REST API for these CPTs
────────────────────────────────────────────────────────────── */
add_filter( 'acf/rest_api/new_scooter/get_fields',   '__return_true' );
add_filter( 'acf/rest_api/used_scooter/get_fields',  '__return_true' );
add_filter( 'acf/rest_api/new_scooter/update_fields', '__return_true' );
add_filter( 'acf/rest_api/used_scooter/update_fields', '__return_true' );

/* ──────────────────────────────────────────────────────────────
   ملاحظة: الحقول ACF يتم استيرادها عبر:
   ACF > Tools > Import/Export > Import (استخدم ملف: acf-field-group.json)
────────────────────────────────────────────────────────────── */
