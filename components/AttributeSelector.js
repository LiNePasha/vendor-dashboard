'use client';

import { useState, useEffect } from 'react';

// 🔥 Global cache للـ attributes لتجنب التحميل المتكرر
let attributesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 دقائق

/**
 * AttributeSelector Component
 * يسمح باختيار attributes من WooCommerce أو إنشاء جديدة
 * @param {Array} attributes - الـ attributes الحالية
 * @param {Function} onChange - callback عند تغيير attributes
 * @param {Function} onGenerateVariations - callback عند توليد variations
 */
export default function AttributeSelector({ attributes, onChange, onGenerateVariations }) {
  const [wooAttributes, setWooAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  useEffect(() => {
    loadWooAttributes();
  }, []);

  const loadWooAttributes = async () => {
    // 🔥 استخدام الـ cache لو موجود وصالح
    if (attributesCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.log('[AttributeSelector] ✅ Using cached attributes');
      setWooAttributes(attributesCache);
      return;
    }

    setLoadingAttributes(true);
    try {
      console.log('[AttributeSelector] 🚀 Fetching attributes from API...');
      const response = await fetch('/api/products/attributes?include_terms=true');
      const data = await response.json();
      
      
      if (data.success && data.attributes) {
        attributesCache = data.attributes;
        cacheTimestamp = Date.now();
        setWooAttributes(data.attributes);
      } else {
        setWooAttributes([]);
      }
    } catch (error) {
      setWooAttributes([]);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const addAttribute = (wooAttrId = null) => {
    
    if (wooAttrId) {
      const wooAttr = wooAttributes.find(a => a.id === wooAttrId);
      
      if (wooAttr) {
        if (attributes.some(a => a.id === wooAttr.id)) {
          alert('⚠️ هذه السمة مضافة بالفعل');
          return;
        }
        
        const newAttr = {
          id: wooAttr.id,
          name: wooAttr.name,
          slug: wooAttr.slug,
          options: [],
          isFromWoo: true
        };
        
        onChange([...attributes, newAttr]);
      }
    } else {
      const newAttr = { 
        name: '', 
        options: [],
        isFromWoo: false
      };
      onChange([...attributes, newAttr]);
    }
  };

  const updateAttribute = (index, field, value) => {
    const updated = [...attributes];
    updated[index][field] = value;
    onChange(updated);
  };

  const removeAttribute = (index) => {
    onChange(attributes.filter((_, i) => i !== index));
  };

  const addOption = (attrIndex, option) => {
    if (!option || option.trim() === '') return;
    
    const updated = [...attributes];
    if (!updated[attrIndex].options.includes(option.trim())) {
      updated[attrIndex].options.push(option.trim());
      onChange(updated);
    }
  };

  const removeOption = (attrIndex, optionIndex) => {
    const updated = [...attributes];
    updated[attrIndex].options.splice(optionIndex, 1);
    onChange(updated);
  };

  const getTotalCombinations = () => {
    if (attributes.length === 0) return 0;
    return attributes.reduce((acc, a) => acc * (a.options.length || 1), 1);
  };

  return (
    <div className="border-2 border-dashed border-purple-300 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
          🏷️ السمات (Attributes)
        </h3>
        <div className="flex gap-2 flex-wrap">
          {/* اختيار من WooCommerce */}
          {wooAttributes.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addAttribute(parseInt(e.target.value));
                  e.target.value = '';
                }
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold border-0 cursor-pointer hover:bg-indigo-700 transition-all"
            >
              <option value="">➕ اختر سمة موجودة ({wooAttributes.length})</option>
              {wooAttributes
                .filter(woo => !attributes.some(a => a.id === woo.id))
                .map(woo => (
                  <option key={woo.id} value={woo.id}>
                    {woo.name} ({woo.terms?.length || 0} خيارات)
                  </option>
                ))}
            </select>
          )}
          
          <button
            type="button"
            onClick={() => {
              addAttribute();
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <span>+</span> سمة جديدة
          </button>
          
          {!loadingAttributes && wooAttributes.length === 0 && (
            <div className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 flex items-center gap-2">
              <span>⚠️</span>
              <span>لا توجد سمات في WooCommerce. استخدم "سمة جديدة" لإنشاء سمات يدوياً.</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loadingAttributes && (
        <div className="text-center py-4 text-purple-600">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent mx-auto"></div>
          <p className="text-sm mt-2">جاري تحميل السمات...</p>
        </div>
      )}

      {/* Empty State */}
      {attributes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-4xl mb-3">🎨</p>
          <p className="font-medium">لم يتم إضافة سمات بعد</p>
          <p className="text-sm mt-2">مثال: اللون، المقاس، الحجم، النوع</p>
          {wooAttributes.length > 0 && (
            <p className="text-xs mt-2 text-indigo-600">💡 يمكنك اختيار من السمات الموجودة أعلاه</p>
          )}
        </div>
      ) : (
        <>
          {/* Attributes List */}
          <div className="space-y-4 mb-4">
            {attributes.map((attr, attrIndex) => {
              const wooAttr = attr.isFromWoo ? wooAttributes.find(w => w.id === attr.id) : null;
              const availableTerms = wooAttr?.terms || [];
              
              return (
                <div key={attrIndex} className="bg-white rounded-lg p-4 border-2 border-purple-200 shadow-sm">
                  {/* Attribute Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => updateAttribute(attrIndex, 'name', e.target.value)}
                        placeholder="اسم السمة (مثل: اللون)"
                        className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                        disabled={attr.isFromWoo}
                      />
                      {attr.isFromWoo && (
                        <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                          <span>📦</span> من الموقع
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttribute(attrIndex)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
                    >
                      🗑️ حذف
                    </button>
                  </div>

                  {/* WooCommerce Terms (if available) */}
                  {availableTerms.length > 0 && (
                    <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <p className="text-xs font-semibold text-indigo-800 mb-2">
                        ⭐ خيارات متاحة من الموقع:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableTerms.map(term => (
                          <button
                            key={term.id}
                            type="button"
                            onClick={() => {
                              if (!attr.options.includes(term.name)) {
                                addOption(attrIndex, term.name);
                              }
                            }}
                            disabled={attr.options.includes(term.name)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                              attr.options.includes(term.name)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-200 text-indigo-700 hover:bg-indigo-300 cursor-pointer'
                            }`}
                          >
                            {term.name} {attr.options.includes(term.name) && '✓'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Selected Options */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      الخيارات المحددة ({attr.options.length}):
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {attr.options.map((option, optIndex) => (
                        <span
                          key={optIndex}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-2 font-medium"
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() => removeOption(attrIndex, optIndex)}
                            className="hover:text-red-600 font-bold text-lg leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {attr.options.length === 0 && (
                        <span className="text-xs text-gray-400 italic">لم يتم إضافة خيارات بعد</span>
                      )}
                    </div>
                    
                    {/* Add New Option */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="أضف خيار جديد (مثل: أحمر)"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addOption(attrIndex, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.target.previousElementSibling;
                          addOption(attrIndex, input.value);
                          input.value = '';
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold transition-all"
                      >
                        + إضافة
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate Variations Button */}
          {attributes.every(a => a.name && a.options.length > 0) && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onGenerateVariations}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-3 mx-auto font-bold shadow-lg hover:shadow-xl"
              >
                <span className="text-xl">⚡</span>
                توليد المتغيرات ({getTotalCombinations()})
                <span className="text-xl">⚡</span>
              </button>
              <p className="text-xs text-purple-700 mt-2">
                سيتم إنشاء {getTotalCombinations()} متغير من التركيبات الممكنة
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
