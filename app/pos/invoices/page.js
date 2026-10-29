'use client';

import { useState, useEffect } from 'react';
import { invoiceStorage, productsCacheStorage } from '@/app/lib/localforage';
import { Toast } from '@/components/Toast';
import InvoiceModal from '@/app/pos/InvoiceModal';
import VariationSelector from '@/components/pos/VariationSelector';
import { APP_MODE_LABELS, getAppMode, ROLES } from '@/app/lib/roles-permissions';
import { warehouseStorage } from '@/app/lib/warehouse-storage';

function recalculateInvoiceAmounts(invoice, items, services) {
  const summary = invoice.summary || {};
  const productsSubtotal = (items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0
  );
  const servicesTotal = (services || []).reduce((sum, service) => sum + Number(service.amount || 0), 0);
  const subtotal = productsSubtotal + servicesTotal;
  const discount = summary.discount;
  const applyMode = discount?.applyMode || 'both';
  const discountBase = applyMode === 'products'
    ? productsSubtotal
    : applyMode === 'services'
      ? servicesTotal
      : subtotal;
  const discountType = String(discount?.type || '').toLowerCase();
  const discountValue = Number(discount?.value ?? discount?.amount ?? 0);
  const rawDiscountAmount = discountType === 'percentage' || discountType === 'percent'
    ? discountBase * discountValue / 100
    : discountValue;
  const discountAmount = Math.min(discountBase, Math.max(0, rawDiscountAmount));

  const requestedInvoiceDiscount = Number(summary.invoiceDiscount || 0);
  const invoiceDiscount = Math.min(Math.max(0, subtotal - discountAmount), Math.max(0, requestedInvoiceDiscount));
  const extraFeeType = String(summary.extraFeeType || 'amount').toLowerCase();
  const extraFeeValue = Number(summary.extraFeeValue ?? summary.extraFee ?? 0);
  const extraFee = extraFeeType === 'percentage'
    ? subtotal * extraFeeValue / 100
    : Number(summary.extraFee || 0);
  const deliveryFee = Number(summary.deliveryFee || 0);
  const total = Math.max(0, subtotal - discountAmount - invoiceDiscount + extraFee + deliveryFee);

  return {
    productsSubtotal,
    servicesTotal,
    subtotal,
    discount: discount ? { ...discount, amount: discountAmount } : discount,
    invoiceDiscount,
    extraFee,
    deliveryFee,
    total,
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, synced, pending
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all'); // all, cash, wallet, instapay, vera, other
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all'); // all, paid_full, paid_partial, returned
  const [filterDate, setFilterDate] = useState('all'); // all, today, yesterday, last7days, last30days
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editingDeliveryFee, setEditingDeliveryFee] = useState(null); // { invoiceId, value }
  const [editingInvoiceDiscount, setEditingInvoiceDiscount] = useState(null); // { invoiceId, value }
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(null); // { invoiceId, value }
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
  const [productQuantities, setProductQuantities] = useState({}); // {productId: quantity}

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

  useEffect(() => {
    if (getAppMode() === ROLES.ASSISTANT_MANAGER) {
      setFilterDate('today');
    }
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
      const invoiceWithNewFee = {
        ...invoice,
        summary: { ...invoice.summary, deliveryFee: fee },
      };
      const amounts = recalculateInvoiceAmounts(invoiceWithNewFee, invoice.items || [], invoice.services || []);
      
      // تحديث deliveryPayment.remainingAmount لو كان fully_paid_no_delivery
      let updatedDeliveryPayment = invoice.deliveryPayment;
      if (invoice.deliveryPayment?.status === 'fully_paid_no_delivery') {
        updatedDeliveryPayment = {
          ...invoice.deliveryPayment,
          remainingAmount: fee,
          paidAmount: Math.max(0, amounts.total - fee)
        };
      }
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoiceWithNewFee,
        summary: {
          ...invoiceWithNewFee.summary,
          ...amounts,
        },
        deliveryPayment: updatedDeliveryPayment
      };

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

      // Update invoice items - recalculate totalPrice for each item
      const updatedItems = invoice.items.map(item => {
        if (item.id === productId) {
          const newTotalPrice = Number(item.price) * quantity;
          return { 
            ...item, 
            quantity,
            totalPrice: newTotalPrice // 🔥 إعادة حساب totalPrice
          };
        }
        return item;
      });

      // Recalculate totals
      const amounts = recalculateInvoiceAmounts(invoice, updatedItems, invoice.services || []);

      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          ...amounts,
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
      const amounts = recalculateInvoiceAmounts(invoice, updatedItems, invoice.services || []);

      const updatedInvoice = {
        ...invoice,
        items: updatedItems,
        summary: {
          ...invoice.summary,
          ...amounts,
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
  const addProductToInvoice = async (invoice, product, specifiedQuantity = null) => {
    try {
      // الحصول على الكمية المطلوبة
      const quantity = specifiedQuantity || productQuantities[product.id] || 1;
      
      // التحقق من المخزون
      if (product.stock_quantity <= 0) {
        setToast({ message: '❌ المنتج غير متوفر في المخزون', type: 'error' });
        return;
      }
      
      if (product.stock_quantity < quantity) {
        setToast({ message: `❌ المخزون المتاح: ${product.stock_quantity} فقط`, type: 'error' });
        return;
      }

      // خصم الكمية من المخزون في API - check if variation
      const updatePayload = product.variation_id ? {
        productId: product.parent_id || product.parentId || product.product_id,
        variationId: product.variation_id,
        adjustment: -quantity
      } : {
        productId: product.id,
        adjustment: -quantity
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
        quantity: quantity,
        totalPrice: product.price * quantity,
        purchase_price: product.purchase_price || null,
        profit: product.purchase_price ? ((product.price - product.purchase_price) * quantity) : null,
        hasPurchasePrice: !!product.purchase_price,
        // حفظ معلومات المتغير إذا كان متغير
        ...(product.variation_id && {
          variation_id: product.variation_id,
          parent_id: product.parent_id || product.parentId || product.product_id,
          is_variation: true
        })
      };

      const updatedItems = [...(invoice.items || []), newInvoiceItem];
      
      // إعادة حساب المجاميع مع الحفاظ على جميع أنواع الخصم
      const amounts = recalculateInvoiceAmounts(invoice, updatedItems, invoice.services || []);
      const extraFeeAmount = amounts.extraFee;
      
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
          ...amounts,
          productsProfit
        }
      };
      
      await invoiceStorage.updateInvoice(invoice.id, updatedInvoice);
      await loadInvoices();
      
      // إعادة تعيين الكمية
      setProductQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[product.id];
        return newQuantities;
      });
      
      setShowProductSelector(null);
      setToast({ message: `✅ تمت إضافة ${quantity} من المنتج للفاتورة`, type: 'success' });
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
      
      // Recalculate totals and preserve the original discount configuration.
      const amounts = recalculateInvoiceAmounts(invoice, invoice.items || [], updatedServices);

      const updatedInvoice = {
        ...invoice,
        services: updatedServices,
        summary: {
          ...invoice.summary,
          ...amounts,
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

      const discountAmount = Math.max(0, parseFloat(editingInvoiceDiscount.value) || 0);
      const invoiceWithDiscount = {
        ...invoice,
        summary: { ...invoice.summary, invoiceDiscount: discountAmount },
      };
      const amounts = recalculateInvoiceAmounts(invoiceWithDiscount, invoice.items || [], invoice.services || []);
      
      // تحديث الفاتورة
      const updatedInvoice = {
        ...invoiceWithDiscount,
        summary: {
          ...invoiceWithDiscount.summary,
          ...amounts,
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
      const updates = (invoice.items || []).map((item) => {
        const target = getInvoiceStockTarget(item);
        return {
          productId: target.productId,
          ...(target.variationId ? { variationId: target.variationId } : {}),
          newQuantity: Math.max(0, Number(item.stock_quantity || 0) - Number(item.quantity || 0)),
        };
      });

      const res = await fetch('/api/pos/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      const details = Array.isArray(data.details) ? data.details : [];
      const successCount = details.filter(detail => ['updated', 'verified'].includes(detail.status)).length;
      const failedCount = details.filter(detail => detail.status === 'failed').length;
      if (!res.ok && res.status !== 207) throw new Error(data.error || 'فشل تحديث المخزون');
      if (successCount === 0) throw new Error('لم يتم تحديث أي صنف');

      await invoiceStorage.markInvoiceAsSynced(invoice.id, details);
      setToast({
        message: failedCount
          ? `تم تحديث ${successCount} أصناف، وفشل ${failedCount}. لا تحذف الفاتورة حتى تراجع المخزون.`
          : `تم تحديث المخزون (${successCount} أصناف)`,
        type: failedCount ? 'warning' : 'success',
      });
      await loadInvoices();
    } catch (error) {
      setToast({ message: error.message || 'فشل تحديث المخزون', type: 'error' });
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
                 invoice.paymentMethod === 'instapay' ? 'انستا باي' :
                 invoice.paymentMethod === 'vera' ? 'مكنة فيزا' :
                             invoice.paymentMethod === 'card' ? 'بطاقة' :
                             invoice.paymentMethod === 'split'
                               ? (invoice.paymentBreakdown || []).map(part => `${part.method} ${Number(part.amount || 0).toFixed(2)}`).join(' + ')
                               : 'أخرى';
        
        // Financial details
        const productsSubtotal = invoice.summary?.productsSubtotal || 0;
        const servicesTotal = invoice.summary?.servicesTotal || 0;
        const subtotal = invoice.summary?.subtotal || 0;
        const discountType = invoice.summary?.discount?.type === 'percentage' ? 'نسبة مئوية' :
                ['fixed', 'amount'].includes(invoice.summary?.discount?.type) ? 'مبلغ ثابت' : '-';
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

  const saveInvoicePaymentMethod = async (invoice) => {
    if (!editingPaymentMethod || editingPaymentMethod.invoiceId !== invoice.id) return;
    if (invoice.source === 'order' || invoice.orderId) {
      setEditingPaymentMethod(null);
      setToast({ message: 'طريقة دفع أوردر الموقع تُعدّل من الأوردر الأصلي، وليس من الفاتورة المحلية.', type: 'warning' });
      return;
    }
    const nextMethod = editingPaymentMethod.value;
    const previousMethod = invoice.paymentMethod || 'other';
    if (!nextMethod || nextMethod === previousMethod) {
      setEditingPaymentMethod(null);
      return;
    }

    try {
      await invoiceStorage.updateInvoicePaymentMethod(invoice.id, nextMethod);
      const updatedInvoice = { ...invoice, paymentMethod: nextMethod };
      setInvoices(prev => prev.map(item => String(item.id) === String(invoice.id) ? updatedInvoice : item));
      setSelectedInvoice(prev => prev?.id === invoice.id ? updatedInvoice : prev);
      setEditingPaymentMethod(null);

      try {
        const { logInvoicePaymentMethodChanged } = await import('@/app/lib/audit-logger');
        const mode = getAppMode();
        await logInvoicePaymentMethodChanged(invoice, previousMethod, nextMethod, {
          type: mode,
          name: APP_MODE_LABELS[mode] || 'المالك',
        });
      } catch (auditError) {
        console.error('Failed to audit payment method change:', auditError);
      }

      setToast({ message: '✅ تم تحديث طريقة الدفع، ستظهر في الفاتورة عند طباعتها', type: 'success' });
    } catch (error) {
      setToast({ message: `❌ فشل تعديل طريقة الدفع: ${error.message}`, type: 'error' });
    }
  };

  const getInvoiceStockTarget = (item) => {
    const compositeId = String(item.id || '').match(/^(\d+)_var_(\d+)$/);
    const productId = item.parent_id || item.parentId || item.product_id || item.productId || compositeId?.[1] || item.id;
    const variationId = item.variation_id || compositeId?.[2] || null;
    return {
      productId: Number(productId),
      variationId: variationId ? Number(variationId) : null,
      key: `${productId}:${variationId || 'simple'}:${item.id}`,
    };
  };

  const deleteInvoice = async () => {
    const invoice = invoiceToDelete;
    if (!invoice) return;
    setDeletingInvoiceId(invoice.id);

    try {
      let restoredCount = 0;
      let legacyStockWarning = false;
      const isWebsiteOrder = invoice.source === 'order' || Boolean(invoice.orderId);

      // Website orders own their stock lifecycle. Never touch that stock here.
      if (!isWebsiteOrder && invoice.synced && Array.isArray(invoice.stockSyncDetails)) {
        const restoredKeys = new Set(invoice.stockRestoredItems || []);
        for (const [index, item] of (invoice.items || []).entries()) {
          const target = getInvoiceStockTarget(item);
          const syncDetail = invoice.stockSyncDetails.find(detail =>
            Number(detail.productId) === target.productId &&
            Number(detail.variationId || 0) === Number(target.variationId || 0) &&
            ['updated', 'verified'].includes(detail.status)
          );
          if (!syncDetail || restoredKeys.has(target.key)) continue;

          const response = await fetch('/api/pos/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              updates: [{
                productId: target.productId,
                ...(target.variationId ? { variationId: target.variationId } : {}),
                adjustment: Number(item.quantity) || 0,
              }],
            }),
          });
          const result = await response.json().catch(() => ({}));
          const resultDetail = result.details?.[0];
          if (!response.ok || !['updated', 'verified'].includes(resultDetail?.status)) {
            throw new Error(`تعذر إرجاع مخزون المنتج ${item.name || target.productId}. لم تُحذف الفاتورة.`);
          }

          restoredKeys.add(target.key);
          restoredCount += 1;
          const latestInvoice = await invoiceStorage.getInvoice(invoice.id) || invoice;
          await invoiceStorage.updateInvoice(invoice.id, {
            ...latestInvoice,
            stockRestoredItems: [...restoredKeys],
          });

          if (target.variationId) {
            const localStock = await warehouseStorage.getVariationLocalStock(target.variationId);
            await warehouseStorage.setVariationLocalStock(target.variationId, localStock + (Number(item.quantity) || 0));
          }
        }
      } else if (!isWebsiteOrder && invoice.synced && !Array.isArray(invoice.stockSyncDetails)) {
        // Legacy invoices do not include per-item sync evidence, so automatic restocking is unsafe.
        legacyStockWarning = true;
      }

      await invoiceStorage.deleteInvoice(invoice.id);
      if (restoredCount > 0) {
        await productsCacheStorage.invalidateCache();
      }
      setInvoices(prev => prev.filter(item => String(item.id) !== String(invoice.id)));
      setSelectedInvoice(prev => prev?.id === invoice.id ? null : prev);
      setInvoiceToDelete(null);

      try {
        const { logInvoiceDeleted } = await import('@/app/lib/audit-logger');
        const mode = getAppMode();
        await logInvoiceDeleted(invoice, { type: mode, name: APP_MODE_LABELS[mode] || 'المالك' });
      } catch (auditError) {
        console.error('Failed to audit invoice deletion:', auditError);
      }

      const message = isWebsiteOrder
        ? 'تم حذف نسخة الفاتورة المحلية فقط؛ أوردر الموقع لم يتغير.'
        : legacyStockWarning
          ? 'تم حذف الفاتورة القديمة، ولم يتم تعديل المخزون لعدم وجود سجل مزامنة تفصيلي.'
          : `تم حذف الفاتورة${restoredCount ? ` وإرجاع مخزون ${restoredCount} صنف` : ''}.`;
      setToast({ message, type: legacyStockWarning ? 'warning' : 'success' });
    } catch (error) {
      setToast({ message: `❌ ${error.message || 'فشل حذف الفاتورة'}`, type: 'error' });
    } finally {
      setDeletingInvoiceId(null);
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
      const amounts = recalculateInvoiceAmounts(invoice, updatedItems, invoice.services || []);
      const { productsSubtotal, servicesTotal, subtotal, total } = amounts;
      const discountAmount = amounts.discount?.amount || 0;
      const extraFeeAmount = amounts.extraFee;
      
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
          ...amounts,
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
      const amounts = recalculateInvoiceAmounts(invoice, invoice.items || [], updatedServices);
      const { productsSubtotal, servicesTotal, subtotal, total } = amounts;
      const discountAmount = amounts.discount?.amount || 0;
      const extraFeeAmount = amounts.extraFee;
      
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
          ...amounts,
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
  const getInvoiceRevenueForPaymentFilter = (invoice) => {
    const invoiceTotal = Number(invoice.summary?.total || 0);
    if (filterPaymentMethod === 'all' || filterPaymentMethod === 'online') return invoiceTotal;
    if (invoice.paymentMethod !== 'split') return invoiceTotal;
    return (invoice.paymentBreakdown || [])
      .filter(part => part.method === filterPaymentMethod)
      .reduce((sum, part) => sum + (Number(part.amount) || 0), 0);
  };

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
        const hasSplitMethod = invoicePaymentMethod === 'split' &&
          (invoice.paymentBreakdown || []).some(part => part.method === filterPaymentMethod && Number(part.amount) > 0);
        if (invoicePaymentMethod !== filterPaymentMethod && !hasSplitMethod) return false;
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
    totalRevenue: filteredInvoices.reduce((sum, inv) => sum + getInvoiceRevenueForPaymentFilter(inv), 0),
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
                <p className="text-purple-100 text-sm font-medium">
                  {filterDate === 'today' ? 'إجمالي مبيعات اليوم' : 'إجمالي المبيعات'}
                </p>
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
                      invoice.paymentMethod === 'split' ? 'bg-indigo-100 text-indigo-700' :
                      invoice.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                      invoice.paymentMethod === 'wallet' ? 'bg-purple-100 text-purple-700' :
                      invoice.paymentMethod === 'instapay' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invoice.source === 'order' ? '🌐' :
                       invoice.paymentMethod === 'split' ? '🧾' :
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

                      {/* Payment Method - Editable */}
                      <div className="bg-blue-50 rounded p-2 border border-blue-200">
                        <label className="text-[10px] font-bold text-gray-700 mb-1 block">💳 طريقة الدفع:</label>
                        {invoice.source === 'order' ? (
                          <div className="text-[10px] text-blue-800">
                            {invoice.paymentMethod || 'غير محدد'} — مصدرها الستور ولا تُعدّل من الفاتورة المحلية.
                          </div>
                        ) : editingPaymentMethod?.invoiceId === invoice.id ? (
                          <div className="flex gap-1.5">
                            <select
                              value={editingPaymentMethod.value}
                              onChange={(e) => setEditingPaymentMethod({ invoiceId: invoice.id, value: e.target.value })}
                              className="flex-1 px-2 py-1 rounded text-[10px] font-bold border border-blue-300 bg-white"
                            >
                              <option value="cash">💵 كاش</option>
                              <option value="wallet">👛 محفظة</option>
                              <option value="instapay">📱 انستا باي</option>
                              <option value="vera">💳 مكنة فيزا</option>
                              <option value="other">➕ أخرى</option>
                            </select>
                            <button
                              onClick={() => saveInvoicePaymentMethod(invoice)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold"
                            >حفظ</button>
                            <button
                              onClick={() => setEditingPaymentMethod(null)}
                              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-bold"
                            >إلغاء</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-blue-900">
                              {invoice.paymentMethod === 'cash' ? '💵 كاش' :
                               invoice.paymentMethod === 'wallet' ? '👛 محفظة' :
                               invoice.paymentMethod === 'instapay' ? '📱 انستا باي' :
                               invoice.paymentMethod === 'vera' ? '💳 مكنة فيزا' :
                               invoice.paymentMethod === 'other' ? '➕ أخرى' : (invoice.paymentMethod || 'غير محدد')}
                            </span>
                            <button
                              onClick={() => setEditingPaymentMethod({ invoiceId: invoice.id, value: invoice.paymentMethod || 'cash' })}
                              className="px-2 py-1 bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 rounded text-[10px] font-bold"
                            >تعديل ✏️</button>
                          </div>
                        )}
                      </div>

                      {invoice.paymentMethod === 'split' && invoice.paymentBreakdown?.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded p-2">
                          <div className="text-[10px] font-bold text-indigo-900 mb-1">🧾 تقسيم الدفع:</div>
                          <div className="space-y-0.5">
                            {invoice.paymentBreakdown.map((part, index) => {
                              const labels = { cash: 'كاش', wallet: 'محفظة', instapay: 'انستا باي', vera: 'مكنة فيزا', card: 'بطاقة', other: 'أخرى' };
                              return (
                                <div key={`${part.method}-${index}`} className="flex justify-between text-[10px] text-indigo-900">
                                  <span>{labels[part.method] || part.method}</span>
                                  <span className="font-bold">{Number(part.amount || 0).toFixed(2)} ج.م</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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

                            {/* Product Selector Modal - Enhanced UI */}
                            {showProductSelector === invoice.id && (
                              <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowProductSelector(null)}>
                                <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                  {/* Header */}
                                  <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                                    <div>
                                      <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                        🛒 اختر منتج للإضافة
                                      </h3>
                                      <p className="text-blue-100 text-sm mt-1">اختر المنتج وحدد الكمية المطلوبة</p>
                                    </div>
                                    <button
                                      onClick={() => setShowProductSelector(null)}
                                      className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full flex items-center justify-center font-bold transition-all"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  
                                  {/* Search */}
                                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="🔍 ابحث عن منتج بالاسم..."
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        className="w-full px-4 py-3 pr-10 border-2 border-gray-300 focus:border-blue-500 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                      />
                                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                        🔍
                                      </span>
                                    </div>
                                  </div>

                                  {/* Products List */}
                                  <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
                                    {productsLoading ? (
                                      <div className="text-center py-16">
                                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                                        <p className="text-gray-600 mt-4 font-semibold">جاري تحميل المنتجات...</p>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 gap-4">
                                        {availableProducts
                                          .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                                          .map((product) => {
                                            const quantity = productQuantities[product.id] || 1;
                                            const productImage = product.images && product.images.length > 0 
                                              ? product.images[0].src 
                                              : '/placeholder-product.png';
                                            
                                            return (
                                              <div
                                                key={product.id}
                                                className="border-2 border-gray-200 bg-white rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200 overflow-hidden"
                                              >
                                                <div className="flex items-center gap-4 p-4">
                                                  {/* Product Image */}
                                                  <div className="flex-shrink-0">
                                                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                                                      <img 
                                                        src={productImage} 
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" font-size="40" text-anchor="middle" dy=".3em" fill="%239ca3af"%3E📦%3C/text%3E%3C/svg%3E';
                                                        }}
                                                      />
                                                    </div>
                                                  </div>

                                                  {/* Product Info */}
                                                  <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-lg text-gray-900 mb-2 truncate">{product.name}</h4>
                                                    <div className="flex items-center gap-4 flex-wrap">
                                                      <span className="px-3 py-1 bg-green-100 text-green-800 font-bold text-sm rounded-full">
                                                        💰 {formatPrice(product.price)} جنيه
                                                      </span>
                                                      {product.type === 'variable' ? (
                                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 font-semibold text-sm rounded-full">
                                                          🎨 منتج متغير
                                                        </span>
                                                      ) : (
                                                        <span className={`px-3 py-1 font-bold text-sm rounded-full ${
                                                          product.stock_quantity <= 0 
                                                            ? 'bg-red-100 text-red-700' 
                                                            : product.stock_quantity < 10
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                          📦 المخزون: {product.stock_quantity}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Quantity & Add Button */}
                                                  <div className="flex items-center gap-3">
                                                    {product.type !== 'variable' && product.stock_quantity > 0 && (
                                                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            const newQty = Math.max(1, quantity - 1);
                                                            setProductQuantities(prev => ({
                                                              ...prev,
                                                              [product.id]: newQty
                                                            }));
                                                          }}
                                                          className="w-8 h-8 bg-white hover:bg-red-100 text-red-600 rounded font-bold text-xl flex items-center justify-center"
                                                        >
                                                          −
                                                        </button>
                                                        <span className="w-14 text-center font-bold text-xl text-gray-900">
                                                          {quantity}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            const newQty = Math.min(quantity + 1, product.stock_quantity);
                                                            setProductQuantities(prev => ({
                                                              ...prev,
                                                              [product.id]: newQty
                                                            }));
                                                          }}
                                                          className="w-8 h-8 bg-white hover:bg-green-100 text-green-600 rounded font-bold text-xl flex items-center justify-center"
                                                        >
                                                          +
                                                        </button>
                                                      </div>
                                                    )}
                                                    
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (product.type === 'variable') {
                                                          handleSelectVariation(product);
                                                        } else {
                                                          addProductToInvoice(invoice, product);
                                                        }
                                                      }}
                                                      disabled={product.type !== 'variable' && product.stock_quantity <= 0}
                                                      className={`px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        product.type === 'variable'
                                                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                                                          : product.stock_quantity <= 0
                                                          ? 'bg-gray-400 text-white'
                                                          : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                                                      }`}
                                                    >
                                                      {product.type === 'variable' 
                                                        ? '🎨 اختر المواصفات' 
                                                        : product.stock_quantity <= 0 
                                                        ? '❌ غير متوفر' 
                                                        : `➕ إضافة${quantity > 1 ? ` (${quantity})` : ''}`}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        
                                        {availableProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase())).length === 0 && (
                                          <div className="text-center py-16">
                                            <div className="text-6xl mb-4">🔍</div>
                                            <p className="text-gray-600 font-semibold text-lg">لا توجد منتجات مطابقة للبحث</p>
                                            <p className="text-gray-500 text-sm mt-2">حاول البحث بكلمات أخرى</p>
                                          </div>
                                        )}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceToDelete(invoice);
                      }}
                      disabled={deletingInvoiceId === invoice.id}
                      className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-bold disabled:opacity-50"
                      title="حذف الفاتورة كاملة"
                    >
                      {deletingInvoiceId === invoice.id ? '…' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">حذف الفاتورة كاملة؟</h3>
              <p className="text-sm text-gray-600">
                الفاتورة <strong>#{String(invoiceToDelete.id).split('-').pop()}</strong> بقيمة{' '}
                <strong>{formatPrice(invoiceToDelete.summary?.total)} ج.م</strong> ستُحذف من سجل الفواتير.
              </p>
              {invoiceToDelete.source === 'order' || invoiceToDelete.orderId ? (
                <p className="mt-3 p-2 rounded-lg bg-blue-50 text-blue-800 text-xs">
                  هذه فاتورة أوردر موقع؛ سيتم حذف النسخة المحلية فقط ولن يتغير الأوردر الأصلي.
                </p>
              ) : invoiceToDelete.synced && !Array.isArray(invoiceToDelete.stockSyncDetails) ? (
                <p className="mt-3 p-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
                  فاتورة قديمة بلا تفاصيل مزامنة مخزون؛ سيتم حذفها دون تغيير المخزون.
                </p>
              ) : invoiceToDelete.synced ? (
                <p className="mt-3 p-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
                  سيُعاد للمخزون فقط ما ثبت نجاح مزامنته من أصناف هذه الفاتورة.
                </p>
              ) : null}
              <p className="text-xs text-red-600 mt-3">لا يمكن التراجع عن حذف الفاتورة.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setInvoiceToDelete(null)}
                disabled={deletingInvoiceId === invoiceToDelete.id}
                className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold disabled:opacity-50"
              >إلغاء</button>
              <button
                onClick={deleteInvoice}
                disabled={deletingInvoiceId === invoiceToDelete.id}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {deletingInvoiceId === invoiceToDelete.id ? 'جاري الحذف...' : 'حذف الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}

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