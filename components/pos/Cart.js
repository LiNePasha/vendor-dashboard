"use client";

export function Cart({
  items,
  services = [],
  onUpdateQuantity,
  onRemoveItem,
  onAddService,
  onUpdateService,
  onRemoveService,
  onCheckout,
  processing,
  discount = 0,
  discountType = 'amount', // 'amount' or 'percentage'
  extraFee = 0,
  paymentMethod = 'cash',
  onDiscountChange,
  onDiscountTypeChange,
  onExtraFeeChange,
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

  // Calculate final total
  const total = subtotal - discountAmount + Number(extraFee);

  return (
    <div className="h-full flex flex-col">
      {/* <div className="p-2 border-b">
        <h2 className="text-lg font-bold">سلة المشتريات</h2>
      </div> */}

      <div className="flex-1 overflow-y-auto p-4 border-t mt-1">
        {items.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            السلة فارغة
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <div className="text-sm text-gray-500">
                    {item.regular_price || item.price} ج.م × {item.quantity}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded border
                      hover:bg-gray-100 disabled:opacity-50"
                  >
                    -
                  </button>
                  
                  <span className="w-8 text-center">{item.quantity}</span>
                  
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock_quantity}
                    className="w-8 h-8 flex items-center justify-center rounded border
                      hover:bg-gray-100 disabled:opacity-50"
                  >
                    +
                  </button>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="w-8 h-8 flex items-center justify-center rounded border
                      text-red-600 hover:bg-red-50"
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
      <div className="border-t p-4 max-h-40 overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-700">رسوم خدمات</h3>
          <button
            onClick={() => onAddService()}
            className="px-3 py-1 bg-purple-500 text-white rounded-lg 
              hover:bg-purple-600 transition-colors text-sm flex items-center gap-1"
          >
            <span>+</span>
            <span>إضافة خدمة</span>
          </button>
        </div>

        {services.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">
            لا توجد خدمات مضافة
          </p>
        ) : (
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={service.description || ''}
                    onChange={(e) => onUpdateService(service.id, 'description', e.target.value)}
                    placeholder="وصف الخدمة..."
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  />
                  <button
                    onClick={() => onRemoveService(service.id)}
                    className="w-8 h-8 flex items-center justify-center rounded border
                      text-red-600 hover:bg-red-50"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">المبلغ:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.amount || ''}
                    onChange={(e) => onUpdateService(service.id, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-32 px-2 py-1 border rounded text-sm"
                  />
                  <span className="text-sm text-gray-600">ج.م</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-4 bg-gray-50 space-y-3">
        {/* Payment Method, Discount, and Extra Fee in one row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Payment Method */}
          <div className="bg-white p-2 rounded-lg border">
            <label className="block text-[10px] font-semibold text-gray-600 mb-1.5">💳 الدفع</label>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cash">كاش</option>
              <option value="wallet">محفظة</option>
              <option value="instapay">انستا باي</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {/* Discount */}
          <div className="bg-white p-2 rounded-lg border">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-gray-600">🏷️ الخصم</label>
              <select
                value={discountType}
                onChange={(e) => onDiscountTypeChange(e.target.value)}
                className="px-1.5 py-0.5 border rounded text-[10px] font-semibold focus:ring-1 focus:ring-red-500 focus:border-red-500"
              >
                <option value="percentage">%</option>
                <option value="amount">ج</option>
              </select>
            </div>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => onDiscountChange(Math.max(0, e.target.value))}
              className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="0"
            />
          </div>

          {/* Extra Fee */}
          <div className="bg-white p-2 rounded-lg border">
            <label className="block text-[10px] font-semibold text-gray-600 mb-1.5">➕ رسوم</label>
            <input
              type="number"
              min="0"
              value={extraFee}
              onChange={(e) => onExtraFeeChange(Math.max(0, e.target.value))}
              className="w-full p-1.5 border rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-2">
          {productsSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span>مجموع المنتجات:</span>
              <span>{productsSubtotal.toFixed(2)} ج.م</span>
            </div>
          )}

          {servicesTotal > 0 && (
            <div className="flex justify-between text-sm text-purple-600">
              <span>مجموع الخدمات:</span>
              <span>{servicesTotal.toFixed(2)} ج.م</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>المجموع الفرعي:</span>
            <span>{subtotal.toFixed(2)} ج.م</span>
          </div>
          
          {discount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>
                الخصم ({discountType === 'percentage' 
                  ? `${discount}%` 
                  : `${discount} ج.م`}):
              </span>
              <span>- {discountAmount.toFixed(2)} ج.م</span>
            </div>
          )}
          
          {extraFee > 0 && (
            <div className="flex justify-between text-sm">
              <span>رسوم إضافية:</span>
              <span>+ {Number(extraFee).toFixed(2)} ج.م</span>
            </div>
          )}
          
          <div className="flex justify-between font-bold pt-2 border-t">
            <span>الإجمالي النهائي:</span>
            <span>{total.toFixed(2)} ج.م</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0 && services.length === 0 || processing}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white
            ${
              (items.length === 0 && services.length === 0) || processing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
        >
          {processing ? 'جاري المعالجة...' : 'إتمام البيع'}
        </button>
      </div>
    </div>
  );
}