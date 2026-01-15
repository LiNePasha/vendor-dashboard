'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

export default function ImportProductsPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [vendorId, setVendorId] = useState(22); // Default vendor ID

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      alert('⚠️ يرجى اختيار ملف CSV');
    }
  };

  const parseCSV = (csvFile) => {
    setLoading(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = result.data
          .filter(row => row.النوع === 'simple' || row.النوع === 'variable')
          .map((row, index) => ({
            id: `import-${index}`,
            name: row.الاسم,
            sku: row['رمز المنتج (SKU)'] || row.SKU,
            price: parseFloat(row['السعر الافتراضي']) || 0,
            salePrice: parseFloat(row['سعر التخفيض']) || 0,
            stock: parseInt(row.المخزون) || 0,
            description: row.الوصف || '',
            shortDescription: row['وصف قصير'] || row['الوصف المختصر'] || '',
            categories: row.التصنيفات ? row.التصنيفات.split(',').map(c => c.trim()) : [],
            images: row.الصور ? row.الصور.split(',').map(img => img.trim()) : [],
            type: row.النوع,
            parentId: row.الأب || null,
            attributes: row['قيمة/قيم السمة 1'] || row['السمة 1 القيمة(القيم)'] ? {
              name: row['اسم السمة 1'] || row['السمة 1 الاسم'],
              values: (row['قيمة/قيم السمة 1'] || row['السمة 1 القيمة(القيم)']).split(',').map(v => v.trim())
            } : null
          }));
        
        setProducts(parsed);
        setLoading(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('❌ خطأ في قراءة الملف');
        setLoading(false);
      }
    });
  };

  const handleImport = async () => {
    if (products.length === 0) {
      alert('⚠️ لا توجد منتجات للاستيراد');
      return;
    }

    setImporting(true);
    setProgress(0);
    const importResults = { success: [], failed: [] };

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Import only simple products for now (variations need parent-child logic)
        if (product.type === 'simple') {
          console.log('Sending product:', {
            name: product.name,
            sku: product.sku,
            price: product.price,
            stock: product.stock
          });

          const response = await fetch('/api/warehouse/import-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: product.name,
              sku: product.sku,
              price: product.price,
              stock: product.stock,
              description: product.description,
              shortDescription: product.shortDescription,
              images: product.images
            })
          });

          const result = await response.json();
          console.log('API response:', result);

          if (response.ok && result.success) {
            importResults.success.push(product.name);
          } else {
            importResults.failed.push({ name: product.name, error: result.error || 'فشل الإنشاء' });
          }
        }
      } catch (error) {
        importResults.failed.push({ name: product.name, error: error.message });
      }

      setProgress(Math.round(((i + 1) / products.length) * 100));
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setResults(importResults);
    setImporting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📥 استيراد منتجات</h1>
              <p className="text-gray-600 dark:text-gray-400">استيراد المنتجات من ملف CSV</p>
            </div>
            <button
              onClick={() => router.push('/warehouse')}
              className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white font-semibold"
            >
              ← رجوع
            </button>
          </div>
        </div>

        {/* Vendor ID */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
            Vendor ID
          </label>
          <input
            type="number"
            value={vendorId}
            onChange={(e) => setVendorId(parseInt(e.target.value))}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="22"
          />
        </div>

        {/* Upload Section */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-white">
            📎 اختر ملف CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {file && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              ✅ تم اختيار: {file.name}
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-blue-800 dark:text-blue-300 font-semibold">جاري قراءة الملف...</p>
          </div>
        )}

        {/* Products Preview */}
        {!loading && products.length > 0 && !results && (
          <>
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  📦 معاينة المنتجات ({products.length})
                </h2>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md transition-all"
                >
                  {importing ? '⏳ جاري الاستيراد...' : '🚀 بدء الاستيراد'}
                </button>
              </div>

              {/* Progress Bar */}
              {importing && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-4 transition-all duration-300 flex items-center justify-center text-xs text-white font-bold"
                      style={{ width: `${progress}%` }}
                    >
                      {progress}%
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                    جاري استيراد المنتجات... يرجى الانتظار
                  </p>
                </div>
              )}

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">الاسم</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">SKU</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">السعر</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">المخزون</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">النوع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {products.slice(0, 20).map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{product.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{product.sku || '-'}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-semibold">{product.price} ج.م</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{product.stock}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            product.type === 'simple' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          }`}>
                            {product.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length > 20 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                    ... و {products.length - 20} منتج آخر
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-3">
                ✅ تم الاستيراد بنجاح ({results.success.length})
              </h3>
              <div className="max-h-40 overflow-y-auto text-sm text-green-700 dark:text-green-400">
                {results.success.map((name, i) => (
                  <div key={i}>• {name}</div>
                ))}
              </div>
            </div>

            {results.failed.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-3">
                  ❌ فشل الاستيراد ({results.failed.length})
                </h3>
                <div className="max-h-40 overflow-y-auto text-sm text-red-700 dark:text-red-400">
                  {results.failed.map((item, i) => (
                    <div key={i}>• {item.name}: {item.error}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/warehouse')}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold transition-colors"
              >
                🏠 العودة للمخزن
              </button>
              <button
                onClick={() => {
                  setProducts([]);
                  setFile(null);
                  setResults(null);
                  setProgress(0);
                }}
                className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 font-bold transition-colors"
              >
                🔄 استيراد ملف جديد
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
