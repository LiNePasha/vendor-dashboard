"use client";

import { useState, useEffect } from "react";
import localforage from "localforage";
import CustomerSelector from "@/components/CustomerSelector";

export function Cart({
  items,
  services = [],
  employees = [],
  selectedEmployee,
  orderType = 'store', // 'store' or 'delivery'
  selectedCustomer,
  onOrderTypeChange,
  onCustomerSelect,
  onUpdateQuantity,
  onRemoveItem,
  onAddService,
  onUpdateService,
  onRemoveService,
  onCheckout,
  processing,
  discount = 0,
  discountType = 'amount',
  discountApplyMode = 'both',
  extraFee = 0,
  deliveryFee = 0,
  deliveryNotes = '',
  deliveryPaymentStatus = 'cash_on_delivery',
  deliveryPaidAmount = 0,
  deliveryPaymentNote = '',
  paymentMethod = 'cash',
  onDiscountChange,
  onDiscountTypeChange,
  onDiscountApplyModeChange,
  onExtraFeeChange,
  onDeliveryFeeChange,
  onDeliveryNotesChange,
  onDeliveryPaymentStatusChange,
  onDeliveryPaidAmountChange,
  onDeliveryPaymentNoteChange,
  onPaymentMethodChange
}) {
  const productsSubtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) * item.quantity),
    0
  );

  const servicesTotal = services
    .filter(s => s.description && s.amount > 0)
    .reduce((sum, service) => sum + Number(service.amount), 0);

  const subtotal = productsSubtotal + servicesTotal;

  // Calculate discount amount
  const discountAmount = discountType === 'percentage' 
    ? (subtotal * (discount / 100))
    : discount;

  // Calculate final total with extra fee and delivery fee
  const total = subtotal - discountAmount + Number(extraFee) + Number(deliveryFee);

  // Load saved services from LocalForage
  const [savedServices, setSavedServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  useEffect(() => {
    loadSavedServices();
  }, []);

  const loadSavedServices = async () => {
    try {
      const saved = await localforage.getItem("savedServices");
      if (saved && Array.isArray(saved)) {
        setSavedServices(saved);
      }
    } catch (error) {
      console.error("Error loading saved services:", error);
    }
  };

  const handleAddSavedService = (savedServiceId) => {
    if (!savedServiceId) return;
    
    const savedService = savedServices.find(s => s.id === savedServiceId);
    if (!savedService) return;
    
    // Create new service with ID first
    const newServiceId = Date.now().toString();
    
    // Call onAddService with pre-filled data
    onAddService(newServiceId, savedService.name, savedService.price);
    
    // Reset dropdown
    setSelectedServiceId('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      {/* <div className="p-2 bg-blue-900 text-white flex-shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <span>السلة</span>
          {items.length > 0 && (
            <span className="bg-blue-700 px-2 py-0.5 rounded-full text-xs">
              {items.length}
            </span>
          )}
        </h2>
      </div> */}

      {/* Employee Selector - Compact */}
      {/* {selectedEmployee && (
        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-600">👤 البائع:</span>
            <span className="font-bold text-gray-900">{selectedEmployee.name}</span>
          </div>
        </div>
      )} */}

      {/* Order Type Selection */}
      <div className="px-2 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => onOrderTypeChange && onOrderTypeChange('store')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              orderType === 'store'
                ? '!bg-blue-600 !text-white'
                : '!bg-gray-100 !text-gray-600 hover:!bg-gray-200'
            }`}
          >
            🏪 استلام من المحل
          </button>
          <button
            onClick={() => onOrderTypeChange && onOrderTypeChange('delivery')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              orderType === 'delivery'
                ? '!bg-green-600 !text-white'
                : '!bg-gray-100 !text-gray-600 hover:!bg-gray-200'
            }`}
          >
            🚚 توصيل
          </button>
        </div>

        {/* Delivery Details - Show when delivery is selected */}
        {orderType === 'delivery' && (
          <div className="mt-2 space-y-2 p-2 bg-green-50 rounded-lg border border-green-200">
            {/* Customer Selection */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>👤</span>
                <span>العميل</span>
              </label>
              <CustomerSelector
                selectedCustomer={selectedCustomer}
                onSelect={onCustomerSelect}
                onClear={() => onCustomerSelect && onCustomerSelect(null)}
              />
            </div>

            {/* Delivery Payment Status - حالة الدفع */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>💳</span>
                <span>حالة الدفع</span>
              </label>
              <select
                value={deliveryPaymentStatus}
                onChange={(e) => onDeliveryPaymentStatusChange && onDeliveryPaymentStatusChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold
                  focus:ring-1 focus:ring-green-500 focus:border-green-500"
              >
                <option value="cash_on_delivery">📦 دفع عند الاستلام</option>
                <option value="half_paid">🕐 نصف المبلغ مدفوع</option>
                <option value="fully_paid">✅ مدفوع كامل</option>
                <option value="fully_paid_no_delivery">🚧 مدفوع كامل بدون توصيل</option>
              </select>
            </div>

            {/* Half Paid Amount - يظهر فقط عند اختيار نصف المبلغ */}
            {deliveryPaymentStatus === 'half_paid' && (
              <div className="p-2 bg-yellow-50 rounded border border-yellow-200 space-y-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    💰 المبلغ المدفوع (ج.م)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={deliveryPaidAmount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        onDeliveryPaidAmountChange && onDeliveryPaidAmountChange(val === '' ? 0 : parseFloat(val) || 0);
                      }
                    }}
                    placeholder="0"
                    className="w-full px-2 py-1.5 bg-white border border-yellow-300 rounded text-xs font-bold
                      focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    📝 ملاحظة الدفع
                  </label>
                  <input
                    type="text"
                    value={deliveryPaymentNote}
                    onChange={(e) => onDeliveryPaymentNoteChange && onDeliveryPaymentNoteChange(e.target.value)}
                    placeholder="مثال: دفع 50 ج.م مقدم..."
                    className="w-full px-2 py-1 bg-white border border-yellow-300 rounded text-xs
                      focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>
            )}

            {/* Delivery Fee */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>🚚</span>
                <span>رسوم التوصيل (ج.م)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={deliveryFee || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    onDeliveryFeeChange && onDeliveryFeeChange(val === '' ? 0 : parseFloat(val) || 0);
                  }
                }}
                placeholder="0"
                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold
                  focus:ring-1 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Delivery Address/Notes */}
            <div>
              <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>📍</span>
                <span>ملاحظات التوصيل</span>
              </label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => onDeliveryNotesChange && onDeliveryNotesChange(e.target.value)}
                placeholder="العنوان أو ملاحظات خاصة..."
                rows={2}
                className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs
                  focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-2 bg-gray-50" style={{ minHeight: '10rem' }}>
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-xs font-bold">السلة فارغة</p>
            <p className="text-xs text-gray-400 mt-1">أضف منتجات للبدء</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 hover:border-blue-400 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <h3 className="font-bold text-gray-900 truncate text-sm">
                      {item.name}
                    </h3>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        🏷️ {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 font-semibold">
                    {item.originalPrice && item.originalPrice > item.price ? (
                      <>
                        <span className="line-through text-gray-400 ml-1">{item.originalPrice} ج.م</span>
                        <span className="text-red-600 font-bold">{item.price} ج.م</span>
                      </>
                    ) : (
                      <span className="font-bold text-gray-900">{item.price} ج.م</span>
                    )}
                    {" × "}{item.quantity} = 
                    <span className="font-bold text-blue-600 mr-1">
                      {(item.price * item.quantity).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300
                      bg-white hover:bg-red-500 hover:text-white hover:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed
                      text-gray-700 font-bold transition-all"
                  >
                    −
                  </button>
                  
                  <span className="w-8 text-center font-bold text-sm text-gray-900">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock_quantity}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300
                      bg-white hover:bg-green-500 hover:text-white hover:border-green-500 disabled:opacity-40 disabled:cursor-not-allowed
                      text-gray-700 font-bold transition-all"
                  >
                    +
                  </button>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-300
                      bg-white text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-bold"
                    title="حذف"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Services Section */}
      <div className="border-t p-2 bg-gray-50">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1">
            <span className="text-sm">⚡</span>
            <span>خدمات إضافية</span>
          </h3>
          <button
            onClick={() => onAddService()}
            className="px-2 py-1 bg-purple-600 text-white rounded-lg 
              hover:bg-purple-700 transition-colors text-xs font-bold"
          >
            + يدوي
          </button>
        </div>

        {savedServices.length > 0 && (
          <div className="mb-2">
            <select
              value={selectedServiceId}
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  handleAddSavedService(id);
                }
              }}
              className="w-full px-2 py-1 bg-white border border-gray-300 rounded-lg 
                text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 cursor-pointer"
            >
              <option value="">⚡ اختر خدمة محفوظة...</option>
              {savedServices.map((savedService) => (
                <option key={savedService.id} value={savedService.id}>
                  {savedService.name} • {savedService.price.toFixed(2)} ج.م
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {services.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-4">
              لا توجد خدمات مضافة
            </p>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                className="p-2 bg-white border border-purple-100 rounded-lg"
              >
                <div className="flex gap-1 mb-1">
                  <input
                    type="text"
                    value={service.description || ''}
                    onChange={(e) => onUpdateService(service.id, 'description', e.target.value)}
                    placeholder="وصف الخدمة..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs 
                      focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <button
                    onClick={() => onRemoveService(service.id)}
                    className="w-7 h-7 flex items-center justify-center rounded 
                      text-red-600 hover:bg-red-50 border border-red-200 transition-colors text-sm"
                    title="حذف"
                  >
                    ×
                  </button>
                </div>
                
                {/* 🆕 اختيار الموظف المسؤول عن الخدمة */}
                {employees && employees.length > 0 && (
                  <div className="mb-1">
                    <select
                      value={service.employeeId || ''}
                      onChange={(e) => {
                        const selectedEmp = employees.find(emp => emp.id == e.target.value);
                        onUpdateService(service.id, 'employeeId', e.target.value);
                        onUpdateService(service.id, 'employeeName', selectedEmp?.name || '');
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs
                        focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    >
                      <option value="">👤 اختر الموظف المسؤول...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.employeeCode}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600 font-medium">المبلغ:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={service.amount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                        onUpdateService(service.id, 'amount', val === '' ? 0 : parseFloat(val) || 0);
                      }
                    }}
                    placeholder="0.00"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs 
                      focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                  />
                  <span className="text-xs text-gray-600 font-medium">ج.م</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t p-2 bg-white space-y-2">
        {/* Payment Method and Discount */}
        <div className="grid grid-cols-2 gap-2">
          {/* Payment Method */}
          <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
            <label className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <span>💳</span>
              طريقة الدفع
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cash">كاش</option>
              <option value="wallet">محفظة</option>
              <option value="instapay">انستا باي</option>
              <option value="vera">مكنة دفع فيزا (فيرا)</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {/* Discount */}
          <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <span>🏷️</span>
                الخصم
              </label>
              <select
                value={discountType}
                onChange={(e) => onDiscountTypeChange(e.target.value)}
                className="px-2 py-0.5 bg-white border border-gray-300 rounded-lg text-xs 
                  font-bold focus:ring-1 focus:ring-red-500"
              >
                <option value="percentage">%</option>
                <option value="amount">ج.م</option>
              </select>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={discount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                  onDiscountChange(val === '' ? 0 : Math.max(0, parseFloat(val) || 0));
                }
              }}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold
                focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Discount Apply Mode */}
        {discount > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-2">
            <label className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
              <span>📌</span>
              تطبيق الخصم على:
            </label>
            <select
              value={discountApplyMode}
              onChange={(e) => onDiscountApplyModeChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-amber-400 rounded-lg text-xs 
                focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-bold"
            >
              <option value="both">المنتجات والخدمات معاً</option>
              <option value="products">المنتجات فقط</option>
              <option value="services">الخدمات فقط</option>
            </select>
          </div>
        )}

        {/* Totals */}
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          {productsSubtotal > 0 && (
            <div className="flex justify-between text-sm text-gray-700 font-bold">
              <span>المنتجات:</span>
              <span>{productsSubtotal.toFixed(2)} ج.م</span>
            </div>
          )}

          {servicesTotal > 0 && (
            <div className="flex justify-between text-sm text-purple-600 font-bold">
              <span>الخدمات:</span>
              <span>{servicesTotal.toFixed(2)} ج.م</span>
            </div>
          )}

          {(productsSubtotal > 0 || servicesTotal > 0) && (
            <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-300 pt-2">
              <span>المجموع الفرعي:</span>
              <span>{subtotal.toFixed(2)} ج.م</span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between text-sm text-red-600 font-bold">
              <span>
                الخصم ({discountType === 'percentage' 
                  ? `${discount}%` 
                  : `${discount} ج.م`}):
              </span>
              <span>- {discountAmount.toFixed(2)} ج.م</span>
            </div>
          )}

          {extraFee > 0 && (
            <div className="flex justify-between text-sm text-green-600 font-bold">
              <span>رسوم إضافية:</span>
              <span>+ {Number(extraFee).toFixed(2)} ج.م</span>
            </div>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm text-blue-600 font-bold">
              <span>🚚 رسوم التوصيل:</span>
              <span>+ {Number(deliveryFee).toFixed(2)} ج.م</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-gray-400">
            <span className="text-gray-900">الإجمالي:</span>
            <span className="text-blue-600">{total.toFixed(2)} ج.م</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0 && services.length === 0 || processing}
          className={`w-full py-3 px-4 rounded-lg font-bold text-white text-base
            transition-all
            ${
              (items.length === 0 && services.length === 0) || processing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
            }
          `}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              جاري المعالجة...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>✓</span>
              إتمام البيع
            </span>
          )}
        </button>
      </div>
    </div>
  );
}