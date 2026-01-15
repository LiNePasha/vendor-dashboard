-- Debug queries for category vendors issue
-- Run EACH query SEPARATELY in phpMyAdmin (one at a time)

-- ============================================
-- Query 1: See WCFM table structure first
-- ============================================
SHOW COLUMNS FROM wp_wcfm_membership_subscription;

-- ============================================
-- Query 2: Check how many products in category 411 (هوجان)
-- ============================================
SELECT COUNT(*) as total_products
FROM wp_posts p
INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
INNER JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
WHERE p.post_type = 'product'
AND p.post_status = 'publish'
AND tt.taxonomy = 'product_cat'
AND tt.term_id = 411;

-- ============================================
-- Query 3: MOST IMPORTANT - Who are the authors (vendors) for products in category 411?
-- ============================================
SELECT 
    p.post_author,
    COUNT(*) as product_count,
    u.display_name,
    u.user_login
FROM wp_posts p
INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
INNER JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
LEFT JOIN wp_users u ON p.post_author = u.ID
WHERE p.post_type = 'product'
AND p.post_status = 'publish'
AND tt.taxonomy = 'product_cat'
AND tt.term_id = 411
GROUP BY p.post_author
ORDER BY product_count DESC;

-- ============================================
-- Query 4: See ALL data in WCFM table
-- ============================================
SELECT *
FROM wp_wcfm_membership_subscription
LIMIT 20;

-- ============================================
-- Query 5: Check vendor meta (offline/disabled status)
-- ============================================
SELECT 
    um.user_id,
    um.meta_key,
    um.meta_value,
    u.display_name
FROM wp_usermeta um
LEFT JOIN wp_users u ON um.user_id = u.ID
WHERE (um.meta_key = '_wcfm_is_store_offline' OR um.meta_key = '_disable_vendor')
ORDER BY um.user_id
LIMIT 50;

-- ============================================
-- Query 6: Sample products from category 411 with their authors
-- ============================================
SELECT 
    p.ID as product_id,
    p.post_title,
    p.post_author,
    u.user_login,
    u.display_name
FROM wp_posts p
INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
INNER JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
LEFT JOIN wp_users u ON p.post_author = u.ID
WHERE p.post_type = 'product'
AND p.post_status = 'publish'
AND tt.taxonomy = 'product_cat'
AND tt.term_id = 411
ORDER BY p.post_author
LIMIT 20;

-- ============================================
-- Query 7: Check if products have _wcfm_product_author meta
-- ============================================
SELECT 
    p.ID,
    p.post_title,
    p.post_author as post_author_field,
    pm.meta_value as wcfm_product_author
FROM wp_posts p
INNER JOIN wp_term_relationships tr ON p.ID = tr.object_id
INNER JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_wcfm_product_author'
WHERE p.post_type = 'product'
AND p.post_status = 'publish'
AND tt.taxonomy = 'product_cat'
AND tt.term_id = 411
LIMIT 20;
