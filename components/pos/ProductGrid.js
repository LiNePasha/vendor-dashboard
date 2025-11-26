"use client";

import { useState, useEffect } from "react";

function ProductSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow animate-pulse">
      <div className="bg-gray-200 h-40 rounded mb-4" />
      <div className="h-4 bg-gray-200 rounded mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export function ProductGrid({ products, loading, onAddToCart, cart = [] }) {
  const [quantities, setQuantities] = useState({});

  // 🔄 Sync quantities with actual cart
  useEffect(() => {
    const newQuantities = {};
    cart.forEach(item => {
      newQuantities[item.id] = item.quantity;
    });
    setQuantities(newQuantities);
  }, [cart]);

  // Get actual cart quantity from props if available
  const getCartQuantity = (productId) => {
    return quantities[productId] || 0;
  };

  const handleDecrease = (product) => {
    const currentQty = getCartQuantity(product.id);
    const newQty = currentQty - 1;
    
    if (newQty <= 0) {
      setQuantities(prev => ({ ...prev, [product.id]: 0 }));
      // Remove from cart by setting quantity to 0
      if (onAddToCart) {
        onAddToCart({ ...product, _setQuantity: 0 });
      }
    } else {
      setQuantities(prev => ({ ...prev, [product.id]: newQty }));
      // Update cart quantity
      if (onAddToCart) {
        onAddToCart({ ...product, _setQuantity: newQty });
      }
    }
  };

  const handleIncrease = (product) => {
    const currentQty = getCartQuantity(product.id);
    if (currentQty < product.stock_quantity) {
      const newQty = currentQty + 1;
      setQuantities(prev => ({ ...prev, [product.id]: newQty }));
      onAddToCart(product);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📦</div>
        <p className="text-gray-500 text-lg">لا توجد منتجات</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {products.map((product) => {
        const currentQty = quantities[product.id] || 0;
        const isInCart = currentQty > 0;

        return (
        <div key={product.id} className="bg-white rounded-lg shadow hover:shadow-xl transition-all duration-300 overflow-hidden group">
          <div className="relative h-36 md:h-40 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
            <img
              src={product.images[0]?.src || '/placeholder.webp'}
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
            />
            <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] md:text-xs font-bold shadow-md
              ${product.stock_quantity > 5 
                ? 'bg-green-500 text-white'
                : product.stock_quantity > 0
                  ? 'bg-orange-500 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              {product.stock_quantity > 0 ? `📦 ${product.stock_quantity}` : 'نفذ'}
            </span>
          </div>
          
          <div className="p-3 md:p-4">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm md:text-base line-clamp-2 min-h-[2.5rem]" title={product.name}>
              {product.name}
            </h3>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-base md:text-lg font-bold text-gray-900">
                {product.regular_price || product.price}
                <span className="text-xs text-gray-500 mr-1">ج.م</span>
              </span>
              
              {/* Counter Button */}
              {!isInCart ? (
                <button
                  onClick={() => {
                    onAddToCart(product);
                    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
                  }}
                  disabled={product.stock_quantity === 0}
                  className={`px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all
                    ${product.stock_quantity > 0
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {product.stock_quantity > 0 ? '+ إضافة' : 'نفذ'}
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-blue-600 rounded-lg shadow-md">
                  <button
                    onClick={() => handleDecrease(product)}
                    className="px-2 py-1.5 md:py-2 text-white hover:bg-blue-700 rounded-r-lg transition-colors font-bold text-sm md:text-base"
                  >
                    −
                  </button>
                  <span className="px-2 py-1 text-white font-bold text-sm md:text-base min-w-[24px] text-center">
                    {currentQty}
                  </span>
                  <button
                    onClick={() => handleIncrease(product)}
                    disabled={currentQty >= product.stock_quantity}
                    className="px-2 py-1.5 md:py-2 text-white hover:bg-blue-700 rounded-l-lg transition-colors font-bold text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}