import React, { useState, useEffect } from 'react';
import usePOSStore from '@/app/stores/pos-store';
import { getVendorLogo } from '@/app/lib/vendor-constants';

export default function InvoiceModal({ invoice, open, onClose, onPrint }) {
  const { vendorInfo, getVendorInfo } = usePOSStore();

  useEffect(() => {
    if (open && !vendorInfo) {
      // Get vendor info from Zustand (cached) if not already loaded
      getVendorInfo();
    }
  }, [open, vendorInfo, getVendorInfo]);

  if (!open || !invoice) return null;

  // Use STATIC logo based on vendor ID (not from API)
  const logoSrc = getVendorLogo(vendorInfo?.id);
  
  // التحقق من نوع الطلب
  const isDelivery = invoice.orderType === 'delivery';
  const customer = invoice.delivery?.customer;
  const address = customer?.address || {};
  const deliveryNotes = invoice.delivery?.notes;
  
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
    <>
      {/* Modal View */}
      <div className="fixed overflow-y-scroll inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:hidden modal-screen">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative text-gray-800">
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-red-600"
            onClick={onClose}
          >
            ×
          </button>
          <div className="flex flex-col items-center mb-4">
            <img 
              src={logoSrc} 
              alt={vendorInfo?.name || 'Logo'} 
              className="w-24 object-cover mb-2 border-2 border-gray-200" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/icons/placeholder.webp';
              }}
            />
            {vendorInfo?.name && (
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{vendorInfo.name}</h3>
            )}
            <h2 className="text-xl font-bold mb-1 text-gray-900">
              {isDelivery ? '🚚 فاتورة توصيل' : '🏪 فاتورة بيع'}
            </h2>
            <span className="text-xs text-gray-600">{new Date(invoice.date).toLocaleString('ar-EG')}</span>
            {invoice.synced !== undefined && (
              <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                invoice.synced 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {invoice.synced ? '✓ تم المزامنة' : '⏳ قيد المعالجة'}
              </span>
            )}
          </div>

          {/* معلومات العميل والتوصيل */}
          {isDelivery && customer && (
            <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg">
              <h4 className="font-bold text-sm text-green-800 mb-2 flex items-center gap-1">
                <span>👤</span> معلومات العميل والتوصيل
              </h4>
              <div className="space-y-1 text-xs text-gray-700">
                <div><span className="font-semibold">الاسم:</span> {customer.name}</div>
                <div><span className="font-semibold">📱 الهاتف:</span> <span className="font-bold text-base">{customer.phone}</span></div>
                {customer.email && <div><span className="font-semibold">📧 البريد:</span> {customer.email}</div>}
                {fullAddress && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <span className="font-semibold">📍 العنوان:</span>
                    <div className="mr-2 text-gray-800">{fullAddress}</div>
                  </div>
                )}
                {address.landmark && (
                  <div className="mt-1 p-1.5 bg-yellow-100 rounded text-xs">
                    <span className="font-semibold">🎯 علامة مميزة:</span> {address.landmark}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* حالة الدفع - Delivery Payment Status */}
          {isDelivery && invoice.deliveryPayment && (
            <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg">
              <h4 className="font-bold text-sm text-yellow-800 mb-2 flex items-center gap-1">
                <span>💳</span> حالة الدفع
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">
                    {invoice.deliveryPayment.status === 'cash_on_delivery' && '📦 دفع عند الاستلام'}
                    {invoice.deliveryPayment.status === 'half_paid' && '🕐 نصف المبلغ مدفوع'}
                    {invoice.deliveryPayment.status === 'fully_paid' && '✅ مدفوع كامل'}
                    {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && '🚧 مدفوع كامل بدون توصيل'}
                  </span>
                </div>
                {invoice.deliveryPayment.status === 'half_paid' && invoice.deliveryPayment.paidAmount > 0 && (
                  <div className="mt-2 p-2 bg-white rounded border border-yellow-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">المبلغ المدفوع:</span>
                      <span className="font-bold text-green-600 text-base">{invoice.deliveryPayment.paidAmount.toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold">المتبقي:</span>
                      <span className="font-bold text-red-600 text-base">{(invoice.summary.total - invoice.deliveryPayment.paidAmount).toFixed(2)} ج.م</span>
                    </div>
                    {invoice.deliveryPayment.note && (
                      <div className="mt-1 pt-1 border-t border-yellow-100 text-xs text-gray-600">
                        <span className="font-semibold">ملاحظة:</span> {invoice.deliveryPayment.note}
                      </div>
                    )}
                  </div>
                )}
                {invoice.deliveryPayment.status === 'fully_paid' && invoice.summary.deliveryFee > 0 && (
                  <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-green-700">✓ المدفوع (ثمن المنتجات):</span>
                      <span className="font-bold text-green-700 text-base">
                        {(invoice.summary.total - invoice.summary.deliveryFee).toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-green-700">✓ رسوم التوصيل المدفوعة:</span>
                      <span className="font-bold text-green-700 text-base">{invoice.summary.deliveryFee.toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-green-300">
                      <span className="font-semibold text-green-800">✓ إجمالي المدفوع:</span>
                      <span className="font-bold text-green-800 text-lg">{invoice.summary.total.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                )}
                {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && invoice.deliveryPayment.remainingAmount > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-green-700">✓ المدفوع (ثمن المنتجات):</span>
                      <span className="font-bold text-green-700 text-base">
                        {(invoice.summary.total - invoice.deliveryPayment.remainingAmount).toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-red-700">📦 المطلوب تحصيله:</span>
                      <span className="font-bold text-red-700 text-base">{invoice.deliveryPayment.remainingAmount.toFixed(2)} ج.م</span>
                    </div>
                    <div className="text-xs text-blue-600 mt-1 text-center">(رسوم التوصيل فقط)</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <table className="w-full text-sm text-gray-800">
              <thead>
                <tr className="border-b">
                  <th className="text-right">المنتج</th>
                  <th>سعر</th>
                  <th>كمية</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map(item => {
                  const hasDiscount = item.originalPrice && item.originalPrice > item.price;
                  const discountPercent = hasDiscount 
                    ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                    : 0;
                  
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-1">
                          <span>{item.name}</span>
                          {hasDiscount && (
                            <span className="text-xs bg-red-500 text-white px-1 py-0.5 rounded">
                              🏷️ {discountPercent}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {hasDiscount ? (
                          <div className="flex flex-col items-center">
                            <span className="line-through text-gray-400 text-xs">{item.originalPrice}</span>
                            <span className="text-red-600 font-bold">{item.price} ج.م</span>
                          </div>
                        ) : (
                          <span>{item.price} ج.م</span>
                        )}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.totalPrice} ج.م</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Services Section */}
          {invoice.services?.length > 0 && (
            <div className="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
              <h4 className="font-semibold text-purple-800 mb-2 text-sm">رسوم خدمات:</h4>
              <div className="space-y-2">
                {invoice.services.map((service, index) => (
                  <div key={index} className="flex justify-between text-sm text-gray-800">
                    <span className="flex items-center gap-1">
                      <span className="text-purple-700">🔧</span>
                      {service.description}
                    </span>
                    <span className="font-semibold text-purple-700">
                      {Number(service.amount).toFixed(2)} ج.م
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 text-sm text-gray-800">
            {invoice.summary?.productsSubtotal > 0 && (
              <div className="flex justify-between">
                <span>مجموع المنتجات:</span>
                <span>{invoice.summary.productsSubtotal.toFixed(2)} ج.م</span>
              </div>
            )}
            {invoice.summary?.servicesTotal > 0 && (
              <div className="flex justify-between text-purple-700">
                <span>مجموع الخدمات:</span>
                <span>{invoice.summary.servicesTotal.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t pt-1 mt-1">
              <span>المجموع الفرعي:</span>
              <span>{invoice.summary.subtotal.toFixed(2)} ج.م</span>
            </div>
            {invoice.summary.discount.amount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>الخصم ({invoice.summary.discount.type === 'percentage' ? `${invoice.summary.discount.value}%` : `${invoice.summary.discount.value} ج.م`}):</span>
                <span>- {invoice.summary.discount.amount.toFixed(2)} ج.م</span>
              </div>
            )}
            {invoice.summary.extraFee > 0 && (
              <div className="flex justify-between">
                <span>رسوم إضافية:</span>
                <span>+ {invoice.summary.extraFee.toFixed(2)} ج.م</span>
              </div>
            )}
            {invoice.summary.deliveryFee > 0 && (
              <div className="flex justify-between text-green-600">
                <span>🚚 رسوم التوصيل:</span>
                <span>+ {invoice.summary.deliveryFee.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>الإجمالي النهائي:</span>
              <span>{invoice.summary.total.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between mt-2">
              <span>طريقة الدفع:</span>
              <span>{invoice.paymentMethod}</span>
            </div>
          </div>

          {/* Delivery Notes */}
          {isDelivery && deliveryNotes && (
            <div className="mt-4 pt-3 border-t">
              <div className="text-sm font-bold mb-1">ملاحظات التوصيل:</div>
              <div className="text-xs text-gray-700 bg-yellow-50 p-2 rounded">
                {deliveryNotes}
              </div>
            </div>
          )}
          
          {vendorInfo && (
            <div className="mt-4 pt-3 border-t text-center text-xs text-gray-700">
              {vendorInfo.phone && <div>📞 {vendorInfo.phone}</div>}
              {vendorInfo.email && <div>📧 {vendorInfo.email}</div>}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold"
              onClick={onPrint}
            >
              طباعة
            </button>
            <button
              className="flex-1 py-2 bg-gray-300 text-gray-800 rounded-lg font-bold"
              onClick={onClose}
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Print View - Thermal Receipt Style */}
      <div>
        <style>{`
          @media screen {
            .receipt { display: none !important; }
          }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 72mm !important; background: white !important; }
              @page {
                size: 72mm auto;
                margin: 0mm;
            }
            /* Avoid Chrome adding extra page due to rounding */
            * { box-sizing: border-box; }
            img { max-width: 100% !important; height: auto !important; }
            .receipt { page-break-inside: avoid; page-break-after: auto; width: 72mm; display: block !important; }
            .modal-screen { display: none !important; }
          }
        `}</style>
        
        <div className="receipt" style={{
          width: '72mm',
          padding: '2mm',
          fontFamily: 'Arial, sans-serif',
          fontSize: '10px',
          lineHeight: '1.2',
          direction: 'rtl',
          backgroundColor: 'white',
          margin: 0,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3px', borderBottom: '1px dashed #000', paddingBottom: '3px', pageBreakInside: 'avoid' }}>
            <img 
              src={logoSrc} 
              alt="Logo"
              style={{ 
                width: '40px', 
                height: 'auto', 
                margin: '0 auto 3px',
                display: 'block'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            {vendorInfo?.name && (
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>
                {vendorInfo.name}
              </div>
            )}
            {vendorInfo?.phone && (
              <div style={{ fontSize: '9px', marginBottom: '1px' }}>📞 {vendorInfo.phone}</div>
            )}
            {vendorInfo?.address && typeof vendorInfo.address === 'string' && (
              <div style={{ fontSize: '8px', marginTop: '1px' }}>{vendorInfo.address}</div>
            )}
          </div>

          {/* Invoice Info */}
          <div style={{ textAlign: 'center', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            {isDelivery ? '🚚 فاتورة توصيل' : 'فاتورة بيع'}
          </div>
          <div style={{ fontSize: '8px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>#{invoice.id}</span>
            <span>{new Date(invoice.date).toLocaleString('ar-EG', { 
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>

          {/* Customer & Delivery Info - Print */}
          {isDelivery && customer && (
            <div style={{ 
              borderBottom: '1px dashed #000', 
              paddingBottom: '3px', 
              marginBottom: '3px',
              fontSize: '9px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>👤 العميل:</div>
              <div style={{ marginBottom: '1px' }}>{customer.name}</div>
              <div style={{ marginBottom: '1px' }}>📱 {customer.phone}</div>
              {fullAddress && (
                <div style={{ marginTop: '2px', fontSize: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>📍</span> {fullAddress}
                </div>
              )}
            </div>
          )}

          {/* Delivery Payment Status - Print */}
          {isDelivery && invoice.deliveryPayment && (
            <div style={{ 
              borderBottom: '1px dashed #000', 
              paddingBottom: '3px', 
              marginBottom: '3px',
              fontSize: '9px',
              backgroundColor: '#fffbeb'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>💳 حالة الدفع:</div>
              <div style={{ fontWeight: 'bold', fontSize: '10px' }}>
                {invoice.deliveryPayment.status === 'cash_on_delivery' && '📦 دفع عند الاستلام'}
                {invoice.deliveryPayment.status === 'half_paid' && '🕐 نصف المبلغ مدفوع'}
                {invoice.deliveryPayment.status === 'fully_paid' && '✅ مدفوع كامل'}
                {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && '🚧 مدفوع كامل بدون توصيل'}
              </div>
              {invoice.deliveryPayment.status === 'half_paid' && invoice.deliveryPayment.paidAmount > 0 && (
                <div style={{ marginTop: '2px', borderTop: '1px solid #ddd', paddingTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                    <span>المدفوع:</span>
                    <span style={{ fontWeight: 'bold' }}>{invoice.deliveryPayment.paidAmount.toFixed(2)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>المتبقي:</span>
                    <span>{(invoice.summary.total - invoice.deliveryPayment.paidAmount).toFixed(2)} ج.م</span>
                  </div>
                  {invoice.deliveryPayment.note && (
                    <div style={{ fontSize: '8px', marginTop: '1px' }}>ملاحظة: {invoice.deliveryPayment.note}</div>
                  )}
                </div>
              )}
              {invoice.deliveryPayment.status === 'fully_paid' && invoice.summary.deliveryFee > 0 && (
                <div style={{ marginTop: '2px', borderTop: '1px solid #10b981', paddingTop: '2px', backgroundColor: '#d1fae5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '9px' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>✓ المدفوع (منتجات):</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{(invoice.summary.total - invoice.summary.deliveryFee).toFixed(2)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '9px' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>✓ رسوم التوصيل:</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{invoice.summary.deliveryFee.toFixed(2)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #10b981', paddingTop: '1px', marginTop: '1px', fontSize: '10px' }}>
                    <span style={{ color: '#16a34a' }}>✓ الإجمالي:</span>
                    <span style={{ color: '#16a34a' }}>{invoice.summary.total.toFixed(2)} ج.م</span>
                  </div>
                </div>
              )}
              {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && invoice.deliveryPayment.remainingAmount > 0 && (
                <div style={{ marginTop: '2px', borderTop: '1px solid #ddd', paddingTop: '2px', backgroundColor: '#dbeafe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '9px' }}>
                    <span style={{ color: '#16a34a' }}>✓ المدفوع (منتجات):</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                      {(invoice.summary.total - invoice.deliveryPayment.remainingAmount).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px' }}>
                    <span style={{ color: '#dc2626' }}>📦 المطلوب:</span>
                    <span style={{ color: '#dc2626' }}>{invoice.deliveryPayment.remainingAmount.toFixed(2)} ج.م</span>
                  </div>
                  <div style={{ fontSize: '8px', marginTop: '1px', textAlign: 'center', color: '#1e40af' }}>(رسوم التوصيل)</div>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '3px', paddingBottom: '3px', marginBottom: '3px', pageBreakInside: 'avoid' }}>
            {invoice.items?.length > 0 && invoice.items.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '3px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '1px', fontSize: '10px' }}>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>{item.quantity} × {item.price} ج.م</span>
                  <span style={{ fontWeight: 'bold' }}>{item.totalPrice.toFixed(2)} ج.م</span>
                </div>
              </div>
            ))}
          </div>

          {/* Services */}
          {invoice.services?.length > 0 && (
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '3px', marginBottom: '3px', pageBreakInside: 'avoid' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px', color: '#7c3aed' }}>رسوم خدمات:</div>
              {invoice.services.map((service, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span>🔧 {service.description}</span>
                    <span style={{ fontWeight: 'bold', color: '#7c3aed' }}>{Number(service.amount).toFixed(2)} ج.م</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div style={{ marginBottom: '3px', fontSize: '9px', pageBreakInside: 'avoid' }}>
            {invoice.summary?.productsSubtotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                <span>مجموع المنتجات:</span>
                <span>{invoice.summary.productsSubtotal.toFixed(2)} ج.م</span>
              </div>
            )}
            {invoice.summary?.servicesTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', color: '#7c3aed' }}>
                <span>مجموع الخدمات:</span>
                <span>{invoice.summary.servicesTotal.toFixed(2)} ج.م</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
              <span>المجموع الفرعي:</span>
              <span>{invoice.summary.subtotal.toFixed(2)} ج.م</span>
            </div>
            {invoice.summary.discount.amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', color: '#000' }}>
                <span>الخصم ({invoice.summary.discount.type === 'percentage' ? `${invoice.summary.discount.value}%` : `${invoice.summary.discount.value} ج.م`}):</span>
                <span>- {invoice.summary.discount.amount.toFixed(2)} ج.م</span>
              </div>
            )}
            {invoice.summary.extraFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                <span>رسوم إضافية:</span>
                <span>+ {invoice.summary.extraFee.toFixed(2)} ج.م</span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '12px', 
              fontWeight: 'bold',
              borderTop: '1px solid #000',
              paddingTop: '2px',
              marginTop: '2px'
            }}>
              <span>الإجمالي:</span>
              <span>{invoice.summary.total.toFixed(2)} ج.م</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '9px' }}>
              <span>الدفع:</span>
              <span>{invoice.paymentMethod}</span>
            </div>
          </div>

          {/* Delivery Notes - Print */}
          {isDelivery && deliveryNotes && (
            <div style={{ 
              borderTop: '1px dashed #000',
              paddingTop: '3px',
              marginTop: '3px',
              fontSize: '8px',
              backgroundColor: '#fffbeb'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>📝 ملاحظات التوصيل:</div>
              <div>{deliveryNotes}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ 
            textAlign: 'center', 
            borderTop: '1px dashed #000',
            paddingTop: '3px',
            fontSize: '9px'
          }}>
          </div>
        </div>
      </div>
    </>
  );
}
