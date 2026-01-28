"use client";

import { useState } from "react";

export default function BulkUploadModal({ isOpen, onClose, onSuccess, setToast }) {
  const [activeTab, setActiveTab] = useState('manual'); // 'files', 'urls', or 'manual'
  const [files, setFiles] = useState([]);
  const [urlsText, setUrlsText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [products, setProducts] = useState([]);
  const [creating, setCreating] = useState(false);
  
  // 🆕 Manual entry products
  const [manualProducts, setManualProducts] = useState([
    { id: Date.now(), name: '', price: '', stock: '', sku: '', imageUrl: '', ready: true }
  ]);

  const handleFilesChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length > 20) {
      setToast({ message: '⚠️ الحد الأقصى 20 صورة في المرة الواحدة', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setFiles(selectedFiles);
    setUploading(true);

    // رفع كل الصور بالتوازي 🔥
    const uploadPromises = selectedFiles.map(async (file, index) => {
      // معاينة محلية
      const preview = URL.createObjectURL(file);
      
      try {
        setUploadProgress(prev => ({ ...prev, [index]: 'uploading' }));
        
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('فشل رفع الصورة');

        const uploadData = await uploadRes.json();
        
        // تحويل لـ WebP
        let imageUrl = uploadData.url;
        if (imageUrl && !imageUrl.includes('.webp')) {
          imageUrl = imageUrl.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
        }

        setUploadProgress(prev => ({ ...prev, [index]: 'success' }));

        return {
          id: `temp-${Date.now()}-${index}`,
          preview,
          imageUrl,
          fileName: file.name,
          name: '',
          price: '',
          stock: 0,
          sku: '',
          ready: false
        };
      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => ({ ...prev, [index]: 'error' }));
        return null;
      }
    });

    const uploadedProducts = (await Promise.all(uploadPromises)).filter(p => p !== null);
    setProducts(uploadedProducts);
    setUploading(false);

    if (uploadedProducts.length > 0) {
      setToast({ message: `✅ تم رفع ${uploadedProducts.length} صورة بنجاح!`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  // 🆕 رفع من URLs
  const handleUrlsUpload = async () => {
    const urls = urlsText
      .split('\n')
      .map(url => url.trim())
      .filter(url => {
        if (!url || !url.startsWith('http')) return false;
        
        // قبول روابط مباشرة للصور
        if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i)) return true;
        
        // قبول روابط فيسبوك
        if (url.includes('facebook.com/photo')) return true;
        if (url.includes('fbcdn.net')) return true;
        
        // قبول روابط إنستجرام
        if (url.includes('instagram.com/p/')) return true;
        if (url.includes('cdninstagram.com')) return true;
        
        return false;
      });

    if (urls.length === 0) {
      setToast({ message: '⚠️ لم يتم العثور على روابط صور صحيحة', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (urls.length > 20) {
      setToast({ message: '⚠️ الحد الأقصى 20 رابط في المرة الواحدة', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setUploading(true);

    // رفع كل الصور بالتوازي 🔥
    const uploadPromises = urls.map(async (url, index) => {
      try {
        setUploadProgress(prev => ({ ...prev, [index]: 'uploading' }));

        const uploadRes = await fetch('/api/upload-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        if (!uploadRes.ok) throw new Error('فشل رفع الصورة');

        const uploadData = await uploadRes.json();

        setUploadProgress(prev => ({ ...prev, [index]: 'success' }));

        return {
          id: `temp-url-${Date.now()}-${index}`,
          preview: url, // استخدام الرابط الأصلي للمعاينة
          imageUrl: uploadData.url,
          name: '',
          price: '',
          stock: 0,
          sku: '',
          ready: false
        };
      } catch (error) {
        console.error('Upload from URL error:', url, error);
        setUploadProgress(prev => ({ ...prev, [index]: 'error' }));
        return null;
      }
    });

    const uploadedProducts = (await Promise.all(uploadPromises)).filter(p => p !== null);
    setProducts(uploadedProducts);
    setUploading(false);

    if (uploadedProducts.length > 0) {
      setToast({ message: `✅ تم رفع ${uploadedProducts.length} صورة من الروابط!`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
      setUrlsText(''); // مسح النص
    }
  };

  const updateProduct = (id, field, value) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const removeProduct = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // 🔥 Batch operations for file uploads
  const fillAllNamesFromFiles = () => {
    let filled = 0;
    setProducts(prev => {
      console.log('Products before filling:', prev.map(p => ({ id: p.id, fileName: p.fileName, name: p.name })));
      
      const updated = prev.map(p => {
        if (!p.fileName) {
          console.log('❌ No fileName for product:', p.id);
          return p;
        }
        if (p.name && p.name.trim()) {
          console.log('⏭️ Already has name:', p.id, p.name);
          return p;
        }
        
        let productName = p.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        productName = productName
          .replace(/^\d+[\.\-_\s]*/, "")           // Remove leading numbers
          .replace(/[\(\)\[\]\{\}]/g, ' ')          // Remove brackets
          .replace(/[\-_]+/g, ' ')                  // Replace - _ with space
          .replace(/\s+/g, ' ')                     // Clean multiple spaces
          .trim();
        
        console.log('✅ Filled:', p.fileName, '→', productName);
        filled++;
        return { ...p, name: productName };
      });
      
      return updated;
    });
    
    if (filled > 0) {
      setToast({ message: `✅ تم ملء ${filled} اسم من الملفات`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } else {
      setToast({ message: '⚠️ لم يتم ملء أي أسماء (تحقق من Console)', type: 'warning' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const applyPriceToAll = () => {
    const price = prompt('أدخل السعر المراد تطبيقه على جميع المنتجات:', '0');
    if (price === null) return;
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      setToast({ message: '⚠️ السعر غير صحيح', type: 'error' });
      setTimeout(() => setToast(null), 2000);
      return;
    }
    
    setProducts(prev => prev.map(p => ({ ...p, price: String(priceValue) })));
    setToast({ message: `✅ تم تطبيق السعر ${priceValue} على ${products.length} منتج`, type: 'success' });
    setTimeout(() => setToast(null), 2000);
  };

  // 🆕 Manual products functions
  const updateManualProduct = (id, field, value) => {
    setManualProducts(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const addManualProduct = () => {
    setManualProducts(prev => [...prev, { 
      id: Date.now(), 
      name: '', 
      price: '', 
      stock: '', 
      sku: '', 
      imageUrl: '', 
      ready: true 
    }]);
  };

  const removeManualProduct = (id) => {
    if (manualProducts.length === 1) return; // Keep at least one row
    setManualProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleBulkCreate = async () => {
    // Determine which products to create based on active tab
    let readyProducts;
    
    if (activeTab === 'manual') {
      readyProducts = manualProducts.filter(p => p.name && p.price);
    } else {
      readyProducts = products.filter(p => p.ready && p.name && p.price);
    }
    
    if (readyProducts.length === 0) {
      setToast({ message: '⚠️ لم يتم تحديد أي منتج للإضافة', type: 'error' });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/warehouse/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: readyProducts.map(p => ({
            name: p.name,
            sellingPrice: parseFloat(p.price),
            purchasePrice: 0,
            stock: parseInt(p.stock) || 0,
            sku: p.sku || '',
            imageUrl: p.imageUrl
          }))
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل إضافة المنتجات');
      }

      setToast({ 
        message: `✅ تم إضافة ${result.created} من ${readyProducts.length} منتج بنجاح!`, 
        type: 'success' 
      });
      setTimeout(() => setToast(null), 3000);

      if (onSuccess) {
        result.products.forEach(product => onSuccess(product));
      }

      // إعادة تعيين
      setFiles([]);
      setProducts([]);
      setUploadProgress({});
      setManualProducts([{ id: Date.now(), name: '', price: '', stock: '', sku: '', imageUrl: '', ready: true }]);
      onClose();
    } catch (error) {
      console.error('Bulk create error:', error);
      setToast({ message: '❌ ' + error.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setCreating(false);
    }
  };

  const selectAll = () => {
    setProducts(prev => prev.map(p => ({ ...p, ready: true })));
  };

  const deselectAll = () => {
    setProducts(prev => prev.map(p => ({ ...p, ready: false })));
  };

  if (!isOpen) return null;

  const readyCount = activeTab === 'manual' 
    ? manualProducts.filter(p => p.name && p.price).length
    : products.filter(p => p.ready && p.name && p.price).length;

  const totalCount = activeTab === 'manual' ? manualProducts.length : products.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl animate-scaleIn flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-5 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-3xl">📦</span>
              <span>إضافة منتجات متعددة</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activeTab === 'manual'
                ? `${totalCount} منتج • ${readyCount} جاهز للإضافة`
                : totalCount > 0 
                  ? `${totalCount} صورة • ${readyCount} جاهز للإضافة`
                  : 'اختر طريقة إضافة المنتجات'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading || creating}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none transition-colors disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {(products.length === 0 && activeTab !== 'manual') || activeTab === 'manual' ? (
            // Upload Area with Tabs
            <div className="h-full flex flex-col">
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                    activeTab === 'manual'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  ✍️ إدخال يدوي
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                    activeTab === 'files'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  📁 رفع ملفات
                </button>
                <button
                  onClick={() => setActiveTab('urls')}
                  className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                    activeTab === 'urls'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  🔗 من روابط
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 flex items-center justify-center">
                {activeTab === 'files' ? (
                  // Files Upload
                  <div className="text-center max-w-md w-full">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilesChange}
                      className="hidden"
                      id="bulk-upload-input"
                      disabled={uploading}
                    />
                    <label
                      htmlFor="bulk-upload-input"
                      className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all group"
                    >
                      <svg
                        className="w-16 h-16 mb-4 text-gray-400 group-hover:text-gray-500 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
                        اضغط لاختيار الصور
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        PNG, JPG, WEBP (حتى 20 صورة)
                      </p>
                      {uploading && (
                        <div className="mt-4 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                          <span className="text-blue-600 font-medium">جاري الرفع...</span>
                        </div>
                      )}
                    </label>
                  </div>
                ) : activeTab === 'urls' ? (
                  // URLs Upload
                  <div className="w-full max-w-2xl space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-semibold mb-2 text-base">💡 كيفية الاستخدام:</p>
                      <ol className="list-decimal list-inside space-y-1.5 mr-2">
                        <li>افتح الصورة في فيسبوك/إنستجرام</li>
                        <li>كليك يمين على الصورة → <span className="font-bold">"نسخ عنوان الصورة"</span></li>
                        <li>الصق الرابط في المربع أدناه</li>
                        <li>كرر لكل صورة (كل رابط في سطر)</li>
                      </ol>
                      <p className="mt-3 text-xs opacity-75">
                        📌 النظام يدعم روابط فيسبوك وإنستجرام والروابط المباشرة للصور
                      </p>
                    </div>

                    <textarea
                      value={urlsText}
                      onChange={(e) => setUrlsText(e.target.value)}
                      placeholder="الصق روابط الصور هنا (كل رابط في سطر منفصل)&#10;&#10;مثال:&#10;https://scontent.fcai1-1.fna.fbcdn.net/v/t39.30808-6/...&#10;https://www.facebook.com/photo/?fbid=123456...&#10;https://example.com/image.jpg"
                      className="w-full h-64 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none"
                      disabled={uploading}
                    />

                    <button
                      onClick={handleUrlsUpload}
                      disabled={uploading || !urlsText.trim()}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span>جاري رفع الصور...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>جلب الصور من الروابط</span>
                        </>
                      )}
                    </button>

                    {uploading && Object.keys(uploadProgress).length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          التقدم: {Object.values(uploadProgress).filter(s => s === 'success').length} / {Object.keys(uploadProgress).length}
                        </p>
                        <div className="flex gap-1">
                          {Object.values(uploadProgress).map((status, i) => (
                            <div
                              key={i}
                              className={`h-2 flex-1 rounded ${
                                status === 'success' ? 'bg-green-500' :
                                status === 'error' ? 'bg-red-500' :
                                'bg-blue-500 animate-pulse'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'manual' ? (
                  // 🆕 Manual Entry Table
                  <div className="w-full">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        💡 <strong>نصيحة:</strong> الصورة اختيارية! يمكنك إضافة منتجات بدون صور وتعديلها لاحقاً
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-700">
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">#</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">
                              اسم المنتج <span className="text-red-500">*</span>
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">
                              السعر <span className="text-red-500">*</span>
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">الكمية</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">SKU</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-semibold">رابط الصورة</th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-sm font-semibold">حذف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manualProducts.map((product, index) => (
                            <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-center">
                                {index + 1}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                <input
                                  type="text"
                                  value={product.name}
                                  onChange={(e) => updateManualProduct(product.id, 'name', e.target.value)}
                                  placeholder="اسم المنتج"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800"
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                <input
                                  type="number"
                                  value={product.price}
                                  onChange={(e) => updateManualProduct(product.id, 'price', e.target.value)}
                                  placeholder="السعر"
                                  min="0"
                                  step="0.01"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800"
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                <input
                                  type="number"
                                  value={product.stock}
                                  onChange={(e) => updateManualProduct(product.id, 'stock', e.target.value)}
                                  placeholder="0"
                                  min="0"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800"
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                <input
                                  type="text"
                                  value={product.sku}
                                  onChange={(e) => updateManualProduct(product.id, 'sku', e.target.value)}
                                  placeholder="SKU"
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800"
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                <input
                                  type="url"
                                  value={product.imageUrl}
                                  onChange={(e) => updateManualProduct(product.id, 'imageUrl', e.target.value)}
                                  placeholder="https://..."
                                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800"
                                />
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center">
                                <button
                                  onClick={() => removeManualProduct(product.id)}
                                  disabled={manualProducts.length === 1}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-lg"
                                  title="حذف"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={addManualProduct}
                      className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-semibold flex items-center justify-center gap-2"
                    >
                      <span className="text-xl">➕</span>
                      <span>إضافة صف جديد</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            // Products Grid
            <div>
              {/* Batch Operations */}
              <div className="mb-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">⚡ عمليات سريعة</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={fillAllNamesFromFiles}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 font-medium"
                  >
                    <span>📝</span>
                    <span>ملء كل الأسماء من الملفات</span>
                  </button>
                  <button
                    onClick={applyPriceToAll}
                    className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm flex items-center gap-2 font-medium"
                  >
                    <span>💰</span>
                    <span>تطبيق سعر موحد</span>
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="mb-4 flex gap-2 items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    ✓ تحديد الكل
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors font-medium"
                  >
                    إلغاء التحديد
                  </button>
                </div>
                <button
                  onClick={() => {
                    setFiles([]);
                    setProducts([]);
                    setUploadProgress({});
                  }}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                >
                  🗑️ مسح الكل
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className={`border-2 rounded-xl p-3 transition-all ${
                      product.ready 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative mb-3 group">
                      <img
                        src={product.preview}
                        alt={`Product ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      {uploadProgress[index] === 'success' && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Form */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="اسم المنتج *"
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="SKU (اختياري)"
                        value={product.sku}
                        onChange={(e) => updateProduct(product.id, 'sku', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="السعر *"
                          value={product.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                              updateProduct(product.id, 'price', val);
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="المخزون"
                          value={product.stock}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              updateProduct(product.id, 'stock', val);
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      {/* Ready Checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={product.ready}
                          onChange={(e) => updateProduct(product.id, 'ready', e.target.checked)}
                          disabled={!product.name || !product.price}
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                        />
                        <span className={`text-sm font-medium ${product.ready ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {product.ready ? '✓ جاهز للإضافة' : 'غير جاهز'}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(products.length > 0 || (activeTab === 'manual' && manualProducts.length > 0)) && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-5 flex gap-3 flex-shrink-0">
            <button
              onClick={handleBulkCreate}
              disabled={creating || readyCount === 0}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-700 text-white py-3 rounded-lg hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md transition-all"
            >
              {creating ? '⏳ جاري الإضافة...' : `✅ إضافة ${readyCount} منتج`}
            </button>
            <button
              onClick={onClose}
              disabled={creating}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 font-semibold transition-colors text-gray-900 dark:text-white"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
