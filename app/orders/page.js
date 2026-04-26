"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import usePOSStore from "@/app/stores/pos-store";
import OrderDetailsModal from "@/components/OrderDetailsModal";
import { BostaAPI } from "@/app/lib/bosta-api";
import { getBostaSettings, validateInvoiceForBosta, formatBostaStatus, getBostaTrackingUrl, isOrderDelayed, getOrdersDeliveredToday, getOrdersDeliveredYesterday } from "@/app/lib/bosta-helpers";
import localforage from 'localforage';
import { invoiceStorage } from '@/app/lib/localforage';

const STATUS_OPTIONS = [
  { value: "pending", label: "ترك الدفع", color: "bg-gray-400" },
  { value: "on-hold", label: "معلق - انتظار", color: "bg-yellow-500" },
  { value: "processing", label: "قيد التجهيز", color: "bg-blue-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "cancelled", label: "ملغى", color: "bg-gray-500" },
  { value: "refunded", label: "تم الاسترجاع", color: "bg-purple-500" },
  { value: "failed", label: "فشل", color: "bg-red-500" },
];

// 🎛️ Feature Flags - التحكم في الميزات
const FEATURES = {
  ENABLE_BOSTA_UNLINK: false, // إزالة الربط ببوسطة | غير إلى false لتعطيل الميزة
  ENABLE_BOSTA_MANUAL_LINK: false, // ربط يدوي ببوسطة (إدخال رقم تتبع يدويًا)
};

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
  const [searchInput, setSearchInput] = useState(""); // 🆕 Input منفصل عن البحث الفعلي
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState(null);
  
  // 🆕 Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // 🆕 Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false); // 🔥 NEW
  const [loadingMore, setLoadingMore] = useState(false); // 🔥 NEW
  const perPage = 100;
  
  // 🆕 Tabs State - تقسيم الطلبات
  const [activeTab, setActiveTab] = useState('website'); // 'website' | 'system' | 'notes'
  const [posInvoices, setPosInvoices] = useState([]);
  
  // 🆕 Standalone Notes State - ملاحظات مستقلة
  const [standaloneNotes, setStandaloneNotes] = useState([]);
  const [editingStandaloneNote, setEditingStandaloneNote] = useState(null);
  const [newNoteForm, setNewNoteForm] = useState({
    title: '',
    content: '',
    type: 'general', // general, return, exchange, modify, other
    status: 'pending', // pending, resolved
    priority: 'normal' // low, normal, high
  });
  const [showNoteForm, setShowNoteForm] = useState(false);
  
  // 🆕 Bosta State
  const [bostaEnabled, setBostaEnabled] = useState(false);
  const [sendingToBosta, setSendingToBosta] = useState(null); // ID of order being sent
  
  // 🆕 Tracking Modal State
  const [trackingModal, setTrackingModal] = useState(null); // { trackingNumber, data, loading }
  
  // 🆕 Editing State for POS Orders
  const [editingInvoice, setEditingInvoice] = useState(null); // { orderStatus, paymentStatus }
  
  // 🆕 Notes State - ملاحظات الطلبات
  const [orderNotes, setOrderNotes] = useState({}); // { orderId: note }
  const [editingNote, setEditingNote] = useState(null); // orderId being edited
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // 🆕 View Mode State (Table or Grid) - Grid is default, saved in localStorage
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orders-view-mode') || 'grid';
    }
    return 'grid';
  });
  
  // 🆕 Refresh counter for forcing re-render
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefresh = () => setRefreshKey(prev => prev + 1);
  
  // 🆕 State للطباعة المجمّعة للأوردرات غير المبعوتة لبوسطة
  const [printingNonBosta, setPrintingNonBosta] = useState(false);
  
  // 🔥 Bulk Selection State
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [registeringBulk, setRegisteringBulk] = useState(false);
  
  // 🆕 Sync Progress State
  const [syncProgress, setSyncProgress] = useState(null); // { current: 0, total: 0 }
  
  // 🆕 Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 🆕 حفظ viewMode في localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orders-view-mode', viewMode);
    }
  }, [viewMode]);

  // 🆕 قراءة search من URL أول مرة وجلب الطلب مباشرة
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
      // 🆕 جلب الطلبات مع search filter من الـ API مباشرة
      fetchOrders({ search: searchFromUrl, per_page: 50 });
    }
  }, [searchParams]);

  // 🆕 useEffect لتحميل الملاحظات عند فتح الطلب
  useEffect(() => {
    if (selectedOrder && !orderNotes[selectedOrder.id]) {
      loadOrderNote(selectedOrder.id);
    }
  }, [selectedOrder]);
  
  // 🆕 تحميل ملاحظات الطلبات المعروضة
  useEffect(() => {
    const loadAllNotes = async () => {
      const orderIds = [...orders.map(o => o.id), ...posInvoices.map(o => o.id)];
      for (const orderId of orderIds) {
        if (!orderNotes[orderId]) {
          await loadOrderNote(orderId);
        }
      }
    };
    
    if (orders.length > 0 || posInvoices.length > 0) {
      loadAllNotes();
    }
  }, [orders, posInvoices]);
  
  // 🆕 تحميل الملاحظات المستقلة - دائماً عند التحميل لعرض العدد الصحيح
  useEffect(() => {
    loadStandaloneNotes();
  }, []);
  
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
  
  // 🔥 Auto-refresh orders - معطّل حالياً
  useEffect(() => {
    // جلب الطلبات أول مرة
    loadOrders(1, false);
    
    // تحميل إعدادات Bosta
    loadBostaSettings();

    // تحديث تلقائي كل دقيقة - معطّل
    // const interval = setInterval(() => {
    //   if (document.visibilityState === 'visible') {
    //     loadOrders();
    //   }
    // }, 60000);

    // لو المستخدم رجع للصفحة، حدث فوراً - معطّل
    // const handleVisibilityChange = () => {
    //   if (document.visibilityState === 'visible') {
    //     loadOrders();
    //   }
    // };
    
    // document.addEventListener('visibilitychange', handleVisibilityChange);

    // return () => {
    //   clearInterval(interval);
    //   document.removeEventListener('visibilitychange', handleVisibilityChange);
    // };
  }, [fetchOrders]);
  
  // 🆕 دالة جلب الطلبات مع Pagination والفلاتر
  const loadOrders = async (page = currentPage, append = false) => {
    const filters = {
      per_page: perPage, // 100 طلب في كل مرة
      page: page,
      append: append, // 🔥 NEW: دعم append mode
    };
    
    // إضافة الفلاتر إذا كانت موجودة - الـ API هيفلترها
    if (statusFilter) filters.status = statusFilter;
    if (searchTerm) filters.search = searchTerm;
    
    // 🔥 FIX: تحويل التاريخ لـ ISO 8601 format كامل
    if (dateFrom) {
      // إضافة الوقت 00:00:00 لبداية اليوم
      filters.after = `${dateFrom}T00:00:00`;
    }
    if (dateTo) {
      // إضافة الوقت 23:59:59 لنهاية اليوم
      filters.before = `${dateTo}T23:59:59`;
    }
    
    // 🆕 فلاتر السعر
    if (minPrice) filters.min_total = minPrice;
    if (maxPrice) filters.max_total = maxPrice;
    
    const result = await fetchOrders(filters);
    
    // تحديث معلومات الـ pagination من الـ response
    if (result) {
      setTotalOrders(result.total || 0);
      setTotalPages(result.total_pages || 1);
      setHasMore(result.has_more || false);
    }
    
    return result;
  };
  
  // 🔥 دالة تحميل المزيد من الطلبات
  const loadMoreOrders = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    await loadOrders(nextPage, true); // append = true
    setCurrentPage(nextPage);
    setLoadingMore(false);
  };
  
  // 🔥 useEffect لمراقبة تغيير الفلاتر وإعادة التحميل
  useEffect(() => {
    // عند تغيير أي فلتر، ارجع للصفحة الأولى وأعد التحميل
    setCurrentPage(1);
    loadOrders(1, false);
  }, [statusFilter, searchTerm, dateFrom, dateTo, minPrice, maxPrice]);
  
  // 🆕 تحميل إعدادات Bosta
  const loadBostaSettings = async () => {
    const settings = await getBostaSettings();
    setBostaEnabled(settings.enabled && settings.apiKey);
  };
  
  // 🆕 دالة البحث عند الضغط على الزر
  const handleSearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };
  
  // 🆕 البحث عند الضغط على Enter
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // 🆕 حفظ ملاحظة طلب في meta_data
  const saveOrderNote = async (orderId, note) => {
    try {
      setSavingNote(true);
      
      // حفظ في meta_data عن طريق update order API
      const response = await fetch('/api/orders/update-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          metaData: {
            key: '_vendor_note',
            value: note
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }
      
      // تحديث الـ state
      setOrderNotes(prev => ({ ...prev, [orderId]: note }));
      setToast({ message: '✅ تم حفظ الملاحظة بنجاح', type: 'success' });
      setEditingNote(null);
      
    } catch (error) {
      console.error('Error saving note:', error);
      setToast({ message: '❌ فشل حفظ الملاحظة', type: 'error' });
    } finally {
      setSavingNote(false);
    }
  };
  
  // 🆕 تحميل ملاحظة من meta_data (من الطلب نفسه)
  const loadOrderNote = async (orderId) => {
    // الملاحظات محملة بالفعل مع الطلبات، مش محتاجين نعمل fetch
    const order = orders.find(o => o.id === orderId);
    if (order && order.meta_data) {
      const vendorNote = order.meta_data.find(m => m.key === '_vendor_note');
      if (vendorNote && vendorNote.value) {
        return vendorNote.value;
      }
    }
    return '';
  };
  
  // 🆕 فتح نافذة تعديل الملاحظة
  const openNoteEditor = async (orderId) => {
    const note = orderNotes[orderId] || await loadOrderNote(orderId);
    setNoteText(note);
    setEditingNote(orderId);
  };
  
  // 🆕 تحميل الملاحظات من meta_data عند تحميل الطلبات
  useEffect(() => {
    if (orders && orders.length > 0) {
      const notesMap = {};
      orders.forEach(order => {
        if (order.meta_data) {
          const vendorNote = order.meta_data.find(m => m.key === '_vendor_note');
          if (vendorNote && vendorNote.value) {
            notesMap[order.id] = vendorNote.value;
          }
        }
      });
      setOrderNotes(notesMap);
    }
  }, [orders.map(o => o.id).join(',')]);
  
  // 🆕 تحميل الملاحظات المستقلة
  const loadStandaloneNotes = async () => {
    try {
      const notesStore = localforage.createInstance({
        name: 'vendor-orders',
        storeName: 'standalone-notes'
      });
      
      const notes = await notesStore.getItem('notes') || [];
      setStandaloneNotes(notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Error loading standalone notes:', error);
    }
  };
  
  // 🆕 حفظ ملاحظة مستقلة
  const saveStandaloneNote = async () => {
    try {
      if (!newNoteForm.title.trim() || !newNoteForm.content.trim()) {
        setToast({ message: '⚠️ يرجى إدخال العنوان والمحتوى', type: 'error' });
        return;
      }
      
      const notesStore = localforage.createInstance({
        name: 'vendor-orders',
        storeName: 'standalone-notes'
      });
      
      const note = {
        id: editingStandaloneNote?.id || Date.now().toString(),
        ...newNoteForm,
        createdAt: editingStandaloneNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      let notes = await notesStore.getItem('notes') || [];
      
      if (editingStandaloneNote) {
        notes = notes.map(n => n.id === note.id ? note : n);
      } else {
        notes.unshift(note);
      }
      
      await notesStore.setItem('notes', notes);
      
      // 🔥 إعادة تحميل البيانات لضمان التزامن
      await loadStandaloneNotes();
      
      setNewNoteForm({
        title: '',
        content: '',
        type: 'general',
        status: 'pending',
        priority: 'normal'
      });
      setShowNoteForm(false);
      setEditingStandaloneNote(null);
      setToast({ message: '✅ تم حفظ الملاحظة بنجاح', type: 'success' });
    } catch (error) {
      console.error('Error saving standalone note:', error);
      setToast({ message: '❌ فشل حفظ الملاحظة', type: 'error' });
    }
  };
  
  // 🔥 Bulk register invoices
  const handleBulkRegisterInvoices = async () => {
    if (selectedOrders.length === 0) {
      setToast({ message: '⚠️ لم يتم تحديد أي طلبات', type: 'error' });
      return;
    }
    
    const confirmed = confirm(`هل تريد تسجيل ${selectedOrders.length} طلب كفواتير؟`);
    if (!confirmed) return;
    
    setRegisteringBulk(true);
    let successCount = 0;
    let failCount = 0;
    let alreadyRegisteredCount = 0;
    
    try {
      const existingInvoices = await invoiceStorage.getAllInvoices();
      
      for (const orderId of selectedOrders) {
        const order = orders.find(o => o.id === orderId);
        if (!order) continue;
        
        // Check if already registered
        const alreadyRegistered = existingInvoices.some(inv => inv.orderId === order.id);
        if (alreadyRegistered) {
          alreadyRegisteredCount++;
          continue;
        }
        
        try {
          // Create invoice from order
          const invoiceItems = order.line_items.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            totalPrice: parseFloat(item.price) * item.quantity,
            stock_quantity: null,
            wholesalePrice: null,
            profit: null
          }));

          const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const shippingFee = parseFloat(order.shipping_total || 0);
          const discountAmount = parseFloat(order.discount_total || 0);
          const orderTotal = parseFloat(order.total);
          
          // ✅ استخراج بيانات العنوان الكاملة
          const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
          const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping?.city || '';
          const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
          const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping?.state || '';
          
          // 🔥 قراءة الملاحظة من meta_data مباشرة (نفس طريقة loadOrderNote)
          const vendorNoteMeta = order.meta_data?.find(m => m.key === '_vendor_note');
          const vendorNote = vendorNoteMeta?.value || orderNotes[order.id] || '';
          
          // ✅ بناء العنوان الكامل للطباعة
          const fullAddress = [
            order.shipping?.address_1,
            order.shipping?.address_2,
            districtName,
            cityName
          ].filter(Boolean).join(' - ');
          
          const invoice = {
            id: `order-${order.id}-${Date.now()}`,
            orderId: order.id,
            date: order.date_created, // ✅ استخدام تاريخ الطلب الحقيقي
            items: invoiceItems,
            services: [],
            orderType: 'delivery',
            orderNotes: vendorNote,
            customerNote: order.customer_note || '',
            summary: {
              productsSubtotal: productsSubtotal,
              servicesTotal: 0,
              subtotal: productsSubtotal,
              discount: {
                type: 'fixed',
                value: discountAmount,
                amount: discountAmount
              },
              extraFee: 0,
              deliveryFee: shippingFee,
              total: orderTotal,
              totalProfit: 0,
              profitItemsCount: 0
            },
            profitDetails: [],
            paymentMethod: order.payment_method_title || 'غير محدد',
            paymentStatus: 'partial',
            customerInfo: {
              name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
              phone: order.billing?.phone || '',
              email: order.billing?.email || '',
              address: fullAddress // ✅ العنوان الكامل
            },
            deliveryPayment: {
              status: 'fully_paid_no_delivery',
              paidAmount: productsSubtotal - discountAmount,
              remainingAmount: shippingFee,
              note: 'تم الدفع في الستور (ثمن المنتجات فقط) - رسوم التوصيل للتحصيل'
            },
            delivery: {
              type: 'delivery',
              address: fullAddress, // ✅ العنوان الكامل
              customer: {
                name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
                phone: order.billing?.phone || order.shipping?.phone || '',
                email: order.billing?.email || '',
                address: {
                  cityId: cityId,
                  city: cityName,
                  districtId: districtId,
                  district: districtName,
                  street: order.shipping?.address_1 || '',
                  area: order.shipping?.address_2 || '',
                  building: '',
                  floor: '',
                  apartment: '',
                  landmark: ''
                }
              },
              fee: shippingFee,
              notes: ''
            },
            deliveryStatus: 'pending',
            synced: true,
            source: 'order'
          };

          await invoiceStorage.saveInvoice(invoice);
          successCount++;
        } catch (error) {
          console.error(`Error registering order ${order.id}:`, error);
          failCount++;
        }
      }
      
      // Show result
      let message = '';
      if (successCount > 0) message += `✅ تم تسجيل ${successCount} فاتورة`;
      if (alreadyRegisteredCount > 0) message += ` | ⚠️ ${alreadyRegisteredCount} مسجل مسبقاً`;
      if (failCount > 0) message += ` | ❌ ${failCount} فشل`;
      
      setToast({ 
        message: message || '✅ تمت العملية', 
        type: failCount === 0 ? 'success' : 'warning' 
      });
      
      // Clear selection
      setSelectedOrders([]);
    } catch (error) {
      console.error('Bulk register error:', error);
      setToast({ message: '❌ فشل تسجيل الفواتير', type: 'error' });
    } finally {
      setRegisteringBulk(false);
    }
  };
  
  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };
  
  // Select all orders
  const selectAllOrders = () => {
    const currentOrders = filteredOrders.map(o => o.id);
    setSelectedOrders(currentOrders);
  };
  
  // Deselect all orders
  const deselectAllOrders = () => {
    setSelectedOrders([]);
  };
  
  // 🔥 Bulk Print & Register
  const handleBulkPrintOrders = async () => {
    if (selectedOrders.length === 0) {
      setToast({ message: '⚠️ لم يتم تحديد أي طلبات', type: 'error' });
      return;
    }
    
    const confirmed = confirm(`هل تريد طباعة وتسجيل ${selectedOrders.length} طلب؟\n\nسيتم تسجيلهم كفواتير تلقائياً وفتح صفحات الطباعة.`);
    if (!confirmed) return;
    
    setRegisteringBulk(true);
    let successCount = 0;
    let failCount = 0;
    let alreadyRegisteredCount = 0;
    const invoiceIdsToShow = [];
    
    try {
      const existingInvoices = await invoiceStorage.getAllInvoices();
      
      for (const orderId of selectedOrders) {
        const order = orders.find(o => o.id === orderId);
        if (!order) continue;
        
        // Check if already registered
        const existingInvoice = existingInvoices.find(inv => inv.orderId === order.id);
        
        try {
          // Create invoice from order (same structure as handleBulkRegisterInvoices)
          const invoiceItems = order.line_items.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            totalPrice: parseFloat(item.price) * item.quantity,
            stock_quantity: null,
            wholesalePrice: null,
            profit: null
          }));

          const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const shippingFee = parseFloat(order.shipping_total || 0);
          const discountAmount = parseFloat(order.discount_total || 0);
          const orderTotal = parseFloat(order.total);
          
          // ✅ استخراج بيانات العنوان الكاملة
          const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
          const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping?.city || '';
          const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
          const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping?.state || '';
          
          // 🔥 قراءة الملاحظة من meta_data مباشرة (نفس طريقة loadOrderNote)
          const vendorNoteMeta = order.meta_data?.find(m => m.key === '_vendor_note');
          const vendorNote = vendorNoteMeta?.value || orderNotes[order.id] || '';
          
          // ✅ بناء العنوان الكامل للطباعة
          const fullAddress = [
            order.shipping?.address_1,
            order.shipping?.address_2,
            districtName,
            cityName
          ].filter(Boolean).join(' - ');
          
          // 🔥 ID ثابت بناءً على رقم الطلب فقط (بدون timestamp)
          const invoiceId = `order-${order.id}`;
          
          const invoice = {
            id: invoiceId,
            orderId: order.id,
            date: order.date_created, // ✅ استخدام تاريخ الطلب الحقيقي
            items: invoiceItems,
            services: [],
            orderType: 'delivery',
            orderNotes: vendorNote,
            customerNote: order.customer_note || '',
            summary: {
              productsSubtotal: productsSubtotal,
              servicesTotal: 0,
              subtotal: productsSubtotal,
              discount: {
                type: 'fixed',
                value: discountAmount,
                amount: discountAmount
              },
              extraFee: 0,
              deliveryFee: shippingFee,
              total: orderTotal,
              totalProfit: 0,
              profitItemsCount: 0
            },
            profitDetails: [],
            paymentMethod: order.payment_method_title || 'غير محدد',
            paymentStatus: 'partial',
            customerInfo: {
              name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
              phone: order.billing?.phone || '',
              email: order.billing?.email || '',
              address: fullAddress // ✅ العنوان الكامل
            },
            deliveryPayment: {
              status: 'fully_paid_no_delivery',
              paidAmount: productsSubtotal - discountAmount,
              remainingAmount: shippingFee,
              note: 'تم الدفع في الستور (ثمن المنتجات فقط) - رسوم التوصيل للتحصيل'
            },
            delivery: {
              type: 'delivery',
              address: fullAddress, // ✅ العنوان الكامل
              customer: {
                name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
                phone: order.billing?.phone || order.shipping?.phone || '',
                email: order.billing?.email || '',
                address: {
                  cityId: cityId,
                  city: cityName,
                  districtId: districtId,
                  district: districtName,
                  street: order.shipping?.address_1 || '',
                  area: order.shipping?.address_2 || '',
                  building: '',
                  floor: '',
                  apartment: '',
                  landmark: ''
                }
              },
              fee: shippingFee,
              notes: ''
            },
            deliveryStatus: 'pending',
            synced: true,
            source: 'order'
          };

          // 🔥 حفظ/تحديث الفاتورة
          await invoiceStorage.saveInvoice(invoice);
          
          if (existingInvoice) {
            alreadyRegisteredCount++;
            console.log(`🔄 تم تحديث فاتورة ${invoiceId} للطلب ${order.id}`);
          } else {
            successCount++;
            console.log(`✅ تم إنشاء فاتورة ${invoiceId} للطلب ${order.id}`);
          }
          
          if (existingInvoice) {
            alreadyRegisteredCount++;
            console.log(`🔄 تم تحديث فاتورة ${invoiceId} للطلب ${order.id}`);
          } else {
            successCount++;
            console.log(`✅ تم إنشاء فاتورة ${invoiceId} للطلب ${order.id}`);
          }
          
          invoiceIdsToShow.push(invoiceId);
        } catch (error) {
          console.error(`Error registering order ${order.id}:`, error);
          failCount++;
        }
      }
      
      // Show result
      let message = '';
      if (successCount > 0) message += `✅ تم تسجيل ${successCount} فاتورة جديدة`;
      if (alreadyRegisteredCount > 0) message += ` | 🔄 ${alreadyRegisteredCount} تم تحديثها`;
      if (failCount > 0) message += ` | ❌ ${failCount} فشل`;
      
      setToast({ 
        message: message + ' | 🖨️ جاري فتح صفحة الطباعة...', 
        type: failCount === 0 ? 'success' : 'warning' 
      });
      
      // Open ONE print page with all invoice IDs
      if (invoiceIdsToShow.length > 0) {
        setTimeout(() => {
          const idsParam = invoiceIdsToShow.join(',');
          window.open(`/pos/invoices/print?ids=${idsParam}`, '_blank');
        }, 500);
      }
      
      // Clear selection
      setSelectedOrders([]);
    } catch (error) {
      console.error('Bulk print & register error:', error);
      setToast({ message: '❌ فشل تسجيل الفواتير', type: 'error' });
    } finally {
      setRegisteringBulk(false);
    }
  };
  
  // 🆕 طباعة كل الأوردرات غير المبعوتة لبوسطة
  const handlePrintNonBostaOrders = async () => {
    // فلترة الأوردرات غير المبعوتة لبوسطة
    const nonBostaOrders = filteredOrders.filter(order => {
      // Check if order has bosta.sent = true
      if (order.bosta && order.bosta.sent === true) {
        return false;
      }
      // Check if order has _bosta_sent meta
      const bostaSentMeta = order.meta_data?.find(m => m.key === '_bosta_sent' || m.key === 'bosta_sent');
      if (bostaSentMeta && bostaSentMeta.value === 'yes') {
        return false;
      }
      return true;
    });
    
    if (nonBostaOrders.length === 0) {
      setToast({ message: '⚠️ لا يوجد طلبات غير مبعوتة لبوسطة', type: 'warning' });
      return;
    }
    
    const confirmed = confirm(`هل تريد طباعة وتسجيل ${nonBostaOrders.length} طلب غير مبعوت لبوسطة؟\n\nسيتم تسجيلهم كفواتير تلقائياً وفتح صفحة الطباعة.`);
    if (!confirmed) return;
    
    setPrintingNonBosta(true);
    let successCount = 0;
    let failCount = 0;
    let alreadyRegisteredCount = 0;
    const invoiceIdsToShow = [];
    
    try {
      const existingInvoices = await invoiceStorage.getAllInvoices();
      
      for (const order of nonBostaOrders) {
        // Check if already registered
        const existingInvoice = existingInvoices.find(inv => inv.orderId === order.id);
        
        try {
          // Create invoice from order (سواء جديد أو تحديث)
          const invoiceItems = order.line_items.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            totalPrice: parseFloat(item.price) * item.quantity,
            stock_quantity: null,
            wholesalePrice: null,
            profit: null
          }));

          const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const shippingFee = parseFloat(order.shipping_total || 0);
          const discountAmount = parseFloat(order.discount_total || 0);
          const orderTotal = parseFloat(order.total);
          
          const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
          const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping?.city || '';
          const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
          const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping?.state || '';
          
          // 🔥 قراءة الملاحظة من meta_data مباشرة (نفس طريقة loadOrderNote)
          const vendorNoteMeta = order.meta_data?.find(m => m.key === '_vendor_note');
          const vendorNote = vendorNoteMeta?.value || orderNotes[order.id] || '';
          
          const fullAddress = [
            order.shipping?.address_1,
            order.shipping?.address_2,
            districtName,
            cityName
          ].filter(Boolean).join(' - ');
          
          // 🔥 ID ثابت بناءً على رقم الطلب فقط (بدون timestamp)
          const invoiceId = `order-${order.id}`;
          
          const invoice = {
            id: invoiceId,
            orderId: order.id,
            date: order.date_created,
            items: invoiceItems,
            services: [],
            orderType: 'delivery',
            orderNotes: vendorNote,
            customerNote: order.customer_note || '',
            summary: {
              productsSubtotal: productsSubtotal,
              servicesTotal: 0,
              subtotal: productsSubtotal,
              discount: {
                type: 'fixed',
                value: discountAmount,
                amount: discountAmount
              },
              extraFee: 0,
              deliveryFee: shippingFee,
              total: orderTotal,
              totalProfit: 0,
              profitItemsCount: 0
            },
            profitDetails: [],
            paymentMethod: order.payment_method_title || 'غير محدد',
            paymentStatus: 'partial',
            customerInfo: {
              name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
              phone: order.billing?.phone || '',
              email: order.billing?.email || '',
              address: fullAddress
            },
            deliveryPayment: {
              status: 'fully_paid_no_delivery',
              paidAmount: productsSubtotal - discountAmount,
              remainingAmount: shippingFee,
              note: 'تم الدفع في الستور (ثمن المنتجات فقط) - رسوم التوصيل للتحصيل'
            },
            delivery: {
              type: 'delivery',
              address: fullAddress,
              customer: {
                name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
                phone: order.billing?.phone || order.shipping?.phone || '',
                email: order.billing?.email || '',
                address: {
                  cityId: cityId,
                  city: cityName,
                  districtId: districtId,
                  district: districtName,
                  street: order.shipping?.address_1 || '',
                  area: order.shipping?.address_2 || '',
                  building: '',
                  floor: '',
                  apartment: '',
                  landmark: ''
                }
              },
              fee: shippingFee,
              notes: ''
            },
            deliveryStatus: 'pending',
            synced: true,
            source: 'order'
          };

          // 🔥 حفظ/تحديث الفاتورة
          await invoiceStorage.saveInvoice(invoice);
          
          if (existingInvoice) {
            alreadyRegisteredCount++;
            console.log(`🔄 تم تحديث فاتورة ${invoiceId} للطلب ${order.id}`);
          } else {
            successCount++;
            console.log(`✅ تم إنشاء فاتورة ${invoiceId} للطلب ${order.id}`);
          }
          
          invoiceIdsToShow.push(invoiceId);
        } catch (error) {
          console.error(`Error registering order ${order.id}:`, error);
          failCount++;
        }
      }
      
      // Show result
      let message = '';
      if (successCount > 0) message += `✅ تم تسجيل ${successCount} فاتورة جديدة`;
      if (alreadyRegisteredCount > 0) message += ` | 🔄 ${alreadyRegisteredCount} تم تحديثها`;
      if (failCount > 0) message += ` | ❌ ${failCount} فشل`;
      
      setToast({ 
        message: message + ' | 🖨️ جاري فتح صفحة الطباعة...', 
        type: failCount === 0 ? 'success' : 'warning' 
      });
      
      // Open ONE print page with all invoice IDs
      if (invoiceIdsToShow.length > 0) {
        setTimeout(() => {
          const idsParam = invoiceIdsToShow.join(',');
          window.open(`/pos/invoices/print?ids=${idsParam}`, '_blank');
        }, 500);
      }
    } catch (error) {
      console.error('Print non-Bosta orders error:', error);
      setToast({ message: '❌ فشل تسجيل الفواتير', type: 'error' });
    } finally {
      setPrintingNonBosta(false);
    }
  };
  
  // 🆕 تقرير الطلبات المُرسلة لبوسطة اليوم
  const handleDailySalesReport = async () => {
    try {
      // استخدام الأوردرات المحددة أو كل الأوردرات
      const ordersToCheck = selectedOrders.length > 0 
        ? orders.filter(o => selectedOrders.includes(o.id))
        : orders;
      
      // جلب الأوردرات اللي مبعوتة لبوسطة اليوم فقط
      const sentToBosta = getOrdersDeliveredToday(ordersToCheck);
      
      if (sentToBosta.length === 0) {
        setToast({ 
          message: selectedOrders.length > 0 
            ? '⚠️ لا توجد طلبات مُرسلة لبوسطة اليوم من الطلبات المحددة' 
            : '⚠️ لا توجد طلبات مُرسلة لبوسطة اليوم',
          type: 'warning' 
        });
        return;
      }
      
      // تسجيل الأوردرات كفواتير (لو مش مسجلة)
      const invoiceIdsToShow = [];
      const existingInvoices = await invoiceStorage.getAllInvoices();
      
      for (const order of sentToBosta) {
        // Check if already registered
        let existingInvoice = existingInvoices.find(inv => inv.orderId === order.id);
        
        if (!existingInvoice) {
          // تسجيل الطلب كفاتورة
          const invoiceItems = order.line_items.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            totalPrice: parseFloat(item.price) * item.quantity,
            imageUrl: item.image_url || item.image?.src || '',
            stock_quantity: null,
            wholesalePrice: null,
            profit: null
          }));

          const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const shippingFee = parseFloat(order.shipping_total || 0);
          const discountAmount = parseFloat(order.discount_total || 0);
          const orderTotal = parseFloat(order.total);
          
          const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
          const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping?.city || '';
          const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
          const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping?.state || '';
          
          const vendorNoteMeta = order.meta_data?.find(m => m.key === '_vendor_note');
          const vendorNote = vendorNoteMeta?.value || orderNotes[order.id] || '';
          
          const fullAddress = [
            order.shipping?.address_1,
            order.shipping?.address_2,
            districtName,
            cityName
          ].filter(Boolean).join(' - ');
          
          const invoiceId = `order-${order.id}`;
          
          const invoice = {
            id: invoiceId,
            orderId: order.id,
            date: order.date_created,
            items: invoiceItems,
            services: [],
            orderType: 'delivery',
            orderNotes: vendorNote,
            customerNote: order.customer_note || '',
            summary: {
              productsSubtotal: productsSubtotal,
              servicesTotal: 0,
              subtotal: productsSubtotal,
              discount: {
                type: 'fixed',
                value: discountAmount,
                amount: discountAmount
              },
              extraFee: 0,
              deliveryFee: shippingFee,
              total: orderTotal,
              totalProfit: 0,
              profitItemsCount: 0
            },
            profitDetails: [],
            paymentMethod: order.payment_method_title || 'غير محدد',
            paymentStatus: 'partial',
            customerInfo: {
              name: `${order.billing.first_name} ${order.billing.last_name}`.trim() || 'عميل',
              phone: order.billing.phone || '',
              email: order.billing.email || ''
            },
            delivery: {
              customer: {
                name: `${order.shipping?.first_name || order.billing.first_name} ${order.shipping?.last_name || order.billing.last_name}`.trim(),
                phone: order.billing.phone || order.shipping?.phone || '',
                address: {
                  firstLine: order.shipping?.address_1 || '',
                  secondLine: order.shipping?.address_2 || '',
                  city: cityName,
                  cityId: cityId,
                  district: districtName,
                  districtId: districtId,
                  fullAddress: fullAddress
                }
              },
              fee: shippingFee
            },
            bosta: order.bosta || null
          };
          
          await invoiceStorage.saveInvoice(invoice);
          invoiceIdsToShow.push(invoice.id);
        } else {
          invoiceIdsToShow.push(existingInvoice.id);
        }
      }
      
      // فتح صفحة تقرير المبيعات اليومية
      if (invoiceIdsToShow.length > 0) {
        const idsParam = invoiceIdsToShow.join(',');
        window.open(`/pos/invoices/daily-sales-report?ids=${idsParam}`, '_blank');
      }
      
      setToast({ message: `✅ تقرير جاهز - ${sentToBosta.length} طلب مُرسل لبوسطة اليوم`, type: 'success' });
    } catch (error) {
      console.error('Daily sales report error:', error);
      setToast({ message: '❌ فشل إنشاء تقرير المبيعات', type: 'error' });
    }
  };
  
  // 🆕 تقرير الطلبات المُرسلة لبوسطة أمس
  const handleYesterdayReport = async () => {
    try {
      // استخدام الأوردرات المحددة أو كل الأوردرات
      const ordersToCheck = selectedOrders.length > 0 
        ? orders.filter(o => selectedOrders.includes(o.id))
        : orders;
      
      // جلب الأوردرات اللي مبعوتة لبوسطة أمس فقط
      const sentToBosta = getOrdersDeliveredYesterday(ordersToCheck);
      
      if (sentToBosta.length === 0) {
        setToast({ 
          message: selectedOrders.length > 0 
            ? '⚠️ لا توجد طلبات مُرسلة لبوسطة أمس من الطلبات المحددة' 
            : '⚠️ لا توجد طلبات مُرسلة لبوسطة أمس',
          type: 'warning' 
        });
        return;
      }
      
      // تسجيل الأوردرات كفواتير (لو مش مسجلة)
      const invoiceIdsToShow = [];
      const existingInvoices = await invoiceStorage.getAllInvoices();
      
      for (const order of sentToBosta) {
        // Check if already registered
        let existingInvoice = existingInvoices.find(inv => inv.orderId === order.id);
        
        if (!existingInvoice) {
          // تسجيل الطلب كفاتورة
          const invoiceItems = order.line_items.map(item => ({
            id: item.product_id || item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            totalPrice: parseFloat(item.price) * item.quantity,
            imageUrl: item.image_url || item.image?.src || '',
            stock_quantity: null,
            wholesalePrice: null,
            profit: null
          }));

          const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const shippingFee = parseFloat(order.shipping_total || 0);
          const discountAmount = parseFloat(order.discount_total || 0);
          const orderTotal = parseFloat(order.total);
          
          const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
          const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping?.city || '';
          const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
          const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping?.state || '';
          
          const vendorNoteMeta = order.meta_data?.find(m => m.key === '_vendor_note');
          const vendorNote = vendorNoteMeta?.value || orderNotes[order.id] || '';
          
          const fullAddress = [
            order.shipping?.address_1,
            order.shipping?.address_2,
            districtName,
            cityName
          ].filter(Boolean).join(' - ');
          
          const invoiceId = `order-${order.id}`;
          
          const invoice = {
            id: invoiceId,
            orderId: order.id,
            date: order.date_created,
            items: invoiceItems,
            services: [],
            orderType: 'delivery',
            orderNotes: vendorNote,
            customerNote: order.customer_note || '',
            summary: {
              productsSubtotal: productsSubtotal,
              servicesTotal: 0,
              subtotal: productsSubtotal,
              discount: {
                type: 'fixed',
                value: discountAmount,
                amount: discountAmount
              },
              extraFee: 0,
              deliveryFee: shippingFee,
              total: orderTotal,
              totalProfit: 0,
              profitItemsCount: 0
            },
            profitDetails: [],
            paymentMethod: order.payment_method_title || 'غير محدد',
            paymentStatus: 'partial',
            customerInfo: {
              name: `${order.billing.first_name} ${order.billing.last_name}`.trim() || 'عميل',
              phone: order.billing.phone || '',
              email: order.billing.email || ''
            },
            delivery: {
              customer: {
                name: `${order.shipping?.first_name || order.billing.first_name} ${order.shipping?.last_name || order.billing.last_name}`.trim(),
                phone: order.billing.phone || order.shipping?.phone || '',
                address: {
                  firstLine: order.shipping?.address_1 || '',
                  secondLine: order.shipping?.address_2 || '',
                  city: cityName,
                  cityId: cityId,
                  district: districtName,
                  districtId: districtId,
                  fullAddress: fullAddress
                }
              },
              fee: shippingFee
            },
            bosta: order.bosta || null
          };
          
          await invoiceStorage.saveInvoice(invoice);
          invoiceIdsToShow.push(invoice.id);
        } else {
          invoiceIdsToShow.push(existingInvoice.id);
        }
      }
      
      // فتح صفحة تقرير المبيعات
      if (invoiceIdsToShow.length > 0) {
        const idsParam = invoiceIdsToShow.join(',');
        window.open(`/pos/invoices/daily-sales-report?ids=${idsParam}`, '_blank');
      }
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setToast({ message: `✅ تقرير جاهز - ${sentToBosta.length} طلب مُرسل لبوسطة أمس (${yesterday.toLocaleDateString('ar-EG')})`, type: 'success' });
    } catch (error) {
      console.error('Yesterday report error:', error);
      setToast({ message: '❌ فشل إنشاء تقرير أمس', type: 'error' });
    }
  };
  
  // 🆕 حذف ملاحظة مستقلة
  const deleteStandaloneNote = async (noteId) => {
    try {
      const notesStore = localforage.createInstance({
        name: 'vendor-orders',
        storeName: 'standalone-notes'
      });
      
      let notes = await notesStore.getItem('notes') || [];
      notes = notes.filter(n => n.id !== noteId);
      
      await notesStore.setItem('notes', notes);
      
      // 🔥 إعادة تحميل البيانات لضمان التزامن
      await loadStandaloneNotes();
      
      setToast({ message: '✅ تم حذف الملاحظة', type: 'success' });
    } catch (error) {
      console.error('Error deleting note:', error);
      setToast({ message: '❌ فشل حذف الملاحظة', type: 'error' });
    }
  };
  
  // 🆕 تغيير حالة الملاحظة
  const toggleNoteStatus = async (noteId) => {
    try {
      const notesStore = localforage.createInstance({
        name: 'vendor-orders',
        storeName: 'standalone-notes'
      });
      
      let notes = await notesStore.getItem('notes') || [];
      notes = notes.map(n => {
        if (n.id === noteId) {
          return { ...n, status: n.status === 'pending' ? 'resolved' : 'pending', updatedAt: new Date().toISOString() };
        }
        return n;
      });
      
      await notesStore.setItem('notes', notes);
      
      // 🔥 إعادة تحميل البيانات لضمان التزامن
      await loadStandaloneNotes();
    } catch (error) {
      console.error('Error toggling note status:', error);
    }
  };
  
  // 🆕 إرسال طلب لبوسطة
  const sendToBosta = async (order) => {
    if (order.bosta?.sent) {
      setToast({ message: 'تم إرسال هذا الطلب لبوسطة مسبقاً', type: 'info' });
      return;
    }

    setSendingToBosta(order.id);
    
    try {
      // 🆕 تحديد نوع الطلب (للطلبات من الموقع)
      if (!order.orderType && order.meta_data) {
        const isPickup = order.meta_data.some(m => 
          (m.key === '_is_store_pickup' && m.value === 'yes') || 
          (m.key === '_delivery_type' && m.value === 'store_pickup')
        );
        order.orderType = isPickup ? 'pickup' : 'delivery';
        
        // بناء بيانات التوصيل من WooCommerce order
        if (!order.delivery && order.billing && order.shipping) {
        // استخراج البيانات من meta_data
        const cityId = order.meta_data?.find(m => m.key === '_shipping_city_id')?.value || '';
        const cityName = order.meta_data?.find(m => m.key === '_shipping_city_name')?.value || order.shipping.city || '';
        const districtId = order.meta_data?.find(m => m.key === '_shipping_district_id')?.value || '';
        const districtName = order.meta_data?.find(m => m.key === '_shipping_district_name')?.value || order.shipping.state || '';
        
        order.delivery = {
          customer: {
            name: `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim(),
            phone: order.billing.phone || order.shipping.phone || '',
            email: order.billing.email || '',
            address: {
              cityId: cityId,  // ✅ الأولوية للـ ID من meta_data
              city: cityName,  // اسم المدينة للعرض فقط
              districtId: districtId,  // ✅ الأولوية للـ ID من meta_data
              district: districtName,  // اسم المنطقة للعرض فقط
              street: order.shipping.address_1 || '',  // ✅ العنوان التفصيلي
              area: order.shipping.address_2 || '',
              building: '',
              floor: '',
              apartment: '',
              landmark: ''
            }
          },
          fee: parseFloat(order.shipping_total || 0)
        };
      }
        
        // بناء items من line_items
        if (!order.items && order.line_items) {
          order.items = order.line_items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price || 0)
          }));
        }
        
        // بناء summary
        if (!order.summary) {
          order.summary = {
            total: parseFloat(order.total || 0),
            subtotal: parseFloat(order.total || 0) - parseFloat(order.shipping_total || 0),
            shipping: parseFloat(order.shipping_total || 0)
          };
        }
        
        // 🔥 بناء deliveryPayment (مهم لحساب COD صح!)
        if (!order.deliveryPayment) {
          const paymentMethod = order.payment_method?.toLowerCase() || '';
          const isPaid = order.status === 'completed' || order.status === 'processing';
          
          if (paymentMethod === 'cod' || paymentMethod === 'cash_on_delivery') {
            // دفع عند الاستلام - COD كامل
            order.deliveryPayment = {
              status: 'cash_on_delivery',
              paidAmount: 0,
              remainingAmount: parseFloat(order.total || 0) - parseFloat(order.shipping_total || 0)
            };
          } else if (isPaid) {
            // مدفوع أونلاين - بدون توصيل
            order.deliveryPayment = {
              status: 'fully_paid_no_delivery',
              paidAmount: parseFloat(order.total || 0) - parseFloat(order.shipping_total || 0),
              remainingAmount: 0 // المبلغ المتبقي غير الشحن
            };
          } else {
            // حالة افتراضية
            order.deliveryPayment = {
              status: 'cash_on_delivery',
              paidAmount: 0,
              remainingAmount: parseFloat(order.total || 0) - parseFloat(order.shipping_total || 0)
            };
          }
          
          console.log('💰 Built deliveryPayment for WooCommerce order:', order.deliveryPayment);
        }
      }
      
      // 1. التحقق من صحة البيانات
      const validation = validateInvoiceForBosta(order);
      if (!validation.valid) {
        console.error('❌ Validation errors:', validation.errors);
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

      // 5. حفظ في WooCommerce (لو كان طلب من الموقع)
      if (typeof order.id === 'number') {
        try {
          const response = await fetch('/api/orders/update-bosta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              bostaData: order.bosta
            })
          });

          if (!response.ok) {
            console.error('Failed to update WooCommerce order with Bosta data');
          }
        } catch (error) {
          console.error('Error updating WooCommerce:', error);
        }
      }

      // 6. حفظ الفاتورة المحدثة في LocalForage (لو كانت من الكاشير)
      if (typeof order.id !== 'number') {
        const allInvoices = await localforage.getItem('invoices') || [];
        const index = allInvoices.findIndex(inv => inv.id === order.id);
        if (index !== -1) {
          allInvoices[index] = order;
          await localforage.setItem('invoices', allInvoices);
          
          // تحديث POS invoices state
          setPosInvoices(prev => 
            prev.map(o => o.id === order.id ? order : o)
          );
        }
      }

      // 7. تحديث الطلبات في الـ state مباشرة (لكل الطلبات - موقع وكاشير)
      const currentOrders = usePOSStore.getState().orders;
      const updatedOrders = currentOrders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            bosta: order.bosta,
            meta_data: [
              ...(o.meta_data || []).filter(m => !m.key?.startsWith('_bosta')),
              { key: '_bosta_sent', value: 'yes' },
              { key: '_bosta_tracking_number', value: order.bosta.trackingNumber }
            ]
          };
        }
        return o;
      });
      
      // Force update with new array reference
      usePOSStore.setState({ orders: [...updatedOrders] });
      
      // Force component re-render
      forceRefresh();

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
        
        // 🆕 استخراج التاريخ الفعلي من timeline بوسطة
        let actualPickedUpAt = null;
        let actualDeliveredAt = null;
        
        // 🔥 Bosta بترجع timeline مش trackingHistory
        const timelineData = result.data.timeline || result.data.trackingHistory;
        
        if (timelineData && Array.isArray(timelineData)) {
          console.log(`📋 Timeline data:`, timelineData);
          
          // البحث عن تاريخ الاستلام من المخزن (Picked Up)
          const pickedUpEvent = timelineData.find(event => {
            const value = (event.value || event.state?.value || '').toLowerCase();
            return value.includes('picked_up') || 
                   value.includes('picked up') ||
                   value.includes('picked') ||
                   event.code === 21; // Bosta code for picked_up
          });
          
          if (pickedUpEvent) {
            actualPickedUpAt = pickedUpEvent.date || pickedUpEvent.timestamp;
            console.log(`✅ Found picked up event:`, {
              value: pickedUpEvent.value,
              date: actualPickedUpAt
            });
          }
          
          // البحث عن تاريخ التسليم للعميل (Delivered)
          const deliveredEvent = timelineData.find(event => {
            const value = (event.value || event.state?.value || '').toLowerCase();
            return value.includes('delivered') || event.code === 45;
          });
          
          if (deliveredEvent) {
            actualDeliveredAt = deliveredEvent.date || deliveredEvent.timestamp;
          }
        }
        
        // 🆕 Fallback: استخدام state.receivedAtWarehouse.time لو مفيش timeline
        if (!actualPickedUpAt && result.data.state?.receivedAtWarehouse?.time) {
          actualPickedUpAt = result.data.state.receivedAtWarehouse.time;
          console.log(`✅ Using receivedAtWarehouse.time as fallback:`, actualPickedUpAt);
        }
        
        if (!actualDeliveredAt && result.data.state?.deliveryTime) {
          actualDeliveredAt = result.data.state.deliveryTime;
          console.log(`✅ Using state.deliveryTime as fallback:`, actualDeliveredAt);
        }
        
        // تحديث بيانات الفاتورة
        const updateData = {
          deliveryStatus,
          bosta: {
            ...invoice.bosta,
            status: result.data.state?.value,
            statusCode: result.data.state?.code,
            lastUpdated: new Date().toISOString()
          }
        };
        
        // 🆕 حفظ pickedUpAt لو موجود (من timeline أو receivedAtWarehouse)
        if (actualPickedUpAt) {
          updateData.bosta.pickedUp = true;
          updateData.bosta.pickedUpAt = actualPickedUpAt;
        }
        
        // 🆕 حفظ deliveredAt لو موجود (من timeline أو deliveryTime)
        if (actualDeliveredAt) {
          updateData.bosta.deliveredAt = actualDeliveredAt;
        }
        
        // Update invoice
        await updatePOSInvoice(invoice.id, updateData);
        
        setToast({ message: '✅ تم مزامنة حالة الطلب', type: 'success' });
      }
    } catch (error) {
      console.error('Sync Error:', error);
      setToast({ message: 'فشل المزامنة: ' + error.message, type: 'error' });
    }
  };

  // 🔥 مزامنة شاملة لكل الأوردرات
  const syncAllOrdersFromBosta = async () => {
    try {
      const settings = await getBostaSettings();
      if (!settings.enabled || !settings.apiKey) {
        setToast({ message: 'يجب تفعيل Bosta من صفحة الإعدادات', type: 'error' });
        return;
      }

      const bostaAPI = new BostaAPI(settings.apiKey, settings.businessLocationId);
      
      // جمع كل الأوردرات اللي ليها tracking number
      const ordersToSync = orders.filter(order => {
        // Website orders with tracking
        const hasBostaMeta = order.meta_data?.some(m => 
          m.key === '_bosta_tracking_number' && m.value
        );
        // System orders with tracking
        const hasBostaTracking = order.bosta?.trackingNumber;
        
        return hasBostaMeta || hasBostaTracking;
      });

      if (ordersToSync.length === 0) {
        setToast({ message: '⚠️ لا توجد أوردرات للمزامنة', type: 'warning' });
        return;
      }

      // 🔥 Initialize progress
      setSyncProgress({ current: 0, total: ordersToSync.length });

      let syncedCount = 0;
      let deliveredCount = 0;
      let pickedUpCount = 0;
      let failedCount = 0;

      for (let i = 0; i < ordersToSync.length; i++) {
        const order = ordersToSync[i];
        
        try {
          // 🔥 Update progress
          setSyncProgress({ current: i + 1, total: ordersToSync.length });
          
          // الحصول على tracking number
          let trackingNumber;
          if (order.bosta?.trackingNumber) {
            trackingNumber = order.bosta.trackingNumber;
          } else {
            const meta = order.meta_data?.find(m => m.key === '_bosta_tracking_number');
            trackingNumber = meta?.value;
          }

          if (!trackingNumber) continue;

          // جلب حالة الشحنة من بوسطة
          const result = await bostaAPI.getTrackingDetails(trackingNumber);
          
          if (!result.data) {
            // 🔥 لو الشحنة مش موجودة في بوسطة (اتمسحت) - احذف بيانات بوسطة
            if (result.error?.status === 404 || result.error?.message?.includes('not found')) {
              if (typeof order.id === 'number') {
                await fetch('/api/orders/update-bosta', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: order.id,
                    clearBosta: true
                  })
                });
              }
            }
            failedCount++;
            continue;
          }

          const bostaStatus = result.data.state?.value?.toLowerCase() || '';
          const bostaStatusLabel = result.data.state?.value || ''; // 🔥 للحفظ في meta
          
          // 🔍 Debug: شوف إيه اللي راجع من بوسطة
          console.log(`🔍 Bosta Response for Order #${order.id}:`, {
            hasTrackingHistory: !!result.data.trackingHistory,
            trackingHistoryLength: result.data.trackingHistory?.length || 0,
            state: result.data.state,
            fullData: result.data
          });
          
          // 🆕 استخراج التاريخ الفعلي من timeline بوسطة
          let actualPickedUpAt = null;
          let actualDeliveredAt = null;
          
          // 🔥 Bosta بترجع timeline مش trackingHistory
          const timelineData = result.data.timeline || result.data.trackingHistory;
          
          if (timelineData && Array.isArray(timelineData)) {
            console.log(`📋 Timeline for Order #${order.id}:`, timelineData);
            
            // 🔍 طباعة تفصيلية لكل event
            timelineData.forEach((event, index) => {
              console.log(`  Timeline ${index + 1}:`, {
                value: event.value || event.state?.value,
                code: event.code,
                date: event.date || event.timestamp,
                done: event.done
              });
            });
            
            // البحث عن تاريخ الاستلام من المخزن (Picked Up)
            const pickedUpEvent = timelineData.find(event => {
              const value = (event.value || event.state?.value || '').toLowerCase();
              return value.includes('picked_up') || 
                     value.includes('picked up') ||
                     value.includes('picked') ||
                     event.code === 21; // Bosta code for picked_up
            });
            
            if (pickedUpEvent) {
              actualPickedUpAt = pickedUpEvent.date || pickedUpEvent.timestamp;
              console.log(`✅ Found picked up date from timeline:`, {
                value: pickedUpEvent.value || pickedUpEvent.state?.value,
                date: actualPickedUpAt,
                code: pickedUpEvent.code
              });
            } else {
              console.log(`⚠️ No picked up event found in timeline`);
            }
            
            // البحث عن تاريخ التسليم للعميل (Delivered)
            const deliveredEvent = timelineData.find(event => {
              const value = (event.value || event.state?.value || '').toLowerCase();
              return value.includes('delivered') || event.code === 45; // Bosta code for delivered
            });
            
            if (deliveredEvent) {
              actualDeliveredAt = deliveredEvent.date || deliveredEvent.timestamp;
              console.log(`✅ Found delivered date from timeline:`, {
                value: deliveredEvent.value || deliveredEvent.state?.value,
                date: actualDeliveredAt
              });
            }
          } else {
            console.log(`⚠️ No timeline data for Order #${order.id}`);
          }
          
          // 🆕 Fallback: استخدام state.receivedAtWarehouse.time لو مفيش timeline
          if (!actualPickedUpAt && result.data.state?.receivedAtWarehouse?.time) {
            actualPickedUpAt = result.data.state.receivedAtWarehouse.time;
            console.log(`✅ Using receivedAtWarehouse.time as fallback for Order #${order.id}:`, actualPickedUpAt);
          }
          
          if (!actualDeliveredAt && result.data.state?.deliveryTime) {
            actualDeliveredAt = result.data.state.deliveryTime;
            console.log(`✅ Using state.deliveryTime as fallback for Order #${order.id}:`, actualDeliveredAt);
          }
          
          console.log(`📦 Order #${order.id} - Final Timeline data:`, {
            status: bostaStatusLabel,
            actualPickedUpAt,
            actualDeliveredAt
          });
          
          // تحديث حسب الحالة
          if (bostaStatus.includes('delivered')) {
            // تم التوصيل → تغيير الحالة لـ completed
            deliveredCount++;
            
            if (typeof order.id === 'number') {
              // Website order - update via API
              await fetch(`/api/orders/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: order.id,
                  status: 'completed'
                })
              });
              
              // حفظ تاريخ التسليم في meta_data
              await fetch('/api/orders/update-bosta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: order.id,
                  bostaData: {
                    sent: true,
                    trackingNumber: trackingNumber,
                    orderId: result.data._id,
                    status: bostaStatusLabel,
                    statusCode: result.data.state?.code,
                    deliveredAt: actualDeliveredAt, // ✅ بس التاريخ الحقيقي من timeline
                    lastUpdated: new Date().toISOString()
                  }
                })
              });
              
              // Update local state
              await updateOrderStatus(order.id, 'completed');
            } else {
              // System order
              await updatePOSInvoice(order.id, {
                deliveryStatus: 'delivered',
                bosta: {
                  ...order.bosta,
                  status: bostaStatusLabel,
                  statusCode: result.data.state?.code,
                  deliveredAt: actualDeliveredAt, // ✅ بس التاريخ الحقيقي من timeline
                  lastUpdated: new Date().toISOString()
                }
              });
            }
          } else if (bostaStatus.includes('picked_up') || bostaStatus.includes('picked up')) {
            // تم الاستلام من بوسطة → حفظ meta data
            pickedUpCount++;
            
            if (typeof order.id === 'number') {
              // Website order - add meta data
              await fetch('/api/orders/update-bosta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: order.id,
                  bostaData: {
                    sent: true,
                    trackingNumber: trackingNumber,
                    orderId: result.data._id,
                    status: bostaStatusLabel, // 🔥 حفظ النص الكامل
                    statusCode: result.data.state?.code,
                    pickedUp: true,
                    pickedUpAt: actualPickedUpAt, // ✅ بس التاريخ الحقيقي من timeline
                    lastUpdated: new Date().toISOString()
                  }
                })
              });
            } else {
              // System order
              await updatePOSInvoice(order.id, {
                deliveryStatus: 'picked_up',
                bosta: {
                  ...order.bosta,
                  status: bostaStatusLabel,
                  statusCode: result.data.state?.code,
                  pickedUp: true,
                  pickedUpAt: actualPickedUpAt, // ✅ بس التاريخ الحقيقي من timeline
                  lastUpdated: new Date().toISOString()
                }
              });
            }
          } else {
            // أي حالة أخرى (in_transit, out_for_delivery, etc)
            // حفظ الحالة + timestamps لو موجودين
            if (typeof order.id === 'number') {
              const bostaData = {
                sent: true,
                trackingNumber: trackingNumber,
                orderId: result.data._id,
                status: bostaStatusLabel, // 🔥 حفظ آخر حالة
                statusCode: result.data.state?.code,
                lastUpdated: new Date().toISOString()
              };
              
              // 🆕 حفظ pickedUpAt لو موجود (من timeline أو receivedAtWarehouse)
              if (actualPickedUpAt) {
                bostaData.pickedUp = true;
                bostaData.pickedUpAt = actualPickedUpAt;
              }
              
              // 🆕 حفظ deliveredAt لو موجود
              if (actualDeliveredAt) {
                bostaData.deliveredAt = actualDeliveredAt;
              }
              
              await fetch('/api/orders/update-bosta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: order.id,
                  bostaData
                })
              });
            } else {
              // System order
              const bostaUpdate = {
                ...order.bosta,
                status: bostaStatusLabel,
                statusCode: result.data.state?.code,
                lastUpdated: new Date().toISOString()
              };
              
              // 🆕 حفظ pickedUpAt لو موجود
              if (actualPickedUpAt) {
                bostaUpdate.pickedUp = true;
                bostaUpdate.pickedUpAt = actualPickedUpAt;
              }
              
              // 🆕 حفظ deliveredAt لو موجود
              if (actualDeliveredAt) {
                bostaUpdate.deliveredAt = actualDeliveredAt;
              }
              
              await updatePOSInvoice(order.id, {
                bosta: bostaUpdate
              });
            }
          }
          
          syncedCount++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Error syncing order ${order.id}:`, error);
          failedCount++;
        }
      }

      // 🔥 Clear progress
      setSyncProgress(null);

      // مش محتاجين reload - الـ local state اتحدث بالفعل من updateOrderStatus
      // الأوردرات اللي بقت completed هتختفي من الفلتر تلقائياً

      // رسالة النتيجة
      let message = `✅ تمت المزامنة: ${syncedCount} طلب`;
      if (deliveredCount > 0) message += ` | 🎉 ${deliveredCount} تم توصيلهم`;
      if (pickedUpCount > 0) message += ` | ✅ ${pickedUpCount} تم استلامهم`;
      if (failedCount > 0) message += ` | ❌ ${failedCount} فشل`;
      
      setToast({ message, type: 'success' });
      
    } catch (error) {
      console.error('Bulk Sync Error:', error);
      setSyncProgress(null);
      setToast({ message: '❌ فشل المزامنة: ' + error.message, type: 'error' });
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
      setTimeout(() => loadOrders(), 1000);

    } catch (error) {
      console.error('Bosta Send Error:', error);
      setToast({ message: 'حدث خطأ: ' + error.message, type: 'error' });
    } finally {
      setSendingToBosta(null);
    }
  };

  const linkToBostaManually = async (order) => {
    try {
      const existingTracking = order.bosta?.trackingNumber || order.meta_data?.find(m => m.key === '_bosta_tracking_number')?.value;
      if (existingTracking) {
        const shouldReplace = window.confirm(`هذا الطلب مربوط بالفعل ببوسطة برقم: ${existingTracking}\n\nهل تريد استبدال الرقم يدويًا؟`);
        if (!shouldReplace) return;
      }

      const input = window.prompt('اكتب رقم تتبع بوسطة يدويًا:', existingTracking || '');
      if (input === null) return;

      const trackingNumber = input.trim();
      if (!trackingNumber) {
        setToast({ message: '⚠️ رقم التتبع مطلوب', type: 'error' });
        return;
      }

      const nowIso = new Date().toISOString();
      const manualBostaData = {
        sent: true,
        trackingNumber,
        orderId: order.bosta?.orderId || `manual-${trackingNumber}`,
        status: 'manually_linked',
        statusCode: 10,
        sentAt: order.bosta?.sentAt || nowIso,
        lastUpdated: nowIso,
        manualLinked: true
      };

      if (typeof order.id === 'number') {
        const response = await fetch('/api/orders/update-bosta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, bostaData: manualBostaData })
        });

        if (!response.ok) {
          throw new Error('فشل حفظ الربط اليدوي في الطلب');
        }
      } else {
        await updatePOSInvoice(order.id, {
          bosta: manualBostaData,
          deliveryStatus: order.deliveryStatus || 'pending'
        });
      }

      const updatedOrders = usePOSStore.getState().orders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            bosta: manualBostaData,
            meta_data: [
              ...(o.meta_data || []).filter(m => !['_bosta_sent','_bosta_tracking_number','_bosta_order_id','_bosta_status','_bosta_status_code','_bosta_sent_at','_bosta_last_updated'].includes(m.key)),
              { key: '_bosta_sent', value: 'yes' },
              { key: '_bosta_tracking_number', value: trackingNumber },
              { key: '_bosta_order_id', value: manualBostaData.orderId },
              { key: '_bosta_status', value: manualBostaData.status },
              { key: '_bosta_status_code', value: String(manualBostaData.statusCode) },
              { key: '_bosta_sent_at', value: manualBostaData.sentAt },
              { key: '_bosta_last_updated', value: manualBostaData.lastUpdated }
            ]
          };
        }
        return o;
      });

      usePOSStore.setState({ orders: [...updatedOrders] });
      setPosInvoices(prev => prev.map(o => o.id === order.id ? { ...o, bosta: manualBostaData } : o));
      forceRefresh();

      setToast({ message: `✅ تم ربط الطلب يدويًا مع بوسطة\nرقم التتبع: ${trackingNumber}`, type: 'success' });
    } catch (error) {
      console.error('Error linking to Bosta manually:', error);
      setToast({ message: '❌ فشل الربط اليدوي مع بوسطة', type: 'error' });
    }
  };

  const unlinkFromBosta = async (order) => {
    try {
      // تم حذف بيانات بوسطة للطلب
      if (typeof order.id === 'number') {
        const response = await fetch('/api/orders/update-bosta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, clearBosta: true })
        });

        if (!response.ok) {
          throw new Error('فشل حذف بيانات بوسطة من الـ API');
        }
      } else {
        await updatePOSInvoice(order.id, { bosta: null, deliveryStatus: 'pending' });
      }

      const updatedOrders = usePOSStore.getState().orders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            bosta: null,
            meta_data: (o.meta_data || []).filter(m => !['bosta_tracking_number','bosta_order_id','bosta_status','bosta_sent','_bosta_tracking_number','_bosta_status','_bosta_sent'].includes(m.key))
          };
        }
        return o;
      });
      usePOSStore.setState({ orders: updatedOrders });
      setPosInvoices(prev => prev.map(o => o.id === order.id ? { ...o, bosta: null, deliveryStatus: 'pending' } : o));

      setToast({ message: '✅ تم إزالة الربط مع بوسطة بنجاح', type: 'success' });
    } catch (error) {
      console.error('Error unlinking from Bosta:', error);
      setToast({ message: '❌ فشل إزالة الربط مع بوسطة', type: 'error' });
    }
  };

  const setBostaActive = async (order, isActive) => {
    try {
      if (typeof order.id === 'number') {
        const metaData = order.meta_data ? [...order.meta_data.filter(m => m.key !== '_bosta_active')] : [];
        metaData.push({ key: '_bosta_active', value: isActive ? 'true' : 'false' });

        const response = await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, meta_data: metaData })
        });

        if (!response.ok) {
          throw new Error('فشل تحديث حالة بوسطة');
        }
      } else {
        await updatePOSInvoice(order.id, {
          bosta: {
            ...order.bosta,
            active: isActive
          }
        });
      }

      const updatedOrders = usePOSStore.getState().orders.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            bosta: {
              ...o.bosta,
              active: isActive
            },
            meta_data: (o.meta_data || []).filter(m => m.key !== '_bosta_active').concat([{ key: '_bosta_active', value: isActive ? 'true' : 'false' }])
          };
        }
        return o;
      });
      usePOSStore.setState({ orders: updatedOrders });
      setPosInvoices(prev => prev.map(o => o.id === order.id ? { ...o, bosta: { ...o.bosta, active: isActive } } : o));

      setToast({ message: `✅ تم ${isActive ? 'تفعيل' : 'تعطيل'} بوسطة للطلب`, type: 'success' });
    } catch (error) {
      console.error('Error setting Bosta active:', error);
      setToast({ message: '❌ فشل تحديث حالة البوسطة', type: 'error' });
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      // Show loading toast
      setToast({ message: '⏳ جاري تحديث الحالة...', type: 'info' });

      // Send API request to update order status
      const response = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus })
      });

      if (!response.ok) {
        throw new Error('فشل تحديث حالة الطلب');
      }

      const result = await response.json();

      // ✅ تحديث الـ state مباشرة من الـ API response
      if (result.order) {
        // Update in Zustand store
        const currentOrders = usePOSStore.getState().orders;
        const updatedOrders = currentOrders.map(order =>
          order.id === orderId ? { ...order, status: result.order.status } : order
        );
        usePOSStore.setState({ orders: updatedOrders });
        forceRefresh();

        // Update selected order if open
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: result.order.status }));
        }
      }

      setToast({ message: '✅ تم تحديث حالة الطلب بنجاح', type: 'success' });
    } catch (error) {
      console.error('Error updating order status:', error);
      setToast({ message: '❌ فشل تحديث حالة الطلب', type: 'error' });
    }
  };

  const handleShippingUpdate = async (orderId, updatedOrder) => {
    if (!updatedOrder) return;

    const currentOrders = usePOSStore.getState().orders;
    const updatedOrders = currentOrders.map(order =>
      order.id === orderId
        ? {
            ...order,
            ...updatedOrder,
            shipping: {
              ...(order.shipping || {}),
              ...(updatedOrder.shipping || {}),
            },
            billing: {
              ...(order.billing || {}),
              ...(updatedOrder.billing || {}),
            },
            meta_data: updatedOrder.meta_data || order.meta_data,
          }
        : order
    );

    usePOSStore.setState({ orders: updatedOrders });
    forceRefresh();

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => ({
        ...prev,
        ...updatedOrder,
        shipping: {
          ...(prev?.shipping || {}),
          ...(updatedOrder.shipping || {}),
        },
        billing: {
          ...(prev?.billing || {}),
          ...(updatedOrder.billing || {}),
        },
        meta_data: updatedOrder.meta_data || prev?.meta_data,
      }));
    }
  };

  // 🆕 تحديث meta_data محليًا بعد الحفظ من المودال
  const handleOrderMetaUpdate = (orderId, metaUpdates = {}) => {
    if (!orderId || !metaUpdates || typeof metaUpdates !== 'object') return;

    const mergeMetaData = (existingMeta = []) => {
      const map = new Map((existingMeta || []).map((m) => [m.key, m.value]));

      Object.entries(metaUpdates).forEach(([key, value]) => {
        if (!key) return;
        if (value === '' || value === null || value === undefined) {
          map.delete(key);
        } else {
          map.set(key, value);
        }
      });

      return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
    };

    const currentOrders = usePOSStore.getState().orders;
    const updatedOrders = currentOrders.map((order) => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        meta_data: mergeMetaData(order.meta_data || []),
      };
    });

    usePOSStore.setState({ orders: updatedOrders });

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => ({
        ...prev,
        meta_data: mergeMetaData(prev?.meta_data || []),
      }));
    }

    forceRefresh();
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

  // 🆕 Filter orders based on active tab with useMemo for reactivity
  // 🔥 نستخدم orders مباشرة (الفلترة بتحصل في الـ API)
  const currentOrders = activeTab === 'website' ? orders : posInvoices;
  
  const filteredOrders = useMemo(() => {
    // للطلبات من الموقع - الـ API بيفلتر كل حاجة، مفيش حاجة نعملها هنا
    if (activeTab === 'website') {
      // ✅ الـ API بيفلتر: status, search, date, price
      // مش محتاجين فلترة محلية لأن ده بيخلي النتائج غير دقيقة
      return currentOrders;
    } 
    // للطلبات من السيستم (POS) - دي محلية فلازم نفلترها هنا
    else {
      return currentOrders.filter((order) => {
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
      });
    }
  }, [currentOrders, activeTab, searchTerm, dateFrom, dateTo, refreshKey]);

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
      
      {/* 🔥 Sync Progress Indicator */}
      {syncProgress && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100000000000] min-w-[300px]">
          <div className="text-center mb-2">
            <span className="text-lg font-bold">🔄 جاري المزامنة...</span>
          </div>
          <div className="text-center mb-3">
            <span className="text-2xl font-black">{syncProgress.current}</span>
            <span className="text-sm mx-2">/</span>
            <span className="text-lg">{syncProgress.total}</span>
          </div>
          <div className="w-full bg-purple-800 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-green-400 to-blue-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-center mt-2 text-xs opacity-90">
            {Math.round((syncProgress.current / syncProgress.total) * 100)}% مكتمل
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📦 الطلبات</h1>
        <p className="text-gray-500 mt-1">
          {(activeTab === 'website' ? ordersLoading : false) ? 'جاري التحميل...' : (
            <>
              {activeTab === 'website' ? (
                <>
                  {filteredOrders.length} طلب
                  {hasMore && <span className="text-blue-600 font-medium"> • يوجد المزيد</span>}
                  {(searchTerm || statusFilter || dateFrom || dateTo) && (
                    <span className="text-orange-600 font-medium"> (مفلتر)</span>
                  )}
                </>
              ) : (
                <>
                  {filteredOrders.length} {filteredOrders.length !== currentOrders.length && `من ${currentOrders.length}`} طلب
                  {(searchTerm || dateFrom || dateTo) && filteredOrders.length !== currentOrders.length && (
                    <span className="text-blue-600 font-medium"> (مفلتر)</span>
                  )}
                </>
              )}
            </>
          )}
        </p>
      </div>
      
      {/* 🆕 Tabs - تقسيم طلبات الموقع والسيستم والملاحظات */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('website')}
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all ${
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
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all ${
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
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all ${
              activeTab === 'notes'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            📝 ملاحظات
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'notes' ? 'bg-white text-purple-600' : 'bg-gray-200 text-gray-700'
            }`}>
              {standaloneNotes.filter(n => n.status === 'pending').length}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Filter - إخفاء في تاب الملاحظات */}
      {activeTab !== 'notes' && (
      <div className="mb-6 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col gap-4">
          {/* Search and Status Filter Row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder={activeTab === 'website' ? "🔍 ابحث بالرقم أو اسم العميل..." : "🔍 ابحث برقم الفاتورة أو اسم العميل أو رقم الهاتف..."}
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
              />
              <button
                onClick={handleSearch}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-md hover:shadow-lg whitespace-nowrap"
              >
                🔍 بحث
              </button>
            </div>
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
            
            {/* 🆕 Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2.5 rounded-lg transition-all font-medium whitespace-nowrap flex items-center gap-2 ${
                showAdvancedFilters 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>⚙️</span>
              <span>فلاتر متقدمة</span>
              <span className="text-xs">{showAdvancedFilters ? '▲' : '▼'}</span>
            </button>
            
            {(searchTerm || statusFilter || dateFrom || dateTo || minPrice || maxPrice) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSearchInput("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setMinPrice("");
                  setMaxPrice("");
                  router.push('/orders');
                  setCurrentPage(1);
                  loadOrders(1); // جلب جميع الطلبات من جديد
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium whitespace-nowrap"
              >
                🔄 مسح الفلاتر
              </button>
            )}
            
            {/* 🔥 Bosta Sync All Button */}
            {bostaEnabled && activeTab === 'website' && (
              <button
                onClick={syncAllOrdersFromBosta}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg transition-all font-bold whitespace-nowrap shadow-md hover:shadow-lg flex items-center gap-2"
                title="مزامنة جميع الأوردرات من بوسطة"
              >
                <span>🔄</span>
                <span>مزامنة Bosta</span>
              </button>
            )}
            
            {/* 🆕 زر تقرير الطلبات المُرسلة لبوسطة اليوم */}
            {bostaEnabled && activeTab === 'website' && (
              <button
                onClick={handleDailySalesReport}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-bold whitespace-nowrap shadow-md hover:shadow-lg flex items-center gap-2"
                title="تقرير بالطلبات المُرسلة لبوسطة اليوم (من المحددة أو الكل)"
              >
                <span>📊</span>
                <span>
                  {selectedOrders.length > 0 
                    ? `تقرير اليوم (${getOrdersDeliveredToday(orders.filter(o => selectedOrders.includes(o.id))).length})`
                    : `طلبات بوسطا اليوم (${getOrdersDeliveredToday(orders).length})`
                  }
                </span>
              </button>
            )}
            
            {/* 🆕 زر تقرير الطلبات المُرسلة لبوسطة امبارح */}
            {bostaEnabled && activeTab === 'website' && (
              <button
                onClick={handleYesterdayReport}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg transition-all font-bold whitespace-nowrap shadow-md hover:shadow-lg flex items-center gap-2"
                title="تقرير بالطلبات المُرسلة لبوسطة أمس (من المحددة أو الكل)"
              >
                <span>📅</span>
                <span>
                  {selectedOrders.length > 0 
                    ? `تقرير امبارح (${getOrdersDeliveredYesterday(orders.filter(o => selectedOrders.includes(o.id))).length})`
                    : `طلبات بوسطا امبارح (${getOrdersDeliveredYesterday(orders).length})`
                  }
                </span>
              </button>
            )}
          </div>
          
          {/* 🆕 Advanced Filters Section */}
          {showAdvancedFilters && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 space-y-4 animate-slideDown">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <span>⚙️</span>
                <span>فلاتر متقدمة</span>
              </h3>
              
              {/* Price Range Filter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 font-medium whitespace-nowrap">💰 السعر من:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="مثال: 100"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 font-medium whitespace-nowrap">💰 السعر إلى:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="مثال: 1000"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Info Text */}
              <p className="text-xs text-gray-600 bg-white/60 rounded-lg p-3 border border-blue-200">
                💡 <strong>نصيحة:</strong> البحث يدعم رقم الأوردر، اسم العميل، رقم التلفون. استخدم الفلاتر المتقدمة لتحديد نطاق السعر والتاريخ.
              </p>
            </div>
          )}

          {/* Active Filters Display */}
          {(searchTerm || statusFilter || dateFrom || dateTo || minPrice || maxPrice) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">الفلاتر النشطة:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  🔍 {searchTerm}
                  <button onClick={() => { setSearchTerm(""); setSearchInput(""); }} className="hover:text-blue-900">×</button>
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
              {minPrice && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  💰 من: {minPrice}
                  <button onClick={() => setMinPrice("")} className="hover:text-amber-900">×</button>
                </span>
              )}
              {maxPrice && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  💰 إلى: {maxPrice}
                  <button onClick={() => setMaxPrice("")} className="hover:text-amber-900">×</button>
                </span>
              )}
            </div>
          )}
          
          {/* 🆕 Statistics Cards - يظهر فقط في تاب الموقع */}
          {activeTab === 'website' && orders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
              {/* Total Orders */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-600 font-medium mb-1">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold text-blue-900">{filteredOrders.length}</p>
                  </div>
                  <div className="text-3xl">📦</div>
                </div>
              </div>
              
              {/* Total Revenue */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 font-medium mb-1">إجمالي المبيعات</p>
                    <p className="text-2xl font-bold text-green-900">
                      {filteredOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-3xl">💰</div>
                </div>
              </div>
              
              {/* Average Order Value */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 font-medium mb-1">متوسط الطلب</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {filteredOrders.length > 0 
                        ? (filteredOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) / filteredOrders.length).toFixed(2)
                        : '0.00'
                      }
                    </p>
                  </div>
                  <div className="text-3xl">📊</div>
                </div>
              </div>
              
              {/* Completed Orders */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600 font-medium mb-1">طلبات مكتملة</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {filteredOrders.filter(o => o.status === 'completed').length}
                    </p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 🆕 محتوى تاب الملاحظات */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* زر إضافة ملاحظة جديدة */}
          <button
            onClick={() => {
              setShowNoteForm(!showNoteForm);
              setEditingStandaloneNote(null);
              setNewNoteForm({
                title: '',
                content: '',
                type: 'general',
                status: 'pending',
                priority: 'normal'
              });
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
          >
            ➕ إضافة ملاحظة جديدة
          </button>

          {/* نموذج إضافة/تعديل ملاحظة */}
          {showNoteForm && (
            <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingStandaloneNote ? '✏️ تعديل ملاحظة' : '📝 ملاحظة جديدة'}
              </h3>
              
              <div className="space-y-4">
                {/* العنوان */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">العنوان</label>
                  <input
                    type="text"
                    value={newNoteForm.title}
                    onChange={(e) => setNewNoteForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="عنوان الملاحظة..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* النوع والأولوية والحالة */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">النوع</label>
                    <select
                      value={newNoteForm.type}
                      onChange={(e) => setNewNoteForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="general">🗒️ عام</option>
                      <option value="return">↩️ استرجاع</option>
                      <option value="exchange">🔄 استبدال</option>
                      <option value="modify">✏️ تعديل</option>
                      <option value="complaint">⚠️ شكوى</option>
                      <option value="followup">📞 متابعة</option>
                      <option value="other">📎 أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الأولوية</label>
                    <select
                      value={newNoteForm.priority}
                      onChange={(e) => setNewNoteForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="low">🟢 منخفضة</option>
                      <option value="normal">🟡 عادية</option>
                      <option value="high">🔴 عالية</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الحالة</label>
                    <select
                      value={newNoteForm.status}
                      onChange={(e) => setNewNoteForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pending">⏳ قيد المعالجة</option>
                      <option value="resolved">✅ تم الحل</option>
                    </select>
                  </div>
                </div>

                {/* المحتوى */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">التفاصيل</label>
                  <textarea
                    value={newNoteForm.content}
                    onChange={(e) => setNewNoteForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="اكتب تفاصيل الملاحظة هنا..."
                    rows="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  />
                </div>

                {/* الأزرار */}
                <div className="flex gap-3">
                  <button
                    onClick={saveStandaloneNote}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3 rounded-lg font-bold transition-all shadow-md"
                  >
                    ✅ حفظ
                  </button>
                  <button
                    onClick={() => {
                      setShowNoteForm(false);
                      setEditingStandaloneNote(null);
                      setNewNoteForm({
                        title: '',
                        content: '',
                        type: 'general',
                        status: 'pending',
                        priority: 'normal'
                      });
                    }}
                    className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* قائمة الملاحظات */}
          <div className="space-y-4">
            {standaloneNotes.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-gray-500 text-lg">لا توجد ملاحظات</p>
                <p className="text-gray-400 text-sm mt-2">اضغط على الزر أعلاه لإضافة ملاحظة جديدة</p>
              </div>
            ) : (
              standaloneNotes.map((note) => {
                const typeInfo = {
                  general: { icon: '🗒️', label: 'عام', color: 'bg-gray-100 text-gray-700' },
                  return: { icon: '↩️', label: 'استرجاع', color: 'bg-red-100 text-red-700' },
                  exchange: { icon: '🔄', label: 'استبدال', color: 'bg-blue-100 text-blue-700' },
                  modify: { icon: '✏️', label: 'تعديل', color: 'bg-yellow-100 text-yellow-700' },
                  complaint: { icon: '⚠️', label: 'شكوى', color: 'bg-orange-100 text-orange-700' },
                  followup: { icon: '📞', label: 'متابعة', color: 'bg-green-100 text-green-700' },
                  other: { icon: '📎', label: 'أخرى', color: 'bg-purple-100 text-purple-700' }
                };

                const priorityInfo = {
                  low: { icon: '🟢', label: 'منخفضة' },
                  normal: { icon: '🟡', label: 'عادية' },
                  high: { icon: '🔴', label: 'عالية' }
                };

                const type = typeInfo[note.type] || typeInfo.general;
                const priority = priorityInfo[note.priority] || priorityInfo.normal;

                return (
                  <div
                    key={note.id}
                    className={`bg-white rounded-xl shadow-md border-2 transition-all ${
                      note.status === 'resolved'
                        ? 'border-green-200 opacity-75'
                        : 'border-purple-200 hover:shadow-lg'
                    }`}
                  >
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`text-lg font-bold ${note.status === 'resolved' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                              {note.title}
                            </h3>
                            {note.status === 'resolved' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                ✅ تم الحل
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${type.color}`}>
                              {type.icon} {type.label}
                            </span>
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                              {priority.icon} {priority.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(note.createdAt).toLocaleDateString('ar-EG', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleNoteStatus(note.id)}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                            note.status === 'resolved'
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {note.status === 'resolved' ? '🔄 إعادة فتح' : '✅ تم الحل'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingStandaloneNote(note);
                            setNewNoteForm({
                              title: note.title,
                              content: note.content,
                              type: note.type,
                              status: note.status,
                              priority: note.priority
                            });
                            setShowNoteForm(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذه الملاحظة؟')) {
                              deleteStandaloneNote(note.id);
                            }
                          }}
                          className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* View Mode Toggle - لكل الطلبات */}
      {activeTab !== 'notes' && (
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

      {/* Table View - لكل الطلبات */}
      {activeTab !== 'notes' && viewMode === 'table' && (
        <div key={refreshKey} className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* 🔥 Bulk Actions Bar */}
          {selectedOrders.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-bold">تم تحديد {selectedOrders.length} طلب</span>
                <button
                  onClick={deselectAllOrders}
                  className="text-sm hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRegisterInvoices}
                  disabled={registeringBulk}
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {registeringBulk ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <span>🧾</span>
                      <span>تسجيل كفواتير ({selectedOrders.length})</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleBulkPrintOrders}
                  disabled={registeringBulk || printingNonBosta}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {registeringBulk ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <span>🖨️</span>
                      <span>طباعة ({selectedOrders.length})</span>
                    </>
                  )}
                </button>
                
                {/* 🆕 زرار طباعة الأوردرات غير المبعوتة لبوسطة */}
                {bostaEnabled && (
                  <button
                    onClick={handlePrintNonBostaOrders}
                    disabled={registeringBulk || printingNonBosta}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                  >
                    {printingNonBosta ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>جاري المعالجة...</span>
                      </>
                    ) : (
                      <>
                        <span>🖨️</span>
                        <span>طباعة غير Bosta ({filteredOrders.filter(o => !o.bosta?.sent && !o.meta_data?.find(m => (m.key === '_bosta_sent' || m.key === 'bosta_sent') && m.value === 'yes')).length})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${activeTab === 'website' ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-green-500 to-green-600'} text-white`}>
                <tr>
                  {/* 🔥 Select All Checkbox */}
                  {activeTab === 'website' && (
                    <th className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllOrders();
                          } else {
                            deselectAllOrders();
                          }
                        }}
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-2 py-3 text-right text-sm font-bold">
                    {activeTab === 'website' ? 'رقم الطلب' : 'رقم الفاتورة'}
                  </th>
                  <th className="px-2 py-3 text-right text-sm font-bold">العميل</th>
                  {/* <th className="px-2 py-3 text-right text-sm font-bold">الهاتف</th> */}
                  <th className="px-2 py-3 text-right text-sm font-bold">المنتجات</th>
                  <th className="px-2 py-3 text-right text-sm font-bold">الإجمالي</th>
                  {activeTab === 'website' && (
                    <>
                      <th className="px-2 py-3 text-right text-sm font-bold">طريقة الدفع</th>
                      <th className="px-2 py-3 text-right text-sm font-bold">الملاحظات</th>
                    </>
                  )}
                  {activeTab === 'system' && (
                    <th className="px-2 py-3 text-right text-sm font-bold">تفاصيل الدفع</th>
                  )}
                  <th className="px-2 py-3 text-right text-sm font-bold">
                    {activeTab === 'website' ? 'الحالة' : 'حالة الطلب'}
                  </th>
                  {activeTab === 'system' && (
                    <th className="px-2 py-3 text-right text-sm font-bold">حالة الدفع</th>
                  )}
                  {bostaEnabled && (
                    <th className="px-2 py-3 text-right text-sm font-bold">Bosta</th>
                  )}
                  <th className="px-2 py-3 text-center text-sm font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading ? (
                  // Loading State
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 animate-pulse">
                      {activeTab === 'website' && (
                        <td className="px-2 py-3">
                          <div className="h-4 w-4 bg-gray-200 rounded"></div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-20"></div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      {activeTab === 'website' && (
                        <td className="px-2 py-3">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                      </td>
                      {activeTab === 'system' && (
                        <td className="px-2 py-3">
                          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                        </td>
                      )}
                      {bostaEnabled && (
                        <td className="px-2 py-3">
                          <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <div className="flex gap-1 justify-center">
                          <div className="h-7 w-10 bg-gray-200 rounded"></div>
                          <div className="h-7 w-10 bg-gray-200 rounded"></div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'website' ? (bostaEnabled ? "9" : "8") : "10"} className="px-4 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">📦</div>
                      <p>لا توجد طلبات</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, index) => {
                    const isSystemOrder = activeTab === 'system';
                    
                    if (isSystemOrder) {
                      // System Orders Table Row
                      return (
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
                            <div className="text-xs">
                              <div className="font-semibold text-gray-900 mb-0.5">
                                👤 {order.delivery?.customer?.name || 'غير متاح'}
                              </div>
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
                        {(order.deliveryStatus === 'pending' || order.status === 'on-hold' || order.status === 'pending') ? (
                          <span className="text-xs text-gray-400">معلق</span>
                        ) : order.bosta?.sent ? (
                          <div className="space-y-1">
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
                            {FEATURES.ENABLE_BOSTA_UNLINK && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unlinkFromBosta(order);
                                }}
                                className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded font-bold"
                              >
                                🗑️ إزالة الربط
                              </button>
                            )}
                          </div>
                        ) : bostaEnabled ? (
                          <div className="space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendToBosta(order);
                              }}
                              disabled={sendingToBosta === order.id}
                              className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded font-bold disabled:opacity-50 w-full"
                            >
                              {sendingToBosta === order.id ? '⏳' : '📦 إرسال'}
                            </button>
                            {FEATURES.ENABLE_BOSTA_MANUAL_LINK && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  linkToBostaManually(order);
                                }}
                                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-bold w-full"
                              >
                                ✍️ ربط يدوي
                              </button>
                            )}
                          </div>
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
                      );
                    } else {
                      // Website Orders Table Row
                      const statusObj = STATUS_OPTIONS.find(s => s.value === order.status);
                      const itemsCount = order.line_items?.length || 0;
                      const isNew = ((new Date() - new Date(order.date_created)) / 1000) < 180;
                      const deliveryType = order.meta_data?.some(m => 
                        (m.key === '_is_store_pickup' && m.value === 'yes') || 
                        (m.key === '_delivery_type' && m.value === 'store_pickup')
                      ) ? 'pickup' : 'delivery';
                      const kashierTxId = order.meta_data?.find(m => m.key === '_kashier_transaction_id')?.value;
                      const orderSource = order.meta_data?.find(m => m.key === '_order_source')?.value;
                      const isSpare2AppOrder = orderSource === 'spare2app';
                      const bostaTracking = order.bosta?.trackingNumber || order.meta_data?.find(m => m.key === '_bosta_tracking_number')?.value;
                      const bostaStatus = order.bosta?.status || order.meta_data?.find(m => m.key === '_bosta_status')?.value;
                      const bostaActiveMeta = order.bosta?.active ?? order.meta_data?.find(m => m.key === '_bosta_active')?.value;
                      const bostaActive = bostaActiveMeta === undefined ? true : (bostaActiveMeta === 'true' || bostaActiveMeta === true);
                      const showBostaBadge = bostaTracking && bostaStatus && order.status !== 'completed'; // 🔥 عرض كل الأوردرات مع tracking
                      const productTotal = parseFloat(order.total) - parseFloat(order.shipping_total || 0);
                      const isPaid = order.payment_method_title && order.payment_method_title !== 'الدفع نقدًا عند الاستلام';
                      
                      // 🆕 إخفاء رقم التتبع لو الحالة pending أو on-hold
                      const showBostaTracking = bostaTracking && order.status !== 'pending' && order.status !== 'on-hold';
                      
                      // 🆕 التحقق من تأخر الأوردر
                      const orderIsDelayed = isOrderDelayed(order, bostaEnabled);
                      
                      return (
                        <tr 
                          key={`${order.id}-${bostaTracking || 'no-track'}-${order.status}-${refreshKey}`}
                          className={`border-b transition-colors ${
                            orderIsDelayed
                              ? 'bg-red-50/80 hover:bg-red-100 border-red-200 border-2'
                              : order.status === 'pending'
                              ? 'bg-gray-50/80 opacity-75 hover:opacity-100 border-dashed'
                              : index % 2 === 0 
                                ? 'bg-white hover:bg-blue-50 border-gray-100' 
                                : 'bg-gray-50 hover:bg-blue-50 border-gray-100'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-2 py-3 text-center">
                            <input 
                              type="checkbox"
                              checked={selectedOrders.includes(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                            />
                          </td>

                          {/* Order ID + Badges */}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                              <span className="font-bold text-blue-600 text-sm">#{order.id}</span>
                              {orderIsDelayed && (
                                <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse font-bold border-2 border-red-800">
                                  ⚠️ متأخر +5 أيام
                                </span>
                              )}
                              {order.status === 'pending' && (
                                <span className="bg-gray-400 text-white text-[9px] px-1.5 py-0.5 rounded-full">💳 لم يدفع</span>
                              )}
                              {isNew && order.status !== 'pending' && (
                                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">🔔 جديد</span>
                              )}
                              {isSpare2AppOrder && (
                                <span className="bg-cyan-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                  ✨ spare2app
                                </span>
                              )}
                              {showBostaBadge && (
                                <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                                  📦 بوسطة
                                </span>
                              )}
                            </div>
                            {/* 🔥 عرض آخر حالة بوسطة + تاريخ آخر تحديث */}
                            {showBostaBadge && (
                              <div className="space-y-0.5">
                                <div className="text-[9px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded inline-block">
                                  📍 {formatBostaStatus(bostaStatus)}
                                </div>
                                {(() => {
                                  const lastUpdated = order.bosta?.lastUpdated || order.meta_data?.find(m => m.key === '_bosta_last_updated')?.value;
                                  if (lastUpdated) {
                                    const updateDate = new Date(lastUpdated);
                                    const formatted = updateDate.toLocaleString('ar-EG', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                    return (
                                      <div className="text-[8px] text-gray-500">
                                        🕐 {formatted}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mb-1">
                              {deliveryType === 'pickup' ? (
                                <span className="bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">🏪 استلام</span>
                              ) : (
                                <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">🚚 توصيل</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(order.date_created).toLocaleDateString('ar-EG', { 
                                day: '2-digit', 
                                month: 'short'
                              })}
                            </div>
                          </td>

                          {/* Customer + Phone + Notes */}
                          <td className="px-2 py-3">
                            <div className="text-xs">
                              <div className="font-semibold text-gray-900 mb-0.5">
                                👤 {order.billing?.first_name} {order.billing?.last_name}
                              </div>
                              {order.billing?.phone && (
                                <div className="text-gray-600 mb-0.5">📱 {order.billing.phone}</div>
                              )}
                            </div>
                          </td>

                          {/* Products */}
                          <td className="px-2 py-3">
                            <div className="flex items-center justify-center">
                              <div className="bg-blue-500 text-white rounded-lg w-10 h-10 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-sm font-bold leading-none">{itemsCount}</div>
                                  <div className="text-[8px] leading-none">منتج</div>
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-500 text-center mt-1">
                              {order.line_items?.[0]?.name?.substring(0, 15) || ''}{order.line_items?.[0]?.name?.length > 15 ? '...' : ''}
                            </div>
                          </td>

                          {/* Total + Breakdown */}
                          <td className="px-2 py-3">
                            <div className="text-xs">
                              {/* المنتجات */}
                              <div className="font-bold text-gray-900 mb-1">
                                💰 {productTotal} ج.م
                              </div>
                              {/* حالة الدفع */}
                              {isPaid && (
                                <div className="bg-blue-100 border border-blue-300 rounded px-1 py-0.5 mb-1">
                                  <span className="text-blue-700 text-[10px] font-semibold">✓ مدفوع</span>
                                </div>
                              )}
                              {/* الشحن */}
                              {parseFloat(order.shipping_total || 0) > 0 && (
                                <div className="bg-orange-100 border border-orange-300 rounded px-1 py-0.5">
                                  <span className="text-orange-700 text-[10px] font-semibold">🚚 {order.shipping_total} ج.م</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Payment Method + Kashier */}
                          <td className="px-2 py-3">
                            <div className="text-xs">
                              <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-1 mb-1">
                                <p className="font-medium text-gray-700 text-[10px]">
                                  💳 {order.payment_method_title}
                                </p>
                              </div>
                              {kashierTxId && (
                                <div className="bg-purple-100 border border-purple-300 rounded px-1.5 py-1">
                                  <div className="text-purple-700 text-[9px] font-bold mb-0.5">🔖 كاشير:</div>
                                  <div className="text-purple-900 text-[9px] font-mono">{kashierTxId}</div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Notes - Customer Note & Order Notes */}
                          <td className="px-2 py-3">
                            <div className="text-xs space-y-1">
                              {order.customer_note && order.customer_note.trim() && (
                                <div className="bg-yellow-50 border border-yellow-300 rounded px-1.5 py-1">
                                  <div className="text-yellow-700 text-[9px] font-bold mb-0.5">📝 ملاحظة العميل:</div>
                                  <div className="text-yellow-900 text-[10px] leading-tight">{order.customer_note}</div>
                                </div>
                              )}
                              {orderNotes[order.id] && orderNotes[order.id].trim() && (
                                <div className="bg-blue-50 border border-blue-300 rounded px-1.5 py-1">
                                  <div className="text-blue-700 text-[9px] font-bold mb-0.5">💼 ملاحظاتنا:</div>
                                  <div className="text-blue-900 text-[10px] leading-tight">{orderNotes[order.id]}</div>
                                </div>
                              )}
                              {!order.customer_note && !orderNotes[order.id] && (
                                <span className="text-gray-400 text-[10px]">-</span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-2 py-3">
                            <select
                              value={order.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(order.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border-2 focus:ring-2 focus:ring-blue-500 w-full ${statusObj?.color || 'bg-gray-500'} text-white`}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Bosta Status */}
                          {bostaEnabled && (
                            <td className="px-2 py-3">
                              {bostaTracking ? (
                                <div className="space-y-1">
                                  <div className="text-xs">
                                    <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold mb-1 text-[10px]">
                                      ✅ {bostaTracking}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTrackingModal(bostaTracking);
                                      }}
                                      className="w-full bg-blue-500 text-white px-2 py-1 rounded text-[10px] hover:bg-blue-600"
                                    >
                                      🔍 تتبع
                                    </button>
                                  </div>
                                  {FEATURES.ENABLE_BOSTA_UNLINK && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        unlinkFromBosta(order);
                                      }}
                                      className="w-full bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600"
                                    >
                                      🗑️ إزالة الربط
                                    </button>
                                  )}
                                </div>
                              ) : (order.status === 'processing' || order.status === 'completed') && deliveryType !== 'pickup' ? (
                                <div className="space-y-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sendToBosta(order);
                                    }}
                                    disabled={sendingToBosta === order.id}
                                    className="w-full bg-purple-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-purple-600 disabled:opacity-50"
                                  >
                                    {sendingToBosta === order.id ? '⏳' : '📦 إرسال'}
                                  </button>
                                  {FEATURES.ENABLE_BOSTA_MANUAL_LINK && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        linkToBostaManually(order);
                                      }}
                                      className="w-full bg-amber-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-amber-600"
                                    >
                                      ✍️ ربط يدوي
                                    </button>
                                  )}
                                </div>
                              ) : order.status === 'pending' || order.status === 'on-hold' ? (
                                <span className="text-xs text-gray-400">معلق</span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          )}

                          {/* Actions */}
                          <td className="px-2 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold w-full"
                              title="التفاصيل"
                            >
                              📄 تفاصيل
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Grid */}
      {activeTab !== 'notes' && (
      <div className={`${viewMode === 'table' ? 'hidden' : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'}`}>
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
                  setSearchInput('');
                  setStatusFilter('');
                  setDateFrom('');
                  setDateTo('');
                  router.push('/orders');
                  if (activeTab === 'website') {
                    setCurrentPage(1);
                    loadOrders(1);
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
              const systemBostaActiveMeta = order.bosta?.active ?? order.meta_data?.find(m => m.key === '_bosta_active')?.value;
              const systemBostaActive = systemBostaActiveMeta === undefined ? true : (systemBostaActiveMeta === 'true' || systemBostaActiveMeta === true);
              
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
                        {/* 🆕 بادج للملاحظات */}
                        {orderNotes[order.id] && (
                          <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full" title="يوجد ملاحظات">
                            📝
                          </span>
                        )}
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
                      {/* Customer Note */}
                      {order.customer_note && order.customer_note.trim() && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="flex items-start gap-1.5">
                            <span className="text-yellow-600 text-sm flex-shrink-0">📝</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-gray-700 mb-0.5">ملاحظة العميل:</div>
                              <p className="text-xs text-gray-800 leading-relaxed bg-white rounded px-2 py-1 border border-yellow-200">
                                {order.customer_note}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 🆕 ملاحظاتنا على الطلب */}
                    {orderNotes[order.id] && (
                      <div className="mb-2 bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-300 rounded-lg p-2.5 shadow-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-pink-600 text-sm flex-shrink-0">📌</span>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-pink-800 mb-1 flex items-center gap-1">
                              <span>ملاحظاتنا</span>
                              <span className="text-[10px] bg-pink-200 text-pink-700 px-1.5 py-0.5 rounded-full">داخلية</span>
                            </div>
                            <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap bg-white/60 rounded px-2 py-1.5 border border-pink-200">
                              {orderNotes[order.id]}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

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
                              <p className="text-gray-700 font-medium mb-2">
                                رقم التتبع: {order.bosta.trackingNumber}
                              </p>
                              <button
                                onClick={() => openTrackingModal(order.bosta.trackingNumber)}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg mb-2"
                              >
                                🔍 تتبع الطلب
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://bosta.co/ar-eg/tracking-shipments?shipment-number=${order.bosta.trackingNumber}`);
                                  setToast({ message: 'تم نسخ لينك التتبع للعميل!', type: 'success' });
                                }}
                                className="w-full text-blue-600 hover:text-blue-700 text-xs font-medium border border-blue-300 rounded-lg py-1.5 hover:bg-blue-50 transition-all"
                              >
                                📋 نسخ لينك للعميل
                              </button>
                            </div>
                          ) : (
                            // إذا لم يتم الإرسال - زر الإرسال + الربط اليدوي
                            <div className="space-y-2">
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
                              {FEATURES.ENABLE_BOSTA_MANUAL_LINK && (
                                <button
                                  onClick={() => linkToBostaManually(order)}
                                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 
                                           text-white px-3 py-2 rounded-lg text-sm font-bold
                                           hover:from-amber-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                                >
                                  ✍️ ربط يدوي برقم تتبع
                                </button>
                              )}
                            </div>
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
            const orderSource = order.meta_data?.find(m => m.key === '_order_source')?.value;
            const isSpare2AppOrder = orderSource === 'spare2app';
            
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
            
            // 🆕 التحقق من تأخر الأوردر في Grid View
            const orderIsDelayed = isOrderDelayed(order, bostaEnabled);
            
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
                  orderIsDelayed
                    ? "border-red-600 ring-4 ring-red-200 shadow-red-300/50 bg-red-50/30"
                    : order.status === 'pending'
                    ? "border-dashed border-gray-300 bg-gray-50/50 opacity-75 hover:opacity-100"
                    : isNew 
                      ? "border-yellow-400 ring-4 ring-yellow-100 shadow-yellow-200/50" 
                      : "border-gray-100 hover:border-blue-300"
                }`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="p-4">
                  {/* Header - Order Number & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-lg">#{order.id}</span>
                        {orderIsDelayed && (
                          <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse font-bold border-2 border-red-800">
                            ⚠️ متأخر +5 أيام
                          </span>
                        )}
                        {order.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 bg-gray-400 text-white text-xs px-2 py-1 rounded-full">
                            💳 لم يدفع
                          </span>
                        )}
                        {isNew && order.status !== 'pending' && (
                          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                            <span className="relative">🔔 جديد</span>
                          </span>
                        )}
                        {isSpare2AppOrder && (
                          <span className="inline-flex items-center gap-1 bg-cyan-600 text-white text-xs px-2 py-1 rounded-full">
                            ✨ spare2app
                          </span>
                        )}
                        {(() => {
                          const bostaTracking = order.bosta?.trackingNumber || order.meta_data?.find(m => m.key === '_bosta_tracking_number')?.value;
                          const bostaStatus = order.bosta?.status || order.meta_data?.find(m => m.key === '_bosta_status')?.value;
                          const showBostaBadge = bostaTracking && bostaStatus && order.status !== 'completed';
                          return showBostaBadge && (
                            <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                              📦 بوسطة
                            </span>
                          );
                        })()}
                        {/* 🆕 بادج للملاحظات */}
                        {orderNotes[order.id] && (
                          <span className="inline-flex items-center gap-1 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full" title="يوجد ملاحظات">
                            📝
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
                      {/* 🔥 عرض آخر حالة بوسطة في الكارد + تاريخ التحديث */}
                      {(() => {
                        const bostaTracking = order.bosta?.trackingNumber || order.meta_data?.find(m => m.key === '_bosta_tracking_number')?.value;
                        const bostaStatus = order.bosta?.status || order.meta_data?.find(m => m.key === '_bosta_status')?.value;
                        const showBostaBadge = bostaTracking && bostaStatus && order.status !== 'completed';
                        
                        if (!showBostaBadge) return null;
                        
                        const lastUpdated = order.bosta?.lastUpdated || order.meta_data?.find(m => m.key === '_bosta_last_updated')?.value;
                        let formattedDate = '';
                        if (lastUpdated) {
                          const updateDate = new Date(lastUpdated);
                          formattedDate = updateDate.toLocaleString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        }
                        
                        return (
                          <div className="text-[10px] bg-purple-50 px-2 py-1 rounded space-y-0.5">
                            <div className="text-purple-700 font-semibold">
                              📍 {formatBostaStatus(bostaStatus)}
                            </div>
                            {formattedDate && (
                              <div className="text-gray-600 text-[9px]">
                                🕐 {formattedDate}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                    
                    {/* Kashier Transaction ID */}
                    {(() => {
                      const kashierTxId = order.meta_data?.find(m => m.key === '_kashier_transaction_id')?.value;
                      return kashierTxId && (
                        <div className="bg-purple-50 border border-purple-300 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-600 text-base">🔖</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-purple-800 mb-0.5">رقم معاملة كاشير:</div>
                              <p className="text-xs text-purple-900 font-mono font-semibold">
                                {kashierTxId}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Customer Note */}
                    {order.customer_note && order.customer_note.trim() && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-2">
                        <div className="flex items-start gap-2">
                          <span className="text-yellow-600 text-base flex-shrink-0">📝</span>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-yellow-800 mb-0.5">ملاحظة العميل:</div>
                            <p className="text-xs text-gray-800 leading-relaxed">
                              {order.customer_note}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 🆕 ملاحظاتنا على الطلب */}
                    {orderNotes[order.id] && (
                      <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-300 rounded-lg p-2.5 shadow-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-pink-600 text-base flex-shrink-0">📌</span>
                          <div className="flex-1">
                            <div className="text-xs font-bold text-pink-800 mb-1 flex items-center gap-1">
                              <span>ملاحظاتنا</span>
                              <span className="text-[10px] bg-pink-200 text-pink-700 px-1.5 py-0.5 rounded-full">داخلية</span>
                            </div>
                            <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap bg-white/60 rounded px-2 py-1.5 border border-pink-200">
                              {orderNotes[order.id]}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
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
                          {(parseFloat(order.total) - parseFloat(order.shipping_total || 0))} جنيه
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
                    {/* 🆕 Bosta Section - لكل الطلبات ماعدا الاستلام والمعلق */}
                    {bostaEnabled && 
                     order.status !== 'pending' && 
                     order.status !== 'on-hold' &&
                     (order.status === 'processing' || order.status === 'completed') && 
                     order.meta_data?.find(m => m.key === '_delivery_type')?.value !== 'pickup' && (
                      <div>
                        {order.bosta?.sent && order.bosta?.trackingNumber ? (
                          // إذا تم الإرسال - عرض معلومات التتبع
                          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-300 rounded-lg p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-purple-700 font-bold flex items-center gap-1">
                                ✅ تم الإرسال لبوسطة
                              </p>
                            </div>
                            <p className="text-gray-700 font-medium mb-2">
                              رقم التتبع: {order.bosta.trackingNumber}
                            </p>
                            <button
                              onClick={() => openTrackingModal(order.bosta.trackingNumber)}
                              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg mb-2"
                            >
                              🔍 تتبع الطلب
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`https://bosta.co/ar-eg/tracking-shipments?shipment-number=${order.bosta.trackingNumber}`);
                                setToast({ message: 'تم نسخ لينك التتبع للعميل!', type: 'success' });
                              }}
                              className="w-full text-blue-600 hover:text-blue-700 text-xs font-medium border border-blue-300 rounded-lg py-1.5 hover:bg-blue-50 transition-all"
                            >
                              📋 نسخ لينك للعميل
                            </button>
                          </div>
                        ) : (
                          // إذا لم يتم الإرسال - زر الإرسال + الربط اليدوي
                          <div className="space-y-2">
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
                            {FEATURES.ENABLE_BOSTA_MANUAL_LINK && (
                              <button
                                onClick={() => linkToBostaManually(order)}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 
                                         text-white px-3 py-2 rounded-lg text-sm font-bold
                                         hover:from-amber-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                              >
                                ✍️ ربط يدوي برقم تتبع
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* رسالة "معلق" لو الحالة pending/on-hold */}
                    {bostaEnabled && 
                     (order.status === 'pending' || order.status === 'on-hold') &&
                     order.meta_data?.find(m => m.key === '_delivery_type')?.value !== 'pickup' && (
                      <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
                        <p className="text-gray-500 text-sm font-medium">⏸️ معلق</p>
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
      )}

      {/* Order Details Modal */}
      {selectedOrder && activeTab === 'website' && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          showToast={showToast}
          orderNote={orderNotes[selectedOrder.id]}
          onEditNote={openNoteEditor}
          editingNote={editingNote === selectedOrder.id}
          noteText={noteText}
          onNoteTextChange={setNoteText}
          onSaveNote={saveOrderNote}
          savingNote={savingNote}
          onCancelNote={() => {
            setEditingNote(null);
            setNoteText('');
          }}
          onShippingUpdate={handleShippingUpdate}
          onOrderMetaUpdate={handleOrderMetaUpdate}
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

            {/* 🆕 قسم الملاحظات */}
            <div className="p-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-800">📝 ملاحظات الطلب</h3>
                {editingNote !== selectedOrder.id && (
                  <button
                    onClick={() => openNoteEditor(selectedOrder.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {orderNotes[selectedOrder.id] ? '✏️ تعديل' : '➕ إضافة ملاحظة'}
                  </button>
                )}
              </div>
              
              {editingNote === selectedOrder.id ? (
                <div className="space-y-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="اكتب ملاحظات عن الطلب (استرجاع، تبديل، إلخ...)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[120px] resize-y"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveOrderNote(selectedOrder.id, noteText)}
                      disabled={savingNote}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                    >
                      {savingNote ? '⏳ جاري الحفظ...' : '✅ حفظ'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(null);
                        setNoteText('');
                      }}
                      className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : orderNotes[selectedOrder.id] ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-gray-800 whitespace-pre-wrap">{orderNotes[selectedOrder.id]}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">لا توجد ملاحظات لهذا الطلب</p>
              )}
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

      {/* 🔥 Load More Button - فقط لطلبات الموقع */}
      {activeTab === 'website' && hasMore && !ordersLoading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMoreOrders}
            disabled={loadingMore}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
              loadingMore
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-2xl transform hover:-translate-y-1'
            }`}
          >
            {loadingMore ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>جاري التحميل...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>📦</span>
                <span>تحميل المزيد من الطلبات</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* 🆕 Pagination Info - معلومات فقط بدون navigation */}
      {activeTab === 'website' && orders.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div>
              عرض <span className="font-bold text-gray-900">{orders.length}</span> طلب
              {hasMore && <span className="text-blue-600 font-medium"> • اضغط "تحميل المزيد" لعرض باقي الطلبات</span>}
              {!hasMore && <span className="text-green-600 font-medium"> ✅</span>}
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
