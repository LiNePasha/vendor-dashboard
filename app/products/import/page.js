"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProductsImportPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [manualMapping, setManualMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);

  // 🆕 Auto-detect column mapping
  const detectColumnMapping = (headers) => {
    const mapping = {};
    
    const patterns = {
      name: ['name', 'product name', 'title', 'product_name', 'اسم', 'اسم المنتج'],
      sku: ['sku', 'code', 'product code', 'كود', 'رمز'],
      regular_price: ['regular price', 'price', 'regular_price', 'السعر', 'سعر'],
      sale_price: ['sale price', 'sale_price', 'discount price', 'سعر التخفيض'],
      stock: ['stock', 'quantity', 'qty', 'stock_quantity', 'الكمية', 'المخزون'],
      in_stock: ['in stock?', 'in_stock', 'available', 'متوفر'],
      categories: ['categories', 'category', 'cat', 'الفئة', 'الفئات'],
      images: ['images', 'image', 'photo', 'الصور', 'صورة'],
      description: ['description', 'desc', 'الوصف'],
      short_description: ['short description', 'short_description', 'وصف قصير'],
      type: ['type', 'product type', 'النوع'],
    };
    
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase().trim();
      
      for (const [key, patterns_list] of Object.entries(patterns)) {
        if (patterns_list.some(pattern => lowerHeader.includes(pattern))) {
          mapping[key] = index;
          break;
        }
      }
    });
    
    return mapping;
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setResults(null);
      setErrors([]);
      
      // 🆕 Preview CSV and extract headers
      try {
        // 🔧 Try to read with different encodings for Arabic support
        const arrayBuffer = await selectedFile.arrayBuffer();
        let text;
        
        const encodings = ['utf-8', 'windows-1256', 'iso-8859-6', 'cp1256'];
        
        for (const encoding of encodings) {
          try {
            text = new TextDecoder(encoding).decode(arrayBuffer);
            console.log(`🔍 Trying encoding: ${encoding}`);
            // Check if it has replacement characters
            if (!text.includes('�')) {
              console.log(`✅ Success with encoding: ${encoding}`);
              break;
            }
          } catch (e) {
            console.log(`❌ Failed encoding: ${encoding}`, e.message);
            continue;
          }
        }
        
        // Final fallback
        if (!text || text.includes('�')) {
          console.log("⚠️ Using fallback text reading");
          text = await selectedFile.text();
        }
        
        let lines = text.split(/\r?\n/).filter(line => line.trim()); // Handle both \n and \r\n
        
        // 🔧 Fix: Remove outer quotes from entire lines if wrapped
        lines = lines.map(line => {
          // If entire line is wrapped in quotes, remove them
          if (line.startsWith('"') && line.endsWith('"')) {
            return line.slice(1, -1);
          }
          return line;
        });
        
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                // Double quote escape ""
                current += '"';
                i++;
              } else {
                // Toggle quote state
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // Field separator - push and clean
              result.push(current.replace(/^"+|"+$/g, '').trim());
              current = '';
            } else {
              current += char;
            }
          }
          // Add last field and clean
          result.push(current.replace(/^"+|"+$/g, '').trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        const preview = lines.slice(1, 4).map(parseCSVLine); // First 3 rows
        
        console.log("📋 Parsed Headers:", headers);
        console.log("📋 Headers count:", headers.length);
        console.log("📋 Headers type:", typeof headers, Array.isArray(headers));
        console.log("📋 First 5 headers:", headers.slice(0, 5));
        
        setCsvHeaders(headers);
        setPreviewData(preview);
        
        // Check if auto-detection will work
        const detectedCount = headers.filter(h => {
          const lower = h.toLowerCase().trim();
          return lower.includes('name') || lower.includes('اسم') || 
                 lower.includes('price') || lower.includes('سعر') ||
                 lower.includes('sku') || lower.includes('كود');
        }).length;
        
        console.log("🔍 Detected fields count:", detectedCount);
        
        // Show manual mapping if detection seems weak
        if (detectedCount < 2) {
          setShowMappingModal(true);
        }
      } catch (error) {
        console.error("Error previewing file:", error);
      }
    } else {
      alert("الرجاء اختيار ملف CSV");
    }
  };

  const parseCSV = (text, useManualMapping = false) => {
    let lines = text.split(/\r?\n/).filter(line => line.trim());
    
    // 🔧 Fix: Remove outer quotes from entire lines if wrapped
    lines = lines.map(line => {
      // If entire line is wrapped in quotes, remove them
      if (line.startsWith('"') && line.endsWith('"')) {
        return line.slice(1, -1);
      }
      return line;
    });
    
    // Parse CSV with proper handling of quoted fields
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped double quote ""
            current += '"';
            i++;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator - clean quotes and push
          result.push(current.replace(/^"+|"+$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add last field and clean quotes
      result.push(current.replace(/^"+|"+$/g, '').trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]);
    const products = [];
    
    console.log("📋 Parsing - Headers:", headers);
    console.log("📋 Parsing - Total headers:", headers.length);
    
    // 🆕 Use manual mapping if provided, otherwise auto-detect
    let headerMapping = {};
    
    if (useManualMapping && Object.keys(manualMapping).length > 0) {
      // Use user's manual mapping
      Object.entries(manualMapping).forEach(([field, headerName]) => {
        const index = headers.indexOf(headerName);
        if (index !== -1) {
          headerMapping[field] = index;
        }
      });
    } else {
      // 🆕 Auto-detect which headers map to which fields
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().trim();
        
        // Map common variations to standard fields
        if (lowerHeader.includes('name') || lowerHeader.includes('اسم')) {
          headerMapping.name = index;
        } else if (lowerHeader.includes('sku') || lowerHeader.includes('كود') || lowerHeader.includes('رمز')) {
          headerMapping.sku = index;
        } else if (lowerHeader.includes('regular') && lowerHeader.includes('price')) {
          headerMapping.regular_price = index;
        } else if (lowerHeader.includes('price') && !lowerHeader.includes('sale') && !headerMapping.regular_price) {
          headerMapping.regular_price = index;
        } else if (lowerHeader.includes('sale') && lowerHeader.includes('price')) {
          headerMapping.sale_price = index;
        } else if (lowerHeader.includes('stock') || lowerHeader.includes('quantity') || lowerHeader.includes('كمية')) {
          headerMapping.stock = index;
        } else if (lowerHeader.includes('in stock') || lowerHeader.includes('available') || lowerHeader.includes('متوفر')) {
          headerMapping.in_stock = index;
        } else if (lowerHeader.includes('categor') || lowerHeader.includes('فئة')) {
          headerMapping.categories = index;
        } else if (lowerHeader.includes('image') || lowerHeader.includes('photo') || lowerHeader.includes('صورة')) {
          headerMapping.images = index;
        } else if (lowerHeader.includes('short') && lowerHeader.includes('desc')) {
          headerMapping.short_description = index;
        } else if (lowerHeader.includes('desc') || lowerHeader.includes('وصف')) {
          headerMapping.description = index;
        } else if (lowerHeader.includes('type') || lowerHeader.includes('نوع')) {
          headerMapping.type = index;
        }
      });
    }
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const product = {};
      
      // Use detected mapping with headers (already cleaned by parseCSVLine)
      product.Name = headerMapping.name !== undefined ? values[headerMapping.name] : (values[headers.indexOf("Name")] || values[0] || "");
      product.SKU = headerMapping.sku !== undefined ? values[headerMapping.sku] : (values[headers.indexOf("SKU")] || "");
      product["Regular price"] = headerMapping.regular_price !== undefined ? values[headerMapping.regular_price] : (values[headers.indexOf("Regular price")] || "0");
      product["Sale price"] = headerMapping.sale_price !== undefined ? values[headerMapping.sale_price] : (values[headers.indexOf("Sale price")] || "");
      product.Stock = headerMapping.stock !== undefined ? values[headerMapping.stock] : (values[headers.indexOf("Stock")] || "0");
      product["In stock?"] = headerMapping.in_stock !== undefined ? values[headerMapping.in_stock] : (values[headers.indexOf("In stock?")] || "1");
      product.Categories = headerMapping.categories !== undefined ? values[headerMapping.categories] : (values[headers.indexOf("Categories")] || "");
      product.Images = headerMapping.images !== undefined ? values[headerMapping.images] : (values[headers.indexOf("Images")] || "");
      product["Short description"] = headerMapping.short_description !== undefined ? values[headerMapping.short_description] : (values[headers.indexOf("Short description")] || "");
      product.Description = headerMapping.description !== undefined ? values[headerMapping.description] : (values[headers.indexOf("Description")] || "");
      product.Type = headerMapping.type !== undefined ? values[headerMapping.type] : (values[headers.indexOf("Type")] || "simple");
      
      // Skip empty products
      if (product.Name && product.Name.length > 0) {
        products.push(product);
      }
    }
    
    return products;
  };

  const handleImport = async () => {
    if (!file) {
      alert("الرجاء اختيار ملف CSV");
      return;
    }

    setImporting(true);
    setProgress(0);
    setErrors([]);

    try {
      // قراءة الملف مع encoding صحيح للعربي
      const arrayBuffer = await file.arrayBuffer();
      let text;
      
      const encodings = ['utf-8', 'windows-1256', 'iso-8859-6', 'cp1256'];
      
      for (const encoding of encodings) {
        try {
          text = new TextDecoder(encoding).decode(arrayBuffer);
          console.log(`🔍 Import - Trying encoding: ${encoding}`);
          // Check if it has replacement characters
          if (!text.includes('�')) {
            console.log(`✅ Import - Success with encoding: ${encoding}`);
            break;
          }
        } catch (e) {
          console.log(`❌ Import - Failed encoding: ${encoding}`, e.message);
          continue;
        }
      }
      
      // Final fallback
      if (!text || text.includes('�')) {
        console.log("⚠️ Import - Using fallback text reading");
        text = await file.text();
      }
      
      const useManualMapping = Object.keys(manualMapping).length > 0;
      const products = parseCSV(text, useManualMapping);

      console.log("📦 Products to import:", products.length);

      let successCount = 0;
      let failCount = 0;
      const importErrors = [];

      // استيراد المنتجات واحد تلو الآخر
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          // تحضير بيانات المنتج
          const productData = {
            name: product.Name || `منتج ${i + 1}`,
            sku: product.SKU || "",
            regular_price: product["Regular price"] || "0",
            sale_price: product["Sale price"] || "",
            stock_quantity: parseInt(product.Stock) || 0,
            manage_stock: product["In stock?"] === "1",
            in_stock: product["In stock?"] === "1",
            categories: product.Categories ? product.Categories.split("|") : ["Uncategorized"],
            images: product.Images ? [{ src: product.Images }] : [],
            short_description: product["Short description"] || "",
            description: product.Description || "",
            type: product.Type || "simple",
          };

          // إرسال المنتج للـ API
          const res = await fetch("/api/products/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productData),
          });

          if (res.ok) {
            successCount++;
          } else {
            const error = await res.json();
            failCount++;
            importErrors.push({
              product: product.Name,
              error: error.message || "فشل الاستيراد",
            });
          }
        } catch (error) {
          failCount++;
          importErrors.push({
            product: product.Name,
            error: error.message,
          });
        }

        // تحديث الـ progress
        setProgress(Math.round(((i + 1) / products.length) * 100));
      }

      setResults({
        total: products.length,
        success: successCount,
        failed: failCount,
      });
      
      setErrors(importErrors);

    } catch (error) {
      console.error("خطأ في الاستيراد:", error);
      alert("حدث خطأ أثناء الاستيراد: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-2"
          >
            ← رجوع
          </button>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-4xl">📥</span>
            استيراد المنتجات من CSV
          </h1>
          <p className="text-gray-600 mt-2">
            قم برفع ملف CSV يحتوي على بيانات المنتجات للاستيراد التلقائي
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* 🆕 Info Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 mb-6 text-right">
            <h3 className="font-bold text-blue-900 text-lg mb-3 flex items-center gap-2 justify-end">
              <span>🎯 النظام يتعرف تلقائياً على أي تنسيق CSV</span>
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-medium">الأعمدة المدعومة (بأي اسم من هذه الاختيارات):</p>
              <ul className="mr-6 space-y-1">
                <li>• <strong>اسم المنتج:</strong> Name, Product Name, Title, اسم, اسم المنتج</li>
                <li>• <strong>السعر:</strong> Price, Regular Price, السعر</li>
                <li>• <strong>الكود:</strong> SKU, Code, Product Code, كود, رمز</li>
                <li>• <strong>الكمية:</strong> Stock, Quantity, Qty, كمية, مخزون</li>
                <li>• <strong>الفئة:</strong> Categories, Category, Cat, فئة, فئات</li>
                <li>• <strong>الصورة:</strong> Images, Image, Photo, صورة</li>
              </ul>
              <p className="text-xs text-blue-600 mt-3 bg-white rounded-lg p-2">
                💡 <strong>مزايا:</strong> لا تحتاج لتغيير أسماء الأعمدة - النظام يفهمها تلقائياً سواء بالعربي أو الإنجليزي!
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 transition-all">
            <div className="text-6xl mb-4">📄</div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={importing}
              />
              <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all inline-block font-bold">
                اختر ملف CSV
              </span>
            </label>
            {file && (
              <div className="mt-4 text-gray-700">
                <p className="font-medium">📎 الملف المحدد:</p>
                <p className="text-blue-600">{file.name}</p>
                
                {/* 🆕 Manual Mapping Button */}
                {csvHeaders.length > 0 && (
                  <button
                    onClick={() => setShowMappingModal(true)}
                    className="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
                  >
                    🎯 ربط الأعمدة يدوياً
                  </button>
                )}
              </div>
            )}
          </div>

          {file && !importing && !results && (
            <button
              onClick={handleImport}
              className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl hover:from-green-700 hover:to-emerald-700 font-bold text-lg transition-all shadow-lg"
            >
              🚀 بدء الاستيراد
            </button>
          )}
        </div>

        {/* Progress */}
        {importing && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="text-center mb-4">
              <div className="animate-spin text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">جاري الاستيراد...</h3>
              <p className="text-gray-600">الرجاء الانتظار حتى اكتمال العملية</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full transition-all duration-300 flex items-center justify-center text-white text-sm font-bold"
                style={{ width: `${progress}%` }}
              >
                {progress}%
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">اكتمل الاستيراد!</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{results.total}</div>
                <div className="text-sm text-blue-600 mt-1">إجمالي</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{results.success}</div>
                <div className="text-sm text-green-600 mt-1">نجح</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{results.failed}</div>
                <div className="text-sm text-red-600 mt-1">فشل</div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="mb-6">
                <h4 className="font-bold text-red-600 mb-3">⚠️ الأخطاء ({errors.length}):</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {errors.map((error, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="font-medium text-red-800">{error.product}</p>
                      <p className="text-sm text-red-600">{error.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/products")}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-bold transition-all"
            >
              📦 عرض المنتجات
            </button>
          </div>
        )}

        {/* 🆕 Manual Mapping Modal */}
        {showMappingModal && csvHeaders.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <h2 className="text-2xl font-bold text-right">🎯 ربط الأعمدة يدوياً</h2>
                <p className="text-indigo-100 text-sm mt-2 text-right">
                  اختر من القائمة المنسدلة أي عمود في ملفك يمثل كل حقل
                </p>
                <p className="text-yellow-200 text-xs mt-1 text-right">
                  🔍 Debug: Found {csvHeaders.length} headers - Type: {Array.isArray(csvHeaders) ? 'Array' : typeof csvHeaders}
                </p>
              </div>
              
              <div className="p-6">
                {/* Preview */}
                {previewData.length > 0 && (
                  <div className="mb-6 bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-700 mb-3 text-right">👀 معاينة البيانات:</h3>
                    <div className="overflow-x-auto" dir="rtl">
                      <table className="w-full text-sm border-collapse" style={{ direction: 'rtl', unicodeBidi: 'embed' }}>
                        <thead>
                          <tr className="bg-gray-200">
                            {csvHeaders.map((header, idx) => (
                              <th key={idx} className="border border-gray-300 px-2 py-1 text-right font-semibold">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, rowIdx) => (
                            <tr key={rowIdx} className="bg-white hover:bg-gray-50">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="border border-gray-300 px-2 py-1 text-right text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {cell && cell.length > 50 ? cell.substring(0, 50) + '...' : (cell || '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      📌 عرض أول 3 منتجات فقط للمعاينة
                    </p>
                  </div>
                )}

                {/* Mapping Fields */}
                <div className="space-y-4">
                  {[
                    { key: 'name', label: '📝 اسم المنتج', required: true },
                    { key: 'sku', label: '🏷️ الكود (SKU)', required: false },
                    { key: 'regular_price', label: '💰 السعر الأساسي', required: true },
                    { key: 'sale_price', label: '🏷️ سعر التخفيض', required: false },
                    { key: 'stock', label: '📦 الكمية المتاحة', required: false },
                    { key: 'categories', label: '📁 الفئة', required: false },
                    { key: 'images', label: '🖼️ الصور', required: false },
                    { key: 'description', label: '📄 الوصف', required: false },
                  ].map(field => (
                    <div key={field.key} className="flex items-center gap-4">
                      <label className="w-48 text-right font-medium text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500 mr-1">*</span>}
                      </label>
                      <select
                        value={manualMapping[field.key] || ''}
                        onChange={(e) => setManualMapping({ ...manualMapping, [field.key]: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-right focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- اختر العمود --</option>
                        {csvHeaders.map((header, idx) => (
                          <option key={idx} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowMappingModal(false);
                      setManualMapping({});
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-bold"
                  >
                    ❌ إلغاء
                  </button>
                  <button
                    onClick={() => {
                      if (!manualMapping.name || !manualMapping.regular_price) {
                        alert("الرجاء تحديد على الأقل: اسم المنتج والسعر");
                        return;
                      }
                      setShowMappingModal(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 font-bold"
                  >
                    ✅ تأكيد الربط
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
