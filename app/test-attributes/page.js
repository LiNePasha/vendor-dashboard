'use client';

import { useState, useEffect } from 'react';

export default function TestAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setLogs([]);
    
    try {
      addLog('🔄 بدء اختبار API...', 'info');
      addLog('📡 URL: /api/products/attributes?include_terms=true', 'info');
      
      const response = await fetch('/api/products/attributes?include_terms=true');
      addLog(`📥 Status: ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');
      
      const data = await response.json();
      addLog(`📦 Response: ${JSON.stringify(data, null, 2)}`, 'info');
      
      if (data.success && data.attributes) {
        setAttributes(data.attributes);
        addLog(`✅ تم تحميل ${data.attributes.length} سمة بنجاح`, 'success');
        
        data.attributes.forEach((attr, index) => {
          addLog(`  ${index + 1}. ${attr.name} (${attr.terms?.length || 0} terms)`, 'info');
        });
      } else {
        addLog('⚠️ لم يتم العثور على سمات', 'warning');
        setError('لم يتم العثور على سمات في الـ response');
      }
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testAPI();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">🧪 اختبار Attributes API</h1>
          
          <button
            onClick={testAPI}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? '⏳ جاري الاختبار...' : '🔄 إعادة الاختبار'}
          </button>
        </div>

        {/* Logs */}
        <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-6 text-white font-mono text-sm">
          <h2 className="text-lg font-bold mb-4 text-green-400">📜 Logs</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-400">لا توجد logs بعد...</p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-bold mb-2">❌ خطأ</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">📊 النتائج</h2>
          
          {attributes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-3">📦</p>
              <p>لم يتم تحميل سمات بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 font-semibold mb-4">
                ✅ تم تحميل {attributes.length} سمة
              </p>
              
              {attributes.map((attr) => (
                <div
                  key={attr.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{attr.name}</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      ID: {attr.id}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Slug:</span>
                      <span className="ml-2 font-mono text-gray-700">{attr.slug}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 font-mono text-gray-700">{attr.type}</span>
                    </div>
                  </div>
                  
                  {attr.terms && attr.terms.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">
                        Terms ({attr.terms.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {attr.terms.map((term) => (
                          <span
                            key={term.id}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {term.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
