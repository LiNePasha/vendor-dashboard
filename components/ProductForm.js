'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { warehouseStorage, suppliersStorage } from '@/app/lib/warehouse-storage';
import usePOSStore from '@/app/stores/pos-store';
import AttributeSelector from './AttributeSelector';
import VariationImageUpload from './VariationImageUpload';
import MultipleImageUpload from './MultipleImageUpload';

/**
 * ProductForm Component - نموذج شامل للمنتجات
 * @param {string} mode - 'create' أو 'edit'
 * @param {number} productId - ID المنتج (للتعديل فقط)
 * @param {object} initialData - بيانات أولية (للتعديل)
 * @param {function} onSuccess - callback عند النجاح
 * @param {function} onClose - callback لإغلاق الـ modal
 */
export default function ProductForm({ mode = 'create', productId = null, initialData = null, onSuccess, onClose }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  
  // 🆕 استخدام categories من POS store
  const categoriesFromStore = usePOSStore((state) => state.categories);
  const fetchCategories = usePOSStore((state) => state.fetchCategories);
  
  // Basic States
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  
  // Image States - 🆕 تحويل لـ multiple images
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Form State
  const [syncToApi, setSyncToApi] = useState(true);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    sellingPrice: '',
    salePrice: '',
    purchasePrice: '',
    supplierId: '',
    apiStock: 0,
    localStock: 0,
    categories: [],
    productType: 'simple',
  });

  // Variable Product States
  const [attributes, setAttributes] = useState([]);
  const [variations, setVariations] = useState([]);
  const [deletedVariationIds, setDeletedVariationIds] = useState([]); // 🆕 تتبع الـ variations المحذوفة
  const [generatedVariations, setGeneratedVariations] = useState(false);
  const [originalData, setOriginalData] = useState(null); // للمقارنة في حالة التعديل

  // Debug: Log attributes changes
  useEffect(() => {
    
  }, [attributes]);

  useEffect(() => {
    loadSuppliers();
    loadCategories();
    
    // Load product data if in edit mode
    if (mode === 'edit' && productId) {
      loadProductData();
    } else if (initialData) {
      populateFormFromData(initialData);
    }
  }, [mode, productId]);

  const loadSuppliers = async () => {
    const suppliersList = await suppliersStorage.getAllSuppliers();
    setSuppliers(suppliersList);
  };

  const loadCategories = async (forceRefresh = false) => {
    // 🆕 استخدام categories من store لو موجودة ومش forceRefresh
    if (!forceRefresh && categoriesFromStore && categoriesFromStore.length > 0) {
      console.log('[ProductForm] ✅ Using cached categories from store');
      setCategories(categoriesFromStore);
      return;
    }
    
    // لو forceRefresh أو مش موجودة، نجيبها من الـ store function
    setCategoriesLoading(true);
    try {
      console.log('[ProductForm] 🚀 Fetching categories from POS store...');
      await fetchCategories();
      // الـ categories هتتحدث في الـ store تلقائياً
    } catch (error) {
      console.error('[ProductForm] ❌ Error loading categories:', error);
      alert('⚠️ فشل تحميل التصنيفات: ' + error.message);
    } finally {
      setCategoriesLoading(false);
    }
  };
  
  // 🆕 Update local categories عند تغير categoriesFromStore
  useEffect(() => {
    if (categoriesFromStore && categoriesFromStore.length > 0) {
      setCategories(categoriesFromStore);
    }
  }, [categoriesFromStore]);

  const loadProductData = async () => {
    setLoadingData(true);
    try {
      const response = await fetch(`/api/products/${productId}?include_variations=true`);
      const data = await response.json();
      
      if (data.success && data.product) {
        await populateFormFromData(data.product);
      }
    } catch (error) {
      console.error('Error loading product:', error);
      alert('❌ فشل تحميل بيانات المنتج');
    } finally {
      setLoadingData(false);
    }
  };

  const populateFormFromData = async (product) => {
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      sellingPrice: product.regular_price || product.price || '',
      salePrice: product.sale_price || '',
      purchasePrice: product.purchase_price || '',
      supplierId: '',
      apiStock: product.stock_quantity || 0,
      localStock: 0,
      categories: product.categories?.map(c => c.id) || [],
      productType: product.type || 'simple',
    });

    if (product.images && product.images.length > 0) {
      const formattedImages = product.images.map(img => ({
        url: img.src,
        preview: img.src,
        uploading: false
      }));
      setImages(formattedImages);
    }

    // Load attributes and variations for variable products
    if (product.type === 'variable') {
      if (product.attributes) {
        const formattedAttrs = product.attributes.map(attr => ({
          id: attr.id,
          name: attr.name,
          slug: attr.slug,
          options: attr.options || [],
          isFromWoo: true
        }));
        setAttributes(formattedAttrs);
      }

      if (product.variations && product.variations.length > 0) {
        // 🆕 جلب المخزون المحلي لكل المتغيرات وتنسيق البيانات
        const variationsWithLocalStock = await Promise.all(
          product.variations.map(async (v) => {
            const localStock = await warehouseStorage.getVariationLocalStock(v.id);
            return {
              id: v.id,
              sku: v.sku,
              price: v.regular_price || v.price,
              sale_price: v.sale_price || '',
              stock_quantity: v.stock_quantity,
              localStock: localStock || 0,
              attributes: v.attributes,
              image: typeof v.image === 'string' ? v.image : v.image?.src
            };
          })
        );
        
        setVariations(variationsWithLocalStock);
        setGeneratedVariations(true);
      }
    }

    // حفظ البيانات الأصلية للمقارنة لاحقاً
    if (mode === 'edit') {
      setOriginalData({
        name: product.name || '',
        sku: product.sku || '',
        categories: product.categories?.map(c => c.id) || [],
        attributes: product.attributes?.map(attr => ({
          id: attr.id,
          name: attr.name,
          options: [...attr.options]
        })) || [],
        variations: product.variations?.map(v => ({
          id: v.id,
          sku: v.sku,
          price: v.regular_price || v.price,
          sale_price: v.sale_price || '',
          stock_quantity: v.stock_quantity,
          localStock: 0,
          attributes: v.attributes,
          image: typeof v.image === 'string' ? v.image : v.image?.src
        })) || []
      });
    }
  };

  // Variation Handlers
  const generateVariations = () => {
    if (attributes.length === 0 || attributes.some(a => a.options.length === 0)) {
      alert('⚠️ يجب إضافة سمات مع خيارات أولاً');
      return;
    }

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

    // 🆕 Get existing variations (keep them if they match current combinations)
    const existingVariations = [...variations];
    const existingCombosMap = new Map();
    
    existingVariations.forEach(v => {
      const comboKey = v.attributes.map(a => `${a.name}:${a.option}`).sort().join('|');
      // 🔥 تحذير: إذا كان الـ key موجود بالفعل، يعني في duplicate!
      if (existingCombosMap.has(comboKey)) {
        console.warn('⚠️ Duplicate variation detected:', comboKey, v);
      }
      existingCombosMap.set(comboKey, v);
    });

    const newVariations = combinations.map((combo, index) => {
      const description = combo.map(c => c.option).join(' - ');
      const comboKey = combo.map(c => `${c.name}:${c.option}`).sort().join('|');
      
      // 🆕 Check if this combination already exists
      const existing = existingCombosMap.get(comboKey);
      if (existing) {
        // Keep existing variation data (price, stock, image, etc.)
        return existing;
      }
      
      // Generate new variation only if it doesn't exist
      const baseSku = form.sku || 'VAR';
      
      // 🔥 توليد SKU فريدة باستخدام أول 3 حروف من كل خيار + timestamp
      const optionsSlug = combo
        .map(c => c.option.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .join('-');
      
      const timestamp = Date.now().toString().slice(-6); // آخر 6 أرقام من timestamp
      const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 حروف عشوائية
      
      const uniqueSku = `${baseSku}-${optionsSlug}-${timestamp}${randomPart}`;
      
      return {
        id: `temp_${Date.now()}_${index}`,
        attributes: combo,
        description,
        sku: uniqueSku,
        price: form.sellingPrice || '0',
        sale_price: form.salePrice || '',
        stock_quantity: 0,
        localStock: 0,
        manage_stock: true,
        image: null
      };
    });

    setVariations(newVariations);
    setGeneratedVariations(true);
  };

  const updateVariation = (index, field, value) => {
    const updated = [...variations];
    updated[index][field] = value;
    setVariations(updated);
  };

  const removeVariation = (index) => {
    const variation = variations[index];
    // 🆕 إذا كان variation موجود في API (له ID حقيقي)، أضفه لقائمة المحذوفات
    if (variation.id && !variation.id.toString().startsWith('temp_')) {
      setDeletedVariationIds(prev => [...prev, variation.id]);
      console.log('🗑️ Marked variation for deletion:', variation.id);
    }
    const newVariations = variations.filter((_, i) => i !== index);
    setVariations(newVariations);
    console.log(`✅ Removed variation at index ${index}. Remaining: ${newVariations.length}`);
  };

  // 🆕 دالة لإزالة المكررات
  const removeDuplicateVariations = () => {
    const seen = new Map();
    const unique = [];
    const duplicates = [];
    
    variations.forEach((v, index) => {
      const comboKey = v.attributes.map(a => `${a.name}:${a.option}`).sort().join('|');
      
      if (seen.has(comboKey)) {
        duplicates.push({ index, variation: v, comboKey });
        // إذا كان له ID حقيقي، أضفه للحذف
        if (v.id && !v.id.toString().startsWith('temp_')) {
          setDeletedVariationIds(prev => [...prev, v.id]);
        }
      } else {
        seen.set(comboKey, true);
        unique.push(v);
      }
    });
    
    if (duplicates.length > 0) {
      console.log('🗑️ Removed duplicates:', duplicates);
      setVariations(unique);
      alert(`✅ تم إزالة ${duplicates.length} نسخة مكررة`);
    } else {
      alert('✅ لا توجد نسخ مكررة');
    }
  };

  const handleVariationImageUpload = (variation, imageUrl) => {
    const index = variations.findIndex(v => v.id === variation.id);
    if (index !== -1) {
      updateVariation(index, 'image', imageUrl);
    }
  };

  // دالة للتحقق من تغيير variation
  const hasVariationChanged = (current, original) => {
    if (!original) return true; // variation جديدة
    
    return (
      current.sku !== original.sku ||
      String(current.price) !== String(original.price) ||
      String(current.sale_price || '') !== String(original.sale_price || '') ||
      parseInt(current.stock_quantity) !== parseInt(original.stock_quantity) ||
      parseInt(current.localStock || 0) !== parseInt(original.localStock || 0) ||
      (typeof current.image === 'string' ? current.image : current.image?.src) !== original.image
    );
  };

  // دالة للتحقق من تغيير المنتج الأساسي
  const hasParentProductChanged = () => {
    if (!originalData) return true;
    
    const categoriesChanged = 
      form.categories.length !== originalData.categories.length ||
      form.categories.some(id => !originalData.categories.includes(id));
    
    const attributesChanged = 
      attributes.length !== originalData.attributes.length ||
      attributes.some((attr, i) => {
        const orig = originalData.attributes[i];
        return !orig || 
          attr.name !== orig.name || 
          attr.options.length !== orig.options.length ||
          attr.options.some((opt, j) => opt !== orig.options[j]);
      });
    
    // 🔥 التحقق من تغيير الصور
    const imagesChanged = () => {
      if (!originalData.images && images.length === 0) return false;
      if (!originalData.images && images.length > 0) return true;
      if (originalData.images && images.length !== originalData.images.length) return true;
      
      // مقارنة URLs
      const originalUrls = (originalData.images || []).map(img => img.url || img.src).sort();
      const currentUrls = images.filter(img => !img.uploading).map(img => img.url).sort();
      return originalUrls.some((url, i) => url !== currentUrls[i]);
    };
    
    return (
      form.name !== originalData.name ||
      form.sku !== originalData.sku ||
      imagesChanged() ||
      categoriesChanged ||
      attributesChanged
    );
  };

  // Category Handlers
  const getCategoryChildren = (parentId) => {
    return categories.filter(c => c.parent === parentId);
  };

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

  const toggleCategorySelection = (catId) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter(id => id !== catId)
        : [...prev.categories, catId]
    }));
  };

  const renderCategory = (cat, level = 0) => {
    const children = getCategoryChildren(cat.id);
    const isSelected = form.categories.includes(cat.id);
    const isCollapsed = collapsedCategories.has(cat.id);
    const paddingLeft = level * 24;
    
    return (
      <div key={cat.id}>
        <div
          className={`flex items-center gap-2 px-4 py-2.5 transition-all border-t border-gray-100 ${
            level === 0 ? 'bg-gray-50 border-t-2 border-gray-200' : ''
          }`}
          style={{ paddingRight: `${paddingLeft + 16}px` }}
        >
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className="w-6 h-6 flex items-center justify-center hover:bg-blue-100 rounded transition-all"
            >
              <span className="text-sm font-bold">{isCollapsed ? '►' : '▼'}</span>
            </button>
          )}
          
          {children.length === 0 && <div className="w-6" />}
          
          <label className="flex-1 flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleCategorySelection(cat.id)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className={`text-sm ${isSelected ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
              {cat.name}
            </span>
          </label>
        </div>
        
        {!isCollapsed && children.map(child => renderCategory(child, level + 1))}
      </div>
    );
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (form.productType === 'simple') {
      if (!form.name || !form.sellingPrice) {
        alert('⚠️ الاسم وسعر البيع مطلوبان');
        return;
      }
    } else if (form.productType === 'variable') {
      if (!form.name) {
        alert('⚠️ الاسم مطلوب');
        return;
      }
      
      // 🔥 التحقق من السمات (Attributes)
      if (attributes.length === 0) {
        alert('⚠️ يجب إضافة سمة واحدة على الأقل (مثل: اللون، المقاس)');
        return;
      }
      
      const emptyAttribute = attributes.find(attr => !attr.name || attr.options.length === 0);
      if (emptyAttribute) {
        alert('⚠️ يجب إدخال اسم السمة وخيار واحد على الأقل لكل سمة');
        return;
      }
      
      // 🔥 التحقق من الأنواع (Variations)
      if (variations.length === 0) {
        alert('⚠️ يجب توليد الأنواع (Variations) أولاً!\n\nاضغط على زر "🔄 توليد Variations" بعد إضافة السمات والخيارات');
        return;
      }
      
      // 🔥 التحقق من اكتمال بيانات كل variation
      const invalidVariations = [];
      variations.forEach((v, index) => {
        if (!v.sku || !v.sku.trim()) {
          invalidVariations.push(`النوع ${index + 1}: SKU مطلوب`);
        }
        if (!v.price || v.price === '0' || parseFloat(v.price) <= 0) {
          invalidVariations.push(`النوع ${index + 1}: السعر مطلوب ويجب أن يكون أكبر من 0`);
        }
      });
      
      if (invalidVariations.length > 0) {
        alert('⚠️ بيانات غير مكتملة:\n\n' + invalidVariations.join('\n'));
        return;
      }
    }

    setLoading(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === form.supplierId);
      
      if (syncToApi) {
        if (form.productType === 'variable') {
          // Create/Update Variable Product
          await handleVariableProductSubmit();
        } else {
          // Create/Update Simple Product
          await handleSimpleProductSubmit();
        }
      } else {
        // Local storage only
        await warehouseStorage.addProduct({
          ...form,
          supplierName: selectedSupplier?.name || ''
        });
        alert('✅ تم إضافة المنتج للمخزن المحلي بنجاح!');
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(form);
        } else {
          router.push('/warehouse');
        }
      }
    } catch (error) {
      console.error('Error submitting product:', error);
      alert('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSimpleProductSubmit = async () => {
    const endpoint = mode === 'edit' 
      ? `/api/products/${productId}`
      : '/api/warehouse/create-product';
    
    const method = mode === 'edit' ? 'PATCH' : 'POST';

    // تجهيز salePrice كسلسلة نصية فقط إذا كانت قيمة رقمية وصحيحة
    let salePriceToSend = undefined;
    if (
      form.salePrice !== undefined &&
      form.salePrice !== null &&
      String(form.salePrice).trim() !== '' &&
      !isNaN(Number(form.salePrice))
    ) {
      salePriceToSend = String(form.salePrice);
    }
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        sku: form.sku,
        sellingPrice: parseFloat(form.sellingPrice),
        ...(salePriceToSend !== undefined ? { salePrice: salePriceToSend } : {}),
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        stock: parseInt(form.apiStock) || 0,
        categories: form.categories.length > 0 ? form.categories : null,
        images: images.filter(img => !img.uploading).map(img => img.url)
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل في حفظ المنتج');
    }

    const savedProductId = result.product.id; // 🔥 استخدام اسم مختلف
    const selectedSupplier = suppliers.find(s => s.id === form.supplierId);

    if (form.purchasePrice || form.supplierId || form.localStock) {
      await warehouseStorage.setProductData(savedProductId, {
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

    // 🔥 استدعاء callback للتحديث أولاً
    if (onSuccess) {
      onSuccess(result.product);
    }
    
    // 🔥 إغلاق الـ modal فوراً
    if (onClose) {
      onClose();
    }
    
    // Toast message سيظهر من الصفحة الأم
  };

  const handleVariableProductSubmit = async () => {
    // 🔥 التحقق من تغيير المنتج الأساسي في حالة التعديل
    const shouldUpdateParent = mode === 'create' || hasParentProductChanged();
    
    let parentId = mode === 'edit' ? productId : null;
    
    // 🆕 استخراج كل الـ options من الـ variations الموجودة فعلياً
    const updatedAttributes = attributes.map(attr => {
      // جمع كل الخيارات من الـ variations
      const optionsFromVariations = new Set();
      variations.forEach(v => {
        const matchingAttr = v.attributes.find(a => a.name === attr.name);
        if (matchingAttr && matchingAttr.option) {
          optionsFromVariations.add(matchingAttr.option);
        }
      });
      
      return {
        ...attr,
        options: Array.from(optionsFromVariations) // استخدام الخيارات من الـ variations فقط
      };
    });
    
    if (shouldUpdateParent) {
      const parentResponse = await fetch(
        mode === 'edit' 
          ? `/api/products/${productId}`
          : '/api/warehouse/create-product',
        {
          method: mode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            sku: form.sku,
            type: 'variable',
            categories: form.categories.length > 0 ? form.categories : null,
            images: images.filter(img => !img.uploading).map(img => img.url), // 🆕 استخدام الصور المتعددة
            attributes: updatedAttributes.map(attr => ({
              name: attr.name,
              options: attr.options,
              visible: true,
              variation: true
            }))
        })
      });

      if (!parentResponse.ok) {
        let errorMessage = `فشل ${mode === 'edit' ? 'تحديث' : 'إنشاء'} المنتج الأساسي`;
        const responseText = await parentResponse.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          if (responseText) errorMessage = responseText;
        }
        throw new Error(errorMessage);
      }

      if (mode === 'create') {
        let parentResult;
        try {
          parentResult = await parentResponse.json();
        } catch (e) {
          throw new Error('استجابة غير صحيحة من الخادم: ' + e.message);
        }
        
        parentId = parentResult?.product?.id || parentResult?.id;
        
        if (!parentId) {
          throw new Error('فشل الحصول على ID المنتج');
        }
      }
    }

    // 🆕 Delete removed variations first (خارج shouldUpdateParent - لازم يحصل دايماً)
    if (mode === 'edit' && deletedVariationIds.length > 0 && parentId) {
      console.log('🗑️ Deleting variations:', deletedVariationIds);
      for (const varId of deletedVariationIds) {
        try {
          const deleteResponse = await fetch(`/api/products/${parentId}/variations/${varId}`, {
            method: 'DELETE'
          });
          if (deleteResponse.ok) {
            console.log('✅ Deleted variation:', varId);
          } else {
            console.error('❌ Failed to delete variation:', varId);
          }
        } catch (err) {
          console.error('Error deleting variation:', varId, err);
        }
      }
      // Clear deleted list after deletion
      setDeletedVariationIds([]);
    }

    // Create/Update variations (فقط المتغيرة)
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const createdVariations = [];
    
    for (const variation of variations) {
      try {
        const variationId = variation.id && !variation.id.toString().startsWith('temp_') ? variation.id : null;
        
        // 🔥 في حالة التعديل، نتحقق من التغيير
        if (mode === 'edit' && variationId) {
          const originalVariation = originalData?.variations?.find(v => v.id === variationId);
          if (!hasVariationChanged(variation, originalVariation)) {
            skippedCount++;
            // حفظ للمخزون المحلي حتى لو مفيش تغيير
            if (variation.localStock) {
              createdVariations.push({
                id: variationId,
                localStock: variation.localStock || 0
              });
            }
            continue; // تخطي الـ variation لأنها مش متغيرة
          }
        }
        
        const url = variationId 
          ? `/api/products/${parentId}/variations/${variationId}`
          : `/api/products/${parentId}/variations`;
        const method = variationId ? 'PUT' : 'POST';
        
        // استخراج URL الصورة (قد يكون string أو object)
        const imageUrl = typeof variation.image === 'string' 
          ? variation.image 
          : variation.image?.src;

        // 🔥 Validation: تأكد إن sale_price أقل من regular_price
        let salePriceToSend = variation.sale_price ? String(variation.sale_price) : '';
        if (salePriceToSend && parseFloat(salePriceToSend) >= parseFloat(variation.price)) {
          console.warn(`⚠️ Sale price (${salePriceToSend}) >= Regular price (${variation.price}). WooCommerce will reject it.`);
          salePriceToSend = ''; // إزالة sale_price لو أعلى من regular_price
        }

        const variationData = {
          sku: variation.sku,
          regular_price: String(variation.price),
          sale_price: salePriceToSend,
          stock_quantity: parseInt(variation.stock_quantity) || 0,
          manage_stock: true,
          attributes: variation.attributes.map(attr => ({
            name: attr.name,
            option: attr.option
          })),
          image: imageUrl ? { src: imageUrl } : null
        };

        console.log('🔍 Sending variation data:', variationData);

        const variationResponse = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variationData)
        });

        if (variationResponse.ok) {
          const variationResult = await variationResponse.json();
          successCount++;
          // 🆕 حفظ معلومات variation للمخزون المحلي
          if (variationResult.variation && variationResult.variation.id) {
            createdVariations.push({
              id: variationResult.variation.id,
              localStock: variation.localStock || 0
            });
          }
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
        console.error('Error creating variation:', err);
      }
    }

    // 🆕 حفظ المخزون المحلي لكل المتغيرات
    if (createdVariations.length > 0) {
      await warehouseStorage.setMultipleVariationLocalStocks(createdVariations);
    }

    const selectedSupplier = suppliers.find(s => s.id === form.supplierId);

    if (form.purchasePrice || form.supplierId) {
      await warehouseStorage.setProductData(parentId, {
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        localStock: 0,
        notes: '',
        suppliers: selectedSupplier ? [{
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          addedAt: new Date().toISOString()
        }] : []
      });
    }

    const actionText = mode === 'edit' ? 'تحديث' : 'إنشاء';
    let message = `✅ تم ${actionText} المنتج المتعدد بنجاح!\n\n🆔 ID: ${parentId}\n📦 الاسم: ${form.name}`;
    
    if (mode === 'edit') {
      message += `\n\n🔄 تحديث المتغيرات:`;
      if (successCount > 0) message += `\n✓ ${successCount} متغير تم تحديثه`;
      if (skippedCount > 0) message += `\n⊝ ${skippedCount} متغير بدون تغيير`;
      if (failCount > 0) message += `\n✗ ${failCount} متغير فشل`;
    } else {
      message += `\n🔀 Variations: ${successCount} نجحت، ${failCount} فشلت`;
    }
    
    // 🔥 استدعاء callback للتحديث أولاً
    if (onSuccess) {
      onSuccess({ id: parentId, name: form.name, type: 'variable' });
    }
    
    // 🔥 إغلاق الـ modal فوراً
    if (onClose) {
      onClose();
    }
    
    // Toast message سيظهر من الصفحة الأم
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">جاري تحميل بيانات المنتج...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white h-full">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      {/* إزالة العنوان لأنه موجود في header الـ modal */}

      {/* Sync Toggle */}
      {/* <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={syncToApi}
            onChange={(e) => setSyncToApi(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded"
          />
          <div className="flex-1">
            <span className="font-semibold text-gray-800">🔄 مزامنة مع WooCommerce API</span>
            <p className="text-xs text-gray-600 mt-1">
              سيظهر المنتج في الموقع و POS. إذا تم إلغاء التحديد، سيتم الحفظ محلياً فقط.
            </p>
          </div>
        </label>
      </div> */}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Product Type Selector */}
        <div className="hidden md:block md:col-span-2 border-2 border-dashed border-blue-300 rounded-xl p-4 bg-gradient-to-r from-blue-50 to-cyan-50">
          <label className="block text-sm font-semibold mb-3 text-blue-900">📦 نوع المنتج</label>
          <div className="flex gap-4">
            <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md"
              style={{
                borderColor: form.productType === 'simple' ? '#3b82f6' : '#d1d5db',
                backgroundColor: form.productType === 'simple' ? '#eff6ff' : 'white'
              }}>
              <input
                type="radio"
                value="simple"
                checked={form.productType === 'simple'}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                className="w-5 h-5 text-blue-600"
              />
              <div>
                <div className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  منتج بسيط
                </div>
                <div className="text-xs text-gray-600">منتج واحد بدون متغيرات</div>
              </div>
            </label>

            <label className="flex-1 flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md"
              style={{
                borderColor: form.productType === 'variable' ? '#8b5cf6' : '#d1d5db',
                backgroundColor: form.productType === 'variable' ? '#f5f3ff' : 'white'
              }}>
              <input
                type="radio"
                value="variable"
                checked={form.productType === 'variable'}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                className="w-5 h-5 text-purple-600"
              />
              <div>
                <div className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-xl">🔀</span>
                  منتج متعدد
                </div>
                <div className="text-xs text-gray-600">منتج بمتغيرات (ألوان، مقاسات)</div>
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-3 px-2">
            💡 <strong>منتج بسيط:</strong> مثل قلم، كتاب | <strong>منتج متعدد:</strong> مثل تيشيرت (أحمر/أزرق، S/M/L)
          </p>
        </div>

        {/* Product Images - 🆕 Multiple Images */}
        <div className="md:col-span-2">
          <MultipleImageUpload 
            images={images}
            onChange={setImages}
            maxImages={8}
            uploading={uploadingImage}
          />
        </div>

        {/* Product Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2 text-gray-800">اسم المنتج *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="مثال: قميص قطني"
            required
          />
        </div>

        {/* SKU */}
        <div className='hidden md:block'>
          <label className="block text-sm font-semibold mb-2 text-gray-800">كود المنتج (SKU)</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="SHIRT-001"
          />
        </div>

        {/* Categories */}
        <div className="md:col-span-2 hidden md:block">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold">
              🏷️ التصنيفات (اختياري)
            </label>
            {!categoriesLoading && categories.length > 0 && (
              <button
                type="button"
                onClick={() => loadCategories(true)}
                className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-medium flex items-center gap-1"
                title="تحديث التصنيفات من السيرفر"
              >
                🔄 تحديث
              </button>
            )}
          </div>
          
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
                onClick={() => loadCategories(true)}
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
                      const allParentsWithChildren = categories.filter(c => c.parent === 0 && getCategoryChildren(c.id).length > 0).map(c => c.id);
                      setCollapsedCategories(new Set(allParentsWithChildren));
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ► إغلاق الكل
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Attributes Section for Variable Products */}
        {form.productType === 'variable' && (
          <div className="md:col-span-2">
            <AttributeSelector
              attributes={attributes}
              onChange={setAttributes}
              onGenerateVariations={generateVariations}
            />
          </div>
        )}

        {/* Variations Editor */}
        {form.productType === 'variable' && generatedVariations && variations.length > 0 && (
          <div className="md:col-span-2 border-2 border-green-300 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                ✨ المتغيرات ({variations.length})
              </h3>
              <button
                type="button"
                onClick={removeDuplicateVariations}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium flex items-center gap-1"
              >
                🧹 إزالة المكررات
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {variations.map((variation, index) => (
                <div key={variation.id} className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {variation.attributes.map((attr, i) => (
                          <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            {attr.name}: {attr.option}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariation(index)}
                      className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="grid md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1">SKU *</label>
                      <input
                        type="text"
                        value={variation.sku}
                        onChange={(e) => updateVariation(index, 'sku', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1">السعر (ج.م) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={variation.price}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                            updateVariation(index, 'price', val);
                          }
                        }}
                        className="w-full px-2 py-1 border rounded text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1">💰 سعر العرض</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={variation.sale_price || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                            updateVariation(index, 'sale_price', val);
                          }
                        }}
                        className={`w-full px-2 py-1 border rounded text-sm ${
                          variation.sale_price && parseFloat(variation.sale_price) >= parseFloat(variation.price)
                            ? 'bg-red-50 border-red-400'
                            : 'bg-yellow-50'
                        }`}
                        placeholder="اختياري"
                        title="سعر العرض (أقل من السعر الأساسي)"
                      />
                      {variation.sale_price && parseFloat(variation.sale_price) >= parseFloat(variation.price) && (
                        <p className="text-xs text-red-600 mt-1 font-bold">
                          ⚠️ سعر العرض يجب أن يكون أقل من السعر الأساسي ({variation.price} ج.م)
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        🌐 مخزون الموقع
                      </label>
                      <input
                        type="number"
                        value={variation.stock_quantity}
                        onChange={(e) => updateVariation(index, 'stock_quantity', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm bg-blue-50"
                        min="0"
                        title="المخزون في WooCommerce"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        🏪 مخزون المحل
                      </label>
                      <input
                        type="number"
                        value={variation.localStock || 0}
                        onChange={(e) => updateVariation(index, 'localStock', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm bg-green-50"
                        min="0"
                        title="المخزون المحلي في المحل"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">الصورة</label>
                      <VariationImageUpload
                        variation={variation}
                        onImageUpload={handleVariationImageUpload}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price & Stock for Simple Products */}
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

            <div>
              <label className="block text-sm font-semibold mb-2">💰 سعر العرض (ج.م)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.salePrice}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    setForm({ ...form, salePrice: val });
                  }
                }}
                className="w-full px-4 py-2 border rounded-lg bg-yellow-50"
                placeholder="اختياري - أقل من سعر البيع"
              />
              <p className="text-xs text-gray-500 mt-1">💡 سعر العرض (إذا كان أقل من السعر الأساسي)</p>
            </div>

            <div className='hidden md:block'>
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

            <div className='hidden md:block'>
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

        {/* Stock for Simple Products */}
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

            <div className='hidden md:block'>
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

        {/* Submit Button */}
        <div className="md:col-span-2 flex gap-4 pt-4">
          {/* <button
            type="button"
            onClick={onClose || (() => router.back())}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all font-semibold"
            disabled={loading}
          >
            ← {onClose ? 'إغلاق' : 'رجوع'}
          </button> */}
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || uploadingImage}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                جاري الحفظ...
              </span>
            ) : (
              <span>💾 {mode === 'edit' ? 'تحديث المنتج' : 'إضافة المنتج'}</span>
            )}
          </button>
        </div>
      </div>
      </div>
    </form>
  );
}
