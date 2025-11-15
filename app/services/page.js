"use client";

import { useState, useEffect } from "react";
import localforage from "localforage";
import { Toast } from "@/components/Toast";

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [newService, setNewService] = useState({ name: "", price: "" });

  // Load services from LocalForage
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const saved = await localforage.getItem("savedServices");
      if (saved && Array.isArray(saved)) {
        setServices(saved);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      setToast({ message: "فشل تحميل الخدمات", type: "error" });
    }
  };

  const saveServices = async (updatedServices) => {
    try {
      await localforage.setItem("savedServices", updatedServices);
      setServices(updatedServices);
      return true;
    } catch (error) {
      console.error("Error saving services:", error);
      setToast({ message: "فشل حفظ الخدمات", type: "error" });
      return false;
    }
  };

  const handleAddService = async () => {
    if (!newService.name.trim()) {
      setToast({ message: "يرجى إدخال اسم الخدمة", type: "error" });
      return;
    }
    if (!newService.price || newService.price <= 0) {
      setToast({ message: "يرجى إدخال سعر صحيح", type: "error" });
      return;
    }

    const service = {
      id: Date.now().toString(),
      name: newService.name.trim(),
      price: parseFloat(newService.price),
      createdAt: new Date().toISOString(),
    };

    const updated = [...services, service];
    const success = await saveServices(updated);
    
    if (success) {
      setNewService({ name: "", price: "" });
      setToast({ message: "تم إضافة الخدمة بنجاح", type: "success" });
    }
  };

  const handleUpdateService = async (id, field, value) => {
    const updated = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    setServices(updated);
  };

  const handleSaveEdit = async (id) => {
    const service = services.find((s) => s.id === id);
    if (!service.name.trim()) {
      setToast({ message: "يرجى إدخال اسم الخدمة", type: "error" });
      return;
    }
    if (!service.price || service.price <= 0) {
      setToast({ message: "يرجى إدخال سعر صحيح", type: "error" });
      return;
    }

    const success = await saveServices(services);
    if (success) {
      setEditingId(null);
      setToast({ message: "تم تحديث الخدمة بنجاح", type: "success" });
    }
  };

  const handleDeleteService = async (id) => {
    if (confirm("هل أنت متأكد من حذف هذه الخدمة؟")) {
      const updated = services.filter((s) => s.id !== id);
      const success = await saveServices(updated);
      if (success) {
        setToast({ message: "تم حذف الخدمة بنجاح", type: "success" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 max-w-5xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">إدارة الخدمات</h1>
        <p className="text-gray-600 dark:text-gray-300">
          أضف وحفظ الخدمات التي تقدمها لاستخدامها بسرعة في نقاط البيع
        </p>
      </div>

      {/* Add New Service */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">➕</span>
          <span>إضافة خدمة جديدة</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              اسم الخدمة
            </label>
            <input
              type="text"
              value={newService.name}
              onChange={(e) =>
                setNewService({ ...newService, name: e.target.value })
              }
              placeholder="مثال: تركيب، صيانة، توصيل..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              onKeyDown={(e) => e.key === "Enter" && handleAddService()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              السعر (ج.م)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newService.price}
              onChange={(e) =>
                setNewService({ ...newService, price: e.target.value })
              }
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              onKeyDown={(e) => e.key === "Enter" && handleAddService()}
            />
          </div>
        </div>

        <button
          onClick={handleAddService}
          className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-medium"
        >
          إضافة الخدمة
        </button>
      </div>

      {/* Services List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <span>الخدمات المحفوظة ({services.length})</span>
          </h2>
        </div>

        {services.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">لا توجد خدمات محفوظة</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              ابدأ بإضافة خدمة جديدة من الأعلى
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {services.map((service) => (
              <div
                key={service.id}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {editingId === service.id ? (
                  // Edit Mode
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) =>
                          handleUpdateService(service.id, "name", e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="اسم الخدمة"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={service.price}
                        onChange={(e) =>
                          handleUpdateService(
                            service.id,
                            "price",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="السعر"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(service.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          title="حفظ"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                          title="إلغاء"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {service.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        تم الإنشاء: {new Date(service.createdAt).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {service.price.toFixed(2)} ج.م
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(service.id)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                          <span>✏️</span>
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                        >
                          <span>🗑️</span>
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">نصيحة</h4>
            <p className="text-blue-800 text-sm">
              الخدمات المحفوظة هنا ستظهر تلقائيًا في صفحة نقاط البيع (POS) لسهولة الاختيار السريع.
              يمكنك إضافة خدمات مثل: التركيب، الصيانة، التوصيل، الضمان، وغيرها.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
