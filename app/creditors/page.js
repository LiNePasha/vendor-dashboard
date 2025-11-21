'use client';

import { useState, useEffect } from 'react';
import { creditorsStorage } from '../lib/warehouse-storage';
import Link from 'next/link';

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState([]);
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
      // Sort by balance (most debt first)
      data.sort((a, b) => b.balance - a.balance);
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

  const totalDebt = creditors.reduce((sum, c) => sum + Math.max(c.balance, 0), 0);
  const activeCreditors = creditors.filter(c => (c.balance || 0) > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-green-900">📊 الدائنين</h1>
          <p className="text-green-700 text-sm mt-1">الناس اللي مديونين ليك بفلوس</p>
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-md">
          <div className="text-sm text-blue-600 font-medium">إجمالي الدائنين</div>
          <div className="text-4xl font-bold text-blue-900 mt-1">{creditors.length}</div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-green-200 shadow-md">
          <div className="text-sm text-green-600 font-medium">دائنين نشطين</div>
          <div className="text-4xl font-bold text-green-900 mt-1">{activeCreditors.length}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-xl shadow-lg">
          <div className="text-sm text-white font-medium opacity-90">إجمالي الفلوس المستحقة ليك</div>
          <div className="text-4xl font-bold text-white mt-2">{totalDebt.toFixed(2)} ج.م</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 البحث بالاسم..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      ) : creditors.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-16 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">مفيش دائنين</h3>
          <p className="text-gray-700 mb-6">ابدأ بإضافة الناس اللي ليك فلوس عندهم</p>
          <button
            onClick={openAddModal}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 shadow-md"
          >
            ➕ إضافة دائن جديد
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {creditors.map((creditor, index) => {
            const debt = Math.max(creditor.balance, 0);
            const percentage = totalDebt > 0 ? (debt / totalDebt) * 100 : 0;
            
            return (
              <div key={creditor.id} className="bg-white border-2 border-green-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="bg-green-100 text-green-700 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-900 mb-1">{creditor.name}</h3>
                      <div className="flex gap-4 text-sm text-gray-600">
                        {creditor.phone && (
                          <div className="flex items-center gap-1">
                            <span>📞</span>
                            <span dir="ltr">{creditor.phone}</span>
                          </div>
                        )}
                        {creditor.email && (
                          <div className="flex items-center gap-1">
                            <span>📧</span>
                            <span>{creditor.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <div className="text-sm text-green-600 font-semibold mb-1">مديون ليك</div>
                    <div className="text-3xl font-bold text-green-700">{debt.toFixed(2)} ج.م</div>
                    <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% من الإجمالي</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all" 
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-red-600 font-semibold mb-1">إجمالي الديون</div>
                    <div className="text-red-900 font-bold">{(creditor.totalDebts || 0).toFixed(2)} ج.م</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-green-600 font-semibold mb-1">إجمالي المدفوعات</div>
                    <div className="text-green-900 font-bold">{(creditor.totalPayments || 0).toFixed(2)} ج.م</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-orange-600 font-semibold mb-1">عدد المعاملات</div>
                    <div className="text-orange-900 font-bold">{(creditor.transactions || []).length}</div>
                  </div>
                </div>

                {/* Recent Transactions */}
                {creditor.transactions && creditor.transactions.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="text-xs font-semibold text-gray-600 mb-2">آخر المعاملات:</div>
                    <div className="space-y-2">
                      {creditor.transactions.slice(-3).reverse().map((txn) => (
                        <div key={txn.id} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span>{txn.type === 'debt' ? '📋' : '💵'}</span>
                            <span className="text-gray-700">{txn.description || (txn.type === 'debt' ? 'دين جديد' : 'دفعة')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${txn.type === 'debt' ? 'text-red-600' : 'text-green-600'}`}>
                              {txn.type === 'debt' ? '+' : '-'}{txn.amount.toFixed(2)} ج.م
                            </span>
                            <span className="text-gray-400">{new Date(txn.date).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => openTransactionModal(creditor)}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <span>💰</span>
                    <span>معاملة جديدة</span>
                  </button>
                  <button
                    onClick={() => openEditModal(creditor)}
                    className="px-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(creditor.id)}
                    className="px-6 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
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
                  placeholder="مثال: عميل دائم"
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

      {/* Modal - معاملة جديدة */}
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-green-600 font-semibold mb-1">الرصيد الحالي:</div>
                <div className="text-3xl font-bold text-green-700">
                  {Math.max(selectedCreditor.balance, 0).toFixed(2)} ج.م
                </div>
                <div className="text-xs text-green-600 mt-1">مديون ليك</div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  نوع المعاملة *
                </label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                >
                  <option value="debt">📋 دين جديد (زيادة المبلغ)</option>
                  <option value="payment">💵 دفعة (تقليل المبلغ)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">
                  المبلغ * (ج.م)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
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
                  placeholder="مثال: فاتورة رقم 123"
                />
              </div>

              {transactionForm.amount && parseFloat(transactionForm.amount) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-blue-900 mb-1">الرصيد المتوقع:</div>
                  <div className="text-lg font-bold text-blue-700">
                    {transactionForm.type === 'debt' 
                      ? (selectedCreditor.balance + parseFloat(transactionForm.amount)).toFixed(2)
                      : (selectedCreditor.balance - parseFloat(transactionForm.amount)).toFixed(2)
                    } ج.م
                  </div>
                </div>
              )}

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
