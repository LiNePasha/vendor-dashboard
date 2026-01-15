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
  
  // Tiers configuration per product: { productId: [tiers] }
  const [productTiers, setProductTiers] = useState({});
  
  // Track which product is expanded in Step 2
  const [expandedProduct, setExpandedProduct] = useState(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedProducts([]);
      setSearch("");
      setSelectedCategory("all");
      setProductTiers({});
      setExpandedProduct(null);
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
    setSelectedProducts(prev => {
      const newSelected = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      
      // Initialize tiers for newly selected products
      if (newSelected.includes(productId) && !productTiers[productId]) {
        setProductTiers(prevTiers => ({
          ...prevTiers,
          [productId]: [
            { from: 5, to: 20, discountType: 'percentage', discountValue: 0 },
            { from: 20, to: 40, discountType: 'percentage', discountValue: 0 }
          ]
        }));
      }
      
      return newSelected;
    });
  };

  // Select all filtered
  const selectAll = () => {
    const allIds = filteredProducts.map(p => p.id);
    setSelectedProducts(allIds);
    
    // Initialize tiers for all selected products
    const newTiers = { ...productTiers };
    allIds.forEach(id => {
      if (!newTiers[id]) {
        newTiers[id] = [
          { from: 5, to: 20, discountType: 'percentage', discountValue: 0 },
          { from: 20, to: 40, discountType: 'percentage', discountValue: 0 }
        ];
      }
    });
    setProductTiers(newTiers);
  };

  // Clear all
  const clearAll = () => {
    setSelectedProducts([]);
  };

  // Add new tier for a product
  const addTier = (productId) => {
    const currentTiers = productTiers[productId] || [];
    const lastTier = currentTiers[currentTiers.length - 1];
    const newFrom = lastTier.to ? lastTier.to + 1 : lastTier.from + 10;
    
    setProductTiers(prev => ({
      ...prev,
      [productId]: [...currentTiers, { from: newFrom, to: newFrom + 9, discountType: 'percentage', discountValue: 0 }]
    }));
  };

  // Remove tier for a product
  const removeTier = (productId, index) => {
    const currentTiers = productTiers[productId] || [];
    if (currentTiers.length <= 1) return; // Keep at least one tier
    
    setProductTiers(prev => ({
      ...prev,
      [productId]: currentTiers.filter((_, i) => i !== index)
    }));
  };

  // Update tier for a product
  const updateTier = (productId, index, field, value) => {
    const currentTiers = [...(productTiers[productId] || [])];
    if (field === 'to' && value === '') {
      currentTiers[index][field] = null;
    } else if (field === 'discountType') {
      currentTiers[index][field] = value;
    } else if (field === 'discountValue') {
      currentTiers[index][field] = value === '' ? 0 : parseFloat(value) || 0;
    } else {
      currentTiers[index][field] = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    setProductTiers(prev => ({
      ...prev,
      [productId]: currentTiers
    }));
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
        image: p.images?.[0]?.src || p.image,
        tiers: productTiers[p.id] || []
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

  // Step 2: Tiers Configuration (Per Product)
  const renderStep2 = () => {
    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));
    
    // Set initial expanded product if none is set
    if (expandedProduct === null && selectedProductsData.length > 0) {
      setExpandedProduct(selectedProductsData[0].id);
    }
    
    return (
      <div className="p-6">
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">📊 تحديد شرائح الخصومات لكل منتج</h3>
          <p className="text-sm text-blue-700">
            قم بتحديد شرائح الخصومات لكل منتج على حدة ({selectedCount} منتج)
          </p>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {selectedProductsData.map((product) => {
            const productId = product.id;
            const tiers = productTiers[productId] || [];
            const isExpanded = expandedProduct === productId;
            
            return (
              <div key={productId} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                {/* Product Header */}
                <div 
                  className="bg-gray-100 p-4 cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => setExpandedProduct(isExpanded ? null : productId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {product.images?.[0]?.src && (
                        <img 
                          src={product.images[0].src} 
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded border border-gray-300"
                        />
                      )}
                      <div>
                        <h4 className="font-bold text-gray-900">{product.name}</h4>
                        <p className="text-sm text-gray-600">
                          سعر التجزئة: <span className="font-bold">{parseFloat(product.price) || 0} ج</span>
                          {product.sku && <span className="mr-2">• كود: {product.sku}</span>}
                        </p>
                      </div>
                    </div>
                    <button className="text-2xl text-gray-600">
                      {isExpanded ? '▼' : '◀'}
                    </button>
                  </div>
                </div>

                {/* Tiers Configuration */}
                {isExpanded && (
                  <div className="p-4 bg-white">
                    <div className="space-y-3 mb-4">
                      {tiers.map((tier, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2">
                            <div>
                              <label className="text-xs text-gray-600 font-medium">من</label>
                              <input
                                type="number"
                                value={tier.from}
                                onChange={(e) => updateTier(productId, index, 'from', parseInt(e.target.value) || 1)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                min="1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 font-medium">إلى</label>
                              <input
                                type="number"
                                value={tier.to === null ? '' : tier.to}
                                onChange={(e) => updateTier(productId, index, 'to', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="+"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                min={tier.from + 1}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 font-medium">نوع</label>
                              <select
                                value={tier.discountType}
                                onChange={(e) => updateTier(productId, index, 'discountType', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-green-500 outline-none"
                              >
                                <option value="percentage">%</option>
                                <option value="amount">ج</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs text-gray-600 font-medium">قيمة الخصم</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={tier.discountValue}
                                  onChange={(e) => updateTier(productId, index, 'discountValue', parseFloat(e.target.value) || 0)}
                                  className="w-full border-2 border-green-400 rounded px-2 py-1 text-center font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                                  min="0"
                                  max={tier.discountType === 'percentage' ? 100 : undefined}
                                  step={tier.discountType === 'percentage' ? '1' : '0.5'}
                                />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">
                                  {tier.discountType === 'percentage' ? '%' : 'ج'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {tiers.length > 1 && (
                            <button
                              onClick={() => removeTier(productId, index)}
                              className="text-red-500 hover:text-red-700 px-2 py-1 text-lg"
                              title="حذف"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addTier(productId)}
                      className="w-full border-2 border-dashed border-green-400 text-green-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-50 transition-colors"
                    >
                      + إضافة شريحة
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Apply to All */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-bold text-yellow-900 mb-3">⚡ تطبيق سريع على الكل:</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const newTiers = {
                  1: { from: 1, to: 9, discountType: 'percentage', discountValue: 0 },
                  2: { from: 10, to: 19, discountType: 'percentage', discountValue: 10 },
                  3: { from: 20, to: 49, discountType: 'percentage', discountValue: 15 },
                  4: { from: 50, to: null, discountType: 'percentage', discountValue: 20 }
                };
                const updated = {};
                selectedProducts.forEach(id => {
                  updated[id] = Object.values(newTiers);
                });
                setProductTiers(updated);
              }}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
            >
              موزعين (10-15-20%)
            </button>
            <button
              onClick={() => {
                const newTiers = [
                  { from: 1, to: 4, discountType: 'percentage', discountValue: 0 },
                  { from: 5, to: 10, discountType: 'percentage', discountValue: 5 },
                  { from: 11, to: null, discountType: 'percentage', discountValue: 10 }
                ];
                const updated = {};
                selectedProducts.forEach(id => {
                  updated[id] = newTiers;
                });
                setProductTiers(updated);
              }}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
            >
              تجار (5-10%)
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
            {selectedCount} منتج مع شرائح خصومات مخصصة لكل منتج
          </p>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedProductsData.map(product => {
            const regularPrice = parseFloat(product.price) || 0;
            const tiers = productTiers[product.id] || [];
            
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
                  // Check if all selected products have at least one tier
                  const hasInvalidProduct = selectedProducts.some(id => {
                    const tiers = productTiers[id] || [];
                    return tiers.length === 0;
                  });
                  if (hasInvalidProduct) {
                    alert('⚠️ حدد شرائح الخصومات لجميع المنتجات');
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

