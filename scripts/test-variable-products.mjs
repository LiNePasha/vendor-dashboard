/**
 * Test Script for Variable Products API
 * 
 * الهدف: اختبار WooCommerce API للمنتجات المتغيرة (Variable Products)
 * 
 * Usage:
 *   node scripts/test-variable-products.js
 */

import fetch from 'node-fetch';

// WooCommerce API credentials
const STORE_URL = 'https://api.spare2app.com';
const CONSUMER_KEY = 'ck_b94f603e7f93cf41ab48b7b2e0b6ce7f54fe8ba8';
const CONSUMER_SECRET = 'cs_b38dc69e9d24e9efc90e8b97f83cf4b74d7c0b30';

// Create auth headers
const authString = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

const headers = {
  'Authorization': `Basic ${authString}`,
  'Content-Type': 'application/json'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function logJSON(obj, indent = 2) {
  console.log(JSON.stringify(obj, null, indent));
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Test 1: Find Variable Products
// ============================================================================
async function test1_findVariableProducts() {
  logSection('🔍 Test 1: البحث عن منتجات متغيرة (Variable Products)');
  
  const url = `${STORE_URL}/wp-json/wc/v3/products?type=variable&per_page=5`;
  const result = await makeRequest(url);
  
  if (!result.success) {
    log(`❌ فشل: ${result.error}`, 'red');
    return null;
  }
  
  const products = result.data;
  
  if (!products || products.length === 0) {
    log('⚠️  لا توجد منتجات متغيرة في المتجر', 'yellow');
    log('💡 الحل: أنشئ منتج variable من لوحة تحكم WooCommerce أولاً', 'cyan');
    return null;
  }
  
  log(`✅ تم العثور على ${products.length} منتجات متغيرة`, 'green');
  
  products.forEach((product, index) => {
    console.log(`\n${index + 1}. ${product.name}`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Type: ${product.type}`);
    console.log(`   Price Range: ${product.price_html || product.price}`);
    console.log(`   Attributes: ${product.attributes?.length || 0}`);
    
    if (product.attributes && product.attributes.length > 0) {
      product.attributes.forEach(attr => {
        console.log(`      - ${attr.name}: ${attr.options?.join(', ') || 'N/A'}`);
      });
    }
  });
  
  return products[0]; // Return first product for further testing
}

// ============================================================================
// Test 2: Get Product Details
// ============================================================================
async function test2_getProductDetails(productId) {
  logSection(`📦 Test 2: تفاصيل المنتج (ID: ${productId})`);
  
  const url = `${STORE_URL}/wp-json/wc/v3/products/${productId}`;
  const result = await makeRequest(url);
  
  if (!result.success) {
    log(`❌ فشل: ${result.error}`, 'red');
    return;
  }
  
  const product = result.data;
  
  log('📋 معلومات المنتج:', 'blue');
  console.log(`   الاسم: ${product.name}`);
  console.log(`   النوع: ${product.type}`);
  console.log(`   السعر: ${product.price}`);
  console.log(`   إدارة المخزون: ${product.manage_stock}`);
  console.log(`   المخزون: ${product.stock_quantity || 'N/A'}`);
  
  log('\n🏷️  السمات (Attributes):', 'blue');
  if (product.attributes && product.attributes.length > 0) {
    product.attributes.forEach((attr, index) => {
      console.log(`\n   ${index + 1}. ${attr.name}`);
      console.log(`      ID: ${attr.id}`);
      console.log(`      Position: ${attr.position}`);
      console.log(`      Visible: ${attr.visible}`);
      console.log(`      Variation: ${attr.variation} ${attr.variation ? '✓' : ''}`);
      console.log(`      Options: ${attr.options?.join(', ') || 'N/A'}`);
    });
  } else {
    log('   ⚠️  لا توجد سمات', 'yellow');
  }
  
  return product;
}

// ============================================================================
// Test 3: Get Product Variations
// ============================================================================
async function test3_getVariations(productId) {
  logSection(`🔀 Test 3: جلب المتغيرات (Variations) للمنتج ${productId}`);
  
  const url = `${STORE_URL}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
  const result = await makeRequest(url);
  
  if (!result.success) {
    log(`❌ فشل: ${result.error}`, 'red');
    return;
  }
  
  const variations = result.data;
  
  log(`✅ تم العثور على ${variations.length} متغير`, 'green');
  
  if (variations.length === 0) {
    log('⚠️  لا توجد متغيرات لهذا المنتج', 'yellow');
    return;
  }
  
  // Display first 3 variations in detail
  const displayCount = Math.min(3, variations.length);
  
  for (let i = 0; i < displayCount; i++) {
    const variation = variations[i];
    console.log(`\n━━━ المتغير ${i + 1} ━━━`);
    console.log(`ID: ${variation.id}`);
    console.log(`SKU: ${variation.sku || 'N/A'}`);
    console.log(`السعر العادي: ${variation.regular_price}`);
    console.log(`سعر العرض: ${variation.sale_price || 'N/A'}`);
    console.log(`المخزون: ${variation.stock_quantity || 'N/A'}`);
    console.log(`إدارة المخزون: ${variation.manage_stock}`);
    console.log(`متاح للبيع: ${variation.purchasable}`);
    console.log(`الحالة: ${variation.status}`);
    
    console.log('\n🏷️  المواصفات:');
    if (variation.attributes && variation.attributes.length > 0) {
      variation.attributes.forEach(attr => {
        console.log(`   ${attr.name}: ${attr.option}`);
      });
    }
    
    console.log('\n🖼️  الصورة:');
    if (variation.image) {
      console.log(`   URL: ${variation.image.src}`);
      console.log(`   Alt: ${variation.image.alt || 'N/A'}`);
    } else {
      console.log('   ⚠️  لا توجد صورة (سيستخدم صورة المنتج الأساسي)');
    }
  }
  
  if (variations.length > displayCount) {
    console.log(`\n... و ${variations.length - displayCount} متغيرات أخرى`);
  }
  
  // Summary
  logSection('📊 ملخص المتغيرات');
  const summary = {
    total: variations.length,
    inStock: variations.filter(v => v.stock_quantity > 0).length,
    outOfStock: variations.filter(v => v.stock_quantity === 0 || v.stock_quantity === null).length,
    onSale: variations.filter(v => v.sale_price && v.sale_price !== '').length,
    withImages: variations.filter(v => v.image).length,
  };
  
  console.log(`إجمالي المتغيرات: ${summary.total}`);
  console.log(`متوفر في المخزون: ${summary.inStock}`);
  console.log(`نفذ من المخزون: ${summary.outOfStock}`);
  console.log(`في التخفيضات: ${summary.onSale}`);
  console.log(`لديه صور: ${summary.withImages}`);
  
  return variations;
}

// ============================================================================
// Test 4: Get Product Attributes (Global)
// ============================================================================
async function test4_getAttributes() {
  logSection('🏷️  Test 4: جلب السمات العامة (Global Attributes)');
  
  const url = `${STORE_URL}/wp-json/wc/v3/products/attributes`;
  const result = await makeRequest(url);
  
  if (!result.success) {
    log(`❌ فشل: ${result.error}`, 'red');
    return;
  }
  
  const attributes = result.data;
  
  if (!attributes || attributes.length === 0) {
    log('⚠️  لا توجد سمات عامة', 'yellow');
    log('💡 يمكنك إنشاء سمات من: المنتجات > سمات في لوحة تحكم WooCommerce', 'cyan');
    return;
  }
  
  log(`✅ تم العثور على ${attributes.length} سمة`, 'green');
  
  attributes.forEach((attr, index) => {
    console.log(`\n${index + 1}. ${attr.name}`);
    console.log(`   ID: ${attr.id}`);
    console.log(`   Slug: ${attr.slug}`);
    console.log(`   Type: ${attr.type}`);
    console.log(`   Order By: ${attr.order_by}`);
    console.log(`   Has Archives: ${attr.has_archives}`);
  });
  
  // Get terms for first attribute
  if (attributes.length > 0) {
    const firstAttr = attributes[0];
    console.log(`\n━━━ قيم السمة "${firstAttr.name}" ━━━`);
    
    const termsUrl = `${STORE_URL}/wp-json/wc/v3/products/attributes/${firstAttr.id}/terms?per_page=100`;
    const termsResult = await makeRequest(termsUrl);
    
    if (termsResult.success && termsResult.data) {
      const terms = termsResult.data;
      console.log(`عدد القيم: ${terms.length}`);
      terms.forEach(term => {
        console.log(`   - ${term.name} (ID: ${term.id})`);
      });
    }
  }
  
  return attributes;
}

// ============================================================================
// Test 5: Test Creating a Variation (OPTIONAL - commented out for safety)
// ============================================================================
async function test5_createVariation(productId) {
  logSection(`⚠️  Test 5: إنشاء متغير جديد (اختياري)`);
  
  log('🚫 هذا الاختبار معطل افتراضياً لتجنب تعديل البيانات', 'yellow');
  log('💡 لتفعيله، قم بإلغاء التعليق عن الكود في test5_createVariation', 'cyan');
  
  // Uncomment below to test creating a variation
  /*
  const newVariation = {
    regular_price: '100',
    stock_quantity: 10,
    manage_stock: true,
    attributes: [
      { id: 1, option: 'أحمر' },
      { id: 2, option: 'M' }
    ]
  };
  
  const url = `${STORE_URL}/wp-json/wc/v3/products/${productId}/variations`;
  const result = await makeRequest(url, {
    method: 'POST',
    body: JSON.stringify(newVariation)
  });
  
  if (!result.success) {
    log(`❌ فشل: ${result.error}`, 'red');
    return;
  }
  
  log('✅ تم إنشاء المتغير بنجاح', 'green');
  logJSON(result.data);
  */
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runTests() {
  log('\n🚀 بدء اختبار Variable Products API', 'bright');
  log('━'.repeat(60), 'bright');
  
  try {
    // Test 1: Find variable products
    const variableProduct = await test1_findVariableProducts();
    
    if (!variableProduct) {
      log('\n⚠️  لا يمكن المتابعة بدون منتجات متغيرة', 'yellow');
      log('📝 التوصيات:', 'cyan');
      log('   1. أنشئ منتج variable من لوحة تحكم WooCommerce', 'cyan');
      log('   2. أضف سمات (Attributes) مثل اللون والمقاس', 'cyan');
      log('   3. أنشئ متغيرات (Variations) للمنتج', 'cyan');
      log('   4. أعد تشغيل هذا السكريبت', 'cyan');
      return;
    }
    
    const productId = variableProduct.id;
    
    // Test 2: Get product details
    await test2_getProductDetails(productId);
    
    // Test 3: Get variations
    await test3_getVariations(productId);
    
    // Test 4: Get global attributes
    await test4_getAttributes();
    
    // Test 5: Create variation (optional)
    await test5_createVariation(productId);
    
    // Final Summary
    logSection('✅ اكتملت جميع الاختبارات');
    log('📊 النتائج:', 'green');
    log('   ✓ تم العثور على منتجات متغيرة', 'green');
    log('   ✓ تم جلب تفاصيل المنتج والسمات', 'green');
    log('   ✓ تم جلب المتغيرات بنجاح', 'green');
    log('   ✓ تم فهم بنية الـ API', 'green');
    
    log('\n🎯 الخطوة التالية:', 'cyan');
    log('   راجع الملف: docs/variable-products-plan.md', 'cyan');
    log('   ابدأ Phase 2: إنشاء API routes في التطبيق', 'cyan');
    
  } catch (error) {
    log(`\n❌ حدث خطأ: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run the tests
runTests();
