"use client";

import { useState } from 'react';

export default function InvoiceUploadModal({ isOpen, onClose, onSuccess, setToast }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'analyzing' | 'results'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importedProducts, setImportedProducts] = useState(new Set()); // Track imported products
  const [rawResponse, setRawResponse] = useState('');

  // Reset modal state
  const resetModal = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedImageUrl(null);
    setProducts([]);
    setImportedProducts(new Set());
    setRawResponse('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setToast({ message: '⚠️ يجب اختيار صورة فقط (JPG, PNG, WebP)', type: 'error' });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: '⚠️ حجم الصورة يجب أن يكون أقل من 10 ميجابايت', type: 'error' });
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  // Upload image to server
  const handleUploadImage = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('فشل رفع الصورة');

      const data = await res.json();
      setUploadedImageUrl(data.url);
      
      // Automatically start analysis
      await handleAnalyze(data.url);

    } catch (error) {
      console.error('Upload error:', error);
      setToast({ message: '❌ فشل رفع الصورة', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // Analyze invoice using Groq AI
  const handleAnalyze = async (imageUrl) => {
    setAnalyzing(true);
    setStep('analyzing');

    try {
      const res = await fetch('/api/analyze-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageUrl }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'فشل تحليل الفاتورة');
      }

      if (!data.products || data.products.length === 0) {
        setToast({ message: '⚠️ لم يتم العثور على منتجات في الفاتورة', type: 'error' });
        setStep('upload');
        return;
      }

      setProducts(data.products);
      setRawResponse(data.rawResponse || '');
      setStep('results');
      setToast({ message: `✅ تم استخراج ${data.products.length} منتج`, type: 'success' });

    } catch (error) {
      console.error('Analysis error:', error);
      setToast({ message: `❌ ${error.message}`, type: 'error' });
      setStep('upload');
    } finally {
      setAnalyzing(false);
    }
  };

  // Update product data in table
  const updateProduct = (index, field, value) => {
    setProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  // Remove product from list
  const removeProduct = (index) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  // Import all products
  const handleImportAll = async () => {
    if (products.length === 0) {
      setToast({ message: '⚠️ لا توجد منتجات للاستيراد', type: 'error' });
      return;
    }

    // التحقق من الأسعار
    const productsWithoutPrice = products.filter(p => !p.price || parseFloat(p.price) <= 0);
    if (productsWithoutPrice.length > 0) {
      setToast({ 
        message: `⚠️ يوجد ${productsWithoutPrice.length} منتج بدون سعر. يرجى إدخال الأسعار أولاً.`, 
        type: 'error' 
      });
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: products.length });
    setImportedProducts(new Set());

    try {
      // تحضير كل المنتجات
      const productsToImport = products.map(p => {
        // التأكد من وجود سعر صالح (أكبر من 0)
        const price = parseFloat(p.price) || 0;
        
        return {
          name: p.name,
          sellingPrice: price > 0 ? price : 1, // إذا السعر 0 أو فاضي، نحط 1 كسعر افتراضي
          purchasePrice: 0,
          stock: parseInt(p.quantity) || 0,
          sku: p.sku || '',
          imageUrl: ''
        };
      });

      // محاكاة progress للمستخدم
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev.current < prev.total) {
            const newCurrent = prev.current + 1;
            setImportedProducts(new Set([...Array(newCurrent).keys()]));
            return { ...prev, current: newCurrent };
          }
          return prev;
        });
      }, 150); // كل 150ms منتج

      // رفع كل المنتجات مرة واحدة (زي BulkUpload)
      const res = await fetch('/api/warehouse/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          products: productsToImport
        }),
      });

      clearInterval(progressInterval);

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'فشل إضافة المنتجات');
      }

      // Mark all as imported
      setImportProgress({ current: products.length, total: products.length });
      setImportedProducts(new Set([...Array(products.length).keys()]));

      setToast({ 
        message: `✅ تم إضافة ${result.created || products.length} من ${products.length} منتج بنجاح`, 
        type: 'success' 
      });

      // Notify parent for each product
      if (onSuccess && result.products) {
        result.products.forEach(product => onSuccess(product));
      }

      // تأخير صغير عشان المستخدم يشوف الـ 100%
      setTimeout(() => {
        handleClose();
      }, 1000);

    } catch (error) {
      console.error('Import error:', error);
      setToast({ message: '❌ فشل استيراد المنتجات: ' + error.message, type: 'error' });
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress({ current: 0, total: 0 });
        setImportedProducts(new Set());
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>📸</span>
                <span>رفع وتحليل فاتورة</span>
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                {step === 'upload' && 'ارفع صورة الفاتورة لاستخراج المنتجات تلقائياً'}
                {step === 'analyzing' && 'جاري تحليل الفاتورة بالذكاء الاصطناعي...'}
                {step === 'results' && `تم استخراج ${products.length} منتج - راجع وعدّل البيانات قبل الاستيراد`}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={analyzing || importing}
              className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="invoice-upload"
                />
                <label htmlFor="invoice-upload" className="cursor-pointer">
                  {previewUrl ? (
                    <div className="space-y-4">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-h-64 mx-auto rounded-lg shadow-lg"
                      />
                      <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                      <button
                        type="button"
                        className="text-purple-600 hover:text-purple-800 font-semibold"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                      >
                        🔄 اختر صورة أخرى
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-6xl">📸</div>
                      <div className="text-lg font-semibold text-gray-700">
                        اضغط لاختيار صورة الفاتورة
                      </div>
                      <p className="text-sm text-gray-500">
                        JPG, PNG, WebP (حتى 10MB)
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">💡 نصائح لأفضل نتائج:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• تأكد من وضوح النص في الصورة</li>
                  <li>• تجنب الظلال والانعكاسات</li>
                  <li>• التقط الصورة من الأعلى مباشرة</li>
                  <li>• الفاتورة يجب أن تحتوي على أعمدة: اسم المنتج، الكمية، السعر</li>
                </ul>
              </div>

              {/* Action Button */}
              {selectedFile && (
                <button
                  onClick={handleUploadImage}
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-3 rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>رفع وتحليل الفاتورة</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Analyzing */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="animate-spin text-6xl">🔄</div>
              <h3 className="text-xl font-bold text-gray-800">جاري تحليل الفاتورة...</h3>
              <p className="text-gray-600">الذكاء الاصطناعي يقوم باستخراج المنتجات</p>
              <div className="flex gap-2 mt-4">
                <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && (
            <div className="space-y-4">
              {/* Preview Image (Small) */}
              {previewUrl && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                  <img 
                    src={previewUrl} 
                    alt="Invoice" 
                    className="h-20 rounded shadow-sm"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">صورة الفاتورة</p>
                    <p className="text-xs text-gray-500">{selectedFile?.name}</p>
                  </div>
                  <button
                    onClick={() => setStep('upload')}
                    className="text-sm text-purple-600 hover:text-purple-800 font-semibold"
                  >
                    🔄 رفع فاتورة أخرى
                  </button>
                </div>
              )}

              {/* Products Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">#</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">اسم المنتج</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">SKU</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">الكمية</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">السعر</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => {
                        const isImported = importedProducts.has(index);
                        const isCurrentlyImporting = importing && importProgress.current === index + 1;
                        
                        return (
                          <tr 
                            key={index} 
                            className={`border-t border-gray-200 transition-all ${
                              isImported 
                                ? 'bg-green-50' 
                                : isCurrentlyImporting 
                                ? 'bg-blue-50 animate-pulse' 
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3 text-sm text-gray-600 relative">
                              {index + 1}
                              {isImported && (
                                <span className="absolute -top-1 -right-1 text-green-600 text-lg">✓</span>
                              )}
                              {isCurrentlyImporting && (
                                <span className="absolute -top-1 -right-1 text-blue-600 text-lg animate-spin">⏳</span>
                              )}
                            </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={product.name}
                              onChange={(e) => updateProduct(index, 'name', e.target.value)}
                              disabled={importing}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={product.sku || ''}
                              onChange={(e) => updateProduct(index, 'sku', e.target.value)}
                              placeholder="اختياري"
                              disabled={importing}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={product.quantity}
                              onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                              min="1"
                              disabled={importing}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={product.price}
                              onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                              min="0.01"
                              step="0.01"
                              disabled={importing}
                              className={`w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                !product.price || parseFloat(product.price) <= 0 
                                  ? 'border-red-500 bg-red-50' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {(!product.price || parseFloat(product.price) <= 0) && (
                              <span className="text-xs text-red-600 mt-1 block">⚠️ مطلوب</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isImported ? (
                              <span className="text-green-600 font-bold text-sm">✓ تم</span>
                            ) : (
                              <button
                                onClick={() => removeProduct(index)}
                                disabled={importing}
                                className="text-red-600 hover:text-red-800 font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                title="حذف المنتج"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Debug Info (Collapsible) */}
              {rawResponse && (
                <details className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    🔍 عرض استجابة الـ AI الأولية
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 overflow-x-auto bg-white p-2 rounded border">
                    {rawResponse}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step === 'results' && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            {/* Progress Bar */}
            {importing && importProgress.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    جاري الاستيراد... ({importProgress.current} / {importProgress.total})
                  </span>
                  <span className="text-sm font-bold text-purple-600">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-indigo-700 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={importing}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleImportAll}
                disabled={importing || products.length === 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>جاري الاستيراد...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>استيراد {products.length} منتج</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
