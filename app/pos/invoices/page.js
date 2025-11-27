'use client';

import { useState, useEffect } from 'react';
import { invoiceStorage } from '@/app/lib/localforage';
import { Toast } from '@/components/Toast';
import InvoiceModal from '@/app/pos/InvoiceModal';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // all, synced, pending
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  // Helper function to format numbers nicely (removes decimals, adds thousands separator)
  const formatPrice = (price) => {
    const num = Number(price);
    if (isNaN(num)) return '0';
    // تقريب لأقرب رقم صحيح وإضافة فواصل الآلاف
    return Math.round(num).toLocaleString('en-US');
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const allInvoices = await invoiceStorage.getAllInvoices();
    setInvoices(allInvoices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
    setLoading(false);
  };

  const syncInvoice = async (invoice) => {
    setSyncingId(invoice.id);
    try {
      const updates = invoice.items.map(item => ({
        productId: item.id,
        newQuantity: item.stock_quantity - item.quantity
      }));

      const res = await fetch('/api/pos/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      });

      let data = null;
      try { data = await res.json(); } catch(e) { data = null; }

      if (res.ok && data) {
        await invoiceStorage.markInvoiceAsSynced(invoice.id);
        setToast({ message: `تم تحديث المخزون (${data.updated || invoice.items.length} منتجات)`, type: 'success' });
        loadInvoices();
        return;
      }

      if (res.status === 207 && data && Array.isArray(data.details)) {
        const details = data.details;
        const successCount = details.filter(d => d.status === 'updated' || d.status === 'verified').length;
        const failedCount = details.filter(d => d.status === 'failed').length;
        if (failedCount === 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
          setToast({ message: `تم تحديث المخزون (${successCount} منتجات)`, type: 'success' });
          loadInvoices();
          return;
        }
        if (successCount > 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
          setToast({ message: `تم تحديث ${successCount} منتجات، وفشل ${failedCount} منتجات. سيتم إعادة المحاولة لاحقاً.`, type: 'warning' });
          loadInvoices();
          return;
        }
      }

      // If we reach here, try verification endpoint to confirm whether stocks were actually updated to avoid duplicate deductions
      try {
        const verifyPayload = { updates: updates.map(u => ({ productId: u.productId, expectedQuantity: u.newQuantity })) };
        const verifyRes = await fetch('/api/pos/verify-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyPayload),
          credentials: 'include'
        });
        const verifyData = await verifyRes.json();
        const results = verifyData?.results || [];
        const matches = results.filter(r => r.matches).length;
        const nonMatches = results.filter(r => !r.matches).length;

        if (matches > 0 && nonMatches === 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
          setToast({ message: `تم التحقق من المخزون وتم تحديث ${matches} منتجات (تم تأكيد التحديث عبر الاستعلام)`, type: 'success' });
          loadInvoices();
          return;
        }

        if (matches > 0) {
          await invoiceStorage.markInvoiceAsSynced(invoice.id);
          setToast({ message: `تم التحقق: ${matches} منتجات محدثة، و ${nonMatches} غير مؤكدة. سيتم إعادة المحاولة لاحقاً.`, type: 'warning' });
          loadInvoices();
          return;
        }
      } catch (verifyErr) {
        // Silently handle verification error
      }

      throw new Error('Failed to sync stock');
    } catch (error) {
      setToast({ message: 'فشل تحديث المخزون', type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Create detailed CSV with all invoice information
      let csv = '';
      
      // Header row - كل التفاصيل
      csv += 'رقم الفاتورة,التاريخ,الحالة,المصدر,رقم الطلب,طريقة الدفع,';
      csv += 'مجموع المنتجات,مجموع الخدمات,المجموع الفرعي,نوع الخصم,قيمة الخصم,مبلغ الخصم,الرسوم الإضافية,الإجمالي النهائي,';
      csv += 'ربح المنتجات,خصم على الأرباح,صافي ربح المنتجات,صافي الربح الكلي,';
      csv += 'عدد المنتجات,عدد الخدمات,تفاصيل المنتجات,تفاصيل الخدمات,اسم الموظف,رقم الموظف\n';
      
      filteredInvoices.forEach(invoice => {
        const date = new Date(invoice.date).toLocaleString('ar-EG');
        const status = invoice.synced ? 'تمت المزامنة' : 'في انتظار المزامنة';
        const source = invoice.source === 'order' ? 'أونلاين من الستور' : 'POS محلي';
        const orderId = invoice.orderId || '-';
        
        const paymentMethod = invoice.paymentMethod === 'cash' ? 'كاش' :
                             invoice.paymentMethod === 'wallet' ? 'محفظة' :
                             invoice.paymentMethod === 'instapay' ? 'انستا باي' : 'أخرى';
        
        // Financial details
        const productsSubtotal = invoice.summary?.productsSubtotal || 0;
        const servicesTotal = invoice.summary?.servicesTotal || 0;
        const subtotal = invoice.summary?.subtotal || 0;
        const discountType = invoice.summary?.discount?.type === 'percentage' ? 'نسبة مئوية' : 
                            invoice.summary?.discount?.type === 'fixed' ? 'مبلغ ثابت' : '-';
        const discountValue = invoice.summary?.discount?.value || 0;
        const discountAmount = invoice.summary?.discount?.amount || 0;
        const extraFee = invoice.summary?.extraFee || 0;
        const total = invoice.summary?.total || 0;
        
        // Profit details
        const productsProfit = invoice.summary?.productsProfit || 0;
        const discountOnProducts = invoice.summary?.discountOnProducts || 0;
        const finalProductsProfit = invoice.summary?.finalProductsProfit || productsProfit;
        const totalProfit = invoice.summary?.totalProfit || (finalProductsProfit + servicesTotal + extraFee);
        
        // Counts
        const itemsCount = invoice.items?.length || 0;
        const servicesCount = invoice.services?.length || 0;
        
        // Product details (formatted as: "الاسم × الكمية × السعر = الإجمالي | ...")
        const productDetails = invoice.items?.map(item => 
          `${item.name} × ${item.quantity} × ${formatPrice(item.price)} ج.م = ${formatPrice(Number(item.price) * item.quantity)} ج.م`
        ).join(' | ') || '-';
        
        // Service details (formatted as: "الوصف = المبلغ | ...")
        const serviceDetails = invoice.services?.map(service => 
          `${service.description} = ${formatPrice(service.amount)} ج.م`
        ).join(' | ') || '-';
        
        // Employee info
        const employeeName = invoice.employeeName || '-';
        const employeeId = invoice.employeeId || '-';
        
        // Build CSV row
        csv += `${invoice.id},"${date}",${status},${source},${orderId},${paymentMethod},`;
        csv += `${productsSubtotal},${servicesTotal},${subtotal},${discountType},${discountValue},${discountAmount},${extraFee},${total},`;
        csv += `${productsProfit},${discountOnProducts},${finalProductsProfit},${totalProfit},`;
        csv += `${itemsCount},${servicesCount},"${productDetails}","${serviceDetails}",${employeeName},${employeeId}\n`;
      });

      // Create and download file
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `invoices_detailed_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setToast({ message: `تم تصدير ${filteredInvoices.length} فاتورة بكل التفاصيل بنجاح`, type: 'success' });
    } catch (error) {
      setToast({ message: 'فشل تصدير الفواتير', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const deleteAllInvoices = async () => {
    try {
      await invoiceStorage.clearAll();
      setInvoices([]);
      setShowDeleteConfirm(false);
      setToast({ message: 'تم حذف جميع الفواتير', type: 'success' });
    } catch (error) {
      setToast({ message: `فشل حذف الفواتير: ${error.message}`, type: 'error' });
    }
  };

  const printInvoice = (invoice) => {
    const url = `/pos/invoices/print?id=${encodeURIComponent(invoice.id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    // Status filter
    if (filterStatus === 'synced' && !invoice.synced) return false;
    if (filterStatus === 'pending' && invoice.synced) return false;
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesId = invoice.id.toString().includes(searchLower);
      const matchesDate = new Date(invoice.date).toLocaleString('ar-EG').includes(searchTerm);
      const matchesItems = invoice.items.some(item => 
        item.name.toLowerCase().includes(searchLower)
      );
      return matchesId || matchesDate || matchesItems;
    }
    
    return true;
  });

  // Calculate stats
  const stats = {
    total: invoices.length,
    synced: invoices.filter(i => i.synced).length,
    pending: invoices.filter(i => !i.synced).length,
    totalRevenue: invoices.reduce((sum, inv) => sum + (inv.summary?.total || 0), 0),
    // Calculate profit: use new totalProfit if available, otherwise calculate from old data
    totalProfit: invoices.reduce((sum, inv) => {
      // New invoices have totalProfit
      if (inv.summary?.totalProfit !== undefined && inv.summary?.totalProfit !== null) {
        return sum + inv.summary.totalProfit;
      }
      // Old invoices: calculate manually
      // (old productsProfit if exists) + services + extraFee - discount
      const oldProfit = (inv.summary?.productsProfit || 0);
      const services = (inv.summary?.servicesTotal || 0);
      const extraFee = (inv.summary?.extraFee || 0);
      return sum + oldProfit + services + extraFee;
    }, 0),
    profitInvoicesCount: invoices.filter(i => {
      const profit = i.summary?.totalProfit !== undefined ? i.summary.totalProfit : 
                     ((i.summary?.productsProfit || 0) + (i.summary?.servicesTotal || 0) + (i.summary?.extraFee || 0));
      return profit > 0;
    }).length,
    totalServices: invoices.reduce((sum, inv) => sum + (inv.summary?.servicesTotal || 0), 0),
    servicesInvoicesCount: invoices.filter(i => i.services?.length > 0).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:hidden">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 print:hidden">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 الفواتير</h1>
          <p className="text-gray-600">إدارة ومتابعة جميع الفواتير</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">إجمالي الفواتير</p>
                <p className="text-3xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">تمت المزامنة</p>
                <p className="text-3xl font-bold mt-1">{stats.synced}</p>
              </div>
              <div className="bg-green-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">في الانتظار</p>
                <p className="text-3xl font-bold mt-1">{stats.pending}</p>
              </div>
              <div className="bg-yellow-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">إجمالي المبيعات</p>
                <p className="text-2xl font-bold mt-1">{formatPrice(stats.totalRevenue)} ج.م</p>
              </div>
              <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="text-pink-100 text-sm font-medium mb-1">💰 صافي الأرباح</p>
                <p className="text-3xl font-bold">{formatPrice(stats.totalProfit)} ج.م</p>
              </div>
              <div className="bg-pink-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="space-y-1.5 pt-3 border-t border-pink-400 border-opacity-30 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-pink-100">📦 أرباح المنتجات (بعد الخصم)</span>
                <span className="font-bold">{formatPrice(invoices.reduce((sum, inv) => sum + (inv.summary?.finalProductsProfit || inv.summary?.productsProfit || 0), 0))} ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pink-100">🔧 إيرادات الخدمات</span>
                <span className="font-bold">{formatPrice(stats.totalServices)} ج.م</span>
              </div>
              {/* <div className="flex items-center justify-between">
                <span className="text-pink-100">➕ رسوم إضافية</span>
                <span className="font-bold">{formatPrice(invoices.reduce((sum, inv) => sum + (inv.summary?.extraFee || 0), 0))} ج.م</span>
              </div> */}
              <div className="flex items-center justify-between pt-1 border-t border-pink-400 border-opacity-20">
                <span className="text-pink-100">من {stats.profitInvoicesCount} فاتورة</span>
              </div>
            </div>
          </div>

          {/* <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">🔧 إجمالي الخدمات</p>
                <p className="text-2xl font-bold mt-1">{stats.totalServices.toFixed(2)} ج.م</p>
                <p className="text-xs text-indigo-100 mt-1">من {stats.servicesInvoicesCount} فاتورة</p>
              </div>
              <div className="bg-indigo-400 bg-opacity-30 rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div> */}
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 بحث في الفواتير..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                الكل ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatus('synced')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'synced'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                مزامنة ({stats.synced})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                انتظار ({stats.pending})
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                disabled={exporting || invoices.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={invoices.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف الكل
              </button>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-gray-600 mb-2">لا توجد فواتير</p>
              <p className="text-gray-500">ابدأ البيع لإنشاء فواتير جديدة</p>
            </div>
          ) : (
            filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  {/* Invoice Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          فاتورة #{invoice.id}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          invoice.synced 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.synced ? '✓ تمت المزامنة' : '⏳ في الانتظار'}
                        </span>
                        {invoice.source === 'order' && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm">
                            🌐 أونلاين من الستور
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(invoice.date).toLocaleString('ar-EG')}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                          invoice.paymentMethod === 'wallet' ? 'bg-purple-100 text-purple-700' :
                          invoice.paymentMethod === 'instapay' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {invoice.paymentMethod === 'cash' ? '💵 كاش' :
                           invoice.paymentMethod === 'wallet' ? '👛 محفظة' :
                           invoice.paymentMethod === 'instapay' ? '📱 انستا باي' : '💳 أخرى'}
                        </span>
                        {invoice.orderId && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            📦 طلب #{invoice.orderId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatPrice(invoice.summary?.total)} ج.م
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ({invoice.items?.length || 0} منتج
                        {invoice.services?.length > 0 && ` + ${invoice.services.length} خدمة`})
                      </div>
                    </div>
                  </div>

                  {/* Invoice Details */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                      {invoice.summary?.productsSubtotal > 0 && (
                        <div className="flex justify-between border-2 p-1">
                          <span className="text-gray-600">مجموع المنتجات:</span>
                          <span className="font-medium">{formatPrice(invoice.summary.productsSubtotal)} ج.م</span>
                        </div>
                      )}

                      {invoice.summary?.servicesTotal > 0 && (
                        <div className="flex justify-between text-purple-600 border-2 p-1">
                          <span>مجموع الخدمات:</span>
                          <span className="font-medium">{formatPrice(invoice.summary.servicesTotal)} ج.م</span>
                        </div>
                      )}

                      <div className="flex justify-between border-2 p-1">
                        <span className="text-gray-600">المجموع الفرعي:</span>
                        <span className="font-medium">{formatPrice(invoice.summary?.subtotal)} ج.م</span>
                      </div>
                      
                      {invoice.summary?.discount?.amount > 0 && (
                        <div className="flex justify-between text-red-600 border-2 p-1">
                          <span>الخصم ({invoice.summary.discount.type === 'percentage' 
                            ? `${invoice.summary.discount.value}%` 
                            : `${invoice.summary.discount.value} ج.م`}):</span>
                          <span className="font-medium">- {formatPrice(invoice.summary.discount.amount)} ج.م</span>
                        </div>
                      )}
                      
                      {invoice.summary?.extraFee > 0 && (
                        <div className="flex justify-between text-blue-600 border-2 p-1">
                          <span>رسوم إضافية:</span>
                          <span className="font-medium">+ {formatPrice(invoice.summary.extraFee)} ج.م</span>
                        </div>
                      )}

                      {/* Profit breakdown if available */}
                      {(invoice.summary?.totalProfit > 0 || invoice.summary?.productsProfit > 0) && (
                        <>
                          <div className="col-span-4 border-t-2 border-green-300 my-1"></div>
                          
                          {invoice.summary?.productsProfit > 0 && (
                            <div className="flex justify-between text-green-600 border-2 p-1 bg-green-50">
                              <span>💰 ربح المنتجات (قبل الخصم):</span>
                              <span className="font-bold">+ {formatPrice(invoice.summary.productsProfit)} ج.م</span>
                            </div>
                          )}

                          {invoice.summary?.discountOnProducts > 0 && (
                            <div className="flex justify-between text-orange-600 border-2 p-1 bg-orange-50">
                              <span>➖ خصم على الأرباح:</span>
                              <span className="font-bold">- {formatPrice(invoice.summary.discountOnProducts)} ج.م</span>
                            </div>
                          )}

                          {invoice.summary?.finalProductsProfit !== undefined && invoice.summary?.finalProductsProfit !== invoice.summary?.productsProfit && (
                            <div className="flex justify-between text-green-700 border-2 p-1 bg-green-100">
                              <span>📦 صافي ربح المنتجات:</span>
                              <span className="font-bold">{formatPrice(invoice.summary.finalProductsProfit)} ج.م</span>
                            </div>
                          )}

                          <div className="flex justify-between text-green-800 border-2 p-1 bg-green-100">
                            <span className="font-bold">✅ إجمالي الربح الصافي:</span>
                            <span className="font-bold text-lg">{formatPrice(invoice.summary.totalProfit)} ج.م</span>
                          </div>
                        </>
                      )}

                      {/* 🆕 تحذير لو فيه منتجات بدون سعر شراء - خارج شرط الربح */}
                      {(invoice.itemsWithoutProfit?.length > 0 || invoice.summary?.itemsWithoutPurchasePrice > 0) && (
                        <div className="col-span-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-yellow-800 mb-1">⚠️ تحذير: أرباح غير دقيقة</p>
                            <p className="text-xs text-yellow-700">
                              {invoice.itemsWithoutProfit?.length || invoice.summary?.itemsWithoutPurchasePrice || 0} من {invoice.items?.length || invoice.summary?.totalItemsCount || 0} منتج 
                              ليس له سعر شراء - الأرباح المعروضة أقل من الفعلية
                            </p>
                            {invoice.itemsWithoutProfit?.length > 0 && (
                              <p className="text-xs text-yellow-600 mt-1 font-medium">
                                المنتجات المتأثرة: {invoice.itemsWithoutProfit.map(i => `${i.name} (${i.quantity})`).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Products List */}
                  {invoice.items?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">المنتجات:</h4>
                      <div className="space-y-2">
                        {invoice.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                {item.quantity}
                              </span>
                              <span className="font-medium text-gray-900">{item.name}</span>
                              <span className="text-gray-500">× {formatPrice(item.price)} ج.م</span>
                            </div>
                            <span className="font-semibold text-gray-900">
                              {formatPrice(Number(item.price) * item.quantity)} ج.م
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services List */}
                  {invoice.services?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-purple-700 mb-2">رسوم خدمات:</h4>
                      <div className="space-y-2">
                        {invoice.services.map((service, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-purple-50 rounded-lg p-2 border border-purple-100">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-600">🔧</span>
                              <span className="font-medium text-gray-900">{service.description}</span>
                            </div>
                            <span className="font-semibold text-purple-600">
                              {formatPrice(service.amount)} ج.م
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => printInvoice(invoice)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      طباعة
                    </button>
                    
                    {!invoice.synced && (
                      <button
                        onClick={() => syncInvoice(invoice)}
                        disabled={syncingId === invoice.id}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                          syncingId === invoice.id
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {syncingId === invoice.id ? 'جاري المزامنة...' : 'مزامنة الآن'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد الحذف</h3>
              <p className="text-gray-600">
                هل أنت متأكد من حذف جميع الفواتير؟<br/>
                لا يمكن التراجع عن هذا الإجراء!
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={deleteAllInvoices}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                حذف الكل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print Modal (disabled; using dedicated print page instead) */}
      {false && selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          open={true}
          onClose={() => setSelectedInvoice(null)}
          onPrint={() => {
            window.print();
            setTimeout(() => setSelectedInvoice(null), 500);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}