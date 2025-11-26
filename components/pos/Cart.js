"use client";

import { useState, useEffect } from "react";
import localforage from "localforage";

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
  paymentMethod = 'cash',
  onDiscountChange,
  onDiscountTypeChange,
  onPaymentMethodChange,
  employees = [] // 🆕 قائمة الموظفين
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
  const total = subtotal - discountAmount;

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
    <div className="h-full flex flex-col">
      {/* <div className="p-2 border-b">
        <h2 className="text-lg font-bold">سلة المشتريات</h2>
      </div> */}

      <div className="flex-1 overflow-y-auto p-4 bg-white max-h-48">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">
            <div className="text-5xl mb-3">🛒</div>
            <p className="text-sm">السلة فارغة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate text-sm">{item.name}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.regular_price || item.price} ج.م × {item.quantity} = 
                    <span className="font-semibold text-gray-700 mr-1">
                      {((item.regular_price || item.price) * item.quantity).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-300
                      bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed
                      text-gray-700 font-bold transition-colors"
                  >
                    −
                  </button>
                  
                  <span className="w-8 text-center font-semibold text-sm text-gray-800">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock_quantity}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-300
                      bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed
                      text-gray-700 font-bold transition-colors"
                  >
                    +
                  </button>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-red-300
                      bg-white text-red-600 hover:bg-red-50 transition-colors font-bold"
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
      <div className="border-t p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">خدمات إضافية</h3>
          <button
            onClick={() => onAddService()}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg 
              hover:bg-purple-700 transition-colors text-xs font-medium shadow-sm"
          >
            + يدوي
          </button>
        </div>

        {savedServices.length > 0 && (
          <div className="mb-3">
            <select
              value={selectedServiceId}
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  handleAddSavedService(id);
                }
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg 
                text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
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

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {services.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-6">
              لا توجد خدمات مضافة
            </p>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                className="p-2.5 bg-white border border-purple-100 rounded-lg"
              >
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={service.description || ''}
                    onChange={(e) => onUpdateService(service.id, 'description', e.target.value)}
                    placeholder="وصف الخدمة..."
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm 
                      focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={() => onRemoveService(service.id)}
                    className="w-8 h-8 flex items-center justify-center rounded 
                      text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                    title="حذف"
                  >
                    ×
                  </button>
                </div>
                
                {/* 🆕 اختيار الموظف المسؤول عن الخدمة */}
                {employees && employees.length > 0 && (
                  <div className="mb-2">
                    <select
                      value={service.employeeId || ''}
                      onChange={(e) => {
                        const selectedEmp = employees.find(emp => emp.id == e.target.value);
                        console.log('🔧 Service Employee Selected:', {
                          serviceId: service.id,
                          employeeId: e.target.value,
                          employeeName: selectedEmp?.name,
                          employeeIdType: typeof e.target.value
                        });
                        onUpdateService(service.id, 'employeeId', e.target.value);
                        onUpdateService(service.id, 'employeeName', selectedEmp?.name || '');
                      }}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs
                        focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">المبلغ:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.amount || ''}
                    onChange={(e) => onUpdateService(service.id, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm 
                      focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-xs text-gray-600 font-medium">ج.م</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t p-4 bg-white space-y-3">
        {/* Payment Method and Discount */}
        <div className="grid grid-cols-2 gap-2">
          {/* Payment Method */}
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <label className="block text-[10px] font-semibold text-gray-700 mb-1.5">
              💳 طريقة الدفع
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cash">كاش</option>
              <option value="wallet">محفظة</option>
              <option value="instapay">انستا باي</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {/* Discount */}
          <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-gray-700">🏷️ الخصم</label>
              <select
                value={discountType}
                onChange={(e) => onDiscountTypeChange(e.target.value)}
                className="px-2 py-0.5 bg-white border border-gray-300 rounded text-[10px] 
                  font-semibold focus:ring-1 focus:ring-red-500"
              >
                <option value="percentage">%</option>
                <option value="amount">ج.م</option>
              </select>
            </div>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => onDiscountChange(Math.max(0, e.target.value))}
              className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs 
                focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-2 bg-gray-50 -mx-4 px-4 py-3 rounded-lg">
          {productsSubtotal > 0 && (
            <div className="flex justify-between text-sm text-gray-700">
              <span>المنتجات:</span>
              <span className="font-medium">{productsSubtotal.toFixed(2)} ج.م</span>
            </div>
          )}

          {servicesTotal > 0 && (
            <div className="flex justify-between text-sm text-purple-600">
              <span>الخدمات:</span>
              <span className="font-medium">{servicesTotal.toFixed(2)} ج.م</span>
            </div>
          )}

          {(productsSubtotal > 0 || servicesTotal > 0) && (
            <div className="flex justify-between text-sm font-medium text-gray-800 border-t border-gray-300 pt-2">
              <span>المجموع الفرعي:</span>
              <span>{subtotal.toFixed(2)} ج.م</span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>
                الخصم ({discountType === 'percentage' 
                  ? `${discount}%` 
                  : `${discount} ج.م`}):
              </span>
              <span className="font-medium">- {discountAmount.toFixed(2)} ج.م</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t-2 border-gray-400">
            <span>الإجمالي:</span>
            <span className="text-blue-600">{total.toFixed(2)} ج.م</span>
          </div>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0 && services.length === 0 || processing}
          className={`w-full py-3.5 px-4 rounded-lg font-bold text-white text-base
            transition-all shadow-md
            ${
              (items.length === 0 && services.length === 0) || processing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
            }
          `}
        >
          {processing ? '⏳ جاري المعالجة...' : '✓ إتمام البيع'}
        </button>
      </div>
    </div>
  );
}