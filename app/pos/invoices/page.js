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
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all'); // all, cash, wallet, instapay, vera, other
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all'); // all, paid_full, paid_partial, returned
  const [filterDate, setFilterDate] = useState('all'); // all, today, yesterday, last7days, last30days
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
    // 🔥 نرتب الفواتير من الأحدث للأقدم الأول
    const sortedInvoices = allInvoices.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    // 🔥 دلوقتي نعرض آخر فاتورة (الأحدث)
    console.log('📊 Latest invoice soldBy:', sortedInvoices[0]?.soldBy);
    console.log('🔧 Latest invoice services:', sortedInvoices[0]?.services);
    console.log('📦 Latest invoice:', sortedInvoices[0]);
    setInvoices(sortedInvoices);
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
        
        // حساب الرسوم الإضافية
        const extraFeeType = invoice.summary?.extraFeeType === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت';
        const extraFeeValue = invoice.summary?.extraFeeValue || invoice.summary?.extraFee || 0;
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

  // 🆕 حذف منتج من الفاتورة
  const deleteProductFromInvoice = async (invoice, itemId) => {
    try {
      // تصفية المنتجات (حذف المنتج المطلوب)
      const updatedItems = invoice.items.filter(item => item.id !== itemId);
      
      // إعادة حساب المجاميع
      const productsSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const servicesTotal = invoice.services?.reduce((sum, service) => sum + service.amount, 0) || 0;
      const subtotal = productsSubtotal + servicesTotal;
      
      // حساب الخصم
      let discountAmount = 0;
      if (invoice.summary?.discount?.type === 'percentage') {
        discountAmount = (subtotal * invoice.summary.discount.value) / 100;
      } else if (invoice.summary?.discount?.type === 'fixed') {
        discountAmount = invoice.summary.discount.value;
      }
      
      // حساب الرسوم الإضافية
      let extraFeeAmount = 0;
      if (invoice.summary?.extraFeeType === 'percentage' && invoice.summary?.extraFeeValue) {
        extraFeeAmount = (subtotal * invoice.summary.extraFeeValue) / 100;
      } else {
        extraFeeAmount = invoice.summary?.extraFee || 0;
      }
      
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const total = subtotal - discountAmount + extraFeeAmount + deliveryFee;
      
      // حساب الأرباح
      const productsProfit = updatedItems.reduce((sum, item) => {
        const purchasePrice = item.purchase_price || 0;
        const profit = (item.price - purchasePrice) * item.quantity;
        return sum + profit;
      }, 0);
      
      const discountOnProducts = invoice.summary?.discount?.amount > 0 
        ? (productsSubtotal > 0 ? (discountAmount * productsSubtotal) / subtotal : 0)
        : 0;
      
      const finalProductsProfit = productsProfit - discountOnProducts;
      const totalProfit = finalProductsProfit + servicesTotal + extraFeeAmount;
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          productsSubtotal,
          servicesTotal,
          subtotal,
          discount: invoice.summary?.discount ? {
            ...invoice.summary.discount,
            amount: discountAmount
          } : null,
          total,
          productsProfit,
          discountOnProducts,
          finalProductsProfit,
          totalProfit
        }
      };
      
      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      setToast({ message: '✅ تم حذف المنتج من الفاتورة', type: 'success' });
    } catch (error) {
      setToast({ message: 'فشل حذف المنتج', type: 'error' });
    }
  };

  // 🆕 حذف خدمة من الفاتورة
  const deleteServiceFromInvoice = async (invoice, serviceIndex) => {
    try {
      // تصفية الخدمات (حذف الخدمة المطلوبة)
      const updatedServices = invoice.services.filter((_, idx) => idx !== serviceIndex);
      
      // إعادة حساب المجاميع
      const productsSubtotal = invoice.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
      const servicesTotal = updatedServices.reduce((sum, service) => sum + service.amount, 0);
      const subtotal = productsSubtotal + servicesTotal;
      
      // حساب الخصم
      let discountAmount = 0;
      if (invoice.summary?.discount?.type === 'percentage') {
        discountAmount = (subtotal * invoice.summary.discount.value) / 100;
      } else if (invoice.summary?.discount?.type === 'fixed') {
        discountAmount = invoice.summary.discount.value;
      }
      
      // حساب الرسوم الإضافية
      let extraFeeAmount = 0;
      if (invoice.summary?.extraFeeType === 'percentage' && invoice.summary?.extraFeeValue) {
        extraFeeAmount = (subtotal * invoice.summary.extraFeeValue) / 100;
      } else {
        extraFeeAmount = invoice.summary?.extraFee || 0;
      }
      
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const total = subtotal - discountAmount + extraFeeAmount + deliveryFee;
      
      // حساب الأرباح
      const productsProfit = invoice.items?.reduce((sum, item) => {
        const purchasePrice = item.purchase_price || 0;
        const profit = (item.price - purchasePrice) * item.quantity;
        return sum + profit;
      }, 0) || 0;
      
      const discountOnProducts = invoice.summary?.discount?.amount > 0 
        ? (productsSubtotal > 0 ? (discountAmount * productsSubtotal) / subtotal : 0)
        : 0;
      
      const finalProductsProfit = productsProfit - discountOnProducts;
      const totalProfit = finalProductsProfit + servicesTotal + extraFeeAmount;
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoice,
        services: updatedServices,
        summary: {
          ...invoice.summary,
          productsSubtotal,
          servicesTotal,
          subtotal,
          discount: invoice.summary?.discount ? {
            ...invoice.summary.discount,
            amount: discountAmount
          } : null,
          total,
          productsProfit,
          discountOnProducts,
          finalProductsProfit,
          totalProfit
        }
      };
      
      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      setToast({ message: '✅ تم حذف الخدمة من الفاتورة', type: 'success' });
    } catch (error) {
      setToast({ message: 'فشل حذف الخدمة', type: 'error' });
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    // Status filter
    if (filterStatus === 'synced' && !invoice.synced) return false;
    if (filterStatus === 'pending' && invoice.synced) return false;
    
    // Payment method filter
    if (filterPaymentMethod !== 'all') {
      // 🆕 فلتر "من الستور" يعتمد على source: 'order'
      if (filterPaymentMethod === 'online') {
        if (invoice.source !== 'order') return false;
      } else {
        const invoicePaymentMethod = (invoice.paymentMethod || 'other').toLowerCase();
        if (invoicePaymentMethod !== filterPaymentMethod) return false;
      }
    }
    
    // 🆕 Payment Status filter (حالة الدفع)
    if (filterPaymentStatus !== 'all') {
      const invoicePaymentStatus = invoice.paymentStatus || 'paid_full';
      if (invoicePaymentStatus !== filterPaymentStatus) return false;
    }
    
    // 🆕 Date filter (فلتر التاريخ)
    if (filterDate !== 'all') {
      const invoiceDate = new Date(invoice.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (filterDate === 'today') {
        const invDate = new Date(invoiceDate);
        invDate.setHours(0, 0, 0, 0);
        if (invDate.getTime() !== today.getTime()) return false;
      } else if (filterDate === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const invDate = new Date(invoiceDate);
        invDate.setHours(0, 0, 0, 0);
        if (invDate.getTime() !== yesterday.getTime()) return false;
      } else if (filterDate === 'last7days') {
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        if (invoiceDate < last7Days) return false;
      } else if (filterDate === 'last30days') {
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        if (invoiceDate < last30Days) return false;
      }
    }
    
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
    // 🆕 Payment Status Stats
    paidFull: invoices.filter(i => (i.paymentStatus || 'paid_full') === 'paid_full').length,
    paidPartial: invoices.filter(i => (i.paymentStatus || 'paid_full') === 'paid_partial').length,
    returned: invoices.filter(i => (i.paymentStatus || 'paid_full') === 'returned').length,
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
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 بحث برقم الفاتورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          {/* <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-700">حالة المزامنة:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'all'
                    ? '!bg-blue-600 !text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                الكل ({stats.total})
              </button>
              <button
                onClick={() => setFilterStatus('synced')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'synced'
                    ? '!bg-green-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                مزامنة ({stats.synced})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? '!bg-yellow-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                انتظار ({stats.pending})
              </button>
            </div>
          </div> */}

          {/* 🆕 Date Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-700">📅 التاريخ:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterDate('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDate === 'all'
                    ? '!bg-blue-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilterDate('today')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDate === 'today'
                    ? '!bg-blue-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                📆 اليوم
              </button>
              <button
                onClick={() => setFilterDate('yesterday')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDate === 'yesterday'
                    ? '!bg-blue-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                🗓️ أمس
              </button>
              <button
                onClick={() => setFilterDate('last7days')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDate === 'last7days'
                    ? '!bg-blue-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                📊 آخر 7 أيام
              </button>
              <button
                onClick={() => setFilterDate('last30days')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterDate === 'last30days'
                    ? '!bg-blue-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                📈 آخر 30 يوم
              </button>
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-700">💳 طريقة الدفع:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterPaymentMethod('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'all'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilterPaymentMethod('cash')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'cash'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                💵 كاش
              </button>
              <button
                onClick={() => setFilterPaymentMethod('wallet')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'wallet'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                💳 محفظة
              </button>
              <button
                onClick={() => setFilterPaymentMethod('instapay')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'instapay'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                📱 انستا باي
              </button>
              <button
                onClick={() => setFilterPaymentMethod('vera')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'vera'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                💳 مكنة فيزا
              </button>
              <button
                onClick={() => setFilterPaymentMethod('online')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'online'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                🌐 من الستور
              </button>
              <button
                onClick={() => setFilterPaymentMethod('other')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentMethod === 'other'
                    ? '!bg-purple-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                ➕ أخرى
              </button>
            </div>
          </div>

          {/* 🆕 Payment Status Filter (حالة الدفع) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-700">💰 حالة الدفع:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterPaymentStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentStatus === 'all'
                    ? '!bg-emerald-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilterPaymentStatus('paid_full')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentStatus === 'paid_full'
                    ? '!bg-emerald-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                ✅ مدفوعة كاملة
              </button>
              <button
                onClick={() => setFilterPaymentStatus('paid_partial')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentStatus === 'paid_partial'
                    ? '!bg-emerald-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                ⚠️ مدفوع جزئي
              </button>
              <button
                onClick={() => setFilterPaymentStatus('returned')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterPaymentStatus === 'returned'
                    ? '!bg-emerald-600 !text-white'
                    : '!bg-gray-100 !text-gray-700 hover:!bg-gray-200'
                }`}
              >
                🔙 مرتجع
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-gray-200">
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
                className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-200 hover:border-blue-300"
              >
                {/* Header Bar with Gradient */}
                <div className={`h-1 ${
                  invoice.source === 'order' ? 'bg-gradient-to-r from-cyan-400 to-blue-500' :
                  invoice.synced ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                  'bg-gradient-to-r from-yellow-400 to-orange-500'
                }`}></div>

                <div className="p-4">
                  {/* Invoice Header - Redesigned */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                    <div className="flex-1">
                      {/* Title Row */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          #{invoice.id.split('-').pop()}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {(!invoice.items || invoice.items.length === 0) ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500 text-white">
                              🛠️ خدمات
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              invoice.synced 
                                ? 'bg-green-500 text-white'
                                : 'bg-yellow-400 text-yellow-900'
                            }`}>
                              {invoice.synced ? '✓' : '⏳'}
                            </span>
                          )}
                          {invoice.source === 'order' && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                              🌐 ستور
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Meta Info */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">{new Date(invoice.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                          invoice.source === 'order' ? 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 border border-cyan-200' :
                          invoice.paymentMethod === 'cash' ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' :
                          invoice.paymentMethod === 'wallet' ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-200' :
                          invoice.paymentMethod === 'instapay' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200' :
                          invoice.paymentMethod === 'vera' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200' :
                          'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}>
                          {invoice.source === 'order' ? '🌐 من الستور' :
                           invoice.paymentMethod === 'cash' ? '💵 كاش' :
                           invoice.paymentMethod === 'wallet' ? '👛 محفظة' :
                           invoice.paymentMethod === 'instapay' ? '📱 انستا باي' :
                           invoice.paymentMethod === 'vera' ? '💳 مكنة فيزا' : '💳 أخرى'}
                        </span>
                        
                        {invoice.orderId && (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            📦 #{invoice.orderId}
                          </span>
                        )}

                        {/* 🆕 عرض اسم الكاشير */}
                        {invoice.soldBy?.employeeName && (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 border border-indigo-200">
                            👤 {invoice.soldBy.employeeName}
                          </span>
                        )}
                        
                        {/* 🆕 Payment Status - Editable Dropdown */}
                        <select
                          value={invoice.paymentStatus || 'paid_full'}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value;
                            try {
                              await invoiceStorage.updateInvoicePaymentStatus(invoice.id, newStatus);
                              await loadInvoices();
                              setToast({ message: 'تم تحديث حالة الدفع', type: 'success' });
                            } catch (error) {
                              setToast({ message: 'فشل تحديث حالة الدفع', type: 'error' });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all ${
                            (invoice.paymentStatus || 'paid_full') === 'paid_full' ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200 hover:border-emerald-400' :
                            (invoice.paymentStatus || 'paid_full') === 'paid_partial' ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200 hover:border-orange-400' :
                            (invoice.paymentStatus || 'paid_full') === 'returned' ? 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 hover:border-red-400' :
                            'bg-gray-50 text-gray-700 border border-gray-200'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="paid_full">✅ مدفوعة كاملة</option>
                          <option value="paid_partial">⚠️ مدفوع جزئي</option>
                          <option value="returned">🔙 مرتجع</option>
                        </select>
                      </div>
                    </div>

                    {/* 🆕 Invoice Notes Section */}
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">📝</span>
                        <label className="text-xs font-bold text-gray-700">ملاحظات على الفاتورة</label>
                      </div>
                      <textarea
                        value={invoice.notes || ''}
                        onChange={async (e) => {
                          e.stopPropagation();
                          const newNotes = e.target.value;
                          try {
                            await invoiceStorage.updateInvoiceNotes(invoice.id, newNotes);
                            await loadInvoices();
                          } catch (error) {
                            setToast({ message: 'فشل حفظ الملاحظات', type: 'error' });
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="اكتب ملاحظات على الفاتورة..."
                        rows={2}
                        className="w-full px-2 py-2 bg-white border border-gray-300 rounded-lg text-xs
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                    
                    {/* Total Amount - Prominent */}
                    <div className="text-left bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-2.5 rounded-lg border border-blue-200">
                      <div className="text-xs font-semibold text-blue-600">الإجمالي</div>
                      <div className="text-2xl font-black text-blue-700">
                        {formatPrice(invoice.summary?.total)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {invoice.items?.length || 0} منتج{invoice.services?.length > 0 && ` • ${invoice.services.length} خدمة`}
                      </div>
                    </div>
                  </div>

                  {/* Invoice Details - Improved Grid */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 mb-3 border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                      {invoice.summary?.productsSubtotal > 0 && (
                        <div className="flex justify-between items-center bg-white rounded-md px-2 py-1.5">
                          <span className="text-gray-600 font-medium">منتجات</span>
                          <span className="font-bold text-gray-900">{formatPrice(invoice.summary.productsSubtotal)}</span>
                        </div>
                      )}

                      {invoice.summary?.servicesTotal > 0 && (
                        <div className="flex justify-between items-center bg-purple-50 rounded-md px-2 py-1.5 border border-purple-200">
                          <span className="text-purple-700 font-medium">خدمات</span>
                          <span className="font-bold text-purple-800">{formatPrice(invoice.summary.servicesTotal)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-white rounded-md px-2 py-1.5">
                        <span className="text-gray-600 font-medium">مجموع</span>
                        <span className="font-bold text-gray-900">{formatPrice(invoice.summary?.subtotal)}</span>
                      </div>
                      
                      {invoice.summary?.discount?.amount > 0 && (
                        <div className="flex justify-between items-center bg-red-50 rounded-md px-2 py-1.5 border border-red-200">
                          <span className="text-red-700 font-medium">
                            خصم {invoice.summary.discount.type === 'percentage' ? `${invoice.summary.discount.value}%` : ''}
                          </span>
                          <span className="font-bold text-red-700">- {formatPrice(invoice.summary.discount.amount)}</span>
                        </div>
                      )}
                      
                      {invoice.summary?.extraFee > 0 && (
                        <div className="flex justify-between items-center bg-blue-50 rounded-md px-2 py-1.5 border border-blue-200">
                          <span className="text-blue-700 font-medium">
                            رسوم {invoice.summary.extraFeeType === 'percentage' ? `${invoice.summary.extraFeeValue}%` : ''}
                          </span>
                          <span className="font-bold text-blue-700">+ {formatPrice(invoice.summary.extraFee)}</span>
                        </div>
                      )}

                      {/* Delivery/Shipping Fee */}
                      {invoice.summary?.deliveryFee > 0 && (
                        <div className="flex justify-between items-center bg-cyan-50 rounded-md px-2 py-1.5 border border-cyan-200">
                          <span className="text-cyan-700 font-medium">🚚 شحن</span>
                          <span className="font-bold text-cyan-800">+ {formatPrice(invoice.summary.deliveryFee)}</span>
                        </div>
                      )}

                      {/* Profit breakdown - Enhanced */}
                      {(invoice.summary?.totalProfit > 0 || invoice.summary?.productsProfit > 0) && (
                        <>
                          <div className="col-span-full h-px bg-gradient-to-r from-transparent via-green-300 to-transparent my-1"></div>
                          
                          {invoice.summary?.productsProfit > 0 && (
                            <div className="flex justify-between items-center bg-green-50 rounded-md px-2 py-1.5 border border-green-200">
                              <span className="text-green-700 font-medium">💰 ربح</span>
                              <span className="font-bold text-green-800">+ {formatPrice(invoice.summary.productsProfit)}</span>
                            </div>
                          )}

                          {invoice.summary?.discountOnProducts > 0 && (
                            <div className="flex justify-between items-center bg-orange-50 rounded-md px-2 py-1.5 border border-orange-200">
                              <span className="text-orange-700 font-medium">➖ خصم</span>
                              <span className="font-bold text-orange-800">- {formatPrice(invoice.summary.discountOnProducts)}</span>
                            </div>
                          )}

                          {invoice.summary?.finalProductsProfit !== undefined && invoice.summary?.finalProductsProfit !== invoice.summary?.productsProfit && (
                            <div className="flex justify-between items-center bg-green-100 rounded-md px-2 py-1.5 border border-green-300">
                              <span className="text-green-800 font-medium">📦 صافي</span>
                              <span className="font-bold text-green-900">{formatPrice(invoice.summary.finalProductsProfit)}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center bg-gradient-to-r from-green-500 to-emerald-600 rounded-md px-2 py-1.5">
                            <span className="font-bold text-white text-xs">✅ إجمالي الربح</span>
                            <span className="font-black text-white">{formatPrice(invoice.summary.totalProfit)}</span>
                          </div>
                        </>
                      )}

                      {/* Warning for items without purchase price - Enhanced */}
                      {(invoice.itemsWithoutProfit?.length > 0 || invoice.summary?.itemsWithoutPurchasePrice > 0) && (
                        <div className="col-span-full bg-yellow-50 border border-yellow-300 rounded-lg p-2 flex items-start gap-2">
                          <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-yellow-900">⚠️ تحذير: أرباح غير دقيقة</p>
                            <p className="text-xs text-yellow-800">
                              {invoice.itemsWithoutProfit?.length || invoice.summary?.itemsWithoutPurchasePrice || 0} من {invoice.items?.length || invoice.summary?.totalItemsCount || 0} منتج ليس له سعر شراء
                            </p>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Delivery Details - if available */}
                  {invoice.delivery && (
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 border border-cyan-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-cyan-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-bold text-cyan-900">🚚 توصيل</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white rounded-md p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <span>👤</span>
                            <span className="font-semibold text-gray-700">العميل</span>
                          </div>
                          <p className="text-gray-900 font-medium">{invoice.delivery.customer?.name || 'غير محدد'}</p>
                          {invoice.delivery.customer?.phone && (
                            <p className="text-gray-600 mt-1">📱 {invoice.delivery.customer.phone}</p>
                          )}
                        </div>
                        {invoice.delivery.customer?.address && (
                          <div className="bg-white rounded-md p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <span>📍</span>
                              <span className="font-semibold text-gray-700">العنوان</span>
                            </div>
                            <p className="text-gray-900">
                              {invoice.delivery.customer.address.city && `${invoice.delivery.customer.address.city}, `}
                              {invoice.delivery.customer.address.district && `${invoice.delivery.customer.address.district}`}
                            </p>
                          </div>
                        )}
                      </div>
                      {invoice.delivery.notes && (
                        <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                          <p className="text-xs text-yellow-800">📝 {invoice.delivery.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Notes - if available */}
                  {invoice.orderNotes && (
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3 mb-3 border-2 border-purple-300">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">📝</span>
                        </div>
                        <h4 className="text-sm font-bold text-purple-900">ملاحظات على الطلب</h4>
                      </div>
                      <div className="bg-white rounded-md p-2 border border-purple-200">
                        <p className="text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">{invoice.orderNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* 🆕 Payment Status for Delivery Orders */}
                  {invoice.deliveryPayment && (
                    <div className={`rounded-lg p-3 mb-3 border-2 ${
                      invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery'
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                        : invoice.deliveryPayment.status === 'half_paid'
                        ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300'
                        : 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-300'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery'
                            ? 'bg-green-500'
                            : invoice.deliveryPayment.status === 'half_paid'
                            ? 'bg-yellow-500'
                            : 'bg-orange-500'
                        }`}>
                          <span className="text-sm">
                            {invoice.deliveryPayment.status === 'fully_paid' && '✅'}
                            {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && '💳'}
                            {invoice.deliveryPayment.status === 'half_paid' && '💰'}
                            {invoice.deliveryPayment.status === 'cash_on_delivery' && '💵'}
                          </span>
                        </div>
                        <h4 className={`text-sm font-bold ${
                          invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery'
                            ? 'text-green-900'
                            : invoice.deliveryPayment.status === 'half_paid'
                            ? 'text-yellow-900'
                            : 'text-orange-900'
                        }`}>
                          {invoice.deliveryPayment.status === 'cash_on_delivery' && 'دفع عند الاستلام'}
                          {invoice.deliveryPayment.status === 'half_paid' && 'نصف المبلغ مدفوع'}
                          {invoice.deliveryPayment.status === 'fully_paid' && 'مدفوع كاملاً'}
                          {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && 'مدفوع كاملاً (بدون توصيل)'}
                        </h4>
                      </div>
                      
                      {invoice.deliveryPayment.status === 'half_paid' && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white rounded-md p-2 border border-green-200">
                            <p className="font-semibold text-green-700 mb-1">✓ المبلغ المدفوع</p>
                            <p className="text-green-900 font-bold">{formatPrice(invoice.deliveryPayment.paidAmount)} ج.م</p>
                          </div>
                          <div className="bg-white rounded-md p-2 border border-red-200">
                            <p className="font-semibold text-red-700 mb-1">⏳ المتبقي</p>
                            <p className="text-red-900 font-bold">{formatPrice(invoice.deliveryPayment.remainingAmount)} ج.م</p>
                          </div>
                        </div>
                      )}

                      {invoice.deliveryPayment.status === 'half_paid' && invoice.deliveryPayment.note && (
                        <div className="mt-2 bg-white border border-yellow-200 rounded-md p-2">
                          <p className="text-xs text-gray-700">📝 {invoice.deliveryPayment.note}</p>
                        </div>
                      )}

                      {invoice.deliveryPayment.status === 'cash_on_delivery' && (
                        <div className="bg-white rounded-md p-2 text-xs border border-orange-200">
                          <p className="font-semibold text-orange-900 text-center">💰 المبلغ المطلوب: {formatPrice(invoice.summary.total)} ج.م</p>
                        </div>
                      )}

                      {(invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery') && (
                        <div className="bg-white rounded-md p-2 text-xs border border-green-200">
                          <p className="font-semibold text-green-900 text-center">✓ تم الدفع بالكامل - {formatPrice(invoice.summary.total)} ج.م</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Customer Info from Order - if available */}
                  {invoice.customerInfo && !invoice.delivery && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-3 mb-3 border border-indigo-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-sm">👤</span>
                        </div>
                        <h4 className="text-sm font-bold text-indigo-900">بيانات العميل</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {invoice.customerInfo.name && (
                          <div className="bg-white rounded-md p-2">
                            <p className="font-semibold text-gray-700 mb-1">الاسم</p>
                            <p className="text-gray-900">{invoice.customerInfo.name}</p>
                          </div>
                        )}
                        {invoice.customerInfo.phone && (
                          <div className="bg-white rounded-md p-2">
                            <p className="font-semibold text-gray-700 mb-1">الهاتف</p>
                            <p className="text-gray-900">{invoice.customerInfo.phone}</p>
                          </div>
                        )}
                        {/* {invoice.customerInfo.email && (
                          <div className="bg-white rounded-md p-2 col-span-2">
                            <p className="font-semibold text-gray-700 mb-1">البريد</p>
                            <p className="text-gray-900 text-xs">{invoice.customerInfo.email}</p>
                          </div>
                        )} */}
                      </div>
                    </div>
                  )}

                  {/* Products List - Redesigned */}
                  {invoice.items?.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                        <h4 className="text-xs font-bold text-gray-800">المنتجات ({invoice.items.length})</h4>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {invoice.items.map((item, idx) => (
                          <div key={item.id} className="group flex items-center justify-between text-xs bg-gradient-to-r from-gray-50 to-blue-50 hover:from-blue-50 hover:to-indigo-50 rounded-lg p-2 border border-gray-200 hover:border-blue-300 transition-all">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-md flex items-center justify-center text-xs font-bold">
                                {item.quantity}
                              </div>
                              <div className="flex-1">
                                <span className="font-semibold text-gray-900 block text-xs">{item.name}</span>
                                <span className="text-xs text-gray-600">{formatPrice(item.price)} × {item.quantity}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-700 text-xs">
                                {formatPrice(Number(item.price) * item.quantity)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`هل تريد حذف "${item.name}" من الفاتورة؟`)) {
                                    deleteProductFromInvoice(invoice, item.id);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center justify-center transition-all text-xs font-bold"
                                title="حذف المنتج"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services List - Redesigned */}
                  {invoice.services?.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-purple-600 rounded-full"></div>
                        <h4 className="text-xs font-bold text-gray-800">الخدمات ({invoice.services.length})</h4>
                      </div>
                      <div className="space-y-1.5">
                        {invoice.services.map((service, index) => (
                          <div key={index} className="group flex items-center justify-between text-xs bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2 border border-purple-200 hover:border-purple-400 transition-all">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">🔧</span>
                              <div className="flex-1">
                                <span className="font-semibold text-gray-900 block">{service.description}</span>
                                {service.employeeName && (
                                  <span className="text-[10px] text-purple-600 font-medium">👤 {service.employeeName}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-purple-700">
                                {formatPrice(service.amount)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`هل تريد حذف خدمة "${service.description}" من الفاتورة؟`)) {
                                    deleteServiceFromInvoice(invoice, index);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center justify-center transition-all text-xs font-bold"
                                title="حذف الخدمة"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions - Enhanced */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => printInvoice(invoice)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      طباعة
                    </button>
                    
                    {/* 🔥 إخفاء زر المزامنة للفواتير بدون منتجات أو المزامنة */}
                    {!invoice.synced && invoice.items?.length > 0 && (
                      <button
                        onClick={() => syncInvoice(invoice)}
                        disabled={syncingId === invoice.id}
                        className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md ${
                          syncingId === invoice.id
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white hover:shadow-lg'
                        }`}
                      >
                        <svg className={`w-4 h-4 ${syncingId === invoice.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {syncingId === invoice.id ? 'مزامنة...' : 'مزامنة'}
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