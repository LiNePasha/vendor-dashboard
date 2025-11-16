'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoiceStorage } from '@/app/lib/localforage';
import { getVendorLogo, getVendorStoreLink } from '@/app/lib/vendor-constants';
import usePOSStore from '@/app/stores/pos-store';

function PrintInvoiceContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const invoiceId = useMemo(() => (idParam ? String(idParam) : ''), [idParam]);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const vendorInfo = usePOSStore((state) => state.vendorInfo);
  const getVendorInfo = usePOSStore((state) => state.getVendorInfo);

  // Load vendor info if not available
  useEffect(() => {
    console.log('👤 Vendor Info:', vendorInfo);
    if (!vendorInfo) {
      console.log('⚠️ No vendor info, fetching...');
      getVendorInfo();
    }
  }, [vendorInfo, getVendorInfo]);

  useEffect(() => {
    async function load() {
      try {
        console.log('🔍 Loading invoice:', invoiceId);
        let inv = null;
        if (invoiceStorage?.getInvoice) {
          inv = await invoiceStorage.getInvoice(invoiceId);
          console.log('📄 Invoice from getInvoice:', inv);
        }
        if (!inv) {
          const all = await invoiceStorage.getAllInvoices();
          console.log('📦 All invoices:', all);
          inv = all.find((i) => String(i.id) === String(invoiceId)) || null;
          console.log('✅ Found invoice:', inv);
        }
        setInvoice(inv || null);
      } catch (err) {
        console.error('❌ Error loading invoice:', err);
        setInvoice(null);
      } finally {
        setLoading(false);
      }
    }
    if (invoiceId) load();
  }, [invoiceId]);

  useEffect(() => {
  if (!invoice) return;
    
    const t = setTimeout(() => {
      window.print();
    }, 300);
    
    const after = () => {
      try { window.close(); } catch (_) {}
    };
    window.addEventListener('afterprint', after);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', after);
    };
  }, [invoice, vendorInfo]);

  if (!invoiceId) {
    console.log('❌ No invoice ID');
    return <div style={{ padding: 16 }}>لا يوجد معرف فاتورة للطباعة</div>;
  }
  if (loading || !invoice || !vendorInfo) {
    console.log('⏳ Loading state:', { loading, hasInvoice: !!invoice, hasVendor: !!vendorInfo });
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>جاري التحميل...</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {!invoice && 'تحميل الفاتورة...'}
          {!vendorInfo && 'تحميل بيانات المتجر...'}
        </div>
      </div>
    );
  }

  // Use STATIC logo based on vendor ID (not from API)
  const logoSrc = getVendorLogo(vendorInfo?.id);
  
  // Get store link based on vendor ID
  const storeLink = getVendorStoreLink(vendorInfo?.id);
  
  // Translate payment method to Arabic
  const paymentMethodAr = {
    cash: '💵 كاش',
    wallet: '👛 محفظة',
    instapay: '📱 انستا باي',
    card: '💳 بطاقة'
  }[invoice.paymentMethod] || invoice.paymentMethod;

  return (
    <>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        /* Force hide all layout elements on print page */
        body > div > aside,
        body > div > div[class*="fixed"],
        nav, header {
          display: none !important;
        }
        
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        @media print {
          @page { 
            size: 72mm auto;
            margin: 0mm;
          }
          
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 72mm !important;
            background: white !important;
          }
          
          body {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
          }
          
          img { 
            max-width: 100% !important; 
            height: auto !important; 
            display: block;
          }
          
          .receipt-print { 
            width: 72mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            background: white !important;
            display: block !important;
          }
        }
        
        @media screen {
          body { 
            background: #f5f7fa;
            padding: 16px;
          }
          .receipt-print { 
            margin: 0 auto;
            max-width: 72mm;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08); 
          }
        }
      `}</style>

      <div className="receipt-print" style={{
        width: '72mm',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        lineHeight: '1.2',
        direction: 'rtl',
        backgroundColor: 'white',
        padding: '3mm',
        margin: 0
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', borderBottom: '1px dashed #000', paddingBottom: '2mm' }}>
          <img src={logoSrc} alt="Logo" style={{ width: '45px', height: 'auto', margin: '0 auto 2mm', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          {vendorInfo?.name && (
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '1mm' }}>{vendorInfo.name}</div>
          )}
          {vendorInfo?.phone && (
            <div style={{ fontSize: '9px', marginBottom: '1mm' }}>📞 {vendorInfo.phone}</div>
          )}
          {vendorInfo?.address && typeof vendorInfo.address === 'string' && (
            <div style={{ fontSize: '8px', marginTop: '1mm', color: '#555' }}>{vendorInfo.address}</div>
          )}
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', fontSize: '11px', fontWeight: 'bold' }}>فاتورة بيع</div>
        
        {/* Online Order Badge */}
        {invoice.source === 'order' && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '2mm', 
            padding: '1mm', 
            backgroundColor: '#eff6ff', 
            border: '1px solid #3b82f6',
            borderRadius: '2mm',
            fontSize: '9px',
            fontWeight: 'bold',
            color: '#1e40af'
          }}>
            🌐 طلب أونلاين {invoice.orderId && `#${invoice.orderId}`}
          </div>
        )}

        {/* Customer Info (for online orders) */}
        {invoice.customerInfo && (invoice.customerInfo.name || invoice.customerInfo.phone) && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '2mm',
            fontSize: '8px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '9px' }}>بيانات العميل:</div>
            {invoice.customerInfo.name && (
              <div style={{ marginBottom: '0.5mm' }}>👤 {invoice.customerInfo.name}</div>
            )}
            {invoice.customerInfo.phone && (
              <div style={{ marginBottom: '0.5mm' }}>📞 {invoice.customerInfo.phone}</div>
            )}
            {invoice.customerInfo.address && (
              <div style={{ marginBottom: '0.5mm' }}>📍 {invoice.customerInfo.address}</div>
            )}
          </div>
        )}
        
        {/* Invoice info */}
        <div style={{ fontSize: '8px', marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}>
          <span>#{invoice.id}</span>
          <span>{new Date(invoice.date).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Items */}
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '2mm', paddingBottom: '2mm', marginBottom: '2mm' }}>
          {invoice.items?.length > 0 && invoice.items.map((item) => (
            <div key={item.id} style={{ marginBottom: '2mm' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5mm', fontSize: '10px' }}>{item.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span>{item.quantity} × {item.price} ج.م</span>
                <span style={{ fontWeight: 'bold' }}>{Number(item.totalPrice || (item.price * item.quantity)).toFixed(2)} ج.م</span>
              </div>
            </div>
          ))}
        </div>

        {/* Services */}
        {invoice.services?.length > 0 && (
          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '2mm', marginBottom: '2mm' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '1mm', color: '#7c3aed' }}>رسوم خدمات:</div>
            {invoice.services.map((service, index) => (
              <div key={index} style={{ marginBottom: '1mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>🔧 {service.description}</span>
                  <span style={{ fontWeight: 'bold', color: '#7c3aed' }}>{Number(service.amount).toFixed(2)} ج.م</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div style={{ marginBottom: '2mm', fontSize: '9px' }}>
          {invoice.summary?.productsSubtotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
              <span>مجموع المنتجات:</span>
              <span>{Number(invoice.summary.productsSubtotal).toFixed(2)} ج.م</span>
            </div>
          )}
          {invoice.summary?.servicesTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#7c3aed' }}>
              <span>مجموع الخدمات:</span>
              <span>{Number(invoice.summary.servicesTotal).toFixed(2)} ج.م</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '1mm' }}>
            <span>المجموع الفرعي:</span>
            <span>{Number(invoice.summary.subtotal).toFixed(2)} ج.م</span>
          </div>
          {invoice.summary.discount?.amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
              <span>الخصم ({invoice.summary.discount.type === 'percentage' ? `${invoice.summary.discount.value}%` : `${invoice.summary.discount.value} ج.م`}):</span>
              <span>- {Number(invoice.summary.discount.amount).toFixed(2)} ج.م</span>
            </div>
          )}
          {invoice.summary.extraFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
              <span>رسوم إضافية:</span>
              <span>+ {Number(invoice.summary.extraFee).toFixed(2)} ج.م</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '1mm', marginTop: '1mm' }}>
            <span>الإجمالي:</span>
            <span>{Number(invoice.summary.total).toFixed(2)} ج.م</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm', fontSize: '9px' }}>
            <span>الدفع:</span>
            <span>{paymentMethodAr}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '2mm', fontSize: '9px' }}>
          <div style={{ fontSize: '8px' }}>(معا لتطوير مجال الموتوسيكلات في مصر)</div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', marginTop: '1mm' }}>{storeLink}</div>
        </div>
      </div>
    </>
  );
}

export default PrintInvoiceContent;
