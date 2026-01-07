"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WholesalePricingModal({ 
  isOpen, 
  onClose, 
  products = [],
  vendorInfo
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1); // 1: Select Products, 2: Set Tiers, 3: Preview
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [listName, setListName] = useState(`تسعير جملة - ${new Date().toLocaleDateString('ar-EG')}`);
  
  // Tiers configuration
  const [tiers, setTiers] = useState([
    { from: 1, to: 4, discountType: 'percentage', discountValue: 0 }, // percentage or amount
    { from: 5, to: 10, discountType: 'percentage', discountValue: 10 },
    { from: 11, to: 20, discountType: 'percentage', discountValue: 15 },
    { from: 21, to: null, discountType: 'percentage', discountValue: 20 } // null means "and above"
  ]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedProducts([]);
      setSearch("");
      setSelectedCategory("all");
      setTiers([
        { from: 1, to: 4, discountType: 'percentage', discountValue: 0 },
        { from: 5, to: 10, discountType: 'percentage', discountValue: 10 },
        { from: 11, to: 20, discountType: 'percentage', discountValue: 15 },
        { from: 21, to: null, discountType: 'percentage', discountValue: 20 }
      ]);
    }
  }, [isOpen]);

  // Extract unique categories from products
  const categories = useMemo(() => {
    if (!products) return [];
    const catsMap = new Map();
    products.forEach(product => {
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(cat => {
          if (!catsMap.has(cat.id)) {
            catsMap.set(cat.id, cat);
          }
        });
      }
    });
    return Array.from(catsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(product => {
      const matchesSearch = !search || 
        product.name?.toLowerCase().includes(search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || 
        (product.categories && product.categories.some(cat => cat.id === parseInt(selectedCategory)));
      
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  if (!isOpen) return null;

  // Toggle product selection
  const toggleProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Select all filtered
  const selectAll = () => {
    const allIds = filteredProducts.map(p => p.id);
    setSelectedProducts(allIds);
  };

  // Clear all
  const clearAll = () => {
    setSelectedProducts([]);
  };

  // Add new tier
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newFrom = lastTier.to ? lastTier.to + 1 : lastTier.from + 10;
    setTiers([...tiers, { from: newFrom, to: newFrom + 9, discountType: 'percentage', discountValue: 0 }]);
  };

  // Remove tier
  const removeTier = (index) => {
    if (tiers.length <= 1) return; // Keep at least one tier
    setTiers(tiers.filter((_, i) => i !== index));
  };

  // Update tier
  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    if (field === 'to' && value === '') {
      newTiers[index][field] = null; // null means "and above"
    } else if (field === 'discountType') {
      newTiers[index][field] = value;
    } else if (field === 'discountValue') {
      newTiers[index][field] = value === '' ? 0 : parseFloat(value) || 0;
    } else {
      newTiers[index][field] = value === '' ? 0 : parseFloat(value) || 0;
    }
    setTiers(newTiers);
  };

  // Calculate price for a product based on tier
  const calculatePrice = (regularPrice, tier) => {
    if (tier.discountType === 'percentage') {
      return regularPrice * (1 - tier.discountValue / 100);
    } else {
      return regularPrice - tier.discountValue;
    }
  };

  // Navigate to print page
  const handlePrint = () => {
    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));
    const printData = {
      listName,
      products: selectedProductsData.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        regularPrice: parseFloat(p.price) || 0,
        image: p.images?.[0]?.src || p.image
      })),
      tiers: tiers.map(t => ({
        from: t.from,
        to: t.to,
        discountType: t.discountType,
        discountValue: t.discountValue
      })),
      date: new Date().toISOString()
    };

    // Store in localStorage
    localStorage.setItem('wholesalePrintData', JSON.stringify(printData));
    
    // Open print page
    window.open('/pos/wholesale/print', '_blank');
    onClose();
  };

  const selectedCount = selectedProducts.length;

  // Step 1: Product Selection
  const renderStep1 = () => {
    return (
      <div className="p-6">
        {/* Search and Category Filter */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="🔍 ابحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="all">🏷️ كل الأقسام ({products.length})</option>
            {categories.map(cat => {
              const count = products.filter(p => 
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

        {/* Select Actions */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={selectAll}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            ✓ اختر الكل ({filteredProducts.length})
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm font-medium"
          >
            ✗ إلغاء الكل
          </button>
        </div>

        {/* Selected Count */}
        <div className="mb-4 text-center">
          <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold">
            {selectedCount} منتج محدد
          </span>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.map(product => {
            const isSelected = selectedProducts.includes(product.id);
            return (
              <div
                key={product.id}
                onClick={() => toggleProduct(product.id)}
                className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex flex-col gap-2">
                  {(product.images && product.images[0]) && (
                    <img
                      src={product.images[0].src || product.image}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="font-bold text-sm text-gray-900 truncate flex-1">
                      {product.name}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 px-1">
                    سعر التجزئة: <span className="font-bold">{parseFloat(product.price) || 0} ج</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center text-gray-500 py-8">لا توجد منتجات</div>
        )}
      </div>
    );
  };

  // Step 2: Tiers Configuration
  const renderStep2 = () => {
    return (
      <div className="p-6">
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">📊 تحديد شرائح الخصومات</h3>
          <p className="text-sm text-blue-700">
            حدد الخصم لكل شريحة كمية. سيتم حساب السعر تلقائياً لكل منتج ({selectedCount} منتج)
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {tiers.map((tier, index) => (
            <div key={index} className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-600 font-medium">من (قطعة)</label>
                  <input
                    type="number"
                    value={tier.from}
                    onChange={(e) => updateTier(index, 'from', parseInt(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-center font-bold focus:ring-2 focus:ring-green-500 outline-none"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium">إلى (قطعة)</label>
                  <input
                    type="number"
                    value={tier.to === null ? '' : tier.to}
                    onChange={(e) => updateTier(index, 'to', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="فأكثر"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-center font-bold focus:ring-2 focus:ring-green-500 outline-none"
                    min={tier.from + 1}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium">نوع الخصم</label>
                  <select
                    value={tier.discountType}
                    onChange={(e) => updateTier(index, 'discountType', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-center font-bold focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="percentage">نسبة %</option>
                    <option value="amount">مبلغ ج</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600 font-medium">
                    {tier.discountType === 'percentage' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (ج)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tier.discountValue}
                      onChange={(e) => updateTier(index, 'discountValue', parseFloat(e.target.value) || 0)}
                      className="w-full border-2 border-green-400 rounded px-3 py-2 text-center font-bold text-green-700 text-lg focus:ring-2 focus:ring-green-500 outline-none"
                      min="0"
                      max={tier.discountType === 'percentage' ? 100 : undefined}
                      step={tier.discountType === 'percentage' ? '1' : '0.5'}
                      placeholder={tier.discountType === 'percentage' ? '10' : '20'}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">
                      {tier.discountType === 'percentage' ? '%' : 'ج'}
                    </span>
                  </div>
                </div>
              </div>
              
              {tiers.length > 1 && (
                <button
                  onClick={() => removeTier(index)}
                  className="text-red-500 hover:text-red-700 px-3 py-2 text-xl"
                  title="حذف الشريحة"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addTier}
          className="w-full border-2 border-dashed border-green-400 text-green-600 px-4 py-3 rounded-lg font-bold hover:bg-green-50 transition-colors"
        >
          + إضافة شريحة جديدة
        </button>

        {/* Quick Templates */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-bold text-gray-700 mb-3">⚡ قوالب سريعة:</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setTiers([
                  { from: 1, to: 9, discountType: 'percentage', discountValue: 0 },
                  { from: 10, to: 19, discountType: 'percentage', discountValue: 10 },
                  { from: 20, to: 49, discountType: 'percentage', discountValue: 15 },
                  { from: 50, to: null, discountType: 'percentage', discountValue: 20 }
                ]);
              }}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
            >
              موزعين (10-15-20%)
            </button>
            <button
              onClick={() => {
                setTiers([
                  { from: 1, to: 4, discountType: 'percentage', discountValue: 0 },
                  { from: 5, to: 10, discountType: 'percentage', discountValue: 5 },
                  { from: 11, to: null, discountType: 'percentage', discountValue: 10 }
                ]);
              }}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
            >
              تجار تجزئة (5-10%)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Step 3: Preview
  const renderStep3 = () => {
    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));
    
    return (
      <div className="p-6">
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-bold text-green-900 mb-2">✓ معاينة قائمة التسعير</h3>
          <p className="text-sm text-green-700">
            {selectedCount} منتج مع {tiers.length} شريحة تسعير
          </p>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedProductsData.map(product => {
            const regularPrice = parseFloat(product.price) || 0;
            return (
              <div key={product.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start gap-4">
                  {(product.images?.[0]?.src || product.image) && (
                    <img
                      src={product.images[0].src || product.image}
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{product.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">سعر التجزئة: {regularPrice.toFixed(2)} ج</p>
                    
                    <div className="space-y-1">
                      {tiers.map((tier, idx) => {
                        const discountedPrice = calculatePrice(regularPrice, tier);
                        const discountLabel = tier.discountType === 'percentage' 
                          ? `${tier.discountValue}%` 
                          : `${tier.discountValue} ج`;
                        
                        return (
                          <div key={idx} className="text-sm flex items-center gap-2">
                            <span className="text-gray-600">
                              • {tier.from}-{tier.to || '+'} قطع
                            </span>
                            <span className="text-green-700 font-bold">
                              → {discountedPrice.toFixed(2)} ج/قطعة
                            </span>
                            {tier.discountValue > 0 && (
                              <span className="text-red-600 text-xs">
                                (خصم {discountLabel})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header with Progress */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">🏪 قائمة تسعير الجملة</h2>
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="mt-2 w-64 bg-white/20 text-white placeholder-white/70 rounded px-3 py-1.5 text-sm outline-none"
                placeholder="اسم قائمة التسعير"
              />
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'اختيار المنتجات' },
              { num: 2, label: 'تحديد الشرائح' },
              { num: 3, label: 'معاينة وطباعة' }
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 flex-1 ${
                  currentStep >= step.num ? 'opacity-100' : 'opacity-50'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentStep >= step.num 
                      ? 'bg-white text-green-600' 
                      : 'bg-white/20 text-white'
                  }`}>
                    {currentStep > step.num ? '✓' : step.num}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {idx < 2 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    currentStep > step.num ? 'bg-white' : 'bg-white/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content based on step */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
          <button
            onClick={() => {
              if (currentStep === 1) {
                onClose();
              } else {
                setCurrentStep(currentStep - 1);
              }
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
          >
            {currentStep === 1 ? 'إغلاق' : '← السابق'}
          </button>
          
          {currentStep < 3 && (
            <button
              onClick={() => {
                if (currentStep === 1 && selectedCount === 0) {
                  alert('⚠️ اختر منتجات أولاً');
                  return;
                }
                if (currentStep === 2) {
                  const hasValidTier = tiers.some(t => t.discountValue > 0 || t.discountValue === 0);
                  if (!hasValidTier) {
                    alert('⚠️ حدد خصومات الشرائح أولاً');
                    return;
                  }
                }
                setCurrentStep(currentStep + 1);
              }}
              disabled={currentStep === 1 && selectedCount === 0}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              التالي ({currentStep === 1 ? selectedCount : ''}) →
            </button>
          )}
          
          {currentStep === 3 && (
            <button
              onClick={handlePrint}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
            >
              🖨️ طباعة القائمة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

