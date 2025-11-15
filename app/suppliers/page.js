'use client';

import { useState, useEffect } from 'react';
import { suppliersStorage } from '../lib/warehouse-storage';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await suppliersStorage.getAllSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      notes: supplier.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      alert('⚠️ اسم المورد مطلوب');
      return;
    }

    try {
      if (editingSupplier) {
        await suppliersStorage.updateSupplier(editingSupplier.id, form);
        alert('✅ تم التحديث بنجاح');
      } else {
        await suppliersStorage.addSupplier(form);
        alert('✅ تم الإضافة بنجاح');
      }
      
      setShowModal(false);
      await loadSuppliers();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const handleDelete = async (supplierId) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    
    try {
      await suppliersStorage.deleteSupplier(supplierId);
      alert('✅ تم الحذف');
      await loadSuppliers();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏢 الموردين</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">إدارة قائمة الموردين</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-md flex items-center gap-2"
        >
          <span className="text-xl">➕</span>
          <span>إضافة مورد</span>
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-blue-200 dark:border-blue-700 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">إجمالي الموردين</div>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-300 mt-1">{suppliers.length}</div>
          </div>
          <div className="text-5xl opacity-20">🏢</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 البحث بالاسم أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-16 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">لا يوجد موردين</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">ابدأ بإضافة موردين لتسجيل بيانات المنتجات</p>
          <button
            onClick={openAddModal}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 shadow-md"
          >
            ➕ إضافة مورد جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{supplier.name}</h3>
                  {supplier.phone && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      <span>📞</span>
                      <span dir="ltr">{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span>📧</span>
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {supplier.notes && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-4">
                  <span className="font-semibold">📝 ملاحظات:</span>
                  <p className="mt-1">{supplier.notes}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500 mb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                تاريخ الإضافة: {new Date(supplier.createdAt).toLocaleDateString('ar-EG')}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(supplier)}
                  className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ✏️ تعديل
                </button>
                <button
                  onClick={() => handleDelete(supplier.id)}
                  className="px-4 bg-red-600 text-white text-sm py-2.5 rounded-lg hover:bg-red-700 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="border-b border-gray-200 dark:border-gray-700 p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSupplier ? '✏️ تعديل مورد' : '➕ إضافة مورد جديد'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  اسم المورد *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="مثال: شركة قطع الغيار الأصلية"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="01012345678"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="supplier@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows="3"
                  placeholder="مثال: مورد موثوق - جودة عالية"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button 
                  type="submit" 
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold shadow-md transition-colors"
                >
                  ✅ حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors text-gray-900 dark:text-white"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
