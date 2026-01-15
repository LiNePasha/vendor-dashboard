"use client";

import { useState } from "react";

export default function WCFMTestPage() {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState('all');

  const runTest = async (testType) => {
    setLoading(true);
    setTestResults(null);
    
    try {
      const res = await fetch(`/api/test-wcfm?test=${testType}`, {
        credentials: 'include',
        cache: 'no-store'
      });
      
      const data = await res.json();
      setTestResults(data);
    } catch (error) {
      setTestResults({
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testTypes = [
    { value: 'all', label: 'All Tests', emoji: '🧪' },
    { value: 'orders', label: 'Orders API', emoji: '📦' },
    { value: 'notifications', label: 'Notifications API', emoji: '🔔' },
    { value: 'settings', label: 'Vendor Settings', emoji: '⚙️' },
    { value: 'capabilities', label: 'Capabilities', emoji: '🔒' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 WCFM REST API Testing
          </h1>
          <p className="text-gray-600">
            اختبار جميع الـ endpoints المتاحة في WCFM REST API
          </p>
        </div>

        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            اختر نوع الاختبار
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {testTypes.map((test) => (
              <button
                key={test.value}
                onClick={() => setSelectedTest(test.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTest === test.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="text-3xl mb-2">{test.emoji}</div>
                <div className="text-sm font-medium">{test.label}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => runTest(selectedTest)}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                جاري الاختبار...
              </span>
            ) : (
              `🚀 تشغيل الاختبار: ${testTypes.find(t => t.value === selectedTest)?.label}`
            )}
          </button>
        </div>

        {/* Results */}
        {testResults && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📊 نتائج الاختبار
            </h2>
            
            {testResults.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-bold">❌ خطأ:</p>
                <p className="text-red-600 mt-2">{testResults.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Timestamp */}
                <div className="text-sm text-gray-500">
                  🕐 {new Date(testResults.timestamp).toLocaleString('ar-EG')}
                </div>

                {/* Test Results */}
                {Object.entries(testResults.tests || {}).map(([testName, result]) => (
                  <div
                    key={testName}
                    className={`border-2 rounded-lg p-4 ${
                      result.success
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-lg">
                        {result.success ? '✅' : '❌'} {testName}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        result.success
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {result.status}
                      </span>
                    </div>

                    {result.endpoint && (
                      <div className="mb-2">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {result.endpoint}
                        </span>
                      </div>
                    )}

                    {result.count !== undefined && (
                      <div className="mb-2">
                        <span className="font-bold">عدد النتائج:</span> {result.count}
                      </div>
                    )}

                    {result.responseStructure && result.responseStructure.length > 0 && (
                      <div className="mb-2">
                        <span className="font-bold">هيكل البيانات:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.responseStructure.map(field => (
                            <span key={field} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full JSON Response */}
                    <details className="mt-3">
                      <summary className="cursor-pointer font-bold text-sm text-blue-600 hover:text-blue-800">
                        📋 عرض البيانات الكاملة
                      </summary>
                      <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs max-h-96">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-3">📝 ملاحظات:</h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>• الاختبار يستخدم الـ token من الـ cookies تلقائياً</li>
            <li>• لازم تكون عامل login قبل ما تستخدم الصفحة دي</li>
            <li>• النتائج بتوضح structure البيانات المتاحة من كل API</li>
            <li>• استخدم النتائج دي عشان تطوّر features جديدة للتجار</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
