"use client";

export function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
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
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) * item.quantity),
    0
  );

  // Calculate discount amount
  const discountAmount = discountType === 'percentage' 
    ? (subtotal * (discount / 100))
    : discount;

  // Calculate final total
  const total = subtotal - discountAmount + Number(extraFee);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">سلة المشتريات</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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

      <div className="border-t p-4 bg-gray-50 space-y-4">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium mb-2">طريقة الدفع:</label>
          <select
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="cash">كاش</option>
            <option value="wallet">محفظة</option>
            <option value="instapay">انستا باي</option>
            <option value="other">أخرى</option>
          </select>
        </div>

        {/* Discount */}
        <div>
          <label className="block text-sm font-medium mb-2">الخصم:</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => onDiscountChange(e.target.value)}
              className="flex-1 p-2 border rounded-lg"
              placeholder="قيمة الخصم"
            />
            <select
              value={discountType}
              onChange={(e) => onDiscountTypeChange(e.target.value)}
              className="w-24 p-2 border rounded-lg"
            >
              <option value="amount">ج.م</option>
              <option value="percentage">%</option>
            </select>
          </div>
        </div>

        {/* Extra Fee */}
        <div>
          <label className="block text-sm font-medium mb-2">رسوم إضافية:</label>
          <input
            type="number"
            min="0"
            value={extraFee}
            onChange={(e) => onExtraFeeChange(e.target.value)}
            className="w-full p-2 border rounded-lg"
            placeholder="رسوم إضافية"
          />
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-sm">
            <span>المجموع:</span>
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
          disabled={items.length === 0 || processing}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white
            ${
              items.length === 0 || processing
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