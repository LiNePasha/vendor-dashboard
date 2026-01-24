'use client';

import { useState, useEffect } from 'react';
import { invoiceStorage } from '@/app/lib/localforage';
import { Toast } from '@/components/Toast';
import InvoiceModal from '@/app/pos/InvoiceModal';
import VariationSelector from '@/components/pos/VariationSelector';

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
  const [editingDeliveryFee, setEditingDeliveryFee] = useState(null); // { invoiceId, value }
  const [editingInvoiceDiscount, setEditingInvoiceDiscount] = useState(null); // { invoiceId, value }
  const [editingProduct, setEditingProduct] = useState(null); // { invoiceId, productId, field, value }
  const [addingService, setAddingService] = useState(null); // invoiceId
  const [newService, setNewService] = useState({ description: '', amount: 0, employeeName: '' });
  
  // State for adding products from API
  const [showProductSelector, setShowProductSelector] = useState(null); // invoiceId
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [variationSelectorProduct, setVariationSelectorProduct] = useState(null);
  const [variationSelectorVariations, setVariationSelectorVariations] = useState([]);

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

  // 🆕 تعديل رسوم الشحن
  const saveDeliveryFee = async (invoiceId) => {
    if (!editingDeliveryFee || editingDeliveryFee.invoiceId !== invoiceId) return;
    
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      const fee = parseFloat(editingDeliveryFee.value) || 0;
      
      console.log('📊 Invoice Summary Before:', invoice.summary);
      console.log('💰 New Delivery Fee:', fee);
      
      // إعادة حساب الإجمالي
      const subtotal = parseFloat(invoice.summary.subtotal) || 0;
      const discountAmount = parseFloat(invoice.summary.discount) || 0;
      const extraFeeAmount = parseFloat(invoice.summary.extraFee) || 0;
      const newTotal = subtotal - discountAmount + extraFeeAmount + fee;
      
      console.log('🧮 Calculation:', { subtotal, discountAmount, extraFeeAmount, fee, newTotal });
      
      // تحديث deliveryPayment.remainingAmount لو كان fully_paid_no_delivery
      let updatedDeliveryPayment = invoice.deliveryPayment;
      if (invoice.deliveryPayment?.status === 'fully_paid_no_delivery') {
        updatedDeliveryPayment = {
          ...invoice.deliveryPayment,
          remainingAmount: fee,
          paidAmount: subtotal - discountAmount + extraFeeAmount
        };
      }
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoice,
        summary: {
          ...invoice.summary,
          deliveryFee: fee,
          total: newTotal
        },
        deliveryPayment: updatedDeliveryPayment
      };

      console.log('📦 Updated Invoice Summary:', updatedInvoice.summary);

      // حفظ في LocalForage - استخدام updateInvoice بدل saveInvoice
      await invoiceStorage.updateInvoice(invoiceId, updatedInvoice);
      
      console.log('💾 Saved to LocalForage');
      
      // تحديث UI
      setInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? updatedInvoice : inv
      ));
      
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(updatedInvoice);
      }
      
      setEditingDeliveryFee(null);
      setToast({ message: '✅ تم تحديث رسوم الشحن - يمكنك الطباعة الآن', type: 'success' });
    } catch (error) {
      console.error('Error updating delivery fee:', error);
      setToast({ message: '❌ فشل تحديث رسوم الشحن', type: 'error' });
    }
  };

  // Update product quantity (with stock management)
  const updateProductQuantity = async (invoice, productId, newQuantity) => {
    try {
      const quantity = parseInt(newQuantity);
      if (isNaN(quantity) || quantity < 1) {
        setToast({ message: 'الكمية يجب أن تكون رقم أكبر من صفر', type: 'error' });
        return;
      }

      // Get the current item to calculate stock change
      const currentItem = invoice.items.find(item => item.id === productId);
      if (!currentItem) {
        setToast({ message: 'المنتج غير موجود في الفاتورة', type: 'error' });
        return;
      }

      const quantityDiff = quantity - currentItem.quantity; // الفرق: موجب = زيادة، سالب = نقصان

      if (quantityDiff === 0) {
        setEditingProduct(null);
        return; // لا تغيير
      }

      console.log('📊 تعديل الكمية:', {
        'الكمية القديمة': currentItem.quantity,
        'الكمية الجديدة': quantity,
        'الفرق': quantityDiff,
        'نوع المنتج': currentItem.variation_id ? 'متغير' : 'عادي',
        'Item ID': currentItem.id,
        'ملاحظة': quantityDiff > 0 ? `زيادة ${quantityDiff} - سيتم خصم من المخزون` : `نقصان ${Math.abs(quantityDiff)} - سيتم إضافة للمخزون`
      });

      // بنبعت الفرق للـ API عشان يطبقه
      const stockAdjustment = -quantityDiff;
      
      console.log('🔄 سيتم إرسال تعديل للمخزون:', stockAdjustment, stockAdjustment > 0 ? '(إضافة)' : '(خصم)');

      // التحقق إذا كان المنتج متغير
      let updatePayload;
      
      if (currentItem.variation_id) {
        // متغير - استخدم variation_id و parent_id
        updatePayload = {
          productId: currentItem.parent_id || currentItem.parentId,
          variationId: currentItem.variation_id,
          adjustment: stockAdjustment
        };
      } else if (typeof productId === 'string' && productId.includes('_var_')) {
        // ID مركب - استخرج الـ IDs منه
        const parts = productId.split('_var_');
        updatePayload = {
          productId: parseInt(parts[0]),
          variationId: parseInt(parts[1]),
          adjustment: stockAdjustment
        };
      } else {
        // منتج عادي
        updatePayload = {
          productId: productId,
          adjustment: stockAdjustment
        };
      }

      console.log('📤 Payload:', updatePayload);

      // تحديث المخزون في API بالفرق
      console.log('🔄 جاري تحديث المخزون في API...');
      const stockUpdateResponse = await fetch('/api/pos/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [updatePayload]
        }),
        credentials: 'include'
      });

      const updateResult = await stockUpdateResponse.json();
      console.log('✅ نتيجة التحديث:', updateResult);

      if (!stockUpdateResponse.ok) {
        console.error('❌ فشل التحديث:', updateResult);
        setToast({ message: '❌ فشل تحديث المخزون', type: 'error' });
        return;
      }

      // Update invoice items - لا نعرف المخزون النهائي، نحفظ null ونحدثه لاحقاً
      const updatedItems = invoice.items.map(item => {
        if (item.id === productId) {
          return { ...item, quantity }; // فقط نحدث الكمية
        }
        return item;
      });

      // Recalculate totals
      const productsSubtotal = updatedItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      const servicesTotal = invoice.services?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
      const subtotal = productsSubtotal + servicesTotal;
      const discountAmount = invoice.summary?.discount?.amount || 0;
      const extraFee = invoice.summary?.extraFee || 0;
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const total = subtotal - discountAmount + extraFee + deliveryFee;

      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          productsSubtotal,
          subtotal,
          total
        }
      };

      console.log('💾 جاري حفظ الفاتورة...');
      
      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      
      setEditingProduct(null);
      setToast({ message: `✅ تم تحديث الكمية والمخزون`, type: 'success' });
    } catch (error) {
      console.error('Error updating quantity:', error);
      setToast({ message: '❌ فشل تحديث الكمية', type: 'error' });
    }
  };

  // Update product price
  const updateProductPrice = async (invoice, productId, newPrice) => {
    try {
      const price = parseFloat(newPrice);
      if (isNaN(price) || price < 0) {
        setToast({ message: 'السعر يجب أن يكون رقم صحيح', type: 'error' });
        return;
      }

      const updatedItems = invoice.items.map(item => {
        if (item.id === productId) {
          return { ...item, price };
        }
        return item;
      });

      // Recalculate totals
      const productsSubtotal = updatedItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      const servicesTotal = invoice.services?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
      const subtotal = productsSubtotal + servicesTotal;
      const discountAmount = invoice.summary?.discount?.amount || 0;
      const extraFee = invoice.summary?.extraFee || 0;
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const invoiceDiscount = invoice.summary?.invoiceDiscount || 0;
      const total = subtotal - discountAmount - invoiceDiscount + extraFee + deliveryFee;

      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          productsSubtotal,
          subtotal,
          total
        }
      };

      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      setEditingProduct(null);
      setToast({ message: '✅ تم تحديث السعر', type: 'success' });
    } catch (error) {
      console.error('Error updating price:', error);
      setToast({ message: '❌ فشل تحديث السعر', type: 'error' });
    }
  };

  // Load products from API (كل المنتجات)
  const loadProductsFromAPI = async () => {
    setProductsLoading(true);
    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/cashier/initial?all=true&force=1&t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableProducts(data.products || []);
      } else {
        setToast({ message: '❌ فشل تحميل المنتجات', type: 'error' });
      }
    } catch (error) {
      setToast({ message: '❌ خطأ في تحميل المنتجات', type: 'error' });
    } finally {
      setProductsLoading(false);
    }
  };

  // Handle selecting variations for variable products
  const handleSelectVariation = async (product) => {
    try {
      const res = await fetch(`/api/products/${product.id}/variations`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تحميل المتغيرات');
      }
      
      setVariationSelectorProduct(product);
      setVariationSelectorVariations(data.variations || []);
    } catch (error) {
      setToast({ message: error.message || 'فشل تحميل المتغيرات', type: 'error' });
    }
  };

  // Add variation to invoice
  const handleAddVariationToInvoice = async (invoice, product, variation) => {
    const variationProduct = {
      id: `${product.id}_var_${variation.id}`,
      variation_id: variation.id,
      parent_id: product.id,
      name: `${product.name} - ${variation.description}`,
      price: variation.price,
      stock_quantity: variation.stock_quantity || 0,
      purchase_price: variation.purchase_price || null,
      is_variation: true
    };
    
    await addProductToInvoice(invoice, variationProduct);
    setVariationSelectorProduct(null);
    setVariationSelectorVariations([]);
  };

  // Add product to invoice (from API with stock update)
  const addProductToInvoice = async (invoice, product) => {
    try {
      // التحقق من المخزون
      if (product.stock_quantity <= 0) {
        setToast({ message: '❌ المنتج غير متوفر في المخزون', type: 'error' });
        return;
      }

      // خصم 1 من المخزون في API - check if variation
      const updatePayload = product.variation_id ? {
        productId: product.parent_id || product.parentId || product.product_id,
        variationId: product.variation_id,
        adjustment: -1
      } : {
        productId: product.id,
        adjustment: -1
      };

      console.log('🔄 خصم من المخزون:', updatePayload);

      const stockUpdateResponse = await fetch('/api/pos/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [updatePayload]
        }),
        credentials: 'include'
      });

      if (!stockUpdateResponse.ok) {
        setToast({ message: '❌ فشل تحديث المخزون', type: 'error' });
        return;
      }

      // إضافة المنتج للفاتورة
      const newInvoiceItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        totalPrice: product.price,
        purchase_price: product.purchase_price || null,
        profit: product.purchase_price ? (product.price - product.purchase_price) : null,
        hasPurchasePrice: !!product.purchase_price,
        // حفظ معلومات المتغير إذا كان متغير
        ...(product.variation_id && {
          variation_id: product.variation_id,
          parent_id: product.parent_id || product.parentId || product.product_id,
          is_variation: true
        })
      };

      const updatedItems = [...(invoice.items || []), newInvoiceItem];
      
      // إعادة حساب المجاميع
      const productsSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const servicesTotal = invoice.services?.reduce((sum, service) => sum + service.amount, 0) || 0;
      const subtotal = productsSubtotal + servicesTotal;
      
      const discountAmount = invoice.summary?.discount?.amount || 0;
      const extraFeeAmount = invoice.summary?.extraFee || 0;
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const total = subtotal - discountAmount + extraFeeAmount + deliveryFee;
      
      // حساب الأرباح
      const productsProfit = updatedItems.reduce((sum, item) => {
        if (item.purchase_price) {
          return sum + ((item.price - item.purchase_price) * item.quantity);
        }
        return sum;
      }, 0);
      
      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          productsSubtotal,
          servicesTotal,
          subtotal,
          total,
          productsProfit
        }
      };
      
      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      
      setShowProductSelector(null);
      setToast({ message: '✅ تمت إضافة المنتج للفاتورة وخصم من المخزون', type: 'success' });
    } catch (error) {
      setToast({ message: '❌ فشل إضافة المنتج', type: 'error' });
    }
  };

  // Add service to invoice
  const addServiceToInvoice = async (invoice) => {
    try {
      if (!newService.description.trim()) {
        setToast({ message: 'اكتب وصف الخدمة', type: 'error' });
        return;
      }
      if (newService.amount < 0) {
        setToast({ message: 'المبلغ يجب أن يكون صحيح', type: 'error' });
        return;
      }

      const service = {
        description: newService.description,
        amount: parseFloat(newService.amount),
        employeeName: newService.employeeName || invoice.soldBy?.employeeName || ''
      };

      const updatedServices = [...(invoice.services || []), service];
      
      // Recalculate totals
      const productsSubtotal = invoice.items?.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0) || 0;
      const servicesTotal = updatedServices.reduce((sum, s) => sum + Number(s.amount), 0);
      const subtotal = productsSubtotal + servicesTotal;
      const discountAmount = invoice.summary?.discount?.amount || 0;
      const extraFee = invoice.summary?.extraFee || 0;
      const deliveryFee = invoice.summary?.deliveryFee || 0;
      const invoiceDiscount = invoice.summary?.invoiceDiscount || 0;
      const total = subtotal - discountAmount - invoiceDiscount + extraFee + deliveryFee;

      const updatedInvoice = {
        ...invoice,
        services: updatedServices,
        summary: {
          ...invoice.summary,
          servicesTotal,
          subtotal,
          total
        }
      };

      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      setAddingService(null);
      setNewService({ description: '', amount: 0, employeeName: '' });
      setToast({ message: '✅ تم إضافة الخدمة للفاتورة', type: 'success' });
    } catch (error) {
      console.error('Error adding service:', error);
      setToast({ message: '❌ فشل إضافة الخدمة', type: 'error' });
    }
  };

  // 🆕 حفظ خصم الفاتورة
  const saveInvoiceDiscount = async (invoiceId) => {
    if (!editingInvoiceDiscount || editingInvoiceDiscount.invoiceId !== invoiceId) return;
    
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      const discountAmount = parseFloat(editingInvoiceDiscount.value) || 0;
      
      // إعادة حساب الإجمالي
      const subtotal = parseFloat(invoice.summary.subtotal) || 0;
      const originalDiscount = parseFloat(invoice.summary.discount) || 0; // الخصم الأصلي على المنتجات
      const extraFeeAmount = parseFloat(invoice.summary.extraFee) || 0;
      const deliveryFee = parseFloat(invoice.summary.deliveryFee) || 0;
      
      // الخصم الكلي = الخصم الأصلي + خصم الفاتورة
      const totalDiscount = originalDiscount + discountAmount;
      const newTotal = subtotal - totalDiscount + extraFeeAmount + deliveryFee;
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoice,
        summary: {
          ...invoice.summary,
          invoiceDiscount: discountAmount, // خصم الفاتورة منفصل
          total: newTotal
        }
      };

      // حفظ في LocalForage
      await invoiceStorage.updateInvoice(invoiceId, updatedInvoice);
      
      // تحديث UI
      setInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? updatedInvoice : inv
      ));
      
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(updatedInvoice);
      }
      
      setEditingInvoiceDiscount(null);
      setToast({ message: '✅ تم إضافة خصم الفاتورة', type: 'success' });
    } catch (error) {
      console.error('Error updating invoice discount:', error);
      setToast({ message: '❌ فشل إضافة الخصم', type: 'error' });
    }
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
    // إضافة timestamp لتجنب الـ cache
    const url = `/pos/invoices/print?id=${encodeURIComponent(invoice.id)}&t=${Date.now()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 🆕 حذف منتج من الفاتورة
  const deleteProductFromInvoice = async (invoice, itemId) => {
    try {
      // Get the item before deletion to return stock
      const itemToDelete = invoice.items.find(item => item.id === itemId);
      if (!itemToDelete) {
        setToast({ message: 'المنتج غير موجود', type: 'error' });
        return;
      }

      // Return stock to API - check if variation
      let updatePayload;
      
      if (itemToDelete.variation_id) {
        // متغير - استخدم variation_id و parent_id
        updatePayload = {
          productId: itemToDelete.parent_id || itemToDelete.parentId,
          variationId: itemToDelete.variation_id,
          adjustment: +itemToDelete.quantity
        };
      } else if (typeof itemId === 'string' && itemId.includes('_var_')) {
        // ID مركب - استخرج الـ IDs منه
        const parts = itemId.split('_var_');
        updatePayload = {
          productId: parseInt(parts[0]),
          variationId: parseInt(parts[1]),
          adjustment: +itemToDelete.quantity
        };
      } else {
        // منتج عادي
        updatePayload = {
          productId: itemId,
          adjustment: +itemToDelete.quantity
        };
      }

      console.log('🔄 إرجاع المخزون:', updatePayload);

      const stockUpdateResponse = await fetch('/api/pos/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [updatePayload]
        }),
        credentials: 'include'
      });

      if (!stockUpdateResponse.ok) {
        setToast({ message: '❌ فشل إرجاع المخزون', type: 'error' });
        return;
      }

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
      setToast({ message: '✅ تم حذف المنتج وإرجاع المخزون', type: 'success' });
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

        {/* Invoices List - Compact Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredInvoices.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
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
                onClick={() => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice)}
                className="group bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-200 hover:border-blue-400 cursor-pointer"
              >
                {/* Compact Header with Status Stripe */}
                <div className={`h-1 ${
                  invoice.source === 'order' ? 'bg-gradient-to-r from-cyan-400 to-blue-500' :
                  invoice.synced ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 
                  'bg-gradient-to-r from-yellow-400 to-orange-500'
                }`}></div>

                <div className="p-3">
                  {/* Compact Header - One Line */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 truncate">
                        #{invoice.id.split('-').pop()}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(!invoice.items || invoice.items.length === 0) ? (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-bold" title="خدمات فقط">
                            🛠
                          </span>
                        ) : (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            invoice.synced ? 'bg-green-500 text-white' : 'bg-yellow-400 text-yellow-900'
                          }`} title={invoice.synced ? 'تمت المزامنة' : 'في الانتظار'}>
                            {invoice.synced ? '✓' : '⏳'}
                          </span>
                        )}
                        {invoice.source === 'order' && (
                          <span className="w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-bold" title="من الستور">
                            🌐
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Total - Prominent but Compact */}
                    <div className="text-right bg-gradient-to-br from-blue-50 to-indigo-50 px-2.5 py-1.5 rounded-lg border border-blue-200 flex-shrink-0">
                      <div className="text-lg font-black text-blue-700 leading-tight">
                        {formatPrice(invoice.summary?.total)}
                      </div>
                      <div className="text-[9px] text-gray-600 font-medium">ج.م</div>
                    </div>
                  </div>

                  {/* Meta Row - Compact */}
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] flex-wrap">
                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(invoice.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      invoice.source === 'order' ? 'bg-cyan-100 text-cyan-700' :
                      invoice.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                      invoice.paymentMethod === 'wallet' ? 'bg-purple-100 text-purple-700' :
                      invoice.paymentMethod === 'instapay' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invoice.source === 'order' ? '🌐' :
                       invoice.paymentMethod === 'cash' ? '💵' :
                       invoice.paymentMethod === 'wallet' ? '👛' :
                       invoice.paymentMethod === 'instapay' ? '📱' : '💳'}
                    </span>

                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      (invoice.paymentStatus || 'paid_full') === 'paid_full' ? 'bg-emerald-100 text-emerald-700' :
                      (invoice.paymentStatus || 'paid_full') === 'paid_partial' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {(invoice.paymentStatus || 'paid_full') === 'paid_full' ? '✅' :
                       (invoice.paymentStatus || 'paid_full') === 'paid_partial' ? '⚠️' : '🔙'}
                    </span>

                    {invoice.soldBy?.employeeName && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold truncate max-w-[80px]" title={invoice.soldBy.employeeName}>
                        👤 {invoice.soldBy.employeeName}
                      </span>
                    )}

                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold ml-auto">
                      {invoice.items?.length || 0}م{invoice.services?.length > 0 && ` • ${invoice.services.length}خ`}
                    </span>
                  </div>

                  {/* Quick Stats Bar */}
                  <div className="grid grid-cols-4 gap-1 text-[10px] mb-2">
                    {invoice.summary?.productsSubtotal > 0 && (
                      <div className="bg-gray-50 rounded px-1.5 py-1 text-center">
                        <div className="text-gray-500 font-medium mb-0.5">منتجات</div>
                        <div className="font-bold text-gray-900">{formatPrice(invoice.summary.productsSubtotal)}</div>
                      </div>
                    )}
                    {invoice.summary?.servicesTotal > 0 && (
                      <div className="bg-purple-50 rounded px-1.5 py-1 text-center border border-purple-200">
                        <div className="text-purple-600 font-medium mb-0.5">خدمات</div>
                        <div className="font-bold text-purple-700">{formatPrice(invoice.summary.servicesTotal)}</div>
                      </div>
                    )}
                    {invoice.summary?.discount?.amount > 0 && (
                      <div className="bg-red-50 rounded px-1.5 py-1 text-center border border-red-200">
                        <div className="text-red-600 font-medium mb-0.5">خصم</div>
                        <div className="font-bold text-red-700">-{formatPrice(invoice.summary.discount.amount)}</div>
                      </div>
                    )}
                    {(invoice.summary?.totalProfit !== undefined && invoice.summary?.totalProfit !== null) && (
                      <div className="bg-green-50 rounded px-1.5 py-1 text-center border border-green-200">
                        <div className="text-green-600 font-medium mb-0.5">ربح</div>
                        <div className="font-bold text-green-700">{formatPrice(invoice.summary.totalProfit)}</div>
                      </div>
                    )}
                  </div>

                  {/* Expandable Details */}
                  {selectedInvoice?.id === invoice.id && (
                    <div className="pt-2 border-t border-gray-200 space-y-2 animate-in slide-in-from-top duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Financial Details Grid */}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-gray-50 p-2 rounded">
                        {/* Delivery Fee - Editable */}
                        {(invoice.summary?.deliveryFee > 0 || invoice.orderType === 'delivery') && (
                          <div className="bg-cyan-50 rounded px-2 py-1 border border-cyan-200">
                            <div className="text-cyan-700 font-medium mb-0.5">🚚 شحن</div>
                            {editingDeliveryFee?.invoiceId === invoice.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editingDeliveryFee.value}
                                  onChange={(e) => setEditingDeliveryFee({ 
                                    invoiceId: invoice.id, 
                                    value: e.target.value 
                                  })}
                                  className="w-16 px-1 py-0.5 text-[10px] border border-cyan-500 rounded text-right font-bold"
                                  placeholder="0"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveDeliveryFee(invoice.id)}
                                  className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[9px] font-bold"
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingDeliveryFee({ 
                                  invoiceId: invoice.id, 
                                  value: invoice.summary.deliveryFee || 0 
                                })}
                                className="font-bold text-cyan-800 hover:bg-cyan-100 px-1 py-0.5 rounded text-[10px]"
                              >
                                {formatPrice(invoice.summary.deliveryFee || 0)} ✏️
                              </button>
                            )}
                          </div>
                        )}

                        {/* Invoice Discount - Editable */}
                        <div className="bg-orange-50 rounded px-2 py-1 border border-orange-200">
                          <div className="text-orange-700 font-medium mb-0.5">🎁 خصم فاتورة</div>
                          {editingInvoiceDiscount?.invoiceId === invoice.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editingInvoiceDiscount.value}
                                onChange={(e) => setEditingInvoiceDiscount({ 
                                  invoiceId: invoice.id, 
                                  value: e.target.value 
                                })}
                                className="w-16 px-1 py-0.5 text-[10px] border border-orange-500 rounded text-right font-bold"
                                placeholder="0"
                                autoFocus
                              />
                              <button
                                onClick={() => saveInvoiceDiscount(invoice.id)}
                                className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[9px] font-bold"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingInvoiceDiscount({ 
                                invoiceId: invoice.id, 
                                value: invoice.summary.invoiceDiscount || 0 
                              })}
                              className="font-bold text-orange-800 hover:bg-orange-100 px-1 py-0.5 rounded text-[10px]"
                            >
                              {formatPrice(invoice.summary.invoiceDiscount || 0)} ✏️
                            </button>
                          )}
                        </div>

                        {/* Profit Info */}
                        {(invoice.summary?.totalProfit !== undefined && invoice.summary?.totalProfit !== null) && (
                          <div className="bg-green-50 rounded px-2 py-1 border border-green-200 col-span-2">
                            <div className="text-green-700 font-medium mb-0.5">💰 صافي الربح</div>
                            <div className="font-bold text-green-800 text-[11px]">
                              {formatPrice(invoice.summary.totalProfit)} ج.م
                            </div>
                            {invoice.summary?.finalProductsProfit !== invoice.summary?.productsProfit && (
                              <div className="text-[9px] text-green-600 mt-0.5">
                                منتجات: {formatPrice(invoice.summary.finalProductsProfit || 0)} 
                                {invoice.summary?.servicesTotal > 0 && ` • خدمات: ${formatPrice(invoice.summary.servicesTotal)}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Payment Status Selector */}
                      <div className="bg-gray-50 rounded p-2">
                        <label className="text-[10px] font-bold text-gray-700 mb-1 block">💰 حالة الدفع:</label>
                        <select
                          value={invoice.paymentStatus || 'paid_full'}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              await invoiceStorage.updateInvoicePaymentStatus(invoice.id, newStatus);
                              await loadInvoices();
                              setToast({ message: 'تم تحديث حالة الدفع', type: 'success' });
                            } catch (error) {
                              setToast({ message: 'فشل تحديث حالة الدفع', type: 'error' });
                            }
                          }}
                          className={`w-full px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            (invoice.paymentStatus || 'paid_full') === 'paid_full' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                            (invoice.paymentStatus || 'paid_full') === 'paid_partial' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                            'bg-red-50 text-red-700 border-red-300'
                          }`}
                        >
                          <option value="paid_full">✅ مدفوعة كاملة</option>
                          <option value="paid_partial">⚠️ مدفوع جزئي</option>
                          <option value="returned">🔙 مرتجع</option>
                        </select>
                      </div>

                      {/* Invoice Notes - Editable */}
                      <div className="bg-yellow-50 rounded p-2 border border-yellow-200">
                        <label className="text-[10px] font-bold text-gray-700 mb-1 block">📝 ملاحظات على الفاتورة:</label>
                        <textarea
                          value={invoice.notes || ''}
                          onChange={async (e) => {
                            const newNotes = e.target.value;
                            try {
                              await invoiceStorage.updateInvoiceNotes(invoice.id, newNotes);
                              await loadInvoices();
                            } catch (error) {
                              setToast({ message: 'فشل حفظ الملاحظات', type: 'error' });
                            }
                          }}
                          placeholder="اكتب ملاحظات..."
                          rows={2}
                          className="w-full px-2 py-1 bg-white border border-yellow-300 rounded text-[10px] focus:ring-1 focus:ring-yellow-500 resize-none"
                        />
                      </div>

                      {/* Order Notes - if available */}
                      {invoice.orderNotes && (
                        <div className="bg-purple-50 rounded p-2 border border-purple-200">
                          <div className="text-[10px] font-bold text-purple-900 mb-1">📝 ملاحظات الطلب</div>
                          <div className="text-[9px] text-purple-800 whitespace-pre-wrap">{invoice.orderNotes}</div>
                        </div>
                      )}

                      {/* Products List - Advanced Editing */}
                      {invoice.items?.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                              <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                              المنتجات ({invoice.items.length})
                            </h5>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setShowProductSelector(invoice.id);
                                await loadProductsFromAPI();
                              }}
                              className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-[9px] font-bold"
                              title="إضافة منتج من المخزون"
                            >
                              + منتج
                            </button>
                          </div>
                          <div className="space-y-0.5 max-h-40 overflow-y-auto">
                            {invoice.items.map((item) => (
                              <div key={item.id} className="group bg-blue-50 rounded p-1.5 border border-blue-200">
                                <div className="flex items-center gap-1.5">
                                  {/* Quantity - Editable */}
                                  <div className="flex items-center gap-0.5">
                                    {editingProduct?.invoiceId === invoice.id && editingProduct?.productId === item.id && editingProduct?.field === 'quantity' ? (
                                      <input
                                        type="number"
                                        value={editingProduct.value}
                                        onChange={(e) => setEditingProduct({...editingProduct, value: e.target.value})}
                                        onBlur={() => updateProductQuantity(invoice, item.id, editingProduct.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateProductQuantity(invoice, item.id, editingProduct.value)}
                                        className="w-10 px-1 py-0.5 text-[9px] border border-blue-500 rounded text-center font-bold"
                                        autoFocus
                                      />
                                    ) : (
                                      <button
                                        onClick={() => setEditingProduct({ invoiceId: invoice.id, productId: item.id, field: 'quantity', value: item.quantity })}
                                        className="w-6 h-6 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center text-[9px] font-bold"
                                        title="تعديل الكمية"
                                      >
                                        {item.quantity}
                                      </button>
                                    )}
                                  </div>

                                  {/* Product Name */}
                                  <span className="font-semibold text-gray-900 text-[10px] flex-1 truncate">{item.name}</span>

                                  {/* Price - Editable */}
                                  <div className="flex items-center gap-0.5">
                                    {editingProduct?.invoiceId === invoice.id && editingProduct?.productId === item.id && editingProduct?.field === 'price' ? (
                                      <input
                                        type="number"
                                        value={editingProduct.value}
                                        onChange={(e) => setEditingProduct({...editingProduct, value: e.target.value})}
                                        onBlur={() => updateProductPrice(invoice, item.id, editingProduct.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateProductPrice(invoice, item.id, editingProduct.value)}
                                        className="w-16 px-1 py-0.5 text-[9px] border border-blue-500 rounded text-right font-bold"
                                        autoFocus
                                      />
                                    ) : (
                                      <button
                                        onClick={() => setEditingProduct({ invoiceId: invoice.id, productId: item.id, field: 'price', value: item.price })}
                                        className="text-[10px] font-bold text-blue-700 hover:bg-blue-100 px-1 py-0.5 rounded"
                                        title="تعديل السعر"
                                      >
                                        {formatPrice(item.price)} ✏️
                                      </button>
                                    )}
                                  </div>

                                  {/* Total */}
                                  <span className="font-bold text-blue-800 text-[10px]">=</span>
                                  <span className="font-bold text-blue-700 text-[10px] w-14 text-left">
                                    {formatPrice(Number(item.price) * item.quantity)}
                                  </span>

                                  {/* Delete */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`هل تريد حذف "${item.name}" من الفاتورة؟`)) {
                                        deleteProductFromInvoice(invoice, item.id);
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                    title="حذف المنتج"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Product Selector Modal */}
                            {showProductSelector === invoice.id && (
                              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowProductSelector(null)}>
                                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                                  {/* Header */}
                                  <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                                    <h3 className="text-lg font-bold text-gray-900">اختر منتج للإضافة</h3>
                                    <button
                                      onClick={() => setShowProductSelector(null)}
                                      className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded flex items-center justify-center font-bold"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  
                                  {/* Search */}
                                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                                    <input
                                      type="text"
                                      placeholder="ابحث عن منتج..."
                                      value={productSearchTerm}
                                      onChange={(e) => setProductSearchTerm(e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500"
                                    />
                                  </div>

                                  {/* Products List */}
                                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                    {productsLoading ? (
                                      <div className="text-center py-8 text-gray-600">جاري التحميل...</div>
                                    ) : (
                                      <div className="grid grid-cols-1 gap-2">
                                        {availableProducts
                                          .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                                          .map((product) => (
                                          <div
                                            key={product.id}
                                            onClick={() => {
                                              if (product.type === 'variable') {
                                                handleSelectVariation(product);
                                              } else {
                                                addProductToInvoice(invoice, product);
                                              }
                                            }}
                                            className="p-3 border border-gray-300 bg-white rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer flex items-center justify-between transition-colors"
                                          >
                                            <div className="flex-1">
                                              <h4 className="font-bold text-sm text-gray-900">{product.name}</h4>
                                              <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                                                <span className="text-gray-700">السعر: {formatPrice(product.price)}</span>
                                                {product.type === 'variable' ? (
                                                  <span className="text-blue-600 font-semibold">منتج متغير - اختر المواصفات</span>
                                                ) : (
                                                  <span className={product.stock_quantity <= 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
                                                    المخزون: {product.stock_quantity}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <button 
                                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                                              disabled={product.type !== 'variable' && product.stock_quantity <= 0}
                                            >
                                              {product.type === 'variable' ? 'اختيارات' : product.stock_quantity <= 0 ? 'غير متوفر' : 'إضافة'}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Services List - Advanced Editing */}
                      <div>
                        {invoice.services?.length > 0 && (
                          <div>
                            <h5 className="text-[10px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                              <div className="w-1 h-3 bg-purple-600 rounded-full"></div>
                              الخدمات ({invoice.services.length})
                            </h5>
                          <div className="space-y-0.5">
                            {invoice.services.map((service, index) => (
                              <div key={index} className="group flex items-center justify-between text-[10px] bg-purple-50 rounded p-1.5 border border-purple-200">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="text-sm">🔧</span>
                                  <div className="flex-1">
                                    <span className="font-semibold text-gray-900 truncate block">{service.description}</span>
                                    {service.employeeName && (
                                      <span className="text-[9px] text-purple-600">({service.employeeName})</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-purple-700 flex-shrink-0">
                                    {formatPrice(service.amount)}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`هل تريد حذف خدمة "${service.description}" من الفاتورة؟`)) {
                                        deleteServiceFromInvoice(invoice, index);
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center text-[10px] font-bold"
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

                      {/* Add Service Section */}
                      <div>
                        {addingService === invoice.id ? (
                          <div className="bg-purple-50 border-2 border-purple-400 rounded p-2 space-y-1.5">
                            <h5 className="text-[10px] font-bold text-purple-900 mb-1">🔧 إضافة خدمة جديدة</h5>
                            <input
                              type="text"
                              placeholder="وصف الخدمة"
                              value={newService.description}
                              onChange={(e) => setNewService({...newService, description: e.target.value})}
                              className="w-full px-2 py-1 text-[10px] border border-purple-300 rounded"
                              autoFocus
                            />
                            <input
                              type="text"
                              placeholder="اسم العامل (اختياري)"
                              value={newService.employeeName}
                              onChange={(e) => setNewService({...newService, employeeName: e.target.value})}
                              className="w-full px-2 py-1 text-[10px] border border-purple-300 rounded"
                            />
                            <input
                              type="number"
                              placeholder="المبلغ"
                              value={newService.amount}
                              onChange={(e) => setNewService({...newService, amount: e.target.value})}
                              className="w-full px-2 py-1 text-[10px] border border-purple-300 rounded"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => addServiceToInvoice(invoice)}
                                className="flex-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-[10px] font-bold"
                              >
                                ✓ إضافة الخدمة
                              </button>
                              <button
                                onClick={() => {
                                  setAddingService(null);
                                  setNewService({ description: '', amount: 0, employeeName: '' });
                                }}
                                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-[10px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingService(invoice.id);
                            }}
                            className="w-full px-2 py-1.5 bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-700 rounded text-[10px] font-bold transition-colors"
                          >
                            + إضافة خدمة
                          </button>
                        )}
                      </div>
                      </div>

                      {/* Delivery Info - Compact */}
                      {invoice.delivery && (
                        <div className="bg-cyan-50 rounded p-2 border border-cyan-200">
                          <h5 className="text-[10px] font-bold text-cyan-900 mb-1">🚚 بيانات التوصيل</h5>
                          <div className="text-[10px] text-gray-700 space-y-0.5">
                            {invoice.delivery.customer?.name && (
                              <div>👤 {invoice.delivery.customer.name}</div>
                            )}
                            {invoice.delivery.customer?.phone && (
                              <div>📱 {invoice.delivery.customer.phone}</div>
                            )}
                            {invoice.delivery.customer?.address && (
                              <div>📍 {invoice.delivery.customer.address.city}, {invoice.delivery.customer.address.district}</div>
                            )}
                            {invoice.delivery.notes && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5 mt-1">
                                📝 {invoice.delivery.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Customer Info - if available */}
                      {invoice.customerInfo && !invoice.delivery && (
                        <div className="bg-indigo-50 rounded p-2 border border-indigo-200">
                          <h5 className="text-[10px] font-bold text-indigo-900 mb-1">👤 بيانات العميل</h5>
                          <div className="text-[10px] text-gray-700 space-y-0.5">
                            {invoice.customerInfo.name && <div>الاسم: {invoice.customerInfo.name}</div>}
                            {invoice.customerInfo.phone && <div>الهاتف: {invoice.customerInfo.phone}</div>}
                          </div>
                        </div>
                      )}

                      {/* Payment Status Details */}
                      {invoice.deliveryPayment && (
                        <div className={`rounded p-2 border ${
                          invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery'
                            ? 'bg-green-50 border-green-300'
                            : invoice.deliveryPayment.status === 'half_paid'
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-orange-50 border-orange-300'
                        }`}>
                          <div className="text-[10px] font-bold text-gray-900 mb-1">
                            {invoice.deliveryPayment.status === 'cash_on_delivery' && '💵 دفع عند الاستلام'}
                            {invoice.deliveryPayment.status === 'half_paid' && '💰 نصف المبلغ مدفوع'}
                            {invoice.deliveryPayment.status === 'fully_paid' && '✅ مدفوع كاملاً'}
                            {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && '💳 مدفوع كاملاً (بدون توصيل)'}
                          </div>
                          {invoice.deliveryPayment.status === 'half_paid' && (
                            <div className="grid grid-cols-2 gap-1 text-[9px]">
                              <div className="bg-white rounded px-1.5 py-1">
                                <span className="text-green-700">✓ مدفوع: </span>
                                <span className="font-bold text-green-900">{formatPrice(invoice.deliveryPayment.paidAmount)}</span>
                              </div>
                              <div className="bg-white rounded px-1.5 py-1">
                                <span className="text-red-700">⏳ متبقي: </span>
                                <span className="font-bold text-red-900">{formatPrice(invoice.deliveryPayment.remainingAmount)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Warning for items without purchase price */}
                      {(invoice.itemsWithoutProfit?.length > 0 || invoice.summary?.itemsWithoutPurchasePrice > 0) && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-1.5 flex items-start gap-1">
                          <span className="text-yellow-600 text-[10px]">⚠️</span>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold text-yellow-900">تحذير: أرباح غير دقيقة</p>
                            <p className="text-[9px] text-yellow-800">
                              {invoice.itemsWithoutProfit?.length || invoice.summary?.itemsWithoutPurchasePrice || 0} من {invoice.items?.length || 0} منتج بدون سعر شراء
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        printInvoice(invoice);
                      }}
                      className="flex-1 px-2 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      طباعة
                    </button>
                    
                    {!invoice.synced && invoice.items?.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          syncInvoice(invoice);
                        }}
                        disabled={syncingId === invoice.id}
                        className={`flex-1 px-2 py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          syncingId === invoice.id
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white'
                        }`}
                      >
                        <svg className={`w-3 h-3 ${syncingId === invoice.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {syncingId === invoice.id ? '...' : 'مزامنة'}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice);
                      }}
                      className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-bold transition-all"
                      title={selectedInvoice?.id === invoice.id ? 'إخفاء' : 'عرض التفاصيل'}
                    >
                      {selectedInvoice?.id === invoice.id ? '▲' : '▼'}
                    </button>
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

      {/* VariationSelector */}
      {variationSelectorProduct && variationSelectorVariations && showProductSelector && (
        <VariationSelector
          product={variationSelectorProduct}
          variations={variationSelectorVariations}
          onClose={() => {
            setVariationSelectorProduct(null);
            setVariationSelectorVariations(null);
          }}
          onSelect={(product, selectedVariation) => {
            // Get the invoice we're adding to
            const invoice = invoices.find(inv => inv.id === showProductSelector);
            if (invoice) {
              handleAddVariationToInvoice(invoice, product, selectedVariation);
            }
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}