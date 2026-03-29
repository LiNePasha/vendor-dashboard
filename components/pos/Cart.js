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
  onAddItem, // 🆕 للإضافة السريعة
  onUpdateItemPrice, // 🆕 لتعديل سعر المنتج (جملة فورية)
  onAddService,
  onUpdateService,
  onRemoveService,
  onCheckout,
  processing,
  discount = 0,
  discountType = 'amount',
  discountApplyMode = 'both',
  extraFee = 0,
  extraFeeType = 'amount',
  deliveryFee = 0,
  deliveryNotes = '',
  deliveryPaymentStatus = 'cash_on_delivery',
  deliveryPaidAmount = 0,
  deliveryPaymentNote = '',
  orderNotes = '',
  paymentMethod = 'cash',
  onDiscountChange,
  onDiscountTypeChange,
  onDiscountApplyModeChange,
  onExtraFeeChange,
  onExtraFeeTypeChange,
  onDeliveryFeeChange,
  onDeliveryNotesChange,
  onDeliveryPaymentStatusChange,
  onDeliveryPaidAmountChange,
  onDeliveryPaymentNoteChange,
  onOrderNotesChange,
  onPaymentMethodChange,
  onExpandChange // 🆕 callback لإخبار الـ parent بحالة التوسيع
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

  // Calculate extra fee amount
  const extraFeeAmount = extraFeeType === 'percentage'
    ? (subtotal * (extraFee / 100))
    : extraFee;

  // Calculate final total with extra fee and delivery fee
  const total = subtotal - discountAmount + Number(extraFeeAmount) + Number(deliveryFee);

  // Load saved services from LocalForage
  const [savedServices, setSavedServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  
  // 🆕 Cart Expansion State
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 🆕 Quick Add Product State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ 
    name: '', 
    price: '', 
    saleQuantity: 1,    // الكمية في الفاتورة
    stockQuantity: 1    // الكمية في المحل
  });

  // 🆕 Edit Price State (جملة فورية)
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState('');

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
  
  // 🆕 Quick Add Product Handler
  const handleQuickAddProduct = () => {
    if (!quickAddForm.name || !quickAddForm.price || !quickAddForm.saleQuantity || !quickAddForm.stockQuantity) {
      return;
    }
    
    const tempProduct = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: quickAddForm.name,
      price: parseFloat(quickAddForm.price),
      quantity: parseInt(quickAddForm.saleQuantity), // 🔥 كمية الفاتورة
      stock_quantity: 999,
      is_temp_product: true,
      temp_data: {
        name: quickAddForm.name,
        sellingPrice: parseFloat(quickAddForm.price),
        purchasePrice: 0,
        stock: parseInt(quickAddForm.stockQuantity), // 🔥 كمية المحل
        sku: `TEMP-${Date.now()}`,
        imageUrl: null
      }
    };
    
    // إضافة للسلة
    if (onAddItem) {
      onAddItem(tempProduct);
    }
    
    // Reset form
    setQuickAddForm({ name: '', price: '', saleQuantity: 1, stockQuantity: 1 });
    setShowQuickAdd(false);
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Header مع زرار التوسيع */}
      <div className="p-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <h2 className="text-base font-bold">السلة</h2>
          {items.length > 0 && (
            <span className="bg-slate-600 px-2 py-0.5 rounded-full text-xs">
              {items.length}
            </span>
          )}
        </div>
        {/* زرار التوسيع - يظهر فقط لما الكارت فيه منتجات */}
        {items.length > 0 && (
          <button
            onClick={() => {
              const newExpandedState = !isExpanded;
              setIsExpanded(newExpandedState);
              // إخبار الـ parent بحالة التوسيع
              if (onExpandChange) {
                onExpandChange(newExpandedState);
              }
            }}
            className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5"
            title={isExpanded ? "إخفاء بعض المنتجات" : "عرض كل المنتجات"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              )}
            </svg>
            <span>{isExpanded ? 'تصغير' : 'توسيع'}</span>
          </button>
        )}
      </div>

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
                ? '!bg-slate-700 !text-white'
                : '!bg-gray-100 !text-gray-600 hover:!bg-gray-200'
            }`}
          >
            🏪 استلام من المحل
          </button>
          <button
            onClick={() => onOrderTypeChange && onOrderTypeChange('delivery')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              orderType === 'delivery'
                ? '!bg-slate-600 !text-white'
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
      <div 
        className="flex-1 overflow-y-auto p-2 bg-gray-50 pb-20"
        style={isExpanded ? { maxHeight: '70vh' } : { minHeight: '10rem' }}
      >
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-xs font-bold">السلة فارغة</p>
            <p className="text-xs text-gray-400 mt-1">أضف منتجات للبدء</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.id}_${item.variation_id || 'single'}_${index}`}
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
                    {item.wholesalePrice && (
                      <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        جملة
                      </span>
                    )}
                  </div>
                  
                  {/* 🆕 Price Edit Mode */}
                  {editingPriceId === `${item.id}_${item.variation_id || 'single'}_${index}` ? (
                    <div className="flex items-center gap-1 mb-1">
                      <input
                        type="number"
                        value={editPriceValue}
                        onChange={(e) => setEditPriceValue(e.target.value)}
                        placeholder="السعر الجديد"
                        className="w-20 px-2 py-1 text-xs border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newPrice = parseFloat(editPriceValue);
                            if (newPrice > 0 && onUpdateItemPrice) {
                              onUpdateItemPrice(item.id, newPrice, item.variation_id);
                            }
                            setEditingPriceId(null);
                            setEditPriceValue('');
                          } else if (e.key === 'Escape') {
                            setEditingPriceId(null);
                            setEditPriceValue('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const newPrice = parseFloat(editPriceValue);
                          if (newPrice > 0 && onUpdateItemPrice) {
                            onUpdateItemPrice(item.id, newPrice, item.variation_id);
                          }
                          setEditingPriceId(null);
                          setEditPriceValue('');
                        }}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-bold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingPriceId(null);
                          setEditPriceValue('');
                        }}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
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
                          {(item.price * item.quantity)} ج.م
                        </span>
                      </div>
                      
                      {/* 🆕 Edit Price Button */}
                      <button
                        onClick={() => {
                          setEditingPriceId(`${item.id}_${item.variation_id || 'single'}_${index}`);
                          setEditPriceValue(item.price.toString());
                        }}
                        className="px-1.5 py-0.5 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100 border border-orange-200 font-bold transition-all"
                        title="تعديل السعر (جملة فورية)"
                      >
                        💰
                      </button>
                    </div>
                  )}
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

      {/* 🆕 Quick Add Section */}
      <div className="border-t border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 p-2">
        {!showQuickAdd ? (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="w-full py-2 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 
              text-white rounded-lg font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span className="text-lg">⚡</span>
            <span>إضافة سريعة للسلة</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                <span>⚡</span>
                <span>إضافة سريعة</span>
              </h3>
              <button
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickAddForm({ name: '', price: '', saleQuantity: 1, stockQuantity: 1 });
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            
            <input
              type="text"
              placeholder="اسم المنتج"
              value={quickAddForm.name}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
              className="w-full px-2 py-1.5 border border-green-300 rounded text-xs font-semibold
                focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                  💰 السعر
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="السعر"
                  value={quickAddForm.price}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setQuickAddForm({ ...quickAddForm, price: val });
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-green-300 rounded text-xs font-semibold
                    focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-blue-600 mb-0.5">
                  🛒 كمية الفاتورة
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="كمية الفاتورة"
                  value={quickAddForm.saleQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setQuickAddForm({ ...quickAddForm, saleQuantity: val === '' ? 1 : parseInt(val) });
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs font-semibold
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-orange-600 mb-0.5">
                🏪 كمية المحل
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="كمية المحل"
                value={quickAddForm.stockQuantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setQuickAddForm({ ...quickAddForm, stockQuantity: val === '' ? 1 : parseInt(val) });
                  }
                }}
                className="w-full px-2 py-1.5 border border-orange-300 rounded text-xs font-semibold
                  focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            <button
              onClick={handleQuickAddProduct}
              disabled={!quickAddForm.name || !quickAddForm.price || !quickAddForm.saleQuantity || !quickAddForm.stockQuantity}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 
                text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ إضافة للسلة
            </button>
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
                        const empId = e.target.value;
                        console.log('🔍 Selected employee ID:', empId);
                        
                        // استخدم == للمقارنة (يتعامل مع string و number)
                        const selectedEmp = employees.find(emp => emp.id == empId);
                        console.log('✅ Found employee:', selectedEmp);
                        
                        // 🔥 نحدّث employeeId و employeeName و employeeCode مرة واحدة
                        if (selectedEmp) {
                          console.log('💾 Updating service with:', { empId, name: selectedEmp.name, code: selectedEmp.id });
                          onUpdateService(service.id, {
                            employeeId: empId,
                            employeeName: selectedEmp.name,
                            employeeCode: selectedEmp.id // 🔥 id هو نفسه employeeCode
                          });
                        } else {
                          onUpdateService(service.id, {
                            employeeId: '',
                            employeeName: '',
                            employeeCode: ''
                          });
                        }
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs
                        focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                    >
                      <option value="">👤 اختر الموظف المسؤول...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id})
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

      {/* Payment Settings Section - Scrollable */}
      <div className="border-t p-2 bg-white space-y-2 overflow-y-auto" style={{ minHeight: '200px' }}>
        {/* Payment, Discount & Extra Fee - في صف واحد */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Payment Method */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-1.5 rounded-md border border-slate-300">
            <label className="text-[10px] font-bold text-blue-800 mb-0.5 flex items-center gap-0.5">
              <span className="text-xs">💳</span>
              <span>الدفع</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="w-full px-1.5 py-1 bg-white border border-blue-300 rounded text-[11px] font-medium
                focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
            >
              <option value="cash">💵 كاش</option>
              <option value="wallet">👛 محفظة</option>
              <option value="instapay">📱 انستا</option>
              <option value="vera">💳 فيزا</option>
              <option value="other">➕ أخرى</option>
            </select>
          </div>

          {/* Discount */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-1.5 rounded-md border border-slate-300">
            <label className="text-[10px] font-bold text-red-800 flex items-center gap-0.5 mb-0.5">
              <span className="text-xs">🏷️</span>
              <span>خصم</span>
            </label>
            <div className="flex gap-1">
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
                className="flex-1 px-1.5 py-1 bg-white border border-red-300 rounded text-[11px] font-medium
                  focus:ring-1 focus:ring-red-500 focus:border-red-500 text-red-900 min-w-0"
                placeholder="0"
              />
              <select
                value={discountType}
                onChange={(e) => onDiscountTypeChange(e.target.value)}
                className="px-1.5 py-1 bg-white border border-red-300 rounded text-[11px] 
                  font-medium focus:ring-1 focus:ring-red-500 text-red-900 w-12"
              >
                <option value="percentage">%</option>
                <option value="amount">ج.م</option>
              </select>
            </div>
          </div>

          {/* Extra Fee */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-1.5 rounded-md border border-slate-300">
            <label className="text-[10px] font-bold text-green-800 flex items-center gap-0.5 mb-0.5">
              <span className="text-xs">➕</span>
              <span>رسوم</span>
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={extraFee}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                    onExtraFeeChange(val === '' ? 0 : Math.max(0, parseFloat(val) || 0));
                  }
                }}
                className="flex-1 px-1.5 py-1 bg-white border border-green-300 rounded text-[11px] font-medium
                  focus:ring-1 focus:ring-green-500 focus:border-green-500 text-green-900 min-w-0"
                placeholder="0"
              />
              <select
                value={extraFeeType}
                onChange={(e) => onExtraFeeTypeChange(e.target.value)}
                className="px-1.5 py-1 bg-white border border-green-300 rounded text-[11px] 
                  font-medium focus:ring-1 focus:ring-green-500 text-green-900 w-12"
              >
                <option value="percentage">%</option>
                <option value="amount">ج.م</option>
              </select>
            </div>
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

        {/* Order Notes (ملاحظات الطلب) */}
        <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-300 rounded-lg p-2">
          <label className="text-xs font-bold text-purple-800 mb-1 flex items-center gap-1">
            <span className="text-base">📝</span>
            ملاحظات على الطلب
          </label>
          <textarea
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
            placeholder="أي ملاحظات أو تفاصيل إضافية..."
            rows={2}
            className="w-full px-2 py-1.5 bg-white border-2 border-purple-300 rounded-lg text-xs
              focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-purple-900"
          />
        </div>
      </div>

      {/* Totals - خارج الـ scrollable section عشان يكون دايماً مرئي */}
      <div className="border-t border-gray-200 p-2 bg-white pb-24">
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
              <span>
                رسوم إضافية ({extraFeeType === 'percentage'
                  ? `${extraFee}%`
                  : `${extraFee} ج.م`}):
              </span>
              <span>+ {extraFeeAmount.toFixed(2)} ج.م</span>
            </div>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm text-blue-600 font-bold">
              <span>🚚 رسوم التوصيل:</span>
              <span>+ {Number(deliveryFee).toFixed(2)} ج.م</span>
            </div>
          )}
          
          {/* <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-gray-400">
            <span className="text-gray-900">الإجمالي:</span>
            <span className="text-blue-600">{total.toFixed(2)} ج.م</span>
          </div> */}
        </div>

        {/* ملخص حالة الدفع للتوصيل */}
        {orderType === 'delivery' && deliveryPaymentStatus && (
          <div className={`p-3 rounded-lg border-2 mt-2 ${
            deliveryPaymentStatus === 'cash_on_delivery' ? 'bg-red-50 border-red-300' :
            deliveryPaymentStatus === 'half_paid' ? 'bg-yellow-50 border-yellow-300' :
            'bg-green-50 border-green-300'
          }`}>
            {deliveryPaymentStatus === 'cash_on_delivery' && (
              <div className="text-center">
                <p className="text-xs font-semibold text-red-700 mb-1">📦 دفع عند الاستلام</p>
                <p className="text-sm font-black text-red-900">
                  المطلوب تحصيله: {total.toFixed(2)} ج.م
                </p>
              </div>
            )}
            
            {deliveryPaymentStatus === 'half_paid' && (
              <div>
                <p className="text-xs font-semibold text-yellow-700 mb-1 text-center">🕐 نصف المبلغ مدفوع</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">✅ مدفوع الآن:</span>
                    <span className="text-green-700 font-bold">{deliveryPaidAmount?.toFixed(2) || '0.00'} ج.م</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded p-1.5">
                    <span className="text-gray-900 font-bold">📦 المطلوب تحصيله:</span>
                    <span className="text-red-700 font-black">{(total - (deliveryPaidAmount || 0)).toFixed(2)} ج.م</span>
                  </div>
                </div>
              </div>
            )}
            
            {deliveryPaymentStatus === 'fully_paid' && (
              <div className="text-center">
                <p className="text-xs font-semibold text-green-700 mb-1">✅ مدفوع بالكامل</p>
                <p className="text-sm font-black text-green-900">
                  لا يوجد مبلغ للتحصيل (0 ج.م)
                </p>
              </div>
            )}
            
            {deliveryPaymentStatus === 'fully_paid_no_delivery' && (
              <div className="text-center">
                <p className="text-xs font-semibold text-green-700 mb-1">🚧 مدفوع كامل بدون توصيل</p>
                <p className="text-sm font-black text-blue-900">
                  المطلوب تحصيله: {Number(deliveryFee)} ج.م (رسوم التوصيل فقط)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* � Fixed Bottom - الإجمالي وزر إتمام البيع فقط (compact) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:w-96 bg-white border-t-2 border-gray-300 shadow-lg z-10">
        {/* Total + Button - في صف واحد compact */}
        <div className="p-3 flex items-center gap-3">
          {/* الإجمالي */}
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-0.5">الإجمالي</div>
            <div className="text-2xl font-black text-blue-600">
              {total} <span className="text-sm">ج.م</span>
            </div>
          </div>
          
          {/* زرار إتمام البيع */}
          <button
            onClick={onCheckout}
            disabled={items.length === 0 && services.length === 0 || processing}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-base
              transition-all transform active:scale-95
              ${
                (items.length === 0 && services.length === 0) || processing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg hover:shadow-xl'
              }
            `}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                <span className="text-sm">جاري...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>✓</span>
                <span>إتمام البيع</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}