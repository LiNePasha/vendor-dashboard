"use client";

import { useState, useEffect, useMemo } from 'react';
import { VENDOR_STORE_BUNDLE_LINKS } from '@/app/lib/vendor-constants';

export default function BundleLinkModal({ isOpen, onClose, allProducts = [], vendorId }) {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // Reset state only when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProducts([]);
      setSearch('');
      setSelectedCategory('all');
      setGeneratedLink('');
      setCopied(false);
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
    return allProducts.filter(product => {
      // Search filter
      const matchesSearch = !search || 
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku?.toLowerCase().includes(search.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || 
        (product.categories && product.categories.some(cat => cat.id === parseInt(selectedCategory)));
      
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, search, selectedCategory]);

  // Toggle product selection
  const toggleProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Generate bundle link
  const generateLink = () => {
    if (selectedProducts.length === 0) {
      alert('⚠️ اختر منتجات أولاً');
      return;
    }

    const vendorIdNum = typeof vendorId === 'string' ? parseInt(vendorId) : vendorId;
    const baseLink = VENDOR_STORE_BUNDLE_LINKS[vendorIdNum];
    
    if (!baseLink) {
      alert(`⚠️ لا يوجد رابط حزمة لهذا التاجر (ID: ${vendorId})`);
      return;
    }

    const link = `${baseLink}${selectedProducts.join(',')}`;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

          {/* Selected Count */}
          <div className="mb-4 text-center">
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-bold">
              {selectedProducts.length} منتج محدد
            </span>
          </div>

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

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
            {filteredProducts.map(product => {
              const isSelected = selectedProducts.includes(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {/* Image at top */}
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
                        className="w-full h-32 object-cover rounded cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all"
                      />
                    )}
                    
                    {/* Checkbox and Name */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-orange-500 border-orange-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <span className="text-white text-xs font-bold">✓</span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-gray-900 truncate flex-1">
                        {product.name}
                      </div>
                    </div>
                    
                    {product.sku && (
                      <div className="text-xs text-gray-500 truncate px-1">
                        {product.sku}
                      </div>
                    )}
                    <div className="text-sm text-orange-600 font-bold px-1">
                      {product.price} ج.م
                    </div>
                    {product.stock_quantity !== undefined && (
                      <div className="text-xs text-gray-500 px-1">
                        مخزون: {product.stock_quantity}
                      </div>
                    )}
                  </div>
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
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
          >
            إغلاق
          </button>
          <button
            onClick={generateLink}
            disabled={selectedProducts.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔗 إنشاء الرابط ({selectedProducts.length})
          </button>
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
