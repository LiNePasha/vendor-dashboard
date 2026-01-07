"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import usePOSStore from "@/app/stores/pos-store";
import OrderDetailsModal from "@/components/OrderDetailsModal";
import { BostaAPI } from "@/app/lib/bosta-api";
import { getBostaSettings, validateInvoiceForBosta, formatBostaStatus, getBostaTrackingUrl } from "@/app/lib/bosta-helpers";
import localforage from 'localforage';

const STATUS_OPTIONS = [
  { value: "on-hold", label: "معلق", color: "bg-yellow-500" },
  { value: "processing", label: "قيد التجهيز", color: "bg-blue-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "cancelled", label: "ملغى", color: "bg-gray-500" },
  { value: "refunded", label: "تم الاسترجاع", color: "bg-purple-500" },
  { value: "failed", label: "فشل", color: "bg-red-500" },
];

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🔥 استخدام Global State
  const orders = usePOSStore((state) => state.orders);
  const ordersLoading = usePOSStore((state) => state.ordersLoading);
  const fetchOrders = usePOSStore((state) => state.fetchOrders);
  const updateOrderStatus = usePOSStore((state) => state.updateOrderStatus);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState(null);
  
  // 🆕 Tabs State - تقسيم الطلبات
  const [activeTab, setActiveTab] = useState('website'); // 'website' | 'system'
  const [posInvoices, setPosInvoices] = useState([]);
  
  // 🆕 Bosta State
  const [bostaEnabled, setBostaEnabled] = useState(false);
  const [sendingToBosta, setSendingToBosta] = useState(null); // ID of order being sent
  
  // 🆕 Tracking Modal State
  const [trackingModal, setTrackingModal] = useState(null); // { trackingNumber, data, loading }
  
  // 🆕 Editing State for POS Orders
  const [editingInvoice, setEditingInvoice] = useState(null); // { orderStatus, paymentStatus }
  
  // 🆕 View Mode State (Table or Grid) - Table is default
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'
  
  // 🆕 Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 🆕 قراءة search من URL أول مرة وجلب الطلب مباشرة
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
      // 🆕 جلب الطلبات مع search filter من الـ API مباشرة
      fetchOrders({ search: searchFromUrl, per_page: 50 });
    }
  }, [searchParams]);

  // 🆕 جلب طلبات الكاشير (POS Invoices)
  useEffect(() => {
    const loadPOSInvoices = async () => {
      try {
        const localforage = (await import('localforage')).default;
        localforage.config({ name: 'vendor-pos', storeName: 'invoices' });
        const invoices = await localforage.getItem('invoices') || [];
        // فلترة الطلبات - فقط التوصيل
        const deliveryInvoices = invoices.filter(inv => inv.orderType === 'delivery');
        setPosInvoices(deliveryInvoices);
      } catch (error) {
        console.error('Error loading POS invoices:', error);
      }
    };
    loadPOSInvoices();
    
    // تحديث كل 10 ثواني لو في تاب السيستم
    const interval = setInterval(() => {
      if (activeTab === 'system') {
        loadPOSInvoices();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [activeTab]);
  
  // 🔥 Auto-refresh orders كل 30 ثانية (بس لو الصفحة مفتوحة)
  // 🔥 Auto-refresh orders كل 30 ثانية (بس لو الصفحة مفتوحة)
  useEffect(() => {
    // جلب الطلبات أول مرة
    fetchOrders();
    
    // تحميل إعدادات Bosta
    loadBostaSettings();

    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(() => {
      // 🆕 تحقق لو الصفحة مفتوحة (visible) قبل ما نعمل fetch
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    }, 30000);

    // 🆕 لو المستخدم رجع للصفحة، حدث فوراً
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchOrders]);
  
  // 🆕 تحميل إعدادات Bosta
  const loadBostaSettings = async () => {
    const settings = await getBostaSettings();
    setBostaEnabled(settings.enabled && settings.apiKey);
  };
  
  // 🆕 إرسال طلب لبوسطة
  const sendToBosta = async (order) => {
    if (order.bosta?.sent) {
      setToast({ message: 'تم إرسال هذا الطلب لبوسطة مسبقاً', type: 'info' });
      return;
    }

    setSendingToBosta(order.id);
    
    try {
      // 1. التحقق من صحة البيانات
      const validation = validateInvoiceForBosta(order);
      if (!validation.valid) {
        setToast({ 
          message: 'خطأ في بيانات الطلب:\n' + validation.errors.join('\n'), 
          type: 'error' 
        });
        return;
      }

      // 2. تحميل الإعدادات
      const settings = await getBostaSettings();
      if (!settings.enabled || !settings.apiKey) {
        setToast({ message: 'يجب تفعيل Bosta من صفحة الإعدادات', type: 'error' });
        return;
      }

      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);

      // 3. إرسال الطلب
      const result = await bostaAPI.createDelivery(order);
      
      if (result.error) {
        setToast({ message: 'فشل الإرسال: ' + result.error, type: 'error' });
        return;
      }

      // 4. تحديث الفاتورة
      order.bosta = {
        sent: true,
        trackingNumber: result.data?.trackingNumber || result.trackingNumber,
        orderId: result.data?._id || result._id,
        status: result.data?.state?.value || result.state?.value || 'created',
        statusCode: result.data?.state?.code || result.state?.code || 10,
        sentAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // 5. حفظ الفاتورة المحدثة في LocalForage
      const allInvoices = await localforage.getItem('invoices') || [];
      const index = allInvoices.findIndex(inv => inv.id === order.id);
      if (index !== -1) {
        allInvoices[index] = order;
        await localforage.setItem('invoices', allInvoices);
      }

      // 6. تحديث العرض
      setPosInvoices(prev => 
        prev.map(o => o.id === order.id ? order : o)
      );

      setToast({ 
        message: '✅ تم إرسال الطلب لبوسطة بنجاح!\nرقم التتبع: ' + order.bosta.trackingNumber, 
        type: 'success' 
      });

    } catch (error) {
      console.error('Bosta Send Error:', error);
      setToast({ message: 'حدث خطأ: ' + error.message, type: 'error' });
    } finally {
      setSendingToBosta(null);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 🆕 فتح مودال التتبع
  const openTrackingModal = async (trackingNumber) => {
    setTrackingModal({ trackingNumber, data: null, loading: true });
    
    try {
      const settings = await getBostaSettings();
      if (!settings.enabled || !settings.apiKey) {
        setToast({ message: 'يجب تفعيل Bosta من صفحة الإعدادات', type: 'error' });
        setTrackingModal(null);
        return;
      }

      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);
      const result = await bostaAPI.getTrackingDetails(trackingNumber);
      
      if (result.error) {
        setToast({ message: 'فشل تحميل تفاصيل التتبع: ' + result.error, type: 'error' });
        setTrackingModal(null);
        return;
      }

      setTrackingModal({ trackingNumber, data: result.data, loading: false });
    } catch (error) {
      console.error('Tracking Error:', error);
      setToast({ message: 'حدث خطأ: ' + error.message, type: 'error' });
      setTrackingModal(null);
    }
  };

  // 🆕 حفظ تعديلات الفاتورة (حالة الطلب وحالة الدفع)
  const updatePOSInvoice = async (orderId, updates) => {
    try {
      const allInvoices = await localforage.getItem('invoices') || [];
      const index = allInvoices.findIndex(inv => inv.id === orderId);
      
      if (index !== -1) {
        // Update invoice
        allInvoices[index] = { ...allInvoices[index], ...updates };
        await localforage.setItem('invoices', allInvoices);
        
        // Update UI
        setPosInvoices(prev => 
          prev.map(inv => inv.id === orderId ? allInvoices[index] : inv)
        );
        
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(allInvoices[index]);
        }
        
        setToast({ message: '✅ تم تحديث الفاتورة بنجاح', type: 'success' });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Update Invoice Error:', error);
      setToast({ message: 'حدث خطأ: ' + error.message, type: 'error' });
      return false;
    }
  };
  
  // 🆕 مزامنة حالة الطلب من Bosta
  const syncOrderStatusFromBosta = async (invoice) => {
    if (!invoice.bosta?.trackingNumber) return;
    
    try {
      const settings = await getBostaSettings();
      if (!settings.enabled || !settings.apiKey) return;

      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);
      const result = await bostaAPI.getTrackingDetails(invoice.bosta.trackingNumber);
      
      if (result.data) {
        // Map Bosta status to delivery status
        const bostaStatus = result.data.state?.value?.toLowerCase() || '';
        let deliveryStatus = 'pending';
        
        if (bostaStatus.includes('delivered')) {
          deliveryStatus = 'delivered';
        } else if (bostaStatus.includes('out_for_delivery') || bostaStatus.includes('out for delivery')) {
          deliveryStatus = 'out_for_delivery';
        } else if (bostaStatus.includes('in_transit') || bostaStatus.includes('in transit')) {
          deliveryStatus = 'in_transit';
        } else if (bostaStatus.includes('picked_up') || bostaStatus.includes('picked up')) {
          deliveryStatus = 'picked_up';
        }
        
        // Update invoice
        await updatePOSInvoice(invoice.id, {
          deliveryStatus,
          bosta: {
            ...invoice.bosta,
            status: result.data.state?.value,
            statusCode: result.data.state?.code,
            lastUpdated: new Date().toISOString()
          }
        });
        
        setToast({ message: '✅ تم مزامنة حالة الطلب', type: 'success' });
      }
    } catch (error) {
      console.error('Sync Error:', error);
      setToast({ message: 'فشل المزامنة: ' + error.message, type: 'error' });
    }
  };

  // 🆕 إرسال أوردر الموقع لبوسطة
  const sendWebsiteOrderToBosta = async (order) => {
    // Check if already sent
    const bostaTrackingMeta = order.meta_data?.find(m => m.key === 'bosta_tracking_number');
    if (bostaTrackingMeta && bostaTrackingMeta.value) {
      setToast({ message: 'تم إرسال هذا الطلب لبوسطة مسبقاً', type: 'info' });
      return;
    }

    setSendingToBosta(order.id);
    
    try {
      // 1. تحميل الإعدادات
      const settings = await getBostaSettings();
      if (!settings.enabled || !settings.apiKey) {
        setToast({ message: 'يجب تفعيل Bosta من صفحة الإعدادات', type: 'error' });
        return;
      }

      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);

      // 2. إرسال الطلب
      const result = await bostaAPI.createWebsiteDelivery(order);
      
      if (result.error) {
        setToast({ message: 'فشل الإرسال: ' + result.error, type: 'error' });
        return;
      }

      // 3. حفظ tracking number في meta_data عبر الـ API
      const trackingNumber = result.data?.trackingNumber || result.trackingNumber;
      const orderId = result.data?._id || result._id;
      const statusValue = result.data?.state?.value || result.state?.value || 'created';
      
      const metaDataToUpdate = [
        { key: 'bosta_tracking_number', value: trackingNumber },
        { key: 'bosta_order_id', value: orderId },
        { key: 'bosta_status', value: statusValue },
        { key: 'bosta_sent_at', value: new Date().toISOString() }
      ];

      const updateRes = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          meta_data: metaDataToUpdate
        })
      });

      if (!updateRes.ok) {
        console.error('Failed to update order meta_data');
      }

      setToast({ 
        message: `✅ تم إرسال الطلب لبوسطة بنجاح!\nرقم التتبع: ${trackingNumber}`, 
        type: 'success' 
      });

      // Refresh orders to get updated meta_data
      setTimeout(() => fetchOrders(), 1000);

    } catch (error) {
      console.error('Bosta Send Error:', error);
      setToast({ message: 'حدث خطأ: ' + error.message, type: 'error' });
    } finally {
      setSendingToBosta(null);
    }
  };

  const handleStatusChange = (orderId, newStatus) => {
    // Update global state
    updateOrderStatus(orderId, newStatus);

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("تم نسخ العنوان!");
  };

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setSelectedOrder(null);
    }
  };

  // 🆕 Filter orders based on active tab
  const currentOrders = activeTab === 'website' ? orders : posInvoices;
  
  const filteredOrders = currentOrders.filter((order) => {
    // للطلبات من الموقع
    if (activeTab === 'website') {
      const fullName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || order.id.toString().includes(searchTerm);
      const matchesStatus = statusFilter ? order.status === statusFilter : true;
      
      // Date filtering
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const orderDate = new Date(order.date_created);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && orderDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= toDate;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    } 
    // للطلبات من السيستم (POS)
    else {
      const customerName = order.customer?.name?.toLowerCase() || '';
      const customerPhone = order.customer?.phone || '';
      const matchesSearch = customerName.includes(searchTerm.toLowerCase()) || 
                          customerPhone.includes(searchTerm) || 
                          order.id.toString().includes(searchTerm);
      
      // Date filtering for POS invoices
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const orderDate = new Date(order.timestamp);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && orderDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= toDate;
        }
      }
      
      return matchesSearch && matchesDate;
    }
  });

  return (
    <div className="p-6 relative min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg text-white z-[100000000000] shadow-lg ${
            toast.type === "error" ? "bg-red-500" : "bg-green-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📦 الطلبات</h1>
        <p className="text-gray-500 mt-1">
          {(activeTab === 'website' ? ordersLoading : false) ? 'جاري التحميل...' : (
            <>
              {filteredOrders.length} {filteredOrders.length !== currentOrders.length && `من ${currentOrders.length}`} طلب
              {(searchTerm || statusFilter || dateFrom || dateTo) && filteredOrders.length !== currentOrders.length && (
                <span className="text-blue-600 font-medium"> (مفلتر)</span>
              )}
            </>
          )}
        </p>
      </div>
      
      {/* 🆕 Tabs - تقسيم طلبات الموقع والسيستم */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold text-base transition-all ${
              activeTab === 'website'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            🌐 طلبات الموقع
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'website' ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-700'
            }`}>
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold text-base transition-all ${
              activeTab === 'system'
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            🏪 طلبات السيستم (كاشير)
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'system' ? 'bg-white text-green-600' : 'bg-gray-200 text-gray-700'
            }`}>
              {posInvoices.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col gap-4">
          {/* Search and Status Filter Row */}
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder={activeTab === 'website' ? "🔍 ابحث بالرقم أو اسم العميل..." : "🔍 ابحث برقم الفاتورة أو اسم العميل أو رقم الهاتف..."}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Status filter فقط لطلبات الموقع */}
            {activeTab === 'website' && (
              <select
                className="border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">📊 كل الحالات</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date Filter Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium whitespace-nowrap">📅 من:</label>
              <input
                type="date"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium whitespace-nowrap">📅 إلى:</label>
              <input
                type="date"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(searchTerm || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  router.push('/orders');
                  fetchOrders(); // جلب جميع الطلبات من جديد
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium whitespace-nowrap"
              >
                🔄 مسح الفلاتر
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {(searchTerm || statusFilter || dateFrom || dateTo) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">الفلاتر النشطة:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  🔍 {searchTerm}
                  <button onClick={() => setSearchTerm("")} className="hover:text-blue-900">×</button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  📊 {STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}
                  <button onClick={() => setStatusFilter("")} className="hover:text-purple-900">×</button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  📅 من: {new Date(dateFrom).toLocaleDateString('ar-EG')}
                  <button onClick={() => setDateFrom("")} className="hover:text-green-900">×</button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  📅 إلى: {new Date(dateTo).toLocaleDateString('ar-EG')}
                  <button onClick={() => setDateTo("")} className="hover:text-green-900">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Mode Toggle - للطلبات من النظام فقط */}
      {activeTab === 'system' && (
        <div className="mb-4 flex justify-end gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            🔲 كاردات
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📊 جدول
          </button>
        </div>
      )}

      {/* Table View - للطلبات من النظام فقط */}
      {activeTab === 'system' && viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <tr>
                  <th className="px-2 py-3 text-right text-sm font-bold">رقم الفاتورة</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">العميل</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">الهاتف</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">المنتجات</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">الإجمالي</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">تفاصيل الدفع</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">حالة الطلب</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">حالة الدفع</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">Bosta</th>
                  <th className="px-2 py-3 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">📦</div>
                      <p>لا توجد طلبات</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, index) => (
                    <tr 
                      key={order.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      {/* Invoice ID */}
                      <td className="px-2 py-3">
                        <div className="font-bold text-gray-900">#{order.id}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.date).toLocaleDateString('ar-EG', { 
                            day: '2-digit', 
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-2 py-3">
                        <div className="font-medium text-gray-900">
                          {order.delivery?.customer?.name || 'غير متاح'}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-2 py-3">
                        <div className="text-sm text-gray-700">
                          {order.delivery?.customer?.phone || '-'}
                        </div>
                      </td>

                      {/* Products */}
                      <td className="px-2 py-3">
                        <div className="text-sm text-gray-700">
                          {order.items?.length || 0} منتج
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-2 py-3">
                        <div className="font-bold text-green-600">
                          {order.summary?.total?.toFixed(2)} ج.م
                        </div>
                      </td>

                      {/* Payment Details */}
                      <td className="px-2 py-3">
                        {order.deliveryPayment ? (
                          <div className="text-xs">
                            {order.deliveryPayment.status === 'cash_on_delivery' && (
                              <div className="bg-red-50 border border-red-200 rounded p-1.5">
                                <p className="font-semibold text-red-700 mb-0.5">📦 دفع عند الاستلام</p>
                                <p className="font-bold text-red-900">
                                  المطلوب: {order.summary?.total?.toFixed(2)} ج.م
                                </p>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'half_paid' && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-1.5 space-y-0.5">
                                <p className="font-semibold text-yellow-700">🕐 نصف المبلغ مدفوع</p>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">✅ مدفوع:</span>
                                  <span className="text-green-700 font-bold">{order.deliveryPayment.paidAmount?.toFixed(2)} ج.م</span>
                                </div>
                                <div className="flex justify-between bg-white rounded px-1 py-0.5">
                                  <span className="text-gray-900 font-semibold">📦 المطلوب:</span>
                                  <span className="text-red-700 font-bold">{order.deliveryPayment.remainingAmount?.toFixed(2)} ج.م</span>
                                </div>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'fully_paid' && (
                              <div className="bg-green-50 border border-green-200 rounded p-1.5">
                                <p className="font-semibold text-green-700 mb-0.5">✅ مدفوع بالكامل</p>
                                <p className="font-bold text-green-900">
                                  لا يوجد مبلغ (0 ج.م)
                                </p>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'fully_paid_no_delivery' && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                                <p className="font-semibold text-blue-700 mb-0.5">🚧 مدفوع بدون توصيل</p>
                                <p className="font-bold text-blue-900">
                                  المطلوب: {order.deliveryPayment.remainingAmount?.toFixed(2) || order.delivery?.fee?.toFixed(2) || '0.00'} ج.م
                                </p>
                                <p className="text-blue-600">(رسوم التوصيل فقط)</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* Delivery Status */}
                      <td className="px-2 py-3">
                        <select
                          value={order.deliveryStatus || 'pending'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updatePOSInvoice(order.id, { deliveryStatus: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold px-2 py-1 rounded-lg border-2 focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="pending">🕐 معلق</option>
                          <option value="processing">⚙️ قيد التجهيز</option>
                          <option value="picked_up">✅ تم الاستلام</option>
                          <option value="in_transit">🚚 في الطريق</option>
                          <option value="out_for_delivery">🏃 خرج للتوصيل</option>
                          <option value="delivered">🎉 تم التوصيل</option>
                          <option value="cancelled">❌ ملغي</option>
                        </select>
                      </td>

                      {/* Payment Status */}
                      <td className="px-2 py-3">
                        <select
                          value={order.deliveryPayment?.status || order.paymentStatus || 'unpaid'}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value;
                            // تحديث deliveryPayment.status في الفاتورة
                            const updates = {
                              deliveryPayment: {
                                ...order.deliveryPayment,
                                status: newStatus
                              }
                            };
                            updatePOSInvoice(order.id, updates);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold px-2 py-1 rounded-lg border-2 focus:ring-2 focus:ring-blue-500 w-full"
                        >
                          <option value="cash_on_delivery">📦 دفع عند الاستلام</option>
                          <option value="half_paid">🕐 نصف المبلغ مدفوع</option>
                          <option value="fully_paid">✅ مدفوع بالكامل</option>
                          <option value="fully_paid_no_delivery">🚧 مدفوع بدون توصيل</option>
                        </select>
                      </td>

                      {/* Bosta Status */}
                      <td className="px-2 py-3">
                        {order.bosta?.sent ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                              ✅ {order.bosta.trackingNumber}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openTrackingModal(order.bosta.trackingNumber);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              🔗 تتبع
                            </button>
                          </div>
                        ) : bostaEnabled ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sendToBosta(order);
                            }}
                            disabled={sendingToBosta === order.id}
                            className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded font-bold disabled:opacity-50"
                          >
                            {sendingToBosta === order.id ? '⏳' : '📦 إرسال'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-3">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold"
                            title="التفاصيل"
                          >
                            📄
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/pos/invoices/print?id=${order.id}`, '_blank');
                            }}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold"
                            title="طباعة"
                          >
                            🖨️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div className={`${activeTab === 'system' && viewMode === 'table' ? 'hidden' : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'}`}>
        {(activeTab === 'website' && ordersLoading) ? (
          // Loading Skeletons
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm p-5 animate-pulse border border-gray-100"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="h-6 bg-gray-200 rounded w-20" />
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="flex gap-3 mt-4">
                <div className="h-9 bg-gray-200 rounded flex-1" />
                <div className="h-9 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))
        ) : filteredOrders.length === 0 ? (
          // Empty State
          <div className="col-span-full text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500 text-lg mb-2">
              {currentOrders.length === 0 ? 'لا توجد طلبات' : 'لا توجد طلبات مطابقة للبحث'}
            </p>
            {searchTerm || statusFilter || dateFrom || dateTo ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setDateFrom('');
                  setDateTo('');
                  router.push('/orders');
                  if (activeTab === 'website') {
                    fetchOrders();
                  }
                }}
                className="text-blue-500 hover:underline text-sm mt-2"
              >
                مسح الفلاتر
              </button>
            ) : null}
          </div>
        ) : (
          // Orders List
          filteredOrders.map((order) => {
            // 🆕 تحديد نوع الطلب (موقع أو سيستم)
            const isSystemOrder = activeTab === 'system';
            
            if (isSystemOrder) {
              // 🏪 عرض طلبات السيستم (POS)
              const orderDate = new Date(order.date); // ✅ استخدام date بدل timestamp
              const itemsCount = (order.items?.length || 0) + (order.services?.length || 0);
              
              return (
                <div
                  key={order.id}
                  className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border-2 border-green-200 transform hover:-translate-y-2"
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                        <span className="inline-flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          🏪 كاشير
                        </span>
                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          🚚 توصيل
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {orderDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {orderDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Customer Info - Always Visible */}
                    <div className="space-y-1 mb-2 text-xs bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-300">
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-600 text-sm">👤</span>
                        <span className="font-bold text-gray-800 text-sm">{order.delivery?.customer?.name || 'عميل'}</span>
                      </div>
                      {order.delivery?.customer?.phone && (
                        <p className="text-gray-700 flex items-center gap-1.5">
                          <span className="text-blue-500 text-xs">📱</span>
                          <span className="font-medium">{order.delivery.customer.phone}</span>
                        </p>
                      )}
                    </div>

                    {/* Products Summary */}
                    <div className="mb-3 bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-800">
                            📦 {order.items?.length || 0} منتج
                          </div>
                          {order.services && order.services.length > 0 && (
                            <div className="text-xs text-gray-500">
                              🔧 + {order.services.length} خدمة
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-gray-900 font-bold text-lg">
                            💰 {((order.summary?.total || 0) - (order.summary?.deliveryFee || 0)).toFixed(2)} ج.م
                          </p>
                          {order.summary?.deliveryFee > 0 && (
                            <p className="text-orange-600 font-medium text-xs">
                              🚚 شحن: {order.summary.deliveryFee.toFixed(2)} ج.م
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* الإجمالي النهائي مع حالة الدفع */}
                      <div className="pt-2 border-t-2 border-purple-300 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-800">الإجمالي الكلي:</span>
                          <span className="text-xl font-black text-purple-700">
                            {order.summary?.total?.toFixed(2)} ج.م
                          </span>
                        </div>
                        
                        {/* حالة الدفع */}
                        {order.deliveryPayment && (
                          <div className={`rounded-lg p-2 ${
                            order.deliveryPayment.status === 'cash_on_delivery' ? 'bg-red-100 border border-red-300' :
                            order.deliveryPayment.status === 'half_paid' ? 'bg-yellow-100 border border-yellow-300' :
                            'bg-green-100 border border-green-300'
                          }`}>
                            {order.deliveryPayment.status === 'cash_on_delivery' && (
                              <div className="text-center">
                                <p className="text-xs font-semibold text-red-700 mb-0.5">📦 دفع عند الاستلام</p>
                                <p className="text-sm font-black text-red-900">
                                  المطلوب تحصيله: {order.summary?.total?.toFixed(2)} ج.م
                                </p>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'half_paid' && (
                              <div>
                                <p className="text-xs font-semibold text-yellow-700 mb-1 text-center">🕐 نصف المبلغ مدفوع</p>
                                <div className="space-y-0.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-700">✅ مدفوع مسبقاً:</span>
                                    <span className="text-green-700 font-bold">{order.deliveryPayment.paidAmount?.toFixed(2)} ج.م</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-white rounded p-1">
                                    <span className="text-gray-900 font-bold">📦 المطلوب تحصيله:</span>
                                    <span className="text-red-700 font-black text-base">{order.deliveryPayment.remainingAmount?.toFixed(2)} ج.م</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'fully_paid' && (
                              <div className="text-center">
                                <p className="text-xs font-semibold text-green-700 mb-0.5">✅ مدفوع بالكامل</p>
                                <p className="text-sm font-black text-green-900">
                                  لا يوجد مبلغ للتحصيل (0 ج.م)
                                </p>
                              </div>
                            )}
                            
                            {order.deliveryPayment.status === 'fully_paid_no_delivery' && (
                              <div className="text-center">
                                <p className="text-xs font-semibold text-blue-700 mb-0.5">🚧 مدفوع كامل بدون توصيل</p>
                                <p className="text-sm font-black text-blue-900">
                                  المطلوب تحصيله: {order.deliveryPayment.remainingAmount?.toFixed(2) || order.delivery?.fee?.toFixed(2) || '0.00'} ج.م
                                </p>
                                <p className="text-xs text-blue-700 mt-0.5">(رسوم التوصيل فقط)</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Controls */}
                    <div className="px-1 mb-2 space-y-2">
                      {/* Delivery Status */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">📦 حالة الطلب</label>
                        <select
                          value={order.deliveryStatus || 'pending'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updatePOSInvoice(order.id, { deliveryStatus: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs font-bold px-3 py-2 rounded-lg border-2 border-orange-300 bg-white
                            focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="pending">🕐 معلق</option>
                          <option value="processing">⚙️ قيد التجهيز</option>
                          <option value="picked_up">✅ تم الاستلام</option>
                          <option value="in_transit">🚚 في الطريق</option>
                          <option value="out_for_delivery">🏃 خرج للتوصيل</option>
                          <option value="delivered">🎉 تم التوصيل</option>
                          <option value="cancelled">❌ ملغي</option>
                        </select>
                      </div>
                      
                      {/* Payment Status */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">💰 حالة الدفع</label>
                        <select
                          value={order.deliveryPayment?.status || order.paymentStatus || 'cash_on_delivery'}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value;
                            // تحديث deliveryPayment.status في الفاتورة
                            const updates = {
                              deliveryPayment: {
                                ...order.deliveryPayment,
                                status: newStatus
                              }
                            };
                            updatePOSInvoice(order.id, updates);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs font-bold px-3 py-2 rounded-lg border-2 border-blue-300 bg-white
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="cash_on_delivery">📦 دفع عند الاستلام</option>
                          <option value="half_paid">🕐 نصف المبلغ مدفوع</option>
                          <option value="fully_paid">✅ مدفوع بالكامل</option>
                          <option value="fully_paid_no_delivery">🚧 مدفوع بدون توصيل</option>
                        </select>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      {/* 🆕 Bosta Section */}
                      {bostaEnabled && (
                        <div className="px-1">
                          {order.bosta?.sent ? (
                            // إذا تم الإرسال - عرض معلومات التتبع
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-300 rounded-lg p-2 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-purple-700 font-bold flex items-center gap-1">
                                  ✅ تم الإرسال لبوسطة
                                </p>
                                <span className="text-[10px] bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                                  {formatBostaStatus(order.bosta.status)}
                                </span>
                              </div>
                              <p className="text-gray-700 font-medium mb-1">
                                رقم التتبع: {order.bosta.trackingNumber}
                              </p>
                              <button
                                onClick={() => openTrackingModal(order.bosta.trackingNumber)}
                                className="w-full text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                              >
                                🔗 تتبع الشحنة
                              </button>
                            </div>
                          ) : (
                            // إذا لم يتم الإرسال - زر الإرسال
                            <button
                              onClick={() => sendToBosta(order)}
                              disabled={sendingToBosta === order.id}
                              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 
                                       text-white px-3 py-2 rounded-lg text-sm font-bold
                                       hover:from-purple-600 hover:to-indigo-700 
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       transition-all shadow-md hover:shadow-lg"
                            >
                              {sendingToBosta === order.id ? '⏳ جاري الإرسال...' : '📦 إرسال لبوسطة'}
                            </button>
                          )}
                        </div>
                      )}
                      
                      <div className="flex gap-2 px-1">
                        <button
                          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-2.5 rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
                          onClick={() => {
                            // 🖨️ فتح صفحة الطباعة في tab جديد
                            window.open(`/pos/invoices/print?id=${order.id}`, '_blank');
                          }}
                        >
                          🖨️ طباعة
                        </button>
                        <button
                          className="px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all text-sm font-medium shadow-md"
                          onClick={() => {
                            // 📄 فتح الفاتورة في modal أو نفس الصفحة
                            setSelectedOrder(order);
                          }}
                        >
                          📄 التفاصيل
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            // 🌐 عرض طلبات الموقع (WooCommerce)
            const statusObj = STATUS_OPTIONS.find((s) => s.value === order.status);
            
            // 🔥 تحديد الطلبات الجديدة فعلاً حسب التاريخ (اليوم فقط)
            const orderDate = new Date(order.date_created);
            orderDate.setHours(orderDate.getHours() + 2); // توقيت مصر
            const today = new Date();
            const isToday = orderDate.toDateString() === today.toDateString();
            const isNew = isToday && order.status === 'on-hold'; // جديد فقط لو معلق واليوم
            
            const items = order.line_items || [];
            const itemsCount = items.length;

            // استخراج الصور من المنتجات - WooCommerce بيحطها في meta_data أو product
            const getProductImages = () => {
              return items.map((item, idx) => {
                // محاولة الحصول على الصورة من أماكن مختلفة
                let imageUrl = null;
                
                // من الـ image object (الطريقة الصحيحة في WooCommerce REST API)
                if (item.image?.src) {
                  imageUrl = item.image.src;
                }
                // من image_url مباشرة
                else if (item.image_url) {
                  imageUrl = item.image_url;
                }
                // من الـ meta_data
                else if (item.meta_data) {
                  const imageMeta = item.meta_data.find(m => m.key === '_thumbnail_id' || m.key === 'image');
                  if (imageMeta?.value) imageUrl = imageMeta.value;
                }
                
                // Fallback للـ placeholder
                if (!imageUrl || imageUrl === '') {
                  imageUrl = '/icons/placeholder.webp';
                }
                
                return {
                  ...item,
                  imageUrl: imageUrl
                };
              });
            };

            const itemsWithImages = getProductImages();

            // تحديد layout الصور حسب العدد (زي Facebook)
            const getImageLayout = () => {
              if (itemsCount === 0) return null;
              if (itemsCount === 1) return "single";
              if (itemsCount === 2) return "double";
              if (itemsCount === 3) return "triple";
              if (itemsCount === 4) return "quad";
              return "grid"; // 5+
            };

            const layout = getImageLayout();
            
            // حساب الوقت مع تصحيح التوقيت
            const getTimeAgo = (dateString) => {
              const date = new Date(dateString);
              date.setHours(date.getHours() + 2); // توقيت مصر UTC+2
              const now = new Date();
              const seconds = Math.floor((now - date) / 1000);
              
              // 🔥 التحقق من نفس اليوم
              const isToday = date.toDateString() === now.toDateString();
              
              if (seconds < 60) return 'الآن';
              if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
              
              // 🔥 لو نفس اليوم نعرض "اليوم" بدل "منذ X ساعة"
              if (isToday) {
                return `اليوم ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
              }
              
              if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
              if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
              
              return date.toLocaleDateString('ar-EG');
            };

            return (
              <div
                key={order.id}
                className={`group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border-2 cursor-pointer transform hover:-translate-y-2 ${
                  isNew 
                    ? "border-yellow-400 ring-4 ring-yellow-100 shadow-yellow-200/50" 
                    : "border-gray-100 hover:border-blue-300"
                }`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="p-4">
                  {/* Header - Order Number & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                      {isNew && (
                        <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                          <span className="relative">🔔 جديد</span>
                        </span>
                      )}
                      {/* 🆕 بادج نوع التوصيل */}
                      {order.meta_data?.some(m => 
                        (m.key === '_is_store_pickup' && m.value === 'yes') || 
                        (m.key === '_delivery_type' && m.value === 'store_pickup')
                      ) ? (
                        <span className="inline-flex items-center gap-1 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                          🏪 استلام
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          🚚 توصيل
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-md ${
                          statusObj?.color || "bg-gray-500"
                        }`}
                      >
                        {statusObj?.label || order.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {getTimeAgo(order.date_created)}
                      </p>
                    </div>
                  </div>

                {/* Products Images Grid - Facebook Style */}
                {items.length > 0 && (
                  <div className="mb-3 rounded-xl overflow-hidden bg-gray-50">
                    {/* Single Image - Full Width */}
                    {layout === "single" && (
                      <div className="w-full aspect-[16/10] relative group bg-white">
                        <img
                          src={itemsWithImages[0].imageUrl}
                          alt={itemsWithImages[0].name}
                          className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = "/icons/placeholder.webp";
                          }}
                        />
                      </div>
                    )}

                    {/* Two Images - Side by Side */}
                    {layout === "double" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {itemsWithImages.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="relative group bg-white overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Three Images - Facebook Style (1 big left, 2 small right) */}
                    {layout === "triple" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        <div className="row-span-2 bg-white overflow-hidden relative group">
                          <img
                            src={itemsWithImages[0].imageUrl}
                            alt={itemsWithImages[0].name}
                            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.src = "/icons/placeholder.webp";
                            }}
                          />
                        </div>
                        {itemsWithImages.slice(1, 3).map((item, idx) => (
                          <div key={idx} className="bg-white overflow-hidden relative group">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Four Images - Facebook Style (2x2 Grid) */}
                    {layout === "quad" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {itemsWithImages.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="bg-white overflow-hidden relative group">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.target.src = "/icons/placeholder.webp";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Five or More Images - Facebook Style (with +X overlay) */}
                    {layout === "grid" && (
                      <div className="grid grid-cols-2 gap-1 aspect-[16/10]">
                        {/* First large image */}
                        <div className="row-span-2 bg-white overflow-hidden relative group">
                          <img
                            src={itemsWithImages[0].imageUrl}
                            alt={itemsWithImages[0].name}
                            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.target.src = "/icons/placeholder.webp";
                            }}
                          />
                        </div>
                        
                        {/* Next 3 images */}
                        {itemsWithImages.slice(1, 4).map((item, idx) => {
                          const isLast = idx === 2 && itemsCount > 4;
                          return (
                            <div key={idx} className="bg-white overflow-hidden relative group">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={`w-full h-full object-contain p-1 transition-all duration-300 ${
                                  isLast ? 'brightness-50 group-hover:brightness-40' : 'group-hover:scale-105'
                                }`}
                                onError={(e) => {
                                  e.target.src = "/icons/placeholder.webp";
                                }}
                              />
                              {isLast && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                                  <span className="text-white font-bold text-3xl drop-shadow-lg">
                                    +{itemsCount - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Products Summary - Enhanced */}
                <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg w-12 h-12 flex items-center justify-center shadow-md">
                        <div className="text-center">
                          <div className="text-lg font-bold leading-none">{itemsCount}</div>
                          <div className="text-[9px] leading-none mt-0.5">منتج</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">
                        {items[0]?.name}
                      </div>
                      {itemsCount > 1 && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {items.slice(1, 3).map(item => item.name).join(" • ")}
                          {itemsCount > 3 && ` وأخرى...`}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {items.slice(0, Math.min(3, itemsCount)).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            <span className="font-medium">×{item.quantity}</span>
                          </span>
                        ))}
                        {itemsCount > 3 && (
                          <span className="text-xs text-gray-400">+{itemsCount - 3} أخرى</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Customer Info */}
                  <div className="space-y-2 mb-4 text-sm px-1">
                    <p className="text-gray-700 flex items-center gap-2">
                      <span className="text-gray-400">👤</span>
                      <span className="font-medium">
                        {order.billing?.first_name} {order.billing?.last_name}
                      </span>
                    </p>
                    <p className="text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">💳</span>
                      {order.payment_method_title}
                    </p>
                    {/* 💰 المجموع بدون الشحن */}
                    <p className="text-gray-900 font-bold text-xl flex items-center gap-2">
                      <span className="text-gray-400 text-base">💰</span>
                      {(parseFloat(order.total) - parseFloat(order.shipping_total || 0))} جنيه
                    </p>
                    {/* تنبيه: المبلغ المدفوع في الستور هو ثمن المنتج فقط */}
                    {order.payment_method_title && order.payment_method_title !== 'الدفع نقدًا عند الاستلام' && (
                      <div className="bg-blue-50 border border-blue-300 rounded-lg p-2">
                        <p className="text-blue-700 text-xs font-semibold mb-0.5">✓ تم دفع ثمن المنتج فقط</p>
                        <p className="text-blue-900 text-sm font-bold">
                          {(parseFloat(order.total) - parseFloat(order.shipping_total || 0)).toFixed(2)} جنيه
                        </p>
                      </div>
                    )}
                    {/* 🚚 الشحن منفصل */}
                    {parseFloat(order.shipping_total || 0) > 0 && (
                      <div className="bg-orange-50 border border-orange-300 rounded-lg p-2">
                        <p className="text-orange-700 text-xs font-semibold mb-0.5">🚚 رسوم التوصيل للتحصيل</p>
                        <p className="text-orange-900 text-sm font-bold">
                          من {parseFloat(order.shipping_total) - 25} إلي {parseFloat(order.shipping_total)} جنيه
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 px-1" onClick={(e) => e.stopPropagation()}>
                    {/* 🆕 Bosta Section - لكل الطلبات ماعدا الاستلام */}
                    {bostaEnabled && order.status === 'processing' && 
                     order.meta_data?.find(m => m.key === '_delivery_type')?.value !== 'pickup' && (
                      <div>
                        {order.meta_data?.find(m => m.key === 'bosta_tracking_number')?.value ? (
                          // إذا تم الإرسال - عرض معلومات التتبع
                          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-300 rounded-lg p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-purple-700 font-bold flex items-center gap-1">
                                ✅ تم الإرسال لبوسطة
                              </p>
                            </div>
                            <p className="text-gray-700 font-medium mb-1">
                              رقم التتبع: {order.meta_data.find(m => m.key === 'bosta_tracking_number').value}
                            </p>
                            <button
                              onClick={() => openTrackingModal(order.meta_data.find(m => m.key === 'bosta_tracking_number').value)}
                              className="w-full text-blue-600 hover:text-blue-700 hover:underline text-xs font-medium"
                            >
                              🔗 تتبع الشحنة
                            </button>
                          </div>
                        ) : (
                          // إذا لم يتم الإرسال - زر الإرسال
                          <button
                            onClick={() => sendWebsiteOrderToBosta(order)}
                            disabled={sendingToBosta === order.id}
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 
                                     text-white px-3 py-2 rounded-lg text-sm font-bold
                                     hover:from-purple-600 hover:to-indigo-700 
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     transition-all shadow-md hover:shadow-lg"
                          >
                            {sendingToBosta === order.id ? '⏳ جاري الإرسال...' : '📦 إرسال لبوسطة'}
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2.5 rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
                        onClick={() => setSelectedOrder(order)}
                      >
                        📄 التفاصيل
                      </button>
                      <select
                        className="border-2 border-gray-200 rounded-lg px-2 py-2 text-xs bg-white hover:border-blue-500 transition-colors font-medium"
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && activeTab === 'website' && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          showToast={showToast}
        />
      )}
      
      {/* POS Invoice Modal */}
      {selectedOrder && activeTab === 'system' && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">فاتورة #{selectedOrder.id}</h2>
                  <p className="text-green-100 text-sm mt-1">
                    {new Date(selectedOrder.date).toLocaleDateString('ar-EG', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Customer Info */}
              {selectedOrder.delivery?.customer && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-300 rounded-lg p-3">
                  <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-base">
                    <span>👤</span> معلومات العميل
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-gray-800"><strong className="text-blue-700">الاسم:</strong> <span className="text-gray-900 font-medium">{selectedOrder.delivery.customer.name}</span></p>
                    {selectedOrder.delivery.customer.phone && (
                      <p className="text-gray-800"><strong className="text-blue-700">📱 الهاتف:</strong> <span className="text-gray-900 font-medium">{selectedOrder.delivery.customer.phone}</span></p>
                    )}
                    {selectedOrder.delivery.customer.email && (
                      <p className="text-gray-800"><strong className="text-blue-700">📧 البريد:</strong> <span className="text-gray-900 font-medium">{selectedOrder.delivery.customer.email}</span></p>
                    )}
                    {selectedOrder.delivery.customer.address && (
                      <div className="text-gray-800">
                        <strong className="text-blue-700">📍 العنوان:</strong>
                        <div className="text-xs bg-white p-2 rounded mt-1 border border-blue-200 text-gray-900 font-medium leading-snug">
                          {typeof selectedOrder.delivery.customer.address === 'string' 
                            ? selectedOrder.delivery.customer.address 
                            : (
                              <div className="space-y-0.5">
                                {selectedOrder.delivery.customer.address.street && (
                                  <div>{selectedOrder.delivery.customer.address.street}</div>
                                )}
                                {(selectedOrder.delivery.customer.address.building || selectedOrder.delivery.customer.address.floor || selectedOrder.delivery.customer.address.apartment) && (
                                  <div>
                                    {[
                                      selectedOrder.delivery.customer.address.building && `مبنى ${selectedOrder.delivery.customer.address.building}`,
                                      selectedOrder.delivery.customer.address.floor && `ط${selectedOrder.delivery.customer.address.floor}`,
                                      selectedOrder.delivery.customer.address.apartment && `ش${selectedOrder.delivery.customer.address.apartment}`
                                    ].filter(Boolean).join(' • ')}
                                  </div>
                                )}
                                {(selectedOrder.delivery.customer.address.area || selectedOrder.delivery.customer.address.city || selectedOrder.delivery.customer.address.state) && (
                                  <div>
                                    {[
                                      selectedOrder.delivery.customer.address.area,
                                      selectedOrder.delivery.customer.address.city,
                                      selectedOrder.delivery.customer.address.state
                                    ].filter(Boolean).join(', ')}
                                  </div>
                                )}
                                {selectedOrder.delivery.customer.address.landmark && (
                                  <div className="text-gray-600 italic">🔖 {selectedOrder.delivery.customer.address.landmark}</div>
                                )}
                              </div>
                            )
                          }
                        </div>
                      </div>
                    )}
                    {selectedOrder.delivery.notes && (
                      <p className="text-gray-800"><strong className="text-blue-700">📝 ملاحظات:</strong> <span className="text-gray-900 font-medium italic">{selectedOrder.delivery.notes}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Products */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
                  <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-lg">
                    <span>📦</span> المنتجات ({selectedOrder.items.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border-2 border-purple-200 flex justify-between items-center hover:border-purple-400 transition-all">
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="text-xs text-purple-700 font-medium">الكمية: <span className="text-purple-900 font-bold">{item.quantity}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-900 text-lg">{(item.price * item.quantity).toFixed(2)} ج.م</p>
                          <p className="text-xs text-gray-600 font-medium">{item.price} ج.م × {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {selectedOrder.services && selectedOrder.services.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-4">
                  <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2 text-lg">
                    <span>🔧</span> الخدمات ({selectedOrder.services.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.services.map((service, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border-2 border-yellow-200 flex justify-between items-center hover:border-yellow-400 transition-all">
                        <div>
                          <p className="font-bold text-gray-900">{service.description}</p>
                          {service.employeeName && (
                            <p className="text-xs text-yellow-700 font-medium">👨‍🔧 الفني: <span className="text-yellow-900 font-bold">{service.employeeName}</span></p>
                          )}
                        </div>
                        <p className="font-bold text-yellow-900 text-lg">{service.amount.toFixed(2)} ج.م</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
                <h3 className="font-bold text-green-900 mb-3 text-lg flex items-center gap-2">💰 ملخص الفاتورة</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">المجموع الفرعي:</span>
                    <span className="font-bold text-gray-900 text-base">{selectedOrder.summary?.subtotal?.toFixed(2) || '0.00'} ج.م</span>
                  </div>
                  {selectedOrder.summary?.discount?.amount > 0 && (
                    <div className="flex justify-between items-center bg-red-50 p-2 rounded border border-red-200">
                      <span className="text-red-700 font-medium">🔻 الخصم ({selectedOrder.summary.discount.type === 'percentage' ? `${selectedOrder.summary.discount.value}%` : 'مبلغ ثابت'}):</span>
                      <span className="font-bold text-red-900 text-base">- {selectedOrder.summary.discount.amount.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  {selectedOrder.summary?.extraFee > 0 && (
                    <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200">
                      <span className="text-green-700 font-medium">➕ رسوم إضافية ({selectedOrder.summary.extraFeeType === 'percentage' ? `${selectedOrder.summary.extraFeeValue}%` : 'مبلغ ثابت'}):</span>
                      <span className="font-bold text-green-900 text-base">+ {selectedOrder.summary.extraFee.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  {selectedOrder.summary?.deliveryFee > 0 && (
                    <div className="flex justify-between items-center bg-orange-50 p-2 rounded border border-orange-200">
                      <span className="text-orange-700 font-medium">🚚 رسوم التوصيل:</span>
                      <span className="font-bold text-orange-900 text-base">+ {selectedOrder.summary.deliveryFee.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-green-400 bg-green-100 p-3 rounded-lg mt-2">
                    <span className="text-green-900 font-bold text-base">💵 الإجمالي النهائي:</span>
                    <span className="text-green-600 font-black text-2xl">{selectedOrder.summary?.total?.toFixed(2) || '0.00'} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-lg p-4">
                <h3 className="font-bold text-indigo-900 mb-3 text-lg flex items-center gap-2">💳 طريقة الدفع</h3>
                <p className="text-sm mb-2">
                  <strong className="text-indigo-700">الطريقة: </strong>
                  <span className="font-bold text-indigo-900 text-base">
                    {selectedOrder.paymentMethod === 'cash' ? '💵 نقدي' : 
                     selectedOrder.paymentMethod === 'wallet' ? '📱 محفظة إلكترونية' :
                     selectedOrder.paymentMethod === 'instapay' ? '⚡ إنستاباي' :
                     selectedOrder.paymentMethod === 'vera' ? '💳 فيرا' : selectedOrder.paymentMethod}
                  </span>
                </p>
                <p className="text-sm">
                  <strong className="text-indigo-700">الحالة: </strong>
                  <span className={`font-bold text-base ${
                    selectedOrder.paymentStatus === 'paid_full' ? 'text-green-600' :
                    selectedOrder.paymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {selectedOrder.paymentStatus === 'paid_full' ? '✅ مدفوع بالكامل' :
                     selectedOrder.paymentStatus === 'partial' ? '⚠️ مدفوع جزئياً' : 
                     '❌ غير مدفوع'}
                  </span>
                </p>
              </div>
              
              {/* 🆕 Order & Payment Status Control */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 rounded-lg p-4">
                <h3 className="font-bold text-orange-900 mb-3 text-lg flex items-center gap-2">
                  ⚙️ التحكم في الطلب
                </h3>
                
                <div className="space-y-3">
                  {/* Order Status */}
                  <div>
                    <label className="block text-sm font-bold text-orange-800 mb-1">
                      📦 حالة الطلب
                    </label>
                    <select
                      value={selectedOrder.deliveryStatus || 'pending'}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        updatePOSInvoice(selectedOrder.id, { deliveryStatus: newStatus });
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-orange-300 rounded-lg text-sm font-bold
                        focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="pending">🕐 معلق</option>
                      <option value="processing">⚙️ قيد التجهيز</option>
                      <option value="picked_up">✅ تم الاستلام</option>
                      <option value="in_transit">🚚 في الطريق</option>
                      <option value="out_for_delivery">🏃 خرج للتوصيل</option>
                      <option value="delivered">🎉 تم التوصيل</option>
                      <option value="cancelled">❌ ملغي</option>
                    </select>
                  </div>
                  
                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-bold text-orange-800 mb-1">
                      💰 حالة الدفع
                    </label>
                    <select
                      value={selectedOrder.deliveryPayment?.status || selectedOrder.paymentStatus || 'cash_on_delivery'}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        const updates = {
                          deliveryPayment: {
                            ...selectedOrder.deliveryPayment,
                            status: newStatus
                          }
                        };
                        updatePOSInvoice(selectedOrder.id, updates);
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-orange-300 rounded-lg text-sm font-bold
                        focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="cash_on_delivery">📦 دفع عند الاستلام</option>
                      <option value="half_paid">🕐 نصف المبلغ مدفوع</option>
                      <option value="fully_paid">✅ مدفوع بالكامل</option>
                      <option value="fully_paid_no_delivery">🚧 مدفوع بدون توصيل</option>
                    </select>
                  </div>
                  
                  {/* Sync from Bosta */}
                  {selectedOrder.bosta?.sent && (
                    <button
                      onClick={() => syncOrderStatusFromBosta(selectedOrder)}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 
                        text-white px-3 py-2 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg
                        flex items-center justify-center gap-2"
                    >
                      <span>🔄</span>
                      <span>مزامنة الحالة من Bosta</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t flex gap-3">
              <button
                onClick={() => window.open(`/pos/invoices/print?id=${selectedOrder.id}`, '_blank')}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg"
              >
                🖨️ طباعة الفاتورة
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {trackingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">📦 تتبع الشحنة</h2>
                <p className="text-sm opacity-90">رقم التتبع: {trackingModal.trackingNumber}</p>
              </div>
              <button
                onClick={() => setTrackingModal(null)}
                className="text-white hover:bg-white hover:bg-opacity-20 w-8 h-8 rounded-full flex items-center justify-center transition-all"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {trackingModal.loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">جاري تحميل التفاصيل...</p>
                </div>
              ) : trackingModal.data ? (
                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-purple-900">الحالة الحالية</h3>
                      <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-bold">
                        {trackingModal.data.state?.value || 'غير متاح'}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium">
                      {trackingModal.data.maskedState || trackingModal.data.statesData?.value || 'لا توجد معلومات'}
                    </p>
                  </div>

                  {/* Timeline */}
                  {trackingModal.data.timeline && trackingModal.data.timeline.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">📍 مراحل الشحنة</h3>
                      <div className="relative">
                        {/* Progress Line */}
                        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full" 
                             style={{ zIndex: 0 }}>
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${(trackingModal.data.timeline.filter(s => s.done).length / trackingModal.data.timeline.length) * 100}%` 
                            }}
                          />
                        </div>
                        
                        {/* Steps */}
                        <div className="relative flex justify-between" style={{ zIndex: 1 }}>
                          {trackingModal.data.timeline.map((step, index) => {
                            const statusLabels = {
                              'new': 'جديد',
                              'picked_up': 'تم الاستلام',
                              'in_transit': 'في الطريق',
                              'out_for_delivery': 'خرج للتوصيل',
                              'delivered': 'تم التوصيل'
                            };
                            
                            const statusIcons = {
                              'new': '📦',
                              'picked_up': '✅',
                              'in_transit': '🚚',
                              'out_for_delivery': '🏃',
                              'delivered': '🎉'
                            };
                            
                            const label = statusLabels[step.value] || step.value;
                            const icon = statusIcons[step.value] || '📍';
                            
                            return (
                              <div key={index} className="flex flex-col items-center" style={{ flex: 1 }}>
                                {/* Circle */}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-300 ${
                                  step.done
                                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg scale-110'
                                    : 'bg-white border-2 border-gray-300 text-gray-400'
                                }`}>
                                  {step.done ? '✓' : icon}
                                </div>
                                
                                {/* Label */}
                                <div className="mt-3 text-center">
                                  <p className={`text-xs font-bold whitespace-nowrap ${
                                    step.done ? 'text-green-700' : 'text-gray-500'
                                  }`}>
                                    {label}
                                  </p>
                                  {step.date && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {new Date(step.date).toLocaleDateString('ar-EG', { 
                                        day: '2-digit', 
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* History */}
                  {trackingModal.data.history && trackingModal.data.history.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-3">📜 سجل التحديثات</h3>
                      <div className="space-y-2">
                        {trackingModal.data.history.map((event, index) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-gray-900">{event.title}</h4>
                              <span className="text-xs text-gray-500">
                                {new Date(event.date).toLocaleString('ar-EG')}
                              </span>
                            </div>
                            {event.subs && event.subs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {event.subs.map((sub, subIndex) => (
                                  <div key={subIndex} className="text-sm text-gray-600 flex items-center justify-between">
                                    <span>{sub.title}</span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(sub.date).toLocaleString('ar-EG')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delivery Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Receiver */}
                    {trackingModal.data.receiver && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-blue-900 mb-2">👤 المستلم</h3>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            <span className="font-semibold">الاسم:</span> {trackingModal.data.receiver.fullName}
                          </p>
                          <p className="text-gray-700">
                            <span className="font-semibold">الهاتف:</span> {trackingModal.data.receiver.phone}
                          </p>
                          {trackingModal.data.receiver.email && (
                            <p className="text-gray-700">
                              <span className="font-semibold">البريد:</span> {trackingModal.data.receiver.email}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* COD & Fees */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-green-900 mb-2">💰 التفاصيل المالية</h3>
                      <div className="space-y-1 text-sm">
                        {trackingModal.data.cod !== undefined && (
                          <p className="text-gray-700">
                            <span className="font-semibold">المبلغ المستحق:</span> {trackingModal.data.cod} ج.م
                          </p>
                        )}
                        {trackingModal.data.shipmentFees !== undefined && (
                          <p className="text-gray-700">
                            <span className="font-semibold">رسوم الشحن:</span> {trackingModal.data.shipmentFees.toFixed(2)} ج.م
                          </p>
                        )}
                        {trackingModal.data.businessReference && (
                          <p className="text-gray-700">
                            <span className="font-semibold">المرجع:</span> {trackingModal.data.businessReference}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drop-off Address */}
                  {trackingModal.data.dropOffAddress && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-orange-900 mb-2">📍 عنوان التسليم</h3>
                      <div className="text-sm text-gray-700 space-y-1">
                        {trackingModal.data.dropOffAddress.city?.name && (
                          <p><span className="font-semibold">المحافظة:</span> {trackingModal.data.dropOffAddress.city.name}</p>
                        )}
                        {trackingModal.data.dropOffAddress.zone?.name && (
                          <p><span className="font-semibold">المنطقة:</span> {trackingModal.data.dropOffAddress.zone.name}</p>
                        )}
                        {trackingModal.data.dropOffAddress.district && (
                          <p><span className="font-semibold">الحي:</span> {trackingModal.data.dropOffAddress.district.nameAr || trackingModal.data.dropOffAddress.district.name || trackingModal.data.dropOffAddress.district}</p>
                        )}
                        {trackingModal.data.dropOffAddress.firstLine && (
                          <p>{trackingModal.data.dropOffAddress.firstLine}</p>
                        )}
                        {trackingModal.data.dropOffAddress.secondLine && (
                          <p>{trackingModal.data.dropOffAddress.secondLine}</p>
                        )}
                        {trackingModal.data.dropOffAddress.buildingNumber && (
                          <p><span className="font-semibold">رقم المبنى:</span> {trackingModal.data.dropOffAddress.buildingNumber}</p>
                        )}
                        {trackingModal.data.dropOffAddress.floor && (
                          <p><span className="font-semibold">الطابق:</span> {trackingModal.data.dropOffAddress.floor}</p>
                        )}
                        {trackingModal.data.dropOffAddress.apartment && (
                          <p><span className="font-semibold">الشقة:</span> {trackingModal.data.dropOffAddress.apartment}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {trackingModal.data.notes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-yellow-900 mb-2">📝 ملاحظات</h3>
                      <p className="text-sm text-gray-700">{trackingModal.data.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-red-600 font-bold">❌ فشل تحميل التفاصيل</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-4 rounded-b-xl">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => window.open(getBostaTrackingUrl(trackingModal.trackingNumber), '_blank')}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 rounded-lg font-bold transition-all"
                >
                  🌐 فتح في Bosta
                </button>
                <button
                  onClick={() => setTrackingModal(null)}
                  className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-all"
                >
                  إغلاق
                </button>
              </div>
              
              {/* Sync Status Button */}
              {activeTab === 'system' && selectedOrder && trackingModal.data && (
                <button
                  onClick={async () => {
                    await syncOrderStatusFromBosta(selectedOrder);
                    setTrackingModal(null);
                  }}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 
                    text-white px-2 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg
                    flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>تحديث حالة الطلب من Bosta</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded-lg text-white z-[70] shadow-xl max-w-md whitespace-pre-line ${
            toast.type === "error" ? "bg-red-500" : 
            toast.type === "info" ? "bg-blue-500" : 
            "bg-green-500"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">
              {toast.type === "error" ? "❌" : toast.type === "info" ? "ℹ️" : "✅"}
            </span>
            <p className="flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="text-white hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 🔥 Wrapper مع Suspense boundary
export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">جاري تحميل الطلبات...</p>
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
