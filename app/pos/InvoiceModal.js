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
            <h2 className="text-xl font-bold mb-1 text-gray-900">فاتورة بيع</h2>
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
                {invoice.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.price} ج.م</td>
                    <td>{item.quantity}</td>
                    <td>{item.totalPrice} ج.م</td>
                  </tr>
                ))}
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
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>الإجمالي النهائي:</span>
              <span>{invoice.summary.total.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between mt-2">
              <span>طريقة الدفع:</span>
              <span>{invoice.paymentMethod}</span>
            </div>
          </div>
          
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
            فاتورة بيع
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
