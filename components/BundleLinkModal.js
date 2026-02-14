"use client";

import { useState, useEffect, useMemo } from 'react';
import { VENDOR_STORE_BUNDLE_LINKS } from '@/app/lib/vendor-constants';

export default function BundleLinkModal({ isOpen, onClose, allProducts = [], vendorId }) {
  // 🆕 بنية جديدة: array of objects بدلاً من arrays منفصلة
  // كل item: { id: unique, productId, variationId?, quantity }
  const [selectedItems, setSelectedItems] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOnlyPublished, setShowOnlyPublished] = useState(true); // ✅ فلتر المنتجات المنشورة فقط
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null); // لعرض الـ variations
  
  // ❌ تم إلغاء variationsData و loadingVariations - الـ variations تأتي مع المنتجات مباشرة

  // Reset state only when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedItems([]);
      setSearch('');
      setSelectedCategory('all');
      setShowOnlyPublished(true); // ✅ إعادة تعيين للمنشورة فقط
      setGeneratedLink('');
      setCopied(false);
      setExpandedProduct(null);
    }
  }, [isOpen]);

  // Extract unique categories from products
  const categories = useMemo(() => {
    if (!allProducts) return [];
    const catsMap = new Map();
    allProducts.forEach(product => {
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (!catsMap.has(cat.id)) {
            catsMap.set(cat.id, cat);
          }
        });
      }
    });
    return Array.from(catsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);

  // Memoize filtered products
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    
    console.log(`🔍 BundleLinkModal: Received ${allProducts.length} products from parent`);
    
    // 🔥 أولاً: إزالة المنتجات المكررة بشكل كامل (مثل الكاشير)
    const seen = new Set();
    const uniqueProducts = [];
    
    allProducts.forEach(product => {
      if (product && product.id && !seen.has(product.id)) {
        seen.add(product.id);
        uniqueProducts.push(product);
      }
    });
    
    console.log(`✅ After de-duplication: ${uniqueProducts.length} unique products`);
    
    // ثانياً: الفلترة
    const filtered = uniqueProducts.filter(product => {
      // Search filter
      const matchesSearch = !search || 
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(search.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || 
        (product.categories && product.categories.some(cat => cat.id === parseInt(selectedCategory)));
      
      // ✅ Published filter
      const matchesPublished = !showOnlyPublished || product.status === 'publish';
      
      return matchesSearch && matchesCategory && matchesPublished;
    });
    
    // ثالثاً: إضافة uniqueKey مع timestamp لضمان uniqueness تام
    const timestamp = Date.now();
    const result = filtered.map((product, index) => ({
      ...product,
      uniqueKey: `prod_${product.id}_${timestamp}_${index}`
    }));
    
    console.log(`🎯 Final filtered products: ${result.length}`);
    
    return result;
  }, [allProducts, search, selectedCategory, showOnlyPublished]);

  // Toggle product selection
  const toggleProduct = (product) => {
    const productId = product.id;
    
    // لو منتج variable، نفتح الـ variations بس
    if (product.type === 'variable' && product.variations && product.variations.length > 0) {
      setExpandedProduct(expandedProduct === productId ? null : productId);
      return;
    }
    
    // منتج simple - نشوف لو موجود نحذفه
    const existingIndex = selectedItems.findIndex(
      item => item.productId === productId && !item.variationId
    );
    
    if (existingIndex >= 0) {
      // حذف المنتج
      setSelectedItems(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      // إضافة المنتج
      setSelectedItems(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(), // unique ID
          productId: productId,
          quantity: 1
        }
      ]);
    }
  };

  // 🆕 إضافة variation محدد
  const addVariation = (productId, variationId) => {
    setSelectedItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        productId: productId,
        variationId: variationId,
        quantity: 1
      }
    ]);
  };
  
  // 🆕 حذف item محدد
  const removeItem = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };
  
  // 🆕 تحديث الكمية
  const updateQuantity = (itemId, quantity) => {
    setSelectedItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  // Generate bundle link
  const generateLink = () => {
    if (selectedItems.length === 0) {
      alert('⚠️ اختر منتجات أولاً');
      return;
    }

    const vendorIdNum = typeof vendorId === 'string' ? parseInt(vendorId) : vendorId;
    const baseLink = VENDOR_STORE_BUNDLE_LINKS[vendorIdNum];
    
    // 🆕 استخدام رابط افتراضي لو مفيش رابط للتاجر
    const finalBaseLink = baseLink || `https://www.spare2app.com/bundle/${vendorIdNum}?p=`;

    // بناء الـ link مع variations والكميات
    // ✅ Format الجديد مع prefix للتمييز:
    // - Simple بدون كمية: productId (مثال: 123)
    // - Simple مع كمية: productId:q{quantity} (مثال: 123:q5)
    // - Variable بدون كمية: productId:v{variationId} (مثال: 456:v789)
    // - Variable مع كمية: productId:v{variationId}:q{quantity} (مثال: 456:v789:q3)
    const productParams = selectedItems.map(item => {
      const { productId, variationId, quantity } = item;
      
      if (variationId) {
        // منتج متغير - نضيف v قبل variation و q قبل الكمية
        return quantity > 1 
          ? `${productId}:v${variationId}:q${quantity}` 
          : `${productId}:v${variationId}`;
      } else {
        // منتج عادي - نضيف q قبل الكمية
        return quantity > 1 
          ? `${productId}:q${quantity}` 
          : `${productId}`;
      }
    }).join(',');

    const link = `${finalBaseLink}${productParams}`;
    setGeneratedLink(link);
  };

  // Copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('⚠️ فشل النسخ');
    }
  };

  // Open link in new tab
  const openLink = () => {
    window.open(generatedLink, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">🔗 حزمة منتجات أونلاين</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search and Category Filter */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="🔍 ابحث عن منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="all">🏷️ كل الأقسام ({allProducts.length})</option>
              {categories.map(cat => {
                const count = allProducts.filter(p => 
                  p.categories && p.categories.some(c => c.id === cat.id)
                ).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
          
          {/* ✅ Published Filter Toggle */}
          <div className="mb-4 flex items-center justify-center">
            <button
              onClick={() => setShowOnlyPublished(!showOnlyPublished)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                showOnlyPublished
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
              }`}
            >
              <span className="text-lg">{showOnlyPublished ? '✓' : '○'}</span>
              <span>عرض المنتجات المنشورة فقط</span>
            </button>
          </div>

          {/* Selected Count */}
          <div className="mb-4 flex items-center justify-center gap-4 flex-wrap">
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-bold">
              {selectedItems.length} عنصر محدد
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-semibold">
              ✓ {allProducts.filter(p => p.status === 'publish').length} منشور
            </span>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full text-sm font-semibold">
              ✎ {allProducts.filter(p => p.status !== 'publish').length} غير منشور
            </span>
          </div>

          {/* 🆕 قائمة المنتجات المحددة - في الأعلى */}
          {selectedItems.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                  🛒 المنتجات المحددة للحزمة
                </h3>
                <button
                  onClick={() => setSelectedItems([])}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full transition-colors"
                >
                  🗑️ مسح الكل
                </button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedItems.map((item, index) => {
                  const product = allProducts.find(p => p.id === item.productId);
                  if (!product) return null;
                  
                  let variationInfo = null;
                  
                  if (item.variationId && product.variations) {
                    const variation = product.variations.find(v => 
                      (v.id || v.variation_id) === item.variationId
                    );
                    if (variation) {
                      let varName = '';
                      if (Array.isArray(variation.attributes)) {
                        varName = variation.attributes.map(attr => attr.option).join(' - ');
                      } else if (typeof variation.attributes === 'object' && variation.attributes !== null) {
                        varName = Object.values(variation.attributes).join(' - ');
                      }
                      variationInfo = varName || `نوع #${item.variationId}`;
                    }
                  }
                  
                  return (
                    <div
                      key={item.id}
                      className="bg-white border-2 border-orange-200 rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
                    >
                      {/* رقم */}
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      
                      {/* صورة المنتج */}
                      {product.images && product.images.length > 0 && (
                        <img
                          src={product.images[0].src}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      )}
                      
                      {/* معلومات المنتج */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">
                          {product.name}
                        </div>
                        {variationInfo && (
                          <div className="text-xs text-green-600 font-medium">
                            📦 {variationInfo}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-orange-600 font-bold">
                            {product.price} ج.م
                          </span>
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, item.quantity - 1);
                              }}
                              className="text-gray-600 hover:text-gray-900 font-bold text-sm w-5 h-5 flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-xs font-bold text-gray-900 min-w-[20px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, item.quantity + 1);
                              }}
                              className="text-gray-600 hover:text-gray-900 font-bold text-sm w-5 h-5 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* زر الحذف */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex-shrink-0 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                        title="حذف المنتج"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generated Link Section - SHOW AT TOP IF EXISTS */}
          {generatedLink && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mb-6">
              <div className="font-bold text-green-800 mb-2">✅ تم إنشاء الرابط:</div>
              <div className="bg-white border border-green-300 rounded p-3 mb-3 break-all text-sm text-black font-mono">
                {generatedLink}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {copied ? '✓ تم النسخ!' : '📋 نسخ الرابط'}
                </button>
                <button
                  onClick={openLink}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  🔗 فتح الرابط
                </button>
              </div>
            </div>
          )}

          {/* 🆕 عنوان قسم اختيار المنتجات */}
          <div className="mb-4 pb-3 border-b-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              📦 اختر المنتجات للإضافة
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              اضغط على أي منتج لإضافته للحزمة
            </p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {filteredProducts.map(product => {
              // Check if this product (simple) or any of its variations are selected
              const isSelected = selectedItems.some(item => 
                item.productId === product.id && !item.variationId
              );
              const isVariable = product.type === 'variable';
              const isExpanded = expandedProduct === product.id;
              
              // ✅ تحقق من حالة المنتج
              const isDraft = product.status !== 'publish';
              const isDisabled = isDraft; // المنتجات غير المنشورة محظورة
              
              // Count how many times this product appears (including variations)
              const productCount = selectedItems.filter(item => 
                item.productId === product.id
              ).length;
              
              return (
                <div key={product.uniqueKey} className={`border-2 rounded-lg overflow-hidden transition-all relative ${
                  isDisabled 
                    ? 'border-gray-300 opacity-60 cursor-not-allowed'
                    : productCount > 0 
                    ? 'border-orange-500 shadow-lg ring-2 ring-orange-200' 
                    : 'border-gray-200 hover:border-orange-300'
                }`}>
                  {/* علامة التحديد مع العدد */}
                  {productCount > 0 && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold z-10 shadow-md">
                      {productCount}
                    </div>
                  )}
                  
                  {/* ✅ Status Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    {product.status === 'draft' && (
                      <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                        ✎ مسودة
                      </span>
                    )}
                    {product.status === 'pending' && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                        ⏳ مراجعة
                      </span>
                    )}
                    {product.status === 'private' && (
                      <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                        🔒 خاص
                      </span>
                    )}
                    {product.status === 'future' && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                        📅 مجدول
                      </span>
                    )}
                  </div>
                  
                  {/* Main Product Card */}
                  <div
                    onClick={() => {
                      if (isDisabled) {
                        alert(`⚠️ لا يمكن إضافة منتج "${product.name}" للحزمة لأنه غير منشور.\n\nيجب نشر المنتج أولاً قبل إضافته للحزمة الأونلاين.`);
                        return;
                      }
                      toggleProduct(product);
                    }}
                    className={`p-3 transition-all ${
                      isDisabled
                        ? 'cursor-not-allowed bg-gray-100'
                        : productCount > 0
                        ? 'bg-gradient-to-br from-orange-50 to-yellow-50 cursor-pointer'
                        : 'bg-white hover:bg-orange-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Image */}
                      {product.images && product.images[0] && (
                        <img
                          src={product.images[0].src}
                          alt={product.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview({
                              url: product.images[0].src,
                              name: product.name
                            });
                          }}
                          className="w-20 h-20 object-cover rounded cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all flex-shrink-0"
                        />
                      )}
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                              productCount > 0
                                ? 'bg-orange-500 border-orange-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {productCount > 0 && (
                              <span className="text-white text-xs font-bold">✓</span>
                            )}
                          </div>
                          <div className="font-bold text-sm text-gray-900 flex-1">
                            {product.name}
                            {isVariable && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                متغير
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {product.sku && (
                          <div className="text-xs text-gray-500 mb-1">
                            {product.sku}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm text-orange-600 font-bold">
                            {product.price} ج.م
                          </div>
                        </div>
                        
                        {/* ✅ رسالة تحذير للمنتجات غير المنشورة */}
                        {isDisabled && (
                          <div className="text-xs text-red-600 font-bold mt-1 bg-red-50 px-2 py-1 rounded border border-red-200">
                            ⚠️ غير منشور - لا يمكن إضافته للحزمة
                          </div>
                        )}
                        
                        {!isDisabled && isVariable && productCount === 0 && (
                          <div className="text-xs text-blue-600 font-bold mt-1">
                            📦 اضغط لإضافة نوع محدد
                          </div>
                        )}
                        {!isDisabled && isVariable && productCount > 0 && (
                          <div className="text-xs text-green-600 font-bold mt-1">
                            ✓ تم إضافة {productCount} {productCount === 1 ? 'نوع' : 'أنواع'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Variations Panel */}
                  {isVariable && isExpanded && (
                    <div className="bg-gray-50 border-t-2 border-orange-200 p-3">
                      <div className="text-sm font-bold text-gray-700 mb-2">
                        اختر نوع لإضافته:
                      </div>
                      
                      {/* استخدام variations من product نفسه (زي الكاشير) */}
                      {product.variations && Array.isArray(product.variations) && product.variations.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {product.variations
                            .filter(v => v && (v.id || v.variation_id))
                            .map((variation, varIndex) => {
                            const varId = variation.id || variation.variation_id;
                            
                            // Count how many times this variation is in selectedItems
                            const varCount = selectedItems.filter(item => 
                              item.productId === product.id && item.variationId === varId
                            ).length;
                            
                            // بناء اسم الـ variation من الـ attributes (زي الكاشير)
                            let varName = '';
                            if (Array.isArray(variation.attributes)) {
                              varName = variation.attributes.map(attr => attr.option).join(' - ');
                            } else if (typeof variation.attributes === 'object' && variation.attributes !== null) {
                              varName = Object.values(variation.attributes).join(' - ');
                            } else if (variation.name) {
                              varName = variation.name.replace(product.name, '').replace(' - ', '').trim();
                            }
                            
                            if (!varName) varName = `نوع #${varId}`;
                            
                            return (
                              <div
                                key={`var_${varId}_${varIndex}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addVariation(product.id, varId);
                                }}
                                className="p-2 rounded cursor-pointer border-2 transition-all bg-white border-gray-200 hover:border-green-300 hover:shadow-md"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {varName}
                                    </div>
                                    {variation.sku && (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        SKU: {variation.sku}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <div className="text-xs text-orange-600 font-bold">
                                        {variation.price || variation.regular_price || '0'} ج.م
                                      </div>
                                      {variation.stock_quantity !== undefined && (
                                        <div className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                                          variation.stock_quantity > 5
                                            ? 'bg-green-100 text-green-700'
                                            : variation.stock_quantity > 0
                                              ? 'bg-orange-100 text-orange-700'
                                              : 'bg-red-100 text-red-700'
                                        }`}>
                                          {variation.stock_quantity > 0 ? `📦 ${variation.stock_quantity}` : 'نفذ'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {varCount > 0 && (
                                      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {varCount}
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addVariation(product.id, varId);
                                      }}
                                      className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded transition-colors"
                                    >
                                      ➕ إضافة
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          لا توجد variations لهذا المنتج
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedProduct(null);
                        }}
                        className="mt-2 text-xs text-gray-600 hover:text-gray-800 w-full text-center"
                      >
                        إغلاق
                      </button>
                    </div>
                  )}

                  {/* Show variations button if variable and not expanded */}
                  {isVariable && !isExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedProduct(product.id);
                      }}
                      className="w-full bg-blue-50 text-blue-700 text-sm font-bold py-2 hover:bg-blue-100 transition-colors"
                    >
                      {productCount > 0 ? '➕ إضافة المزيد' : '⚙️ اختر نوع محدد'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا توجد منتجات
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 px-6 py-4 border-t-2 border-orange-200 sticky bottom-0">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* معلومات الحزمة */}
            <div className="flex-1 bg-white rounded-lg px-4 py-2 border-2 border-orange-200">
              <div className="text-xs text-gray-600">العناصر المحددة</div>
              <div className="text-2xl font-bold text-orange-600">{selectedItems.length}</div>
            </div>
            
            {/* الأزرار */}
            <div className="flex gap-3 sm:flex-1 justify-end">
              <button
                onClick={onClose}
                className="flex-1 text-sm sm:flex-initial bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                إغلاق
              </button>
              <button
                onClick={generateLink}
                disabled={selectedItems.length === 0}
                className="flex-1 text-sm sm:flex-initial bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                🔗 إنشاء رابط الحزمة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center">
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-4 right-4 bg-white text-black hover:bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold shadow-lg z-10"
            >
              ×
            </button>
            <div className="text-white text-center mb-4 font-bold text-lg px-4">
              {imagePreview.name}
            </div>
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
