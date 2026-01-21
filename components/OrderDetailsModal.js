"use client";

import { useRef, useState } from "react";
import { invoiceStorage } from "@/app/lib/localforage";

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
  onCancelNote
}) {
  const modalRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [registeringInvoice, setRegisteringInvoice] = useState(false);

  if (!isOpen || !order) return null;

  // 🔍 Debug: طباعة كل الـ order structure
  console.log('🔍 Full Order Object:', order);
  console.log('🔍 Order Keys:', Object.keys(order));
  console.log('🔍 Customer Note:', order.customer_note);
  
  // 🆕 استخراج بيانات الدفع من meta_data
  const getMetaValue = (key) => order.meta_data?.find(m => m.key === key)?.value;
  
  const paymentType = getMetaValue('_payment_type');
  const paidAmount = getMetaValue('_paid_amount');
  const remainingAmount = getMetaValue('_remaining_amount');
  const paymentNote = getMetaValue('_payment_note');
  const instaPayProof = getMetaValue('_instapay_payment_proof');
  const orderImage = getMetaValue('order_image');
  const shippingAddressIndex = getMetaValue('_shipping_address_index');
  
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
              {order.billing?.address_1 && (
                <div className="flex items-start gap-2 pt-2">
                  <p className="flex-1 text-gray-700">
                    <span className="font-medium">العنوان:</span>{" "}
                    {shippingAddressIndex || `${order.billing.address_1}, ${order.billing?.state}`}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        shippingAddressIndex || `${order.billing.address_1}, ${order.billing.state}`
                      )
                    }
                    className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                  >
                    📋 نسخ
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

          {/* InstaPay Payment Proof */}
          {instaPayProof && (
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

          {/* Transfer Image (order_image) */}
          {orderImage && (
            <section className="bg-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600">
              <h3 className="font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
                <span>🖼️</span> صورة التحويل
              </h3>
              <div className="relative group">
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
            </section>
          )}

          {/* Products */}
          <section>
            <h3 className="font-bold text-sm sm:text-base mb-3 flex items-center gap-2 text-gray-600">
              <span>📦</span> المنتجات ({order.line_items?.length || 0})
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {order.line_items?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 sm:gap-3 bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      onError={(e) => {
                        e.target.src = '/icons/placeholder.webp';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs sm:text-sm text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {item.quantity} × {item.price} {order.currency}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm sm:text-base text-gray-900">
                      {(item.quantity * parseFloat(item.price))}
                    </p>
                    <p className="text-xs text-gray-500">{order.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Total */}
          <section className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="space-y-2">
              {!isStorePickup && order.shipping_total && parseFloat(order.shipping_total) > 0 && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-700">
                  <span className="font-medium">🚚 رنج الشحن</span>
                  <span className="font-semibold">من {order.shipping_total - 25} إلي {order.shipping_total} {order.currency}</span>
                </div>
              )}

              {!isStorePickup && order.shipping_total && parseFloat(order.shipping_total) > 0 && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-700">
                  <span className="font-medium">💰 مجموع الاوردر</span>
                  <p className="text-gray-900 font-bold text-base sm:text-lg">
                      {(parseFloat(order.total) - parseFloat(order.shipping_total || 0))} {order.currency}
                    </p>
                </div>
              )}
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
    </div>
  );
}
