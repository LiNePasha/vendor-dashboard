-- Test query to check vendor slugs and see what data we're working with
-- Run this in phpMyAdmin to see the actual slug values

SELECT 
    u.ID as vendor_id,
    u.user_login,
    u.user_nicename,
    u.display_name,
    u.user_email,
    
    -- Try to get shop name from different meta keys
    (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'store_name' LIMIT 1) as store_name,
    (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_wcfm_shop_name' LIMIT 1) as wcfm_shop_name,
    
    -- Try to get store URL/slug from WCFM meta
    (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_wcfm_store_url' LIMIT 1) as wcfm_store_url,
    
    -- Check if store is offline or disabled
    (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_wcfm_is_store_offline' LIMIT 1) as is_offline,
    (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_disable_vendor' LIMIT 1) as is_disabled,
    
    -- Count products
    (SELECT COUNT(*) FROM wp_posts WHERE post_type = 'product' AND post_status = 'publish' AND post_author = u.ID) as product_count

FROM wp_users u

WHERE EXISTS (
    -- Has vendor role
    SELECT 1 FROM wp_usermeta 
    WHERE user_id = u.ID 
    AND meta_key = 'wp_capabilities' 
    AND (meta_value LIKE '%wcfm_vendor%' OR meta_value LIKE '%seller%')
)

ORDER BY product_count DESC;


-- Alternative: Show what the current code would generate
SELECT 
    u.ID as vendor_id,
    u.display_name,
    
    -- Current WRONG slug (using user_login)
    u.user_login as current_wrong_slug,
    
    -- What we SHOULD use (WCFM store URL or user_nicename)
    COALESCE(
        (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_wcfm_store_url' LIMIT 1),
        u.user_nicename
    ) as correct_slug,
    
    -- Shop name for reference
    COALESCE(
        (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'store_name' LIMIT 1),
        (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = '_wcfm_shop_name' LIMIT 1),
        u.display_name
    ) as shop_name

FROM wp_users u

WHERE EXISTS (
    SELECT 1 FROM wp_usermeta 
    WHERE user_id = u.ID 
    AND meta_key = 'wp_capabilities' 
    AND (meta_value LIKE '%wcfm_vendor%' OR meta_value LIKE '%seller%')
)

ORDER BY u.ID;
