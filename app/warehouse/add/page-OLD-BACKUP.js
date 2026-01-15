'use client';

import { useState, useEffect } from 'react';
import { warehouseStorage, suppliersStorage } from '../../lib/warehouse-storage';
import { useRouter } from 'next/navigation';

export default function AddProductPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]); // 🆕 التصنيفات
  const [categoriesLoading, setCategoriesLoading] = useState(false); // 🆕 حالة تحميل التصنيفات
  const [categorySearch, setCategorySearch] = useState(''); // 🆕 بحث في التصنيفات
  const [collapsedCategories, setCollapsedCategories] = useState(new Set()); // 🆕 التصنيفات المقفولة
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null); // 🆕 رابط الصورة المرفوعة
  const [uploadingImage, setUploadingImage] = useState(false); // 🆕 حالة رفع الصورة
  const [syncToApi, setSyncToApi] = useState(true); // خيار المزامنة مع API - مفعّل افتراضياً
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    sellingPrice: '',
    purchasePrice: '',
    supplierId: '',
    apiStock: 0, // الكمية في API (للبيع)
    localStock: 0, // الكمية في المخزن المحلي
    categories: [], // 🆕 تغيير لـ array لدعم multiple categories
    productType: 'simple', // 🆕 نوع المنتج: simple أو variable
  });

  // 🆕 Variable Product State
  const [attributes, setAttributes] = useState([]); // [{id, name, options: ['أحمر', 'أزرق']}]
  const [variations, setVariations] = useState([]); // الـ variations المولدة
  const [generatedVariations, setGeneratedVariations] = useState(false);
  
  // 🆕 WooCommerce Attributes State
  const [wooAttributes, setWooAttributes] = useState([]); // السمات من WooCommerce
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadCategories(); // 🆕 تحميل التصنيفات
    loadWooAttributes(); // 🆕 تحميل السمات من WooCommerce
  }, []);

  const loadSuppliers = async () => {
    const suppliersList = await suppliersStorage.getAllSuppliers();
    setSuppliers(suppliersList);
  };

  // 🆕 دالة للحصول على كل أبناء التصنيف (recursive)
  const getCategoryChildren = (parentId) => {
    return categories.filter(c => c.parent === parentId);
  };

  // 🆕 دالة toggle للتصنيف
  const toggleCategory = (catId) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(catId)) {
        newSet.delete(catId);
      } else {
        newSet.add(catId);
      }
      return newSet;
    });
  };

  // 🆕 دالة لعرض التصنيف وأبنائه بشكل recursive
  const renderCategory = (cat, level = 0) => {
    const children = getCategoryChildren(cat.id);
    const isSelected = form.categories.includes(cat.id);
    const isCollapsed = collapsedCategories.has(cat.id);
    const selectedChildrenCount = children.filter(c => form.categories.includes(c.id)).length;
    
    // حساب المسافة البادئة حسب المستوى
    const paddingLeft = level * 24; // 24px لكل مستوى
    
    return (
      <div key={cat.id}>
        {/* التصنيف الحالي */}
        <div
          className={`flex items-center gap-2 px-4 py-2.5 transition-all border-t border-gray-100 ${
            level === 0 ? 'bg-gray-50 border-t-2 border-gray-200' : ''
          }`}
          style={{ paddingRight: `${paddingLeft + 16}px` }}
        >
          {/* زر Collapse/Expand */}
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className="w-6 h-6 flex items-center justify-center hover:bg-blue-100 rounded transition-all text-gray-600 hover:text-blue-700"
            >
              <span className="text-sm font-bold">
                {isCollapsed ? '►' : '▼'}
              </span>
            </button>
          )}
          {children.length === 0 && <div className="w-6" />}
          
          {/* Checkbox والمحتوى */}
          <label
            className={`flex items-center gap-3 flex-1 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all rounded px-2 py-1 ${
              isSelected ? 'bg-blue-50 font-semibold' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  setForm({ 
                    ...form, 
                    categories: [...form.categories, cat.id] 
                  });
                } else {
                  setForm({ 
                    ...form, 
                    categories: form.categories.filter(id => id !== cat.id) 
                  });
                }
              }}
              className={`${level === 0 ? 'w-5 h-5' : 'w-4 h-4'} text-blue-600 rounded focus:ring-2 focus:ring-blue-500`}
            />
            <span className={`flex-1 text-gray-800 ${level === 0 ? 'text-base font-bold' : 'text-sm'}`}>
              {level === 0 ? '📁' : '↳'} {cat.name}
            </span>
            {cat.count > 0 && (
              <span className={`text-xs ${level === 0 ? 'bg-gray-100' : 'bg-white border border-gray-200'} text-gray-600 px-2 py-1 rounded-full font-medium`}>
                {cat.count}
              </span>
            )}
            {children.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                {selectedChildrenCount}/{children.length}
              </span>
            )}
          </label>
        </div>

        {/* الأبناء (recursive) - يظهروا فقط لو مش collapsed */}
        {children.length > 0 && !isCollapsed && (
          <div>
            {children
              .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
              .map(childCat => renderCategory(childCat, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 🆕 تحميل كل التصنيفات من WooCommerce مباشرة
  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      console.log('🔄 Starting to load ALL WooCommerce categories from /api/warehouse/categories...');
      
      // 🔥 استخدام endpoint التصنيفات المخصص للـ warehouse
      const res = await fetch('/api/warehouse/categories', {
        credentials: 'include',
      });

      console.log('📡 API Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error:', errorText);
        throw new Error('فشل تحميل التصنيفات');
      }

      const data = await res.json();
      console.log('📦 Full API Response:', data);
      
      // التعامل مع response format
      let categoriesArray = [];
      
      if (data.success && Array.isArray(data.categories)) {
        categoriesArray = data.categories;
      } else if (Array.isArray(data.categories)) {
        categoriesArray = data.categories;
      } else if (Array.isArray(data)) {
        categoriesArray = data;
      }
      
      if (categoriesArray.length > 0) {
        console.log('✅ Setting categories:', categoriesArray.length);
        setCategories(categoriesArray);
        console.log('📊 First category:', JSON.stringify(categoriesArray[0], null, 2));
        console.log('🔢 Total categories:', categoriesArray.length);
        
        // 🔍 تحليل التصنيفات محلياً
        const parentCats = categoriesArray.filter(c => c.parent === 0);
        const childCats = categoriesArray.filter(c => c.parent !== 0);
        console.log('👨‍👦 Parent categories:', parentCats.length);
        console.log('👶 Child categories:', childCats.length);
        
        // إحصائيات إضافية
        if (data.stats) {
          console.log('📈 Server Stats:', data.stats);
        }
      } else {
        console.warn('⚠️ No categories found in response');
        console.warn('Response structure:', JSON.stringify(data, null, 2));
        setCategories([]);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      setCategories([]);
      alert('⚠️ فشل تحميل التصنيفات: ' + error.message);
    } finally {
      setCategoriesLoading(false);
      console.log('✅ Categories loading complete. Categories in state:', categories.length);
    }
  };

  // 🆕 تحميل السمات من WooCommerce
  const loadWooAttributes = async () => {
    setLoadingAttributes(true);
    try {
      const response = await fetch('/api/products/attributes?include_terms=true');
      const data = await response.json();
      
      if (data.success && data.attributes) {
        setWooAttributes(data.attributes);
        console.log('✅ Loaded WooCommerce attributes:', data.attributes.length);
      }
    } catch (error) {
      console.error('❌ Error loading attributes:', error);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      alert('⚠️ يرجى اختيار صورة فقط');
      return;
    }

    // التحقق من حجم الملف (أقل من 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    // معاينة فورية
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // 🔥 رفع الصورة فوراً على Cloudinary
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('فشل رفع الصورة');
      }

      const uploadData = await uploadRes.json();
      
      // 🆕 تحويل الرابط لـ WebP للسرعة
      let imageUrl = uploadData.url;
      if (imageUrl && !imageUrl.includes('.webp')) {
        imageUrl = imageUrl.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
      }
      
      setUploadedImageUrl(imageUrl);
      alert('✅ تم رفع الصورة بنجاح');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('⚠️ فشل رفع الصورة، جرب مرة أخرى');
      // مسح الصورة عند الفشل
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setUploadedImageUrl(null);
  };

  // 🆕 Variable Product Functions
  const addAttribute = (wooAttrId = null) => {
    if (wooAttrId) {
      // إضافة attribute من WooCommerce
      const wooAttr = wooAttributes.find(a => a.id === wooAttrId);
      if (wooAttr) {
        // التحقق من عدم إضافته مسبقاً
        if (attributes.some(a => a.id === wooAttr.id)) {
          alert('⚠️ هذه السمة مضافة بالفعل');
          return;
        }
        
        setAttributes([...attributes, {
          id: wooAttr.id,
          name: wooAttr.name,
          slug: wooAttr.slug,
          options: [], // سيتم ملؤها من terms
          isFromWoo: true
        }]);
      }
    } else {
      // إضافة attribute جديد يدوياً
      setAttributes([...attributes, { 
        name: '', 
        options: [],
        isFromWoo: false
      }]);
    }
  };

  const updateAttribute = (index, field, value) => {
    const updated = [...attributes];
    updated[index][field] = value;
    setAttributes(updated);
  };

  const removeAttribute = (index) => {
    setAttributes(attributes.filter((_, i) => i !== index));
    setGeneratedVariations(false); // Reset variations
  };

  const addOption = (attrIndex, option) => {
    if (!option || option.trim() === '') return;
    
    const updated = [...attributes];
    if (!updated[attrIndex].options.includes(option.trim())) {
      updated[attrIndex].options.push(option.trim());
      setAttributes(updated);
    }
  };

  const removeOption = (attrIndex, optionIndex) => {
    const updated = [...attributes];
    updated[attrIndex].options.splice(optionIndex, 1);
    setAttributes(updated);
    setGeneratedVariations(false); // Reset variations
  };

  // توليد variations من attributes
  const generateVariations = () => {
    if (attributes.length === 0 || attributes.some(a => a.options.length === 0)) {
      alert('⚠️ يجب إضافة سمات مع خيارات أولاً');
      return;
    }

    // Generate all combinations
    const combinations = [];
    const generate = (current = [], attrIndex = 0) => {
      if (attrIndex === attributes.length) {
        combinations.push([...current]);
        return;
      }

      const attr = attributes[attrIndex];
      for (const option of attr.options) {
        generate([...current, { name: attr.name, option }], attrIndex + 1);
      }
    };

    generate();

    // Create variations
    const newVariations = combinations.map((combo, index) => {
      const description = combo.map(c => c.option).join(' - ');
      const baseSku = form.sku || 'VAR';
      
      return {
        id: `temp_${Date.now()}_${index}`, // Temporary ID
        attributes: combo,
        description,
        sku: `${baseSku}-${index + 1}`,
        price: form.sellingPrice || '0',
        stock_quantity: 0,
        manage_stock: true,
        image: null
      };
    });

    setVariations(newVariations);
    setGeneratedVariations(true);
    alert(`✅ تم توليد ${newVariations.length} متغير`);
  };

  const updateVariation = (index, field, value) => {
    const updated = [...variations];
    updated[index][field] = value;
    setVariations(updated);
  };

  const removeVariation = (index) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for simple products
    if (form.productType === 'simple') {
      if (!form.name || !form.sellingPrice) {
        alert('⚠️ الاسم وسعر البيع مطلوبان');
        return;
      }
    } 
    // Validation for variable products
    else if (form.productType === 'variable') {
      if (!form.name) {
        alert('⚠️ الاسم مطلوب');
        return;
      }
      if (variations.length === 0) {
        alert('⚠️ يجب توليد variations أولاً');
        return;
      }
      // Check that all variations have SKU and price
      const invalidVariation = variations.find(v => !v.sku || !v.price || v.price === '0');
      if (invalidVariation) {
        alert('⚠️ يجب إدخال SKU وسعر لجميع الـ variations');
        return;
      }
    }

    setLoading(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === form.supplierId);
      
      // إذا اختار المستخدم المزامنة مع API
      if (syncToApi) {
        // Handle Variable Products
        if (form.productType === 'variable') {
          // Step 1: Create parent variable product
          const parentResponse = await fetch('/api/warehouse/create-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              sku: form.sku,
              type: 'variable',
              categories: form.categories.length > 0 ? form.categories : null,
              imageUrl: uploadedImageUrl,
              attributes: attributes.map(attr => ({
                name: attr.name,
                options: attr.options,
                visible: true,
                variation: true // Enable for variations
              }))
            })
          });

          const parentResult = await parentResponse.json();

          if (!parentResponse.ok || !parentResult.success) {
            throw new Error(parentResult.error || 'فشل إنشاء المنتج الأساسي');
          }

          const parentId = parentResult.product.id;

          // Step 2: Create variations
          let successCount = 0;
          let failCount = 0;
          
          for (const variation of variations) {
            try {
              const variationResponse = await fetch(`/api/products/${parentId}/variations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sku: variation.sku,
                  regular_price: variation.price,
                  stock_quantity: parseInt(variation.stock_quantity) || 0,
                  manage_stock: true,
                  attributes: variation.attributes.map(attr => ({
                    name: attr.name,
                    option: attr.option
                  })),
                  image: variation.image ? { src: variation.image } : null
                })
              });

              if (variationResponse.ok) {
                successCount++;
              } else {
                failCount++;
                console.error('Failed variation:', variation.sku);
              }
            } catch (err) {
              failCount++;
              console.error('Error creating variation:', err);
            }
          }

          // Save local warehouse data if needed
          if (form.purchasePrice || form.supplierId) {
            await warehouseStorage.setProductData(parentId, {
              purchasePrice: parseFloat(form.purchasePrice) || 0,
              localStock: 0, // Variable products don't have direct stock
              notes: '',
              suppliers: selectedSupplier ? [{
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.name,
                addedAt: new Date().toISOString()
              }] : []
            });
          }

          // Success message
          const selectedCats = form.categories.map(id => 
            categories.find(c => c.id === id)?.name
          ).filter(Boolean);
          
          const categoriesText = selectedCats.length > 0 
            ? `\n📁 التصنيفات: ${selectedCats.join(' • ')}`
            : '';

          alert(`✅ تم إنشاء المنتج المتعدد بنجاح!\n\n` +
                `🆔 ID: ${parentId}\n` +
                `📦 الاسم: ${form.name}\n` +
                `🔀 Variations: ${successCount} نجحت، ${failCount} فشلت${categoriesText}`);

        } 
        // Handle Simple Products (original code)
        else {
          const response = await fetch('/api/warehouse/create-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              sku: form.sku,
              sellingPrice: parseFloat(form.sellingPrice),
              purchasePrice: parseFloat(form.purchasePrice) || 0,
              stock: parseInt(form.apiStock) || 0,
              categories: form.categories.length > 0 ? form.categories : null,
              imageUrl: uploadedImageUrl
            })
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || 'فشل إنشاء المنتج في API');
          }

          // حفظ البيانات المحلية
          if (form.purchasePrice || form.supplierId || form.localStock) {
            await warehouseStorage.setProductData(result.product.id, {
              purchasePrice: parseFloat(form.purchasePrice) || 0,
              localStock: parseInt(form.localStock) || 0,
              notes: '',
              suppliers: selectedSupplier ? [{
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.name,
                addedAt: new Date().toISOString()
              }] : []
            });
          }

          // 🎉 رسالة نجاح
          const selectedCats = form.categories.map(id => 
            categories.find(c => c.id === id)?.name
          ).filter(Boolean);
          
          const categoriesText = selectedCats.length > 0 
            ? `\n📁 التصنيفات: ${selectedCats.join(' • ')}`
            : '';

          alert(`✅ تم إنشاء المنتج بنجاح في WooCommerce!\n\n` +
                `🆔 ID: ${result.product.id}\n` +
                `📦 الاسم: ${result.product.name}\n` +
                `📊 المخزون: ${result.product.stock_quantity}${categoriesText}`);
        }
      } else {
        // حفظ محلي فقط (الطريقة القديمة)
        await warehouseStorage.addProduct({
          ...form,
          supplierName: selectedSupplier?.name || ''
        });

        alert('✅ تم إضافة المنتج للمخزن المحلي بنجاح!');
      }

      router.push('/warehouse');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">➕ إضافة منتج جديد</h1>
        <p className="text-gray-600 text-sm mt-1">أضف منتج جديد للمخزن المحلي</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 🆕 نوع المنتج */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">نوع المنتج *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="productType"
                  value="simple"
                  checked={form.productType === 'simple'}
                  onChange={(e) => setForm({ ...form, productType: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="text-sm">📦 منتج بسيط</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="productType"
                  value="variable"
                  checked={form.productType === 'variable'}
                  onChange={(e) => setForm({ ...form, productType: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="text-sm">🔀 منتج متعدد (مواصفات مختلفة)</span>
              </label>
            </div>
            {form.productType === 'variable' && (
              <p className="text-xs text-gray-600 mt-2">
                💡 المنتج المتعدد يسمح لك ببيع نفس المنتج بمواصفات مختلفة (مثل: ألوان، مقاسات، أحجام)
              </p>
            )}
          </div>

          {/* اسم المنتج */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">اسم المنتج *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="مثال: مساعد هيدروليك أمامي"
              required
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-semibold mb-2">SKU (اختياري)</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="مثال: HD-123"
            />
          </div>

          {/* 🆕 التصنيفات - Tree Structure مع Multi-Select */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-3">
              🏷️ التصنيفات (اختياري)
            </label>
            
            {/* البحث */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="🔍 ابحث عن تصنيف..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                disabled={categoriesLoading}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                🔍
              </span>
            </div>

            {/* Selected Categories Pills */}
            {form.categories.length > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-blue-800">✓ التصنيفات المختارة ({form.categories.length})</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, categories: [] })}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 bg-white rounded-lg hover:bg-red-50 transition-all"
                  >
                    ✕ حذف الكل
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.categories.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    if (!cat) return null;
                    return (
                      <div
                        key={catId}
                        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-200 group hover:border-blue-400 transition-all"
                      >
                        <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                        <button
                          type="button"
                          onClick={() => setForm({ 
                            ...form, 
                            categories: form.categories.filter(id => id !== catId) 
                          })}
                          className="text-red-500 hover:text-red-700 opacity-70 group-hover:opacity-100 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories Tree */}
            {categoriesLoading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin text-4xl mb-2">⏳</div>
                <p className="text-sm">جاري تحميل التصنيفات...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-gray-200 rounded-xl bg-white">
                <div className="text-5xl mb-3">📂</div>
                <p className="font-semibold text-lg mb-2">لا توجد تصنيفات</p>
                <p className="text-sm">افتح Console (F12) لمزيد من التفاصيل</p>
                <button
                  type="button"
                  onClick={loadCategories}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto bg-white">
                {categories
                  .filter(cat => cat.parent === 0) // الرئيسية فقط
                  .filter(cat => {
                    if (!categorySearch) return true;
                    // بحث في الاسم أو أي من الأبناء على أي مستوى
                    const searchLower = categorySearch.toLowerCase();
                    
                    // دالة للبحث في الشجرة
                    const searchInTree = (catId) => {
                      const cat = categories.find(c => c.id === catId);
                      if (!cat) return false;
                      
                      if (cat.name.toLowerCase().includes(searchLower)) return true;
                      
                      const children = categories.filter(c => c.parent === catId);
                      return children.some(c => searchInTree(c.id));
                    };
                    
                    return searchInTree(cat.id);
                  })
                  .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                  .map((parentCat) => renderCategory(parentCat, 0))}
              </div>
            )}

            {/* Info */}
            {categories.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  📊 {categories.filter(c => c.parent === 0).length} تصنيف رئيسي • {categories.filter(c => c.parent !== 0).length} تصنيف فرعي
                </span>
                <div className="flex items-center gap-2">
                  {collapsedCategories.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setCollapsedCategories(new Set())}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ▼ فتح الكل
                    </button>
                  )}
                  {collapsedCategories.size === 0 && categories.filter(c => c.parent === 0 && getCategoryChildren(c.id).length > 0).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allParents = categories.filter(c => c.parent === 0 && getCategoryChildren(c.id).length > 0);
                        setCollapsedCategories(new Set(allParents.map(c => c.id)));
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ► قفل الكل
                    </button>
                  )}
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ✕ مسح البحث
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 🆕 Attributes Section (لو variable product) */}
          {form.productType === 'variable' && (
            <div className="md:col-span-2 border-2 border-dashed border-purple-300 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-indigo-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                  🏷️ السمات (Attributes)
                </h3>
                <button
                  type="button"
                  onClick={addAttribute}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 text-sm font-semibold"
                >
                  <span>+</span> إضافة سمة
                </button>
              </div>

              {attributes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-3">🎨</p>
                  <p className="font-medium">لم يتم إضافة سمات بعد</p>
                  <p className="text-sm mt-2">مثال: اللون، المقاس، الحجم، النوع</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attributes.map((attr, attrIndex) => (
                    <div key={attrIndex} className="bg-white rounded-lg p-4 border-2 border-purple-200">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={attr.name}
                            onChange={(e) => updateAttribute(attrIndex, 'name', e.target.value)}
                            placeholder="اسم السمة (مثل: اللون)"
                            className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttribute(attrIndex)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
                        >
                          🗑️ حذف
                        </button>
                      </div>

                      {/* Options */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">الخيارات:</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {attr.options.map((option, optIndex) => (
                            <span
                              key={optIndex}
                              className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-2"
                            >
                              {option}
                              <button
                                type="button"
                                onClick={() => removeOption(attrIndex, optIndex)}
                                className="hover:text-red-600 font-bold"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="أضف خيار (مثل: أحمر)"
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
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
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold"
                          >
                            + إضافة
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Generate Variations Button */}
              {attributes.length > 0 && attributes.every(a => a.name && a.options.length > 0) && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={generateVariations}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 mx-auto font-bold shadow-lg"
                  >
                    <span className="text-xl">⚡</span>
                    توليد المتغيرات ({attributes.reduce((acc, a) => acc * a.options.length, 1)})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 🆕 Variations Section */}
          {form.productType === 'variable' && generatedVariations && variations.length > 0 && (
            <div className="md:col-span-2 border-2 border-green-300 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
              <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                🔀 المتغيرات ({variations.length})
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {variations.map((variation, index) => (
                  <div key={variation.id} className="bg-white rounded-lg p-4 border-2 border-green-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{variation.description}</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {variation.attributes.map((attr, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {attr.name}: {attr.option}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariation(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-semibold"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">SKU</label>
                        <input
                          type="text"
                          value={variation.sku}
                          onChange={(e) => updateVariation(index, 'sku', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">السعر</label>
                        <input
                          type="text"
                          value={variation.price}
                          onChange={(e) => updateVariation(index, 'price', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">المخزون</label>
                        <input
                          type="number"
                          value={variation.stock_quantity}
                          onChange={(e) => updateVariation(index, 'stock_quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* سعر البيع (للـ simple product فقط) */}
          {form.productType === 'simple' && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">سعر البيع * (ج.م)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.sellingPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setForm({ ...form, sellingPrice: val });
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="450"
                  required
                />
              </div>

              {/* سعر الشراء */}
              <div>
                <label className="block text-sm font-semibold mb-2">سعر الشراء (ج.م)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setForm({ ...form, purchasePrice: val });
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="300"
                />
              </div>

              {/* المورد */}
              <div>
                <label className="block text-sm font-semibold mb-2">المورد</label>
                <div className="flex gap-2">
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    className="flex-1 px-4 py-2 border rounded-lg"
                  >
                    <option value="">اختر المورد</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => router.push('/suppliers')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ➕
                  </button>
                </div>
              </div>
            </>
          )}

          {/* الكمية في API (للـ simple product فقط) */}
          {form.productType === 'simple' && (
            <>
              <div>
            <label className="block text-sm font-semibold mb-2">الكمية المتاحة للبيع (في الموقع) 🛒</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.apiStock}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setForm({ ...form, apiStock: val === '' ? 0 : parseInt(val) });
                }
              }}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">💡 الكمية التي ستكون متاحة للبيع من الكاشير</p>
          </div>

          {/* الكمية في المخزن المحلي */}
          <div>
            <label className="block text-sm font-semibold mb-2">الكمية في المخزن المحلي 📦</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.localStock}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setForm({ ...form, localStock: val === '' ? 0 : parseInt(val) });
                }
              }}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">💡 للتسجيل فقط - وليست متاحة في الموقع</p>
          </div>
            </>
          )}

          {/* صورة المنتج */}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">صورة المنتج (اختياري)</label>
            
            {!imagePreview ? (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={uploadingImage}
                  id="image-upload"
                />
                {uploadingImage && (
                  <div className="mt-3 flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="text-sm font-medium">⏳ جاري رفع الصورة على Cloudinary...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border-2 border-green-500 shadow-md" />
                  {uploadedImageUrl && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    🗑️ إزالة الصورة
                  </button>
                  <label
                    htmlFor="image-upload"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm cursor-pointer"
                  >
                    🔄 تغيير الصورة
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploadingImage}
                    id="image-upload"
                  />
                </div>
                {uploadedImageUrl && (
                  <p className="text-xs text-green-600 font-medium">✅ تم رفع الصورة بنجاح على Cloudinary</p>
                )}
              </div>
            )}
          </div>

          {/* خيار المزامنة مع API */}
          <div className="md:col-span-2">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToApi}
                  onChange={(e) => setSyncToApi(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 flex items-center gap-2">
                    <span>🔄</span>
                    <span>مزامنة مع الموقع</span>
                  </div>
                  {/* <p className="text-sm text-gray-600 mt-1">
                    عند التفعيل، سيتم إنشاء المنتج مباشرة في WooCommerce ورفع الصورة لـ Cloudinary
                  </p> */}
                  {/* {syncToApi && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-800 font-semibold mb-2">✅ سيتم:</p>
                      <ul className="text-xs text-blue-700 space-y-1 mr-4">
                        <li>• رفع الصورة لـ Cloudinary تلقائياً</li>
                        <li>• إنشاء المنتج في WooCommerce</li>
                        <li>• إضافة المخزون للـ API مباشرة</li>
                        <li>• حفظ سعر الشراء والمورد محلياً</li>
                      </ul>
                    </div>
                  )} */}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6 pt-6 border-t">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
          >
            {loading ? '⏳ جاري الحفظ...' : syncToApi ? '🔄 حفظ ومزامنة مع الموقع' : '✅ حفظ محلياً فقط'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/warehouse')}
            disabled={loading}
            className="px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
          >
            إلغاء
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>ملاحظة:</strong> {syncToApi 
              ? 'المنتج سيُنشأ مباشرة في الموقع وسيكون متاحاً للبيع من خلال الكاشير.' 
              : 'المنتج سيُحفظ في المخزن المحلي فقط. يمكنك لاحقاً مزامنته مع الموقع.'}
          </p>
        </div>
      </form>
    </div>
  );
}
