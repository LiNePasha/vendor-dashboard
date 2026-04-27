"use client";

import { useEffect, useRef, useState } from "react";
import { invoiceStorage } from "@/app/lib/localforage";
import { uploadToCloudinary } from "@/app/lib/cloudinary";
import BostaLocationSelector from "@/components/BostaLocationSelector";

export default function OrderDetailsModal({ 
  order, 
  isOpen, 
  onClose, 
  onStatusChange,
  showToast,
  orderNote,
  onEditNote,
  editingNote,
  noteText,
  onNoteTextChange,
  onSaveNote,
  savingNote,
  onCancelNote,
  onShippingUpdate,
  onOrderMetaUpdate
}) {
  const modalRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [registeringInvoice, setRegisteringInvoice] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingAmount, setShippingAmount] = useState("");
  const [updatingShipping, setUpdatingShipping] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    cityId: "",
    districtId: "",
    zoneId: "",
    address_index: "",
  });
  
  // 🆕 State for editing line items
  const [editingItems, setEditingItems] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const [updatingItems, setUpdatingItems] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // 🔥 كل المنتجات محملة مرة واحدة
  const [loadingProducts, setLoadingProducts] = useState(false);
  const searchTimeoutRef = useRef(null);
  
  // 🆕 State for variable products
  const [selectedVariableProduct, setSelectedVariableProduct] = useState(null);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [transferImageInput, setTransferImageInput] = useState("");
  const [cashierCodeInput, setCashierCodeInput] = useState("");
  const [savingOrderMeta, setSavingOrderMeta] = useState(false);
  const [transferImageFile, setTransferImageFile] = useState(null);
  const [uploadingTransferImage, setUploadingTransferImage] = useState(false);

  if (!isOpen || !order) return null;

  // 🔍 Debug: طباعة كل الـ order structure
  console.log('🔍 Full Order Object:', order);
  console.log('🔍 Order Keys:', Object.keys(order));
  console.log('🔍 Customer Note:', order.customer_note);

  // 🆕 استخراج بيانات الدفع من meta_data
  // 🔥 FIX: نستخدم آخر entry بنفس الـ key (مش الأولى) عشان لو في duplicates تظهر الأحدث
  const getMetaValue = (key) => {
    const entries = order.meta_data?.filter(m => m.key === key);
    if (!entries || entries.length === 0) return undefined;
    return entries[entries.length - 1].value;
  };

  const paymentType = getMetaValue('_payment_type');
  const paidAmount = getMetaValue('_paid_amount');
  const remainingAmount = getMetaValue('_remaining_amount');
  const paymentNote = getMetaValue('_payment_note');
  const instaPayProof = getMetaValue('_instapay_payment_proof');
  const orderImage = getMetaValue('order_image');
  const orderSource = getMetaValue('_order_source');
  const cashierCode = getMetaValue('_kashier_transaction_id');
  const paymentUpdatedAt = getMetaValue('_payment_updated_at');

  const formatPaymentDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch { return isoStr; }
  };
  const shippingAddressIndex = getMetaValue('_shipping_address_index');
  const isSpare2AppOrder = orderSource === 'spare2app';
  const hasCashierCode = !!String(cashierCode || '').trim();

  const isHalfPayment = paymentType === 'half_payment';
  const isFullPayment = paymentType === 'full_payment';

  // 🆕 التحقق من نوع التوصيل
  const isStorePickup = order.meta_data?.some(
    m => (m.key === '_is_store_pickup' && m.value === 'yes') || 
         (m.key === '_delivery_type' && m.value === 'store_pickup')
  );

  const deliveryType = isStorePickup ? 'استلام من المتجر' : 'توصيل';
  const deliveryIcon = isStorePickup ? '🏪' : '🚚';
  const deliveryColor = isStorePickup ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200';
  const shippingTotal = parseFloat(order.shipping_total || 0);
  const orderTotal = parseFloat(order.total || 0);
  const productsTotal = Math.max(0, orderTotal - shippingTotal);

  useEffect(() => {
    setShippingAmount((parseFloat(order?.shipping_total || 0) || 0).toString());
    setEditingShipping(false);
    setAddressForm({
      first_name: order?.shipping?.first_name || order?.billing?.first_name || '',
      last_name: order?.shipping?.last_name || order?.billing?.last_name || '',
      phone: order?.billing?.phone || order?.shipping?.phone || '',
      address_1: order?.shipping?.address_1 || getMetaValue('_shipping_address_1') || '',
      address_2: order?.shipping?.address_2 || getMetaValue('_shipping_area') || '',
      city: getMetaValue('_shipping_city_name') || getMetaValue('_shipping_city') || order?.shipping?.city || '',
      state: getMetaValue('_shipping_district_name') || getMetaValue('_shipping_state') || order?.shipping?.state || '',
      cityId: getMetaValue('_shipping_city_id') || '',
      districtId: getMetaValue('_shipping_district_id') || '',
      zoneId: getMetaValue('_shipping_zone_id') || '',
      address_index: getMetaValue('_shipping_address_index') || '',
    });
    setEditingAddress(false);
    // 🆕 Initialize line items
    setLineItems(order?.line_items ? JSON.parse(JSON.stringify(order.line_items)) : []);
    setEditingItems(false);
    setTransferImageInput(orderImage || '');
    setCashierCodeInput(cashierCode || '');
    setTransferImageFile(null);
  }, [order]);

  const updateOrderMetaKey = async (key, value) => {
    // 🔥 FIX: ابعت الـ id بتاع الـ meta entry عشان WooCommerce يعمل UPDATE مش INSERT
    // لو بعتنا بدون id، WooCommerce بيضيف entry جديدة وبيخلي القديمة — فـ find() بترجع القديمة
    const existingMeta = order.meta_data?.find(m => m.key === key);
    const metaPayload = { key, value };
    if (existingMeta?.id) {
      metaPayload.id = existingMeta.id;
    }

    const response = await fetch('/api/orders/update-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        metaData: metaPayload
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || `فشل تحديث ${key}`);
    }
  };

  const handleSaveTransferImage = async () => {
    try {
      setSavingOrderMeta(true);
      const nowIso = new Date().toISOString();
      await updateOrderMetaKey('order_image', transferImageInput.trim());
      await updateOrderMetaKey('_payment_updated_at', nowIso);

      if (onOrderMetaUpdate) {
        onOrderMetaUpdate(order.id, {
          order_image: transferImageInput.trim(),
          _payment_updated_at: nowIso
        });
      }

      if (showToast) showToast('✅ تم تحديث صورة التحويل');
    } catch (error) {
      console.error('Transfer image update error:', error);
      if (showToast) showToast(error.message || '❌ فشل تحديث صورة التحويل', 'error');
    } finally {
      setSavingOrderMeta(false);
    }
  };

  const handleUploadTransferImageFromDevice = async () => {
    try {
      if (!transferImageFile) {
        if (showToast) showToast('⚠️ اختار صورة الأول', 'error');
        return;
      }

      setUploadingTransferImage(true);
      const uploadedUrl = await uploadToCloudinary(transferImageFile);

      const nowIso = new Date().toISOString();
      await updateOrderMetaKey('order_image', uploadedUrl);
      await updateOrderMetaKey('_payment_updated_at', nowIso);
      setTransferImageInput(uploadedUrl);

      if (onOrderMetaUpdate) {
        onOrderMetaUpdate(order.id, {
          order_image: uploadedUrl,
          _payment_updated_at: nowIso
        });
      }

      setTransferImageFile(null);
      if (showToast) showToast('✅ تم رفع الصورة وحفظها بنجاح');
    } catch (error) {
      console.error('Transfer image upload error:', error);
      if (showToast) showToast(error.message || '❌ فشل رفع الصورة', 'error');
    } finally {
      setUploadingTransferImage(false);
    }
  };

  const handleSaveCashierCode = async () => {
    try {
      const normalizedCode = cashierCodeInput.trim();
      setSavingOrderMeta(true);
      const nowIso = new Date().toISOString();

      await updateOrderMetaKey('_kashier_transaction_id', normalizedCode);
      await updateOrderMetaKey('_payment_updated_at', nowIso);

      // ✅ حسب الطلب: لو اتحط كود كاشير نمسح صورة التحويل
      if (normalizedCode) {
        await updateOrderMetaKey('order_image', '');
        setTransferImageInput('');
      }

      if (onOrderMetaUpdate) {
        onOrderMetaUpdate(order.id, normalizedCode
          ? {
              _kashier_transaction_id: normalizedCode,
              order_image: '',
              _payment_updated_at: nowIso
            }
          : {
              _kashier_transaction_id: normalizedCode,
              _payment_updated_at: nowIso
            }
        );
      }

      if (showToast) {
        showToast(normalizedCode
          ? '✅ تم حفظ كود الكاشير وتم حذف صورة التحويل تلقائيًا'
          : '✅ تم مسح كود الكاشير');
      }
    } catch (error) {
      console.error('Cashier code update error:', error);
      if (showToast) showToast(error.message || '❌ فشل حفظ كود الكاشير', 'error');
    } finally {
      setSavingOrderMeta(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id, status: newStatus }),
      });

      if (!res.ok) throw new Error("فشل تحديث الحالة");

      const updatedOrder = await res.json();
      
      if (onStatusChange) {
        onStatusChange(order.id, updatedOrder.status);
      }
      
      if (showToast) {
        showToast("تم تحديث حالة الطلب!");
      }
    } catch (err) {
      if (showToast) {
        showToast("فشل تغيير الحالة!", "error");
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle register invoice
  const handleRegisterInvoice = async () => {
    setRegisteringInvoice(true);
    try {
      const existingInvoices = await invoiceStorage.getAllInvoices();
      const alreadyRegistered = existingInvoices.some(inv => inv.orderId === order.id);
      
      if (alreadyRegistered) {
        if (showToast) {
          showToast("هذا الطلب مسجل بالفعل في الفواتير!", "error");
        }
        return;
      }

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

      // 🔥 حساب صحيح: مجموع المنتجات فقط
      const productsSubtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const shippingFee = parseFloat(order.shipping_total || 0);
      const discountAmount = parseFloat(order.discount_total || 0);
      const orderTotal = parseFloat(order.total);
      
      // 🏠 تحليل العنوان من meta_data لإنشاء address object
      const parseAddress = () => {
        const addressObj = {
          state: getMetaValue('_shipping_state') || order.shipping?.state || '',
          city: getMetaValue('_shipping_city') || order.shipping?.city || '',
          area: getMetaValue('_shipping_area') || '',
          street: getMetaValue('_shipping_address_1') || order.shipping?.address_1 || '',
          building: getMetaValue('_shipping_building') || '',
          floor: getMetaValue('_shipping_floor') || '',
          apartment: getMetaValue('_shipping_apartment') || '',
          landmark: getMetaValue('_shipping_landmark') || ''
        };
        return addressObj;
      };
      
      const addressObject = parseAddress();
      
      // 🔍 Debug: طباعة الملاحظات للتأكد
      console.log('📝 Order Notes:', {
        orderNote: orderNote,
        customerNote: order.customer_note,
        hasOrderNote: !!orderNote,
        hasCustomerNote: !!order.customer_note
      });
      
      const invoice = {
        id: `order-${order.id}-${Date.now()}`,
        orderId: order.id,
        date: new Date().toISOString(),
        items: invoiceItems,
        services: [],
        orderType: 'delivery', // 🚚 نوع الطلب
        orderNotes: orderNote || '', // 🔥 ملاحظاتنا الداخلية
        customerNote: order.customer_note || '', // 🔥 ملاحظات العميل
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
          deliveryFee: shippingFee, // 🚚 رسوم الشحن
          total: orderTotal,
          totalProfit: 0,
          profitItemsCount: 0
        },
        profitDetails: [],
        paymentMethod: order.payment_method_title || 'غير محدد',
        paymentStatus: 'partial', // 🔥 مدفوع جزئي (المنتجات فقط)
        customerInfo: {
          name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          phone: order.billing?.phone || '',
          email: order.billing?.email || '',
          address: shippingAddressIndex || (order.billing?.address_1 ? `${order.billing.address_1}, ${order.billing?.state || ''}` : '')
        },
        // 🆕 بيانات الدفع الجزئي
        paymentDetails: isHalfPayment ? {
          type: 'half_payment',
          paidAmount: parseFloat(paidAmount || 0),
          remainingAmount: parseFloat(remainingAmount || 0),
          note: paymentNote || ''
        } : null,
        // 🚚 حالة دفع التوصيل - مدفوع بدون رسوم توصيل
        deliveryPayment: {
          status: 'fully_paid_no_delivery', // 🔥 دفع المنتج في الستور، رسوم التوصيل للتحصيل
          paidAmount: productsSubtotal - discountAmount, // المدفوع = ثمن المنتجات بعد الخصم
          remainingAmount: shippingFee, // المتبقي = رسوم التوصيل فقط
          note: 'تم الدفع في الستور (ثمن المنتجات فقط) - رسوم التوصيل للتحصيل'
        },
        // 🆕 بيانات التوصيل التفصيلية
        delivery: !isStorePickup ? {
          type: 'delivery',
          address: shippingAddressIndex,
          customer: {
            name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
            phone: order.billing?.phone || '',
            email: order.billing?.email || '',
            address: addressObject // 🏠 استخدام address object بدل string
          },
          fee: shippingFee,
          notes: ''
        } : null,
        deliveryStatus: 'pending', // 🔥 حالة التوصيل
        synced: true,
        source: 'order'
      };

      await invoiceStorage.saveInvoice(invoice);
      
      if (showToast) {
        showToast("تم تسجيل الفاتورة بنجاح! 🎉");
      }
    } catch (error) {
      if (showToast) {
        showToast("فشل تسجيل الفاتورة!", "error");
      }
    } finally {
      setRegisteringInvoice(false);
    }
  };

  const handleShippingSave = async () => {
    const parsedShipping = parseFloat(shippingAmount);

    if (Number.isNaN(parsedShipping) || parsedShipping < 0) {
      if (showToast) {
        showToast('سعر الشحن لازم يكون رقم صحيح أكبر من أو يساوي صفر', 'error');
      }
      return;
    }

    setUpdatingShipping(true);
    try {
      const response = await fetch('/api/orders/update-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          shippingTotal: parsedShipping
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل تحديث سعر الشحن');
      }

      if (onShippingUpdate) {
        await onShippingUpdate(order.id, result.order);
      }

      setEditingShipping(false);
      if (showToast) {
        showToast('✅ تم تحديث سعر الشحن بنجاح');
      }
    } catch (error) {
      console.error('Shipping Update Error:', error);
      if (showToast) {
        showToast(error.message || 'فشل تحديث سعر الشحن', 'error');
      }
    } finally {
      setUpdatingShipping(false);
    }
  };

  const handleAddressSave = async () => {
    if (!addressForm.address_1?.trim()) {
      if (showToast) {
        showToast('العنوان الأساسي مطلوب', 'error');
      }
      return;
    }

    setUpdatingAddress(true);
    try {
      const response = await fetch('/api/orders/update-shipping-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          shipping: {
            first_name: addressForm.first_name?.trim() || '',
            last_name: addressForm.last_name?.trim() || '',
            phone: addressForm.phone?.trim() || '',
            address_1: addressForm.address_1?.trim() || '',
            address_2: addressForm.address_2?.trim() || '',
            city: addressForm.city?.trim() || '',
            state: addressForm.state?.trim() || '',
          },
          billingPhone: addressForm.phone?.trim() || '',
          shippingAddressIndex: addressForm.address_index?.trim() || '',
          shippingCityName: addressForm.city?.trim() || '',
          shippingDistrictName: addressForm.state?.trim() || '',
          shippingCityId: addressForm.cityId || '',
          shippingDistrictId: addressForm.districtId || '',
          shippingZoneId: addressForm.zoneId || '',
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل تحديث عنوان الشحن');
      }

      if (onShippingUpdate) {
        await onShippingUpdate(order.id, result.order);
      }

      setEditingAddress(false);
      if (showToast) {
        showToast('✅ تم تحديث عنوان الشحن بنجاح');
      }
    } catch (error) {
      console.error('Shipping Address Update Error:', error);
      if (showToast) {
        showToast(error.message || 'فشل تحديث عنوان الشحن', 'error');
      }
    } finally {
      setUpdatingAddress(false);
    }
  };

  // 🆕 Update item quantity
  const handleUpdateQuantity = (itemId, newQuantity) => {
    const qty = parseInt(newQuantity);
    if (isNaN(qty) || qty < 0) return;
    
    setLineItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: qty } : item
    ));
  };

  // 🆕 Remove item
  const handleRemoveItem = (itemId) => {
    if (!confirm('هل تريد حذف هذا المنتج من الطلب؟')) return;
    setLineItems(prev => prev.filter(item => item.id !== itemId));
  };

  // 🆕 Load all products once (using same API as products page)
  const loadAllProducts = async () => {
    if (allProducts.length > 0) {
      // Already loaded
      return;
    }

    setLoadingProducts(true);
    try {
      console.log('📦 Loading all products from Cashier API...');
      const timestamp = Date.now();
      const response = await fetch(`/api/cashier/initial?all=true&_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Cashier API Error:', errorData);
        throw new Error(errorData.error || 'فشل تحميل المنتجات');
      }
      
      const data = await response.json();
      console.log('✅ Cashier API Response:', data);
      
      // Cashier API returns { products: [], categories: [] }
      const products = data.products || [];
      
      // Remove duplicates
      const uniqueProducts = Array.from(
        new Map(products.map(p => [p.id, p])).values()
      );
      
      console.log(`✅ Loaded ${uniqueProducts.length} unique products`);
      
      setAllProducts(uniqueProducts);
      setSearchResults(uniqueProducts); // Show all initially
    } catch (error) {
      console.error('❌ Load products error:', error);
      if (showToast) {
        showToast('فشل تحميل المنتجات: ' + error.message, 'error');
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  // 🆕 Search/filter products locally (no API calls)
  const handleSearchProducts = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue || searchValue.trim() === '') {
      // Show all products
      setSearchResults(allProducts);
      return;
    }

    // Filter locally
    const searchLower = searchValue.toLowerCase();
    const filtered = allProducts.filter(product => {
      const nameMatch = product.name?.toLowerCase().includes(searchLower);
      const skuMatch = product.sku?.toLowerCase().includes(searchLower);
      return nameMatch || skuMatch;
    });
    
    console.log(`🔍 Filtered ${filtered.length} products from ${allProducts.length} for "${searchValue}"`);
    setSearchResults(filtered);
  };

  // 🆕 Add product to order
  const handleAddProduct = (product) => {
    // Check if product is variable
    if (product.type === 'variable') {
      // Show variations modal
      setSelectedVariableProduct(product);
      setShowVariationsModal(true);
      setSelectedVariation(null);
      return;
    }
    
    // Check if already exists
    const exists = lineItems.find(item => item.product_id === product.id);
    if (exists) {
      if (showToast) {
        showToast('المنتج موجود بالفعل في الطلب', 'warning');
      }
      return;
    }

    const newItem = {
      id: Date.now(), // Temporary ID
      product_id: product.id,
      name: product.name,
      price: parseFloat(product.price) || 0,
      quantity: 1,
      total: parseFloat(product.price) || 0,
      image_url: product.images?.[0]?.src || '',
      sku: product.sku || ''
    };

    setLineItems(prev => [...prev, newItem]);
    setSearchTerm('');
    setSearchResults(allProducts); // Reset to show all
    if (showToast) {
      showToast('✅ تم إضافة المنتج');
    }
  };

  // 🆕 Add variation to order
  const handleAddVariation = () => {
    if (!selectedVariation || !selectedVariableProduct) return;
    
    // Check if variation already exists
    const exists = lineItems.find(item => item.variation_id === selectedVariation.id);
    if (exists) {
      if (showToast) {
        showToast('هذا الاختيار موجود بالفعل في الطلب', 'warning');
      }
      return;
    }

    // Build variation name with attributes
    const attributesText = Object.entries(selectedVariation.attributes || {})
      .map(([key, value]) => value)
      .join(' - ');
    
    const variationName = `${selectedVariableProduct.name} (${attributesText})`;

    const newItem = {
      id: Date.now(), // Temporary ID
      product_id: selectedVariableProduct.id,
      variation_id: selectedVariation.id,
      name: variationName,
      price: parseFloat(selectedVariation.price) || 0,
      quantity: 1,
      total: parseFloat(selectedVariation.price) || 0,
      image_url: selectedVariation.image?.src || selectedVariableProduct.images?.[0]?.src || '',
      sku: selectedVariation.sku || ''
    };

    setLineItems(prev => [...prev, newItem]);
    setShowVariationsModal(false);
    setSelectedVariableProduct(null);
    setSelectedVariation(null);
    setSearchTerm('');
    setSearchResults(allProducts);
    
    if (showToast) {
      showToast('✅ تم إضافة المنتج');
    }
  };

  // 🆕 Save items changes
  const handleSaveItems = async () => {
    if (lineItems.length === 0) {
      if (showToast) {
        showToast('لا يمكن حفظ طلب فارغ', 'error');
      }
      return;
    }

    setUpdatingItems(true);
    try {
      // Format line items for WooCommerce API
      // ⚠️ Woo لا يحذف العنصر إذا تم حذفه محلياً فقط، لازم نبعت id بكمية 0
      const originalLineItems = order?.line_items || [];
      const currentExistingIds = new Set(
        lineItems
          .filter((item) => Number(item.id) < 1000000000000)
          .map((item) => Number(item.id))
      );

      // Existing + newly added/edited items
      const formattedItems = lineItems.map((item) => {
        const isTempItem = Number(item.id) > 1000000000000;
        const lineItem = {
          product_id: item.product_id,
          quantity: Number(item.quantity)
        };

        // Existing item in order
        if (!isTempItem) {
          lineItem.id = Number(item.id);
        }
        
        // Add variation_id if exists
        if (item.variation_id) {
          lineItem.variation_id = item.variation_id;
        }
        
        return lineItem;
      });

      // Deleted items: send quantity 0 to force deletion in WooCommerce
      const deletedItems = originalLineItems
        .filter((originalItem) => !currentExistingIds.has(Number(originalItem.id)))
        .map((originalItem) => ({
          id: Number(originalItem.id),
          quantity: 0
        }));

      const payloadLineItems = [...formattedItems, ...deletedItems];

      const response = await fetch('/api/orders/update-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          lineItems: payloadLineItems
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل تحديث المنتجات');
      }

      if (onShippingUpdate) {
        await onShippingUpdate(order.id, result.order);
      }

      setEditingItems(false);
      if (showToast) {
        showToast('✅ تم تحديث المنتجات بنجاح');
      }
    } catch (error) {
      console.error('Items Update Error:', error);
      if (showToast) {
        showToast(error.message || 'فشل تحديث المنتجات', 'error');
      }
    } finally {
      setUpdatingItems(false);
    }
  };

  // 🆕 Calculate new total
  const calculateTotal = () => {
    const itemsTotal = lineItems.reduce((sum, item) => {
      const price = parseFloat(item.price || 0);
      const qty = parseInt(item.quantity || 0);
      return sum + (price * qty);
    }, 0);
    return itemsTotal;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    if (showToast) {
      showToast("تم نسخ العنوان!");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[98vh] overflow-hidden flex flex-col animate-fadeIn"
      >
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-2xl sm:text-3xl">📋</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">طلب #{order.id}</h2>
              <p className="text-blue-100 text-xs sm:text-sm">
                {(() => {
                  if (!order.date_created) return 'تاريخ غير محدد';
                  try {
                    const dateStr = order.date_created.replace('T', ' ').substring(0, 16);
                    const [datePart, timePart] = dateStr.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    const date = new Date(year, month - 1, day, parseInt(hour) + 2, minute);
                    
                    return date.toLocaleString('ar-EG', { 
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  } catch (e) {
                    return 'تاريخ غير صالح';
                  }
                })()}
              </p>
              {isSpare2AppOrder && (
                <span className="inline-flex mt-1 items-center gap-1 bg-cyan-500/90 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                  ✨ spare2app
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all hover:rotate-90"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Delivery Type Badge - Compact */}
          <div className={`${deliveryColor} border rounded-lg p-3 flex items-center gap-2`}>
            <span className="text-2xl">{deliveryIcon}</span>
            <div className="flex-1 text-gray-900">
              <p className="font-bold text-sm">{deliveryType}</p>
              {isStorePickup && (
                <p className="text-xs text-gray-600">استلام من المتجر</p>
              )}
            </div>
          </div>

          {/* Status & Register - في صف واحد responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                حالة الطلب
              </label>
              <div className="relative">
                <select
                  disabled={updatingStatus}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-blue-500 transition-colors disabled:opacity-50 font-medium"
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="on-hold">معلق</option>
                  <option value="processing">قيد التجهيز</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغى</option>
                  <option value="refunded">تم الاسترجاع</option>
                  <option value="failed">فشل</option>
                </select>
                {updatingStatus && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                &nbsp;
              </label>
              <button
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-3 py-2 rounded-lg transition-all font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50"
                onClick={handleRegisterInvoice}
                disabled={registeringInvoice}
              >
                {registeringInvoice ? '⏳ جاري...' : '🧾 تسجيل فاتورة'}
              </button>
            </div>
          </div>

          {/* Customer Info - Compact */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5 text-gray-800">
              <span>👤</span> بيانات العميل
            </h3>
            <div className="space-y-1 text-xs">
              <p className="text-gray-700">
                <span className="font-semibold">الاسم:</span> {order.billing?.first_name} {order.billing?.last_name}
              </p>
              {order.billing?.phone && (
                <p className="text-gray-700">
                  <span className="font-semibold">الهاتف:</span> {order.billing.phone}
                </p>
              )}
              {(order.billing?.address_1 || order.shipping?.address_1 || shippingAddressIndex) && (
                <div className="flex items-start gap-2 pt-2">
                  <p className="flex-1 text-gray-700">
                    <span className="font-medium">العنوان:</span>{" "}
                    {shippingAddressIndex || order.shipping?.address_1 || `${order.billing?.address_1 || ''}, ${order.billing?.state || ''}`}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        shippingAddressIndex || order.shipping?.address_1 || `${order.billing?.address_1 || ''}, ${order.billing?.state || ''}`
                      )
                    }
                    className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                  >
                    📋 نسخ
                  </button>
                  <button
                    onClick={() => setEditingAddress(true)}
                    className="text-purple-600 hover:text-purple-700 text-xs font-medium"
                  >
                    ✏️ تعديل العنوان
                  </button>
                  {order.meta_data?.find((m) => m.key === "_billing_maps_link") && (
                    <a
                      href={
                        order.meta_data.find((m) => m.key === "_billing_maps_link").value
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 text-xs font-medium"
                    >
                      🗺️ خرائط
                    </a>
                  )}
                </div>
              )}              

              {editingAddress && (
                <div className="mt-3 p-3 bg-white border border-blue-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={addressForm.first_name}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="الاسم الأول"
                      className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                    />
                    <input
                      value={addressForm.last_name}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="الاسم الأخير"
                      className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                    />
                  </div>
                  <input
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="رقم الهاتف"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <input
                    value={addressForm.address_1}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, address_1: e.target.value }))}
                    placeholder="العنوان الأساسي"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <input
                    value={addressForm.address_2}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, address_2: e.target.value }))}
                    placeholder="عنوان إضافي / المنطقة"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <BostaLocationSelector
                    address={{
                      city: addressForm.city,
                      district: addressForm.state,
                      cityId: addressForm.cityId,
                      districtId: addressForm.districtId,
                      zoneId: addressForm.zoneId,
                    }}
                    onAddressChange={(nextAddress) => setAddressForm(prev => ({
                      ...prev,
                      city: nextAddress.city || prev.city,
                      state: nextAddress.district || prev.state,
                      cityId: nextAddress.cityId || '',
                      districtId: nextAddress.districtId || '',
                      zoneId: nextAddress.zoneId || '',
                    }))}
                    disabled={updatingAddress}
                  />

                  {(!addressForm.cityId || !addressForm.districtId) && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ يفضل اختيار المدينة والمنطقة من قائمة بوسطة لضمان صحة الـ IDs قبل الإرسال.
                    </div>
                  )}

                  <input
                    value={addressForm.address_index}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, address_index: e.target.value }))}
                    placeholder="العنوان المركب (اختياري)"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddressSave}
                      disabled={updatingAddress}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-xs font-bold disabled:opacity-50"
                    >
                      {updatingAddress ? '⏳ جاري الحفظ...' : '💾 حفظ العنوان'}
                    </button>
                    <button
                      onClick={() => setEditingAddress(false)}
                      disabled={updatingAddress}
                      className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded text-xs font-bold disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Note */}
              {order.customer_note && order.customer_note.trim() && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-2 sm:p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 text-sm sm:text-base flex-shrink-0">📝</span>
                    <div className="flex-1">
                      <div className="text-xs sm:text-sm font-bold text-yellow-800 mb-0.5">ملاحظة العميل:</div>
                      <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
                        {order.customer_note}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <section className="bg-green-50 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600">
            <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
              <span>💳</span> معلومات الدفع
            </h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-600">طريقة الدفع:</span>
                <span className="font-semibold text-xs sm:text-sm text-gray-800">{order.payment_method_title}</span>
              </div>
              
              {isHalfPayment && (
                <div className="mt-2 p-2 sm:p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base sm:text-lg">⚠️</span>
                    <span className="font-bold text-xs sm:text-sm text-yellow-800">دفع جزئي (نصف المبلغ)</span>
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">المبلغ المدفوع:</span>
                      <span className="font-bold text-green-700">{paidAmount} جنيه ✓</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">المبلغ المتبقي:</span>
                      <span className="font-bold text-red-700">{remainingAmount} جنيه</span>
                    </div>
                    {paymentNote && (
                      <div className="mt-2 pt-2 border-t border-yellow-300">
                        <p className="text-xs text-gray-700">📝 {paymentNote}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {isFullPayment && paidAmount && (
                <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded-lg">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-700">تم الدفع كاملاً:</span>
                    <span className="font-bold text-green-700">{paidAmount} جنيه ✓</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* InstaPay Payment Proof - يظهر فقط لو مش Spare2App order (اللي عندها قسمها الخاص) */}
          {instaPayProof && !hasCashierCode && !isSpare2AppOrder && (
            <section className="bg-indigo-50 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600">
              <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
                <span>📱</span> إثبات الدفع (InstaPay)
              </h3>
              <div className="relative group">
                <img
                  src={instaPayProof}
                  alt="إثبات الدفع"
                  className="w-full max-w-sm sm:max-w-md rounded-lg border-2 border-indigo-300 shadow-md hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => window.open(instaPayProof, '_blank')}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => window.open(instaPayProof, '_blank')}
                    className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium"
                  >
                    🔍 عرض بالحجم الكامل
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instaPayProof);
                      if (showToast) showToast("تم نسخ رابط الصورة!");
                    }}
                    className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium"
                  >
                    📋 نسخ الرابط
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Spare2App Controls: Transfer Image + Cashier Code */}
          {isSpare2AppOrder && (
            <section className="bg-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600">
              <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
                <span>✨</span> أدوات Spare2App
              </h3>

              {/* Transfer Image */}
              {!hasCashierCode ? (
                <div className="bg-white rounded-lg border border-blue-200 p-3 mb-3">
                  <div className="text-xs sm:text-sm font-bold text-blue-800 mb-2">🖼️ صورة التحويل</div>

                  {/* لو العميل بعت InstaPay proof، اعرضها هنا */}
                  {instaPayProof && !orderImage && (
                    <div className="relative group mb-2">
                      <p className="text-[11px] text-indigo-600 font-semibold mb-1">📱 إثبات دفع العميل (InstaPay):</p>
                      <img
                        src={instaPayProof}
                        alt="إثبات الدفع InstaPay"
                        className="w-full max-w-sm sm:max-w-md rounded-lg border-2 border-indigo-300 shadow-md hover:shadow-xl transition-all cursor-pointer"
                        onClick={() => window.open(instaPayProof, '_blank')}
                      />
                    </div>
                  )}

                  {orderImage ? (
                    <div className="relative group mb-2">
                      <img
                        src={orderImage}
                        alt="صورة التحويل"
                        className="w-full max-w-sm sm:max-w-md rounded-lg border-2 border-blue-300 shadow-md hover:shadow-xl transition-all cursor-pointer"
                        onClick={() => window.open(orderImage, '_blank')}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => window.open(orderImage, '_blank')}
                          className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                        >
                          🔍 عرض بالحجم الكامل
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(orderImage);
                            if (showToast) showToast("تم نسخ رابط الصورة!");
                          }}
                          className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium"
                        >
                          📋 نسخ الرابط
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mb-2">لا توجد صورة تحويل حالياً</div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setTransferImageFile(file);
                      }}
                      className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white"
                      disabled={savingOrderMeta || uploadingTransferImage}
                    />
                    <button
                      onClick={handleUploadTransferImageFromDevice}
                      disabled={savingOrderMeta || uploadingTransferImage || !transferImageFile}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold disabled:opacity-50"
                    >
                      {uploadingTransferImage ? '⏳ جاري الرفع...' : '📤 رفع من الموبايل'}
                    </button>
                  </div>

                  {transferImageFile && (
                    <p className="text-[11px] text-gray-600 mt-2">
                      الملف المختار: <span className="font-semibold">{transferImageFile.name}</span>
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <input
                      type="url"
                      value={transferImageInput}
                      onChange={(e) => setTransferImageInput(e.target.value)}
                      placeholder="https://... رابط صورة التحويل"
                      className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                      disabled={savingOrderMeta || uploadingTransferImage}
                    />
                    <button
                      onClick={handleSaveTransferImage}
                      disabled={savingOrderMeta || uploadingTransferImage}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold disabled:opacity-50"
                    >
                      {savingOrderMeta ? '⏳ جاري...' : '💾 حفظ الصورة'}
                    </button>
                    <button
                      onClick={() => {
                        setTransferImageInput('');
                      }}
                      disabled={savingOrderMeta || uploadingTransferImage}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-bold disabled:opacity-50"
                    >
                      مسح الحقل
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-3">
                  <p className="text-xs sm:text-sm text-green-800 font-bold">
                    ✅ تم الدفع{paymentUpdatedAt ? ` — ${formatPaymentDate(paymentUpdatedAt)}` : ''}
                  </p>
                </div>
              )}

              {/* Cashier Code */}
              <div className="bg-white rounded-lg border border-purple-200 p-3">
                <div className="text-xs sm:text-sm font-bold text-purple-800 mb-2">🔖 كود كاشير</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={cashierCodeInput}
                    onChange={(e) => setCashierCodeInput(e.target.value)}
                    placeholder="اكتب كود كاشير"
                    className="flex-1 border border-purple-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                    disabled={savingOrderMeta}
                  />
                  <button
                    onClick={handleSaveCashierCode}
                    disabled={savingOrderMeta}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-bold disabled:opacity-50"
                  >
                    {savingOrderMeta ? '⏳ جاري...' : '💾 حفظ كود كاشير'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  ملحوظة: عند حفظ كود كاشير، صورة التحويل يتم حذفها تلقائيًا.
                </p>
                {cashierCode && (
                  <p className="text-[11px] text-purple-700 mt-1">
                    الحالي: <span className="font-mono font-bold">{cashierCode}</span>
                  </p>
                )}
                {paymentUpdatedAt && (
                  <p className="text-[11px] text-green-700 mt-1 font-semibold">
                    🕐 تم الدفع: {formatPaymentDate(paymentUpdatedAt)}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Products */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 text-gray-600">
                <span>📦</span> المنتجات ({editingItems ? lineItems.length : order.line_items?.length || 0})
              </h3>
              
              {!editingItems ? (
                <button
                  onClick={() => setEditingItems(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                >
                  ✏️ تعديل المنتجات
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveItems}
                    disabled={updatingItems}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                  >
                    {updatingItems ? '⏳ جاري الحفظ...' : '✅ حفظ التغييرات'}
                  </button>
                  <button
                    onClick={() => {
                      setLineItems(JSON.parse(JSON.stringify(order.line_items)));
                      setEditingItems(false);
                    }}
                    disabled={updatingItems}
                    className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 sm:space-y-3">
              {(editingItems ? lineItems : order.line_items)?.map((item) => {
                const imageUrl = item.image_url || item.image?.src || '/icons/placeholder.webp';
                const unitPrice = item.price || (item.quantity > 0 ? (parseFloat(item.total) / item.quantity) : 0);
                
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl p-2 sm:p-3 ${
                      editingItems ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'
                    }`}
                  >
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      onError={(e) => {
                        e.target.src = '/icons/placeholder.webp';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-gray-800 truncate">{item.name}</p>
                      {editingItems ? (
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-gray-600">الكمية:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                            className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-600">× {parseFloat(unitPrice).toFixed(2)} {order.currency}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {item.quantity} × {parseFloat(unitPrice).toFixed(2)} {order.currency}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-gray-400 mt-0.5">كود: {item.sku}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="font-bold text-sm sm:text-base text-gray-900">
                        {(parseFloat(unitPrice) * parseInt(item.quantity)).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">{order.currency}</p>
                      {editingItems && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition-all"
                        >
                          🗑️ حذف
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Product Button */}
            {editingItems && (
              <div className="mt-3">
                {!showAddProduct ? (
                  <button
                    onClick={() => {
                      setShowAddProduct(true);
                      loadAllProducts(); // 🔥 تحميل المنتجات مرة واحدة
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-all"
                  >
                    ➕ إضافة منتج جديد
                  </button>
                ) : (
                  <div className="bg-white border-2 border-green-300 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-gray-700">
                        بحث عن منتج {allProducts.length > 0 && `(${allProducts.length} منتج)`}
                      </h4>
                      <button
                        onClick={() => {
                          setShowAddProduct(false);
                          setSearchTerm('');
                          setSearchResults([]);
                        }}
                        className="text-gray-500 hover:text-gray-700 text-xl"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {loadingProducts ? (
                      <div className="text-center py-6">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                        <p className="text-sm text-gray-600 mt-3">جاري تحميل المنتجات...</p>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="ابحث هنا بالاسم أو الكود..."
                          value={searchTerm}
                          onChange={(e) => handleSearchProducts(e.target.value)}
                          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                        />
                        
                        {searchResults.length === 0 && allProducts.length > 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">لا توجد نتائج 😕</p>
                        )}
                        
                        {searchResults.length > 0 && (
                          <div className="mt-2 max-h-64 overflow-y-auto space-y-1 border-t-2 border-gray-200 pt-2">
                            <p className="text-xs text-gray-500 mb-1 px-1">
                              {searchTerm ? `${searchResults.length} نتيجة` : `${searchResults.length} منتج متاح`}
                            </p>
                            {searchResults.map(product => {
                              const isVariable = product.type === 'variable';
                              const hasVariations = product.variations && product.variations.length > 0;
                              
                              return (
                                <button
                                  key={product.id}
                                  onClick={() => handleAddProduct(product)}
                                  className="w-full text-left px-3 py-2 hover:bg-green-50 rounded-lg transition-all flex items-center gap-3 border border-gray-200 hover:border-green-400 hover:shadow-sm"
                                >
                                  <img
                                    src={product.images?.[0]?.src || '/icons/placeholder.webp'}
                                    alt={product.name}
                                    className="w-12 h-12 object-cover rounded border border-gray-200"
                                    onError={(e) => { e.target.src = '/icons/placeholder.webp'; }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
                                      {isVariable && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                                          متغير
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-xs font-bold text-green-700">
                                        {isVariable && hasVariations 
                                          ? `من ${parseFloat(product.price).toFixed(2)}` 
                                          : parseFloat(product.price).toFixed(2)
                                        } {order.currency}
                                      </p>
                                      {product.sku && (
                                        <p className="text-xs text-gray-500">• كود: {product.sku}</p>
                                      )}
                                      {isVariable && hasVariations && (
                                        <p className="text-xs text-purple-600">• {product.variations.length} اختيار</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-green-600 text-xl">+</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Show new total when editing */}
            {editingItems && (
              <div className="mt-3 p-3 bg-blue-100 border-2 border-blue-300 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-gray-700">📊 الإجمالي الجديد (المنتجات فقط):</span>
                  <span className="font-bold text-lg text-blue-700">{calculateTotal().toFixed(2)} {order.currency}</span>
                </div>
              </div>
            )}
          </section>

          {/* Total */}
          <section className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="space-y-2">
              {!isStorePickup && (
                <div className="bg-white/80 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-xs sm:text-sm text-gray-700">🚚 سعر الشحن</span>

                    {editingShipping ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={shippingAmount}
                          onChange={(e) => setShippingAmount(e.target.value)}
                          className="w-28 border border-blue-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={updatingShipping}
                        />
                        <button
                          onClick={handleShippingSave}
                          disabled={updatingShipping}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                          {updatingShipping ? '⏳' : 'حفظ'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingShipping(false);
                            setShippingAmount(shippingTotal.toString());
                          }}
                          disabled={updatingShipping}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-orange-700">{shippingTotal.toFixed(2)} {order.currency}</span>
                        <button
                          onClick={() => setEditingShipping(true)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                        >
                          ✏️ تغيير السعر
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* {!isStorePickup && shippingTotal > 0 && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-700">
                  <span className="font-medium">🚚 رنج الشحن</span>
                  <span className="font-semibold">من {(shippingTotal - 25).toFixed(2)} إلي {shippingTotal.toFixed(2)} {order.currency}</span>
                </div>
              )} */}

              {!isStorePickup && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-700">
                  <span className="font-medium">💰 مجموع الاوردر</span>
                  <p className="text-gray-900 font-bold text-base sm:text-lg">
                    {productsTotal.toFixed(2)} {order.currency}
                  </p>
                </div>
              )}

              {/* <div className="flex justify-between items-center text-sm sm:text-base text-gray-900 pt-2 border-t border-blue-200">
                <span className="font-bold">الإجمالي النهائي</span>
                <span className="font-black text-lg sm:text-xl text-green-700">{orderTotal.toFixed(2)} {order.currency}</span>
              </div> */}
                </div>
          </section>
        </div>

        {/* Notes Section */}
        <div className="px-3 sm:px-6 pb-3 sm:pb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-sm sm:text-base font-bold text-gray-800">📝 ملاحظات الطلب</h3>
              {!editingNote && (
                <button
                  onClick={() => onEditNote(order.id)}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {orderNote ? '✏️ تعديل' : '➕ إضافة'}
                </button>
              )}
            </div>
            
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => onNoteTextChange(e.target.value)}
                  placeholder="اكتب ملاحظات عن الطلب (استرجاع، تبديل، إلخ...)"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveNote(order.id, noteText)}
                    disabled={savingNote}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                  >
                    {savingNote ? '⏳ جاري الحفظ...' : '✅ حفظ'}
                  </button>
                  <button
                    onClick={onCancelNote}
                    className="px-4 sm:px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs sm:text-sm rounded-lg font-medium transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : orderNote ? (
              <div className="bg-white border border-yellow-300 rounded-lg p-2 sm:p-3">
                <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap">{orderNote}</p>
              </div>
            ) : (
              <p className="text-gray-500 text-xs sm:text-sm">لا توجد ملاحظات لهذا الطلب</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* 🆕 Variations Modal */}
      {showVariationsModal && selectedVariableProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">اختر المتغير</h3>
                <button
                  onClick={() => {
                    setShowVariationsModal(false);
                    setSelectedVariableProduct(null);
                    setSelectedVariation(null);
                  }}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-xl transition-all"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-blue-100 mt-1">{selectedVariableProduct.name}</p>
            </div>

            {/* Variations List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedVariableProduct.variations && selectedVariableProduct.variations.length > 0 ? (
                selectedVariableProduct.variations.map(variation => {
                  // Build attributes text
                  const attributesText = Object.entries(variation.attributes || {})
                    .map(([key, value]) => value)
                    .join(' - ');
                  
                  const isSelected = selectedVariation?.id === variation.id;
                  
                  return (
                    <button
                      key={variation.id}
                      onClick={() => setSelectedVariation(variation)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <img
                        src={variation.image?.src || selectedVariableProduct.images?.[0]?.src || '/icons/placeholder.webp'}
                        alt={attributesText}
                        className="w-16 h-16 object-cover rounded border border-gray-200"
                        onError={(e) => { e.target.src = '/icons/placeholder.webp'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800">{attributesText}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {variation.sku && `كود: ${variation.sku} • `}
                          السعر: {parseFloat(variation.price).toFixed(2)} {order.currency}
                        </p>
                        {variation.stock_quantity !== null && variation.stock_quantity !== undefined && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            المخزون: {variation.stock_quantity}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="text-blue-600 text-2xl">✓</div>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-8">لا توجد متغيرات متاحة</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 flex gap-2">
              <button
                onClick={handleAddVariation}
                disabled={!selectedVariation}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ إضافة المتغير المحدد
              </button>
              <button
                onClick={() => {
                  setShowVariationsModal(false);
                  setSelectedVariableProduct(null);
                  setSelectedVariation(null);
                }}
                className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 rounded-lg transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
