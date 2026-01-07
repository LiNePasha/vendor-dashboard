'use client';

import { useEffect, useState } from 'react';
import usePOSStore from '@/app/stores/pos-store';
import { getVendorLogo, getVendorStoreLink } from '@/app/lib/vendor-constants';

export default function WholesalePrintPage() {
  const [printData, setPrintData] = useState(null);
  const vendorInfo = usePOSStore((state) => state.vendorInfo);
  const getVendorInfo = usePOSStore((state) => state.getVendorInfo);

  // Calculate price based on discount
  const calculatePrice = (regularPrice, tier) => {
    if (tier.discountType === 'percentage') {
      return regularPrice * (1 - tier.discountValue / 100);
    } else {
      return regularPrice - tier.discountValue;
    }
  };

  // Format price without unnecessary .00
  const formatPrice = (price) => {
    return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  };

  // Load vendor info if not available
  useEffect(() => {
    if (!vendorInfo) {
      getVendorInfo();
    }
  }, [vendorInfo, getVendorInfo]);

  useEffect(() => {
    const data = localStorage.getItem('wholesalePrintData');
    if (data) {
      setPrintData(JSON.parse(data));
    }
  }, []);

  useEffect(() => {
    if (!printData) return;
    
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
  }, [printData, vendorInfo]);

  if (!printData || !vendorInfo) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>جاري التحميل...</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {!printData && 'تحميل قائمة التسعير...'}
          {!vendorInfo && 'تحميل بيانات المتجر...'}
        </div>
      </div>
    );
  }

  const logoSrc = getVendorLogo(vendorInfo?.id);
  const storeLink = getVendorStoreLink(vendorInfo?.id);
  const date = new Date(printData.date);

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
        fontSize: '12px',
        lineHeight: '1.4',
        direction: 'rtl',
        backgroundColor: 'white',
        color: '#222',
        padding: '3mm',
        margin: 0
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', borderBottom: '1px dashed #000', paddingBottom: '2mm', color: '#222' }}>
          <img src={logoSrc} alt="Logo" style={{ width: '50px', height: 'auto', margin: '0 auto 2mm', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          {vendorInfo?.name && (
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '1mm', color: '#111' }}>{vendorInfo.name}</div>
          )}
          {vendorInfo?.phone && (
            <div style={{ fontSize: '12px', marginBottom: '1mm', color: '#222' }}>📞 {vendorInfo.phone}</div>
          )}
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', fontSize: '15px', fontWeight: 'bold', color: '#111' }}>
          🏪 قائمة تسعير جملة
        </div>

        {/* List Name */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2mm', 
          padding: '1mm', 
          backgroundColor: '#eff6ff', 
          border: '1px solid #3b82f6',
          borderRadius: '2mm',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#1e40af'
        }}>
          {printData.listName}
        </div>

        {/* Date */}
        <div style={{ fontSize: '11px', marginBottom: '2mm', textAlign: 'center', color: '#666' }}>
          {date.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Products List */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '2mm', marginBottom: '2mm' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '13px', textAlign: 'center' }}>
            📦 المنتجات ({printData.products.length})
          </div>
          
          {printData.products.map((product, index) => {
            const productTiers = product.tiers || [];
            
            return (
              <div key={product.id} style={{ 
                marginBottom: '2mm',
                paddingBottom: '2mm',
                borderBottom: index < printData.products.length - 1 ? '1px solid #000' : 'none'
              }}>
                {/* Product Header */}
                <div style={{ 
                  backgroundColor: '#f3f4f6',
                  padding: '1mm 2mm',
                  marginBottom: '1mm',
                  border: '1px solid #000'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#000', marginBottom: '0.5mm' }}>
                    {product.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' }}>
                    {product.sku && <span>كود: {product.sku}</span>}
                    <span style={{ fontWeight: 'bold', color: '#000' }}>سعر التجزئة: {formatPrice(product.regularPrice)} ج</span>
                  </div>
                </div>

                {/* Pricing Table */}
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '11px',
                  border: '1px solid #000'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e5e7eb' }}>
                      <th style={{ 
                        padding: '1mm', 
                        border: '1px solid #000',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        الكمية
                      </th>
                      <th style={{ 
                        padding: '1mm', 
                        border: '1px solid #000',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        الخصم
                      </th>
                      <th style={{ 
                        padding: '1mm', 
                        border: '1px solid #000',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        السعر
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productTiers.map((tier, tidx) => {
                      const discountedPrice = calculatePrice(product.regularPrice, tier);
                      const discountLabel = tier.discountType === 'percentage' 
                        ? `${tier.discountValue}%` 
                        : `${tier.discountValue} ج`;
                      
                      return (
                        <tr key={tidx} style={{ backgroundColor: tidx % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ 
                            padding: '1mm', 
                            border: '1px solid #000',
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}>
                            {tier.from}-{tier.to || '+'}
                          </td>
                          <td style={{ 
                            padding: '1mm', 
                            border: '1px solid #000',
                            textAlign: 'center',
                            color: tier.discountValue > 0 ? '#dc2626' : '#666',
                            fontSize: '10px'
                          }}>
                            {tier.discountValue > 0 ? discountLabel : '-'}
                          </td>
                          <td style={{ 
                            padding: '1mm', 
                            border: '1px solid #000',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            {formatPrice(discountedPrice)} ج
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '2mm', fontSize: '11px' }}>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '1mm' }}>
            📌 الأسعار قابلة للتغيير بدون إخطار
          </div>
          <div style={{ fontSize: '11px', color: '#222' }}>موقع {vendorInfo.name} الرسمي</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '1mm', color: '#111' }}>{storeLink}</div>
          <div style={{ fontSize: '12px', marginTop: '2mm', color: '#222', fontWeight: 'bold' }}>شكراً لتعاملكم معنا 🙏</div>
        </div>
      </div>
    </>
  );
}
