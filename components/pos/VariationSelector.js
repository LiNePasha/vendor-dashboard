"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

/**
 * VariationSelector - مودال لاختيار variation من منتج variable
 * 
 * Props:
 * - product: المنتج الأساسي (variable product)
 * - variations: قائمة الـ variations
 * - onClose: دالة إغلاق المودال
 * - onSelect: دالة عند اختيار variation - يرجع (product, selectedVariation)
 */
export default function VariationSelector({ product, variations, onClose, onSelect }) {
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [availableOptions, setAvailableOptions] = useState({});

  // استخراج الـ attributes من المنتج الأساسي
  const productAttributes = product?.attributes?.filter(attr => attr.variation) || [];

  useEffect(() => {
    // حساب الخيارات المتاحة بناءً على الاختيارات الحالية
    if (!variations || variations.length === 0) return;

    const available = {};
    
    productAttributes.forEach(attr => {
      const attrName = attr.name;
      available[attrName] = new Set();

      variations.forEach(variation => {
        // تحقق: هل هذا variation متوافق مع الاختيارات الحالية؟
        const isCompatible = Object.entries(selectedAttributes).every(([key, value]) => {
          if (key === attrName) return true; // نفس الـ attribute
          const varAttr = variation.attributes.find(a => a.name === key);
          return !varAttr || varAttr.option === value || value === '';
        });

        if (isCompatible) {
          const varAttr = variation.attributes.find(a => a.name === attrName);
          if (varAttr && variation.in_stock) {
            available[attrName].add(varAttr.option);
          }
        }
      });

      available[attrName] = Array.from(available[attrName]);
    });

    setAvailableOptions(available);
  }, [selectedAttributes, variations, productAttributes]);

  useEffect(() => {
    // البحث عن variation مطابق للاختيارات
    if (!variations || variations.length === 0) {
      setSelectedVariation(null);
      return;
    }

    // تحقق: هل كل attributes مختارة؟
    const allSelected = productAttributes.every(attr => 
      selectedAttributes[attr.name] && selectedAttributes[attr.name] !== ''
    );

    if (!allSelected) {
      setSelectedVariation(null);
      return;
    }

    // ابحث عن variation مطابق
    const match = variations.find(variation => {
      return variation.attributes.every(attr => {
        return selectedAttributes[attr.name] === attr.option;
      });
    });

    setSelectedVariation(match || null);
  }, [selectedAttributes, variations, productAttributes]);

  const handleAttributeSelect = (attrName, value) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attrName]: value
    }));
  };

  const handleAddToCart = () => {
    if (!selectedVariation) return;
    onSelect(product, selectedVariation);
    onClose();
  };

  if (!product || !variations) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="text-lg font-bold">اختر المواصفات</h2>
              <p className="text-sm text-blue-100">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* No variations available */}
          {(!variations || variations.length === 0) && (
            <div className="text-center py-8">
              <span className="text-6xl">📦</span>
              <p className="mt-4 text-gray-600 font-medium">
                لا توجد متغيرات متاحة لهذا المنتج
              </p>
            </div>
          )}

          {/* Attributes Selection */}
          {variations && variations.length > 0 && productAttributes.map((attr, index) => {
            const options = availableOptions[attr.name] || [];
            
            return (
              <div key={index} className="mb-6">
                <label className="flex text-sm font-bold text-gray-700 mb-3 items-center gap-2">
                  <span className="text-lg">
                    {attr.name === 'اللون' || attr.name.includes('لون') ? '🎨' : 
                     attr.name === 'المقاس' || attr.name.includes('مقاس') ? '📏' : 
                     attr.name === 'الحجم' || attr.name.includes('حجم') ? '📐' : '🏷️'}
                  </span>
                  {attr.name}:
                </label>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {attr.options?.map((option, optIndex) => {
                    const isAvailable = options.includes(option);
                    const isSelected = selectedAttributes[attr.name] === option;
                    
                    return (
                      <button
                        key={optIndex}
                        onClick={() => isAvailable && handleAttributeSelect(attr.name, option)}
                        disabled={!isAvailable}
                        className={`
                          px-3 py-2.5 rounded-lg font-semibold text-sm transition-all border-2
                          ${isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : isAvailable
                              ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                          }
                        `}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Selected Variation Preview */}
          {selectedVariation && (
            <div className="mt-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <div className="flex items-start gap-4">
                {/* Image */}
                {selectedVariation.image && (
                  <div className="flex-shrink-0 w-24 h-24 relative rounded-lg overflow-hidden border-2 border-green-300 shadow-md">
                    <Image
                      src={selectedVariation.image}
                      alt={selectedVariation.description}
                      fill
                      className="object-contain bg-white"
                    />
                  </div>
                )}
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    {selectedVariation.description || 'متغير محدد'}
                  </h3>
                  
                  <div className="space-y-1.5">
                    {/* Price */}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {selectedVariation.price}
                        <span className="text-sm text-gray-500 mr-1">ج.م</span>
                      </span>
                      {selectedVariation.sale_price && (
                        <span className="text-sm text-gray-500 line-through">
                          {selectedVariation.regular_price}
                        </span>
                      )}
                    </div>
                    
                    {/* Stock - API & Local */}
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${
                        selectedVariation.stock_quantity > 5 
                          ? 'text-blue-600' 
                          : selectedVariation.stock_quantity > 0
                            ? 'text-orange-600'
                            : 'text-red-600'
                      }`}>
                        🌐 موقع: {selectedVariation.stock_quantity}
                      </span>
                      {selectedVariation.localStock !== undefined && (
                        <span className={`text-sm font-semibold ${
                          selectedVariation.localStock > 5 
                            ? 'text-green-600' 
                            : selectedVariation.localStock > 0
                              ? 'text-orange-600'
                              : 'text-gray-400'
                        }`}>
                          🏪 محلي: {selectedVariation.localStock}
                        </span>
                      )}
                    </div>
                    
                    {/* SKU */}
                    {selectedVariation.sku && (
                      <div className="text-xs text-gray-500">
                        SKU: {selectedVariation.sku}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection Hint */}
          {!selectedVariation && productAttributes.length > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <span className="text-lg">💡</span>
                اختر جميع المواصفات لإضافة المنتج للسلة
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-white text-gray-700 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-100 transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariation || selectedVariation.stock_quantity === 0}
            className={`
              flex-1 px-5 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
              ${selectedVariation && selectedVariation.stock_quantity > 0
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <span className="text-xl">✓</span>
            إضافة للسلة
          </button>
        </div>
      </div>
    </div>
  );
}
