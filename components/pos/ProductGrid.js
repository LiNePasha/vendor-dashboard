"use client";

import { useState, useEffect } from "react";

function ProductSkeleton() {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-3xl shadow-lg border-2 border-gray-100 animate-pulse">
      <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-48 rounded-2xl mb-4" />
      <div className="h-5 bg-gray-200 rounded-xl mb-3" />
      <div className="h-4 bg-gray-200 rounded-lg w-2/3 mb-3" />
      <div className="h-8 bg-gray-200 rounded-xl w-full" />
    </div>
  );
}

export function ProductGrid({ products, loading, onAddToCart, onEdit, onSelectVariation, cart = [], vendorId }) {
  const [quantities, setQuantities] = useState({});

  // 🔄 Sync quantities with actual cart
  useEffect(() => {
    const newQuantities = {};
    cart.forEach(item => {
      // استخدم الـ unique ID من الـ cart مباشرة
      newQuantities[item.id] = item.quantity;
    });
    setQuantities(newQuantities);
  }, [cart]);

  // Get actual cart quantity from props if available
  // product: قد يكون منتج أو variation
  const getCartQuantity = (product) => {
    // إنشاء الـ unique ID نفس طريقة handleVariationSelect
    const uniqueId = product.is_variation && product.variation_id 
      ? `${product.parent_id}_var_${product.variation_id}`
      : product.id;
    return quantities[uniqueId] || 0;
  };

  const handleDecrease = (product) => {
    const currentQty = getCartQuantity(product);
    const newQty = currentQty - 1;
    
    if (newQty <= 0) {
      // Remove from cart by setting quantity to 0
      if (onAddToCart) {
        // إنشاء product object بنفس الـ unique ID format
        const productWithUniqueId = product.is_variation && product.variation_id
          ? { ...product, id: `${product.parent_id}_var_${product.variation_id}` }
          : product;
        onAddToCart({ ...productWithUniqueId, _setQuantity: 0 });
      }
    } else {
      // Update cart quantity
      if (onAddToCart) {
        const productWithUniqueId = product.is_variation && product.variation_id
          ? { ...product, id: `${product.parent_id}_var_${product.variation_id}` }
          : product;
        onAddToCart({ ...productWithUniqueId, _setQuantity: newQty });
      }
    }
  };

  const handleIncrease = (product) => {
    const currentQty = getCartQuantity(product);
    if (currentQty < product.stock_quantity) {
      // للـ variations، نحتاج إنشاء product object بنفس صيغة handleVariationSelect
      const productToAdd = product.is_variation && product.variation_id
        ? { ...product, id: `${product.parent_id}_var_${product.variation_id}` }
        : product;
      onAddToCart(productToAdd);
    }
  };

  if (loading) {
    return (
      <>
        <div className="text-center py-12 mb-6">
          <div className="inline-block animate-spin text-6xl mb-4">🔄</div>
          <p className="text-indigo-600 font-black text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            جاري تحميل المنتجات...
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl shadow-xl border-2 border-gray-100">
        <div className="text-8xl mb-6">📦</div>
        <p className="text-gray-500 text-2xl font-bold">لا توجد منتجات</p>
        <p className="text-gray-400 text-sm mt-2">جرب البحث أو اختر قسم آخر</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
      {products.map((product) => {
        // استخدم uniqueId إذا موجود، وإلا أنشئ واحد
        const uniqueKey = product.uniqueId || (product.is_variation && product.variation_id 
          ? `${product.parent_id}_var_${product.variation_id}` 
          : `prod_${product.id}`);
        const currentQty = getCartQuantity(product);
        const isInCart = currentQty > 0;

        return (
        <div key={uniqueKey} className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-400 relative">
          
          {/* 🆕 زر التعديل */}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product.id); // إرسال ID فقط
              }}
              className="absolute top-2 left-2 z-20 bg-white hover:bg-slate-700 hover:text-white text-gray-700 rounded-lg w-8 h-8 flex items-center justify-center shadow-lg transition-all border border-gray-300 hover:border-slate-600"
              title="تعديل المنتج"
            >
              ✏️
            </button>
          )}
          
          {/* 🖼️ صورة المنتج */}
          <div className="relative h-36 md:h-40 overflow-hidden bg-gray-50">
            <img
              src={product.images?.[0]?.src || (vendorId ? `/logos/${vendorId}.webp` : '/placeholder.webp')}
              alt={product.name}
              className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
              onError={(e) => {
                // إذا فشل تحميل الصورة (سواء صورة المنتج أو لوجو البائع)، استخدم placeholder
                if (e.target.src !== '/placeholder.webp') {
                  e.target.src = '/placeholder.webp';
                }
              }}
            />
            {/* Stock Badge */}
            <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm border
              ${product.stock_quantity > 5 
                ? 'bg-green-500 text-white border-green-400'
                : product.stock_quantity > 0
                  ? 'bg-orange-500 text-white border-orange-400'
                  : 'bg-red-500 text-white border-red-400'
              }`}
            >
              {product.stock_quantity > 0
                ? `📦 ${product.stock_quantity}`
                : (product.type === 'variable' ? 'اختر أولاً' : 'نفذ')}
            </div>
          </div>
          
          <div className="p-3 relative">
            <h3 className="font-bold text-gray-900 mb-2 text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-blue-600 transition-colors" title={product.name}>
              {product.name}
            </h3>
            
            {/* 🆕 Variable Product - Show All Variations Directly */}
            {product.type === 'variable' && product.variations && product.variations.length > 0 ? (
              (() => {
                // Filter valid variations (must have variation_id or id, and not null)
                const validVariations = product.variations.filter(v => v && (v.variation_id || v.id)).map(v => ({
                  ...v,
                  variation_id: v.variation_id || v.id, // Normalize variation_id
                  attributes: (() => {
                    // Convert attributes object to array format
                    if (Array.isArray(v.attributes)) {
                      return v.attributes;
                    } else if (typeof v.attributes === 'object' && v.attributes !== null) {
                      // Convert {"attribute_color": "red"} to [{name: "color", option: "red"}]
                      return Object.entries(v.attributes).map(([key, value]) => {
                        // Remove 'attribute_' prefix and decode URI
                        const cleanKey = key.replace(/^attribute_/, '');
                        const decodedKey = decodeURIComponent(cleanKey);
                        return { name: decodedKey, option: value };
                      });
                    }
                    return [];
                  })()
                }));
                const validCount = validVariations.length;
                
                // Get available variations (with stock > 0)
                const availableVariations = validVariations.filter(v => v.stock_quantity > 0);
                const availableCount = availableVariations.length;
                
                return (
                  <div className="mb-1">
                    {/* Show available variations names */}
                    {availableCount > 0 && (
                      <div className="bg-gray-100 rounded p-1 mb-1 text-[9px] text-gray-700">
                        <span className="font-bold">متاح ({availableCount}):</span> {availableVariations.map((v, idx) => {
                          let name = 'نوع';
                          if (Array.isArray(v.attributes)) {
                            name = v.attributes.map(attr => attr.option).join('-');
                          } else if (typeof v.attributes === 'object' && v.attributes !== null) {
                            name = Object.values(v.attributes).join('-');
                          } else if (v.name) {
                            name = v.name.replace(product.name, '').replace(' - ', '').trim();
                          }
                          return idx === availableVariations.length - 1 ? name : name + '، ';
                        })}
                      </div>
                    )}
                    
                    {/* Show all variations in grid */}
                    <div className="flex gap-1 overflow-x-auto pb-2" style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#3b82f6 #e5e7eb'
                    }}>
                      <style jsx>{`
                        div::-webkit-scrollbar {
                          height: 8px;
                        }
                        div::-webkit-scrollbar-track {
                          background: #e5e7eb;
                          border-radius: 4px;
                        }
                        div::-webkit-scrollbar-thumb {
                          background: #3b82f6;
                          border-radius: 4px;
                        }
                        div::-webkit-scrollbar-thumb:hover {
                          background: #2563eb;
                        }
                      `}</style>
                      {validVariations.map((variation) => {
                  const varCartQty = getCartQuantity(variation);
                  const isVarInCart = varCartQty > 0;
                  const varKey = `${product.id}_var_${variation.variation_id}`;
                  
                  return (
                    <div
                      key={variation.variation_id}
                      className="bg-gray-50 border border-gray-200 rounded p-1 hover:bg-slate-50 hover:border-slate-300 transition-all flex flex-col flex-shrink-0"
                      style={{ minWidth: '65px' }}
                    >
                      <div className="flex flex-col gap-0.5 mb-1">
                        <div className="text-[9px] font-bold text-gray-800 truncate leading-tight text-center">
                          {(() => {
                            if (Array.isArray(variation.attributes)) {
                              return variation.attributes.map(attr => attr.option).join('-');
                            } else if (typeof variation.attributes === 'object' && variation.attributes !== null) {
                              return Object.values(variation.attributes).join('-');
                            } else if (variation.name) {
                              return variation.name.replace(product.name, '').replace(' - ', '').trim();
                            }
                            return 'نوع';
                          })()}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[9px] font-bold text-blue-600">
                            {variation.price}ج
                          </span>
                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                            variation.stock_quantity > 5 
                              ? 'bg-green-100 text-green-700'
                              : variation.stock_quantity > 0
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {variation.stock_quantity > 0 ? `${variation.stock_quantity}` : 'نفذ'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                        {!isVarInCart ? (
                          <button
                            onClick={() => {
                              let variationName = product.name;
                              if (Array.isArray(variation.attributes)) {
                                const attrs = variation.attributes.map(attr => attr.option).join(' - ');
                                variationName = `${product.name} - ${attrs}`;
                              } else if (typeof variation.attributes === 'object' && variation.attributes !== null) {
                                const attrs = Object.values(variation.attributes).join(' - ');
                                variationName = `${product.name} - ${attrs}`;
                              } else if (variation.name) {
                                variationName = variation.name;
                              }
                              
                              const variationWithId = {
                                ...variation,
                                id: varKey,
                                name: variationName,
                                parent_id: product.id,
                                parent_name: product.name,
                                is_variation: true
                              };
                              onAddToCart(variationWithId);
                            }}
                            disabled={variation.stock_quantity === 0}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all w-full ${
                              variation.stock_quantity > 0
                                ? 'bg-slate-700 text-white hover:bg-slate-800'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="flex items-center gap-0 bg-slate-700 rounded text-white text-[9px] w-full justify-center">
                            <button
                              onClick={() => handleDecrease(variation)}
                              className="px-1 py-0.5 hover:bg-slate-800 rounded-r transition-all font-bold flex-1"
                            >
                              −
                            </button>
                            <span className="px-1 py-0.5 font-bold">
                              {varCartQty}
                            </span>
                            <button
                              onClick={() => handleIncrease(variation)}
                              disabled={varCartQty >= variation.stock_quantity}
                              className="px-1 py-0.5 hover:bg-slate-800 rounded-l transition-all font-bold disabled:opacity-50 flex-1"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
                );
              })()
            ) : product.type === 'variable' ? (
              /* Fallback: Show select button if no variations loaded */
              <button
                onClick={() => onSelectVariation && onSelectVariation(product)}
                className="w-full mb-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-md"
              >
                🎯 اختر الأنواع
              </button>
            ) : null}
            
            {/* Simple Product Controls */}
            {product.type !== 'variable' && (
            <div className="flex items-center justify-between gap-2">
              {/* السعر مع دعم العروض */}
              <div className="flex flex-col">
                {product.sale_price && product.sale_price !== product.regular_price ? (
                  <>
                    <span className="text-base font-bold text-green-600">
                      {product.sale_price}
                      <span className="text-xs text-gray-500 mr-1">ج.م</span>
                    </span>
                    <span className="text-xs text-gray-400 line-through">
                      {product.regular_price || product.price} ج.م
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-gray-900">
                    {product.regular_price || product.price}
                    <span className="text-xs text-gray-500 mr-1">ج.م</span>
                  </span>
                )}
              </div>
              
              {/* Simple Product Counter */}
              {!isInCart ? (
                <button
                  onClick={() => {
                    onAddToCart(product);
                    const key = product.is_variation && product.variation_id ? `var_${product.variation_id}` : `prod_${product.id}`;
                    setQuantities(prev => ({ ...prev, [key]: 1 }));
                  }}
                  disabled={product.stock_quantity === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md border
                    ${product.stock_quantity > 0
                      ? 'bg-slate-700 text-white hover:bg-slate-800 border-slate-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                    }`}
                >
                  {product.stock_quantity > 0 ? '+ إضافة' : 'نفذ'}
                </button>
              ) : (
                <div className="flex items-center gap-0 bg-slate-700 rounded-lg shadow-md border border-slate-600">
                  <button
                    onClick={() => handleDecrease(product)}
                    className="px-2 py-1.5 text-white hover:bg-slate-800 rounded-r-lg transition-all font-bold text-sm"
                  >
                    −
                  </button>
                  <span className="px-2 py-1 text-white font-bold text-sm min-w-[32px] text-center">
                    {currentQty}
                  </span>
                  <button
                    onClick={() => handleIncrease(product)}
                    disabled={currentQty >= product.stock_quantity}
                    className="px-2 py-1.5 text-white hover:bg-slate-800 rounded-l-lg transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}