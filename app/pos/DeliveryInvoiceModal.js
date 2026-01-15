'use client';

import { useEffect, useRef } from 'react';

/**
 * DeliveryInvoiceModal - بوليصة التوصيل القابلة للطباعة
 */
export default function DeliveryInvoiceModal({ isOpen, onClose, invoice, vendorInfo }) {
  const printAreaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-print when modal opens
      setTimeout(() => {
        handlePrint();
      }, 300);
    }
  }, [isOpen]);

  const handlePrint = () => {
    if (printAreaRef.current) {
      const printContent = printAreaRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload(); // إعادة تحميل الصفحة بعد الطباعة
    }
  };

  if (!isOpen || !invoice) return null;

  const customer = invoice.delivery?.customer;
  const address = customer?.address || {};

  // تنسيق العنوان الكامل
  const fullAddress = [
    address.state,
    address.city,
    address.area,
    address.street,
    address.building && `عقار ${address.building}`,
    address.floor && `دور ${address.floor}`,
    address.apartment && `شقة ${address.apartment}`,
  ].filter(Boolean).join(' - ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">🚚</span>
            بوليصة توصيل
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-green-50 font-bold transition-all"
            >
              🖨️ طباعة
            </button>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printAreaRef} className="p-8 print:p-4">
          {/* Header Section */}
          <div className="border-b-2 border-gray-300 pb-6 mb-6">
            <div className="flex items-start justify-between">
              {/* Vendor Info */}
              <div>
                {vendorInfo?.logo && (
                  <img
                    src={vendorInfo.logo}
                    alt="Logo"
                    className="h-16 mb-3"
                  />
                )}
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  {vendorInfo?.name || 'اسم المحل'}
                </h1>
                {vendorInfo?.phone && (
                  <p className="text-sm text-gray-600">📱 {vendorInfo.phone}</p>
                )}
                {vendorInfo?.address && (
                  <p className="text-sm text-gray-600">📍 {vendorInfo.address}</p>
                )}
              </div>

              {/* Invoice Info */}
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">رقم الفاتورة</div>
                <div className="text-lg font-bold text-gray-800">#{invoice.id}</div>
                <div className="text-sm text-gray-500 mt-2">
                  {new Date(invoice.date).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Delivery Info */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Customer Info */}
            <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
              <h3 className="font-bold text-lg text-blue-800 mb-3 flex items-center gap-2">
                <span className="text-2xl">👤</span>
                معلومات العميل
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">الاسم:</span>
                  <span className="mr-2 text-gray-800">{customer?.name}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">الهاتف:</span>
                  <span className="mr-2 text-gray-800 font-bold text-lg">{customer?.phone}</span>
                </div>
                {customer?.email && (
                  <div>
                    <span className="font-semibold text-gray-700">البريد:</span>
                    <span className="mr-2 text-gray-800">{customer.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50">
              <h3 className="font-bold text-lg text-green-800 mb-3 flex items-center gap-2">
                <span className="text-2xl">📍</span>
                عنوان التوصيل
              </h3>
              <div className="text-sm text-gray-800 leading-relaxed">
                {fullAddress || 'لم يتم تحديد عنوان'}
                {address.landmark && (
                  <div className="mt-2 p-2 bg-yellow-100 rounded border border-yellow-300">
                    <span className="font-semibold">🎯 علامة مميزة:</span>
                    <span className="mr-2">{address.landmark}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">📦</span>
              المنتجات
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-right">#</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">المنتج</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">الكمية</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">السعر</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                    <td className="border border-gray-300 px-4 py-2 font-medium">{item.name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center font-bold">{item.quantity}</td>
                    <td className="border border-gray-300 px-4 py-2">{Number(item.price).toFixed(2)} ج.م</td>
                    <td className="border border-gray-300 px-4 py-2 font-semibold">
                      {(Number(item.price) * item.quantity).toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Services (if any) */}
          {invoice.services && invoice.services.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-2xl">🔧</span>
                الخدمات
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-right">#</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">الخدمة</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.services.map((service, index) => (
                    <tr key={service.id}>
                      <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-2">{service.description}</td>
                      <td className="border border-gray-300 px-4 py-2 font-semibold">
                        {Number(service.amount).toFixed(2)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="border-t-2 border-gray-300 pt-4">
            <div className="max-w-md mr-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">المجموع الفرعي:</span>
                <span className="font-medium">{invoice.summary.subtotal.toFixed(2)} ج.م</span>
              </div>

              {invoice.summary.discount?.amount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>الخصم:</span>
                  <span className="font-medium">- {invoice.summary.discount.amount.toFixed(2)} ج.م</span>
                </div>
              )}

              {invoice.summary.extraFee > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>رسوم إضافية:</span>
                  <span className="font-medium">+ {invoice.summary.extraFee.toFixed(2)} ج.م</span>
                </div>
              )}

              {invoice.summary.deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>🚚 رسوم التوصيل:</span>
                  <span className="font-medium">+ {invoice.summary.deliveryFee.toFixed(2)} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-xl font-bold text-gray-800 border-t-2 border-gray-400 pt-2">
                <span>الإجمالي المطلوب:</span>
                <span className="text-green-600">{invoice.summary.total.toFixed(2)} ج.م</span>
              </div>

              <div className="text-sm text-gray-600 mt-2">
                طريقة الدفع: <span className="font-semibold">
                  {invoice.paymentMethod === 'cash' ? 'نقدي' : 
                   invoice.paymentMethod === 'card' ? 'بطاقة' : 
                   invoice.paymentMethod === 'mobile' ? 'محفظة' : 'آخر'}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Notes */}
          {invoice.delivery?.notes && (
            <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
              <h3 className="font-bold text-gray-800 mb-2">📝 ملاحظات التوصيل:</h3>
              <p className="text-gray-700">{invoice.delivery.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-300 text-center text-sm text-gray-600">
            <p className="font-semibold">شكراً لتعاملكم معنا 🙏</p>
            <p className="mt-2">يرجى التأكد من المنتجات عند الاستلام</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-4, .print\\:p-4 * {
            visibility: visible;
          }
          .print\\:p-4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
