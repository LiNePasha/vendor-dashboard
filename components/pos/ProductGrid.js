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
      // إذا كان العنصر variation استخدم variation_id كمفتاح، وإلا id
      const key = item.is_variation && item.variation_id ? `var_${item.variation_id}` : `prod_${item.id}`;
      newQuantities[key] = item.quantity;
    });
    setQuantities(newQuantities);
  }, [cart]);

  // Get actual cart quantity from props if available
  // product: قد يكون منتج أو variation
  const getCartQuantity = (product) => {
    if (product.is_variation && product.variation_id) {
      return quantities[`var_${product.variation_id}`] || 0;
    }
    return quantities[`prod_${product.id}`] || 0;
  };

  const handleDecrease = (product) => {
    const currentQty = getCartQuantity(product);
    const newQty = currentQty - 1;
    const key = product.is_variation && product.variation_id ? `var_${product.variation_id}` : `prod_${product.id}`;
    if (newQty <= 0) {
      setQuantities(prev => ({ ...prev, [key]: 0 }));
      // Remove from cart by setting quantity to 0
      if (onAddToCart) {
        onAddToCart({ ...product, _setQuantity: 0 });
      }
    } else {
      setQuantities(prev => ({ ...prev, [key]: newQty }));
      // Update cart quantity
      if (onAddToCart) {
        onAddToCart({ ...product, _setQuantity: newQty });
      }
    }
  };

  const handleIncrease = (product) => {
    const currentQty = getCartQuantity(product);
    if (currentQty < product.stock_quantity) {
      const newQty = currentQty + 1;
      const key = product.is_variation && product.variation_id ? `var_${product.variation_id}` : `prod_${product.id}`;
      setQuantities(prev => ({ ...prev, [key]: newQty }));
      onAddToCart(product);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {products.map((product) => {
        const isVariation = product.is_variation && product.variation_id;
        const key = isVariation ? `var_${product.variation_id}` : `prod_${product.id}`;
        const currentQty = quantities[key] || 0;
        const isInCart = currentQty > 0;

        return (
        <div key={product.id} className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-400 relative">
          
          {/* 🆕 زر التعديل */}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product.id); // إرسال ID فقط
              }}
              className="absolute top-2 left-2 z-20 bg-white hover:bg-blue-500 hover:text-white text-gray-700 rounded-lg w-8 h-8 flex items-center justify-center shadow-lg transition-all border border-gray-300 hover:border-blue-400"
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
            
            {/* 🆕 Variable Product Badge */}
            {product.type === 'variable' && (
              <div className="mb-2 flex flex-col gap-1">
                {Array.isArray(product.attributes) && product.attributes.length > 0 ? (
                  product.attributes.map((attr, idx) => (
                    <span
                      key={attr.id || idx}
                      className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-md flex items-center gap-1 border border-purple-200"
                    >
                      <span className="text-sm">🎨</span>
                      {attr.name}: {Array.isArray(attr.options) ? attr.options.join('، ') : ''}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-md flex items-center gap-1">
                    لا يوجد متغيرات
                  </span>
                )}
              </div>
            )}
            
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
              
              {/* 🆕 Variable Product - Select Button */}
              {product.type === 'variable' ? (
                <button
                  onClick={() => onSelectVariation && onSelectVariation(product)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-md"
                >
                  🎯 اختر
                </button>
              ) : (
                /* Simple Product - Counter Button */
                !isInCart ? (
                  <button
                    onClick={() => {
                      onAddToCart(product);
                      const key = product.is_variation && product.variation_id ? `var_${product.variation_id}` : `prod_${product.id}`;
                      setQuantities(prev => ({ ...prev, [key]: 1 }));
                    }}
                    disabled={product.stock_quantity === 0}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md border
                      ${product.stock_quantity > 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-500'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                      }`}
                  >
                    {product.stock_quantity > 0 ? '+ إضافة' : 'نفذ'}
                  </button>
                ) : (
                  <div className="flex items-center gap-0 bg-blue-600 rounded-lg shadow-md border border-blue-500">
                    <button
                      onClick={() => handleDecrease(product)}
                      className="px-2 py-1.5 text-white hover:bg-blue-700 rounded-r-lg transition-all font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="px-2 py-1 text-white font-bold text-sm min-w-[32px] text-center">
                      {currentQty}
                    </span>
                    <button
                      onClick={() => handleIncrease(product)}
                      disabled={currentQty >= product.stock_quantity}
                      className="px-2 py-1.5 text-white hover:bg-blue-700 rounded-l-lg transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}