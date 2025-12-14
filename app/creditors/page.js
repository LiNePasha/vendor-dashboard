'use client';

import { useState, useEffect } from 'react';
import { creditorsStorage } from '../lib/warehouse-storage';

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingCreditor, setEditingCreditor] = useState(null);
  const [selectedCreditor, setSelectedCreditor] = useState(null);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [transactionForm, setTransactionForm] = useState({
    type: 'debt',
    amount: '',
    description: ''
  });

  useEffect(() => {
    loadCreditors();
  }, []);

  const loadCreditors = async () => {
    setLoading(true);
    try {
      const data = await creditorsStorage.getAllCreditors();
      setCreditors(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCreditor(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (creditor) => {
    setEditingCreditor(creditor);
    setForm({
      name: creditor.name,
      phone: creditor.phone || '',
      email: creditor.email || '',
      notes: creditor.notes || ''
    });
    setShowModal(true);
  };

  const openTransactionModal = (creditor) => {
    setSelectedCreditor(creditor);
    setTransactionForm({ type: 'debt', amount: '', description: '' });
    setShowTransactionModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      alert('⚠️ الاسم مطلوب');
      return;
    }

    try {
      if (editingCreditor) {
        await creditorsStorage.updateCreditor(editingCreditor.id, form);
        alert('✅ تم التحديث بنجاح');
      } else {
        await creditorsStorage.addCreditor(form);
        alert('✅ تم الإضافة بنجاح');
      }
      
      setShowModal(false);
      await loadCreditors();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    
    if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
      alert('⚠️ المبلغ مطلوب ويجب أن يكون أكبر من صفر');
      return;
    }

    try {
      await creditorsStorage.addTransaction(selectedCreditor.id, transactionForm);
      alert('✅ تم إضافة المعاملة بنجاح');
      setShowTransactionModal(false);
      await loadCreditors();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const handleDelete = async (creditorId) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    
    try {
      await creditorsStorage.deleteCreditor(creditorId);
      alert('✅ تم الحذف');
      await loadCreditors();
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ');
    }
  };

  const filteredCreditors = creditors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // حساب الإحصائيات
  const stats = {
    total: creditors.length,
    creditorsWithDebt: creditors.filter(c => (c.balance || 0) > 0).length, // دائنين ليهم فلوس عندك
    totalOwed: creditors.reduce((sum, c) => sum + Math.max(c.balance || 0, 0), 0), // إجمالي الفلوس اللي ليهم عندك
    totalDebts: creditors.reduce((sum, c) => sum + (c.totalDebts || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 الدائنين</h1>
          <p className="text-gray-600 text-sm mt-1">إدارة قائمة الدائنين والمعاملات المالية</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openAddModal}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 shadow-md flex items-center gap-2"
          >
            <span className="text-xl">➕</span>
            <span>إضافة دائن</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
          <div className="text-sm text-blue-600 font-medium">إجمالي الدائنين</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-green-200 shadow-sm">
          <div className="text-sm text-green-600 font-medium">دائنين ليهم فلوس</div>
          <div className="text-3xl font-bold text-green-900 mt-1">{stats.creditorsWithDebt}</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm">
          <div className="text-sm text-orange-600 font-medium">إجمالي المستحق ليهم</div>
          <div className="text-2xl font-bold text-orange-900 mt-1">{stats.totalOwed.toFixed(2)} ج.م</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
          <div className="text-sm text-red-600 font-medium">إجمالي الديون</div>
          <div className="text-2xl font-bold text-red-900 mt-1">{stats.totalDebts.toFixed(2)} ج.م</div>
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
      ) : filteredCreditors.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-16 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">لا يوجد دائنين</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">ابدأ بإضافة دائنين لتسجيل المعاملات المالية</p>
          <button
            onClick={openAddModal}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 shadow-md"
          >
            ➕ إضافة دائن جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreditors.map((creditor) => {
            const balance = creditor.balance || 0;
            const owesYouMoney = balance > 0; // مديون ليك
            const youOweThem = balance < 0; // انت مديون ليهم
            
            return (
              <div key={creditor.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{creditor.name}</h3>
                    {creditor.phone && (
                      <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                        <span>📞</span>
                        <span dir="ltr">{creditor.phone}</span>
                      </div>
                    )}
                    {creditor.email && (
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>📧</span>
                        <span className="truncate">{creditor.email}</span>
                      </div>
                    )}
                  </div>
                  
                  {owesYouMoney && (
                    <div className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                      مديون ليك
                    </div>
                  )}
                  {youOweThem && (
                    <div className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                      ليه فلوس
                    </div>
                  )}
                </div>

                {/* الرصيد */}
                <div className={`p-4 rounded-lg mb-4 ${
                  balance > 0 ? 'bg-green-50 border border-green-200' :
                  balance < 0 ? 'bg-red-50 border border-red-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="text-xs font-semibold mb-1 text-gray-600">الرصيد الحالي</div>
                  <div className={`text-2xl font-bold ${
                    balance > 0 ? 'text-green-700' :
                    balance < 0 ? 'text-red-700' :
                    'text-gray-700'
                  }`}>
                    {balance > 0 ? `+${balance.toFixed(2)} ج.م` : balance < 0 ? `-${Math.abs(balance).toFixed(2)} ج.م` : '0 ج.م'}
                  </div>
                  {balance > 0 && (
                    <div className="text-xs text-green-600 mt-1">مديون ليك {balance.toFixed(2)} ج.م</div>
                  )}
                  {balance < 0 && (
                    <div className="text-xs text-red-600 mt-1">ليه عندك {Math.abs(balance).toFixed(2)} ج.م</div>
                  )}
                </div>

                {/* الإحصائيات */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-red-600 font-semibold">الديون</div>
                    <div className="text-red-900 font-bold">{(creditor.totalDebts || 0).toFixed(2)} ج.م</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-green-600 font-semibold">المدفوعات</div>
                    <div className="text-green-900 font-bold">{(creditor.totalPayments || 0).toFixed(2)} ج.م</div>
                  </div>
                </div>

                {creditor.notes && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4">
                    <span className="font-semibold">📝 ملاحظات:</span>
                    <p className="mt-1">{creditor.notes}</p>
                  </div>
                )}

                {/* Recent Transactions with Date and Time */}
                {creditor.transactions && creditor.transactions.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <div className="text-xs font-semibold text-gray-600 mb-2">آخر المعاملات:</div>
                    <div className="space-y-2">
                      {creditor.transactions.slice(-3).reverse().map((txn) => (
                        <div key={txn.id} className="text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <span>{txn.type === 'debt' ? '📋' : '💵'}</span>
                              <span className="text-gray-700">{txn.description || (txn.type === 'debt' ? 'دين جديد' : 'دفعة')}</span>
                            </div>
                            <span className={`font-bold ${txn.type === 'debt' ? 'text-red-600' : 'text-green-600'}`}>
                              {txn.type === 'debt' ? '+' : '-'}{parseFloat(txn.amount).toFixed(2)} ج.م
                            </span>
                          </div>
                          <div className="text-gray-400 text-xs flex items-center gap-2 mr-6">
                            <span>📅</span>
                            <span>{new Date(txn.date).toLocaleDateString('ar-EG')}</span>
                            <span>🕐</span>
                            <span>{new Date(txn.date).toLocaleTimeString('ar-EG')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 mb-4 border-t border-gray-200 pt-3">
                  تاريخ الإضافة: {new Date(creditor.createdAt).toLocaleDateString('ar-EG')}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openTransactionModal(creditor)}
                    className="flex-1 bg-purple-600 text-white text-sm py-2.5 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    💰 معاملة
                  </button>
                  <button
                    onClick={() => openEditModal(creditor)}
                    className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(creditor.id)}
                    className="px-4 bg-red-600 text-white text-sm py-2.5 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal - إضافة/تعديل دائن */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="border-b border-gray-200 p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCreditor ? '✏️ تعديل دائن' : '➕ إضافة دائن جديد'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  الاسم *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                  placeholder="مثال: أحمد محمد"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                  placeholder="01012345678"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                  rows="3"
                  placeholder="مثال: عميل دائم - جودة عالية"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button 
                  type="submit" 
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold shadow-md transition-colors"
                >
                  ✅ حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors text-gray-900"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - إضافة معاملة */}
      {showTransactionModal && selectedCreditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="border-b border-gray-200 p-5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                💰 معاملة جديدة - {selectedCreditor.name}
              </h2>
              <button 
                onClick={() => setShowTransactionModal(false)} 
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTransactionSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  نوع المعاملة *
                </label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                >
                  <option value="debt">📋 دين جديد (زيادة الرصيد)</option>
                  <option value="payment">💵 دفعة (تقليل الرصيد)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  المبلغ * (ج.م)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={transactionForm.amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setTransactionForm({ ...transactionForm, amount: val });
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  الوصف (اختياري)
                </label>
                <textarea
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                  rows="2"
                  placeholder="مثال: دفعة مقدمة لشحنة جديدة"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="font-semibold text-blue-900 mb-1">الرصيد الحالي:</div>
                <div className={`text-lg font-bold ${
                  (selectedCreditor.balance || 0) > 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {(selectedCreditor.balance || 0) > 0 
                    ? `مديون ليك ${(selectedCreditor.balance).toFixed(2)} ج.م`
                    : `${(selectedCreditor.balance || 0).toFixed(2)} ج.م`
                  }
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button 
                  type="submit" 
                  className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold shadow-md transition-colors"
                >
                  ✅ إضافة المعاملة
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors text-gray-900"
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
