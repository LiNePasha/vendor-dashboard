'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoiceStorage } from '@/app/lib/localforage';
import { getVendorLogo, getVendorStoreLink } from '@/app/lib/vendor-constants';
import usePOSStore from '@/app/stores/pos-store';

function DailySalesReportContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids');
  
  const invoiceIds = useMemo(() => {
    if (idsParam) {
      return idsParam.split(',').map(id => String(id).trim()).filter(Boolean);
    }
    return [];
  }, [idsParam]);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const vendorInfo = usePOSStore((state) => state.vendorInfo);
  const getVendorInfo = usePOSStore((state) => state.getVendorInfo);

  // Load vendor info if not available
  useEffect(() => {
    if (!vendorInfo) {
      getVendorInfo();
    }
  }, [vendorInfo, getVendorInfo]);

  useEffect(() => {
    async function load() {
      try {
        const allInvoices = await invoiceStorage.getAllInvoices();
        const loadedInvoices = invoiceIds
          .map((id) => {
            for (let i = allInvoices.length - 1; i >= 0; i--) {
              if (String(allInvoices[i].id) === String(id)) {
                return allInvoices[i];
              }
            }
            return null;
          })
          .filter(Boolean);
        setInvoices(loadedInvoices);
      } catch (err) {
        console.error('❌ Error loading invoices:', err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }
    if (invoiceIds.length > 0) load();
  }, [invoiceIds]);

  useEffect(() => {
    if (invoices.length === 0 || !vendorInfo) return;
    
    const t = setTimeout(() => {
      window.print();
    }, 500);
    
    const after = () => {
      try { window.close(); } catch (_) {}
    };
    window.addEventListener('afterprint', after);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', after);
    };
  }, [invoices, vendorInfo]);

  if (invoiceIds.length === 0) {
    return <div style={{ padding: 16 }}>لا يوجد معرف فاتورة للطباعة</div>;
  }
  if (loading || invoices.length === 0 || !vendorInfo) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>جاري التحميل...</div>
      </div>
    );
  }

  // Use STATIC logo based on vendor ID
  const logoSrc = getVendorLogo(vendorInfo?.id);
  const storeLink = getVendorStoreLink(vendorInfo?.id);
  
  // حساب إجماليات التقرير (بدون رسوم التوصيل)
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.summary?.productsSubtotal || 0), 0);
  const totalOrders = invoices.length;
  const totalProfit = invoices.reduce((sum, inv) => sum + (inv.summary?.totalProfit || 0), 0);
  const totalDeliveryFees = invoices.reduce((sum, inv) => sum + (inv.summary?.deliveryFee || 0), 0);
  const totalProductsSales = invoices.reduce((sum, inv) => sum + (inv.summary?.productsSubtotal || 0), 0);
  
  // تجميع المنتجات
  const productsSummary = {};
  invoices.forEach(invoice => {
    invoice.items?.forEach(item => {
      const key = item.id || item.name;
      if (!productsSummary[key]) {
        productsSummary[key] = {
          name: item.name,
          quantity: 0,
          totalSales: 0,
          imageUrl: item.imageUrl || ''
        };
      }
      productsSummary[key].quantity += item.quantity;
      productsSummary[key].totalSales += item.totalPrice || (item.price * item.quantity);
    });
  });
  
  const productsArray = Object.values(productsSummary).sort((a, b) => b.quantity - a.quantity);
  
  // تنسيق التاريخ
  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const timeStr = today.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div style={{
      fontFamily: 'Cairo, Tajawal, Arial, sans-serif',
      width: '210mm', // A4 width
      margin: '0 auto',
      padding: '10mm',
      backgroundColor: '#fff'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        borderBottom: '3px solid #2563eb',
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        {logoSrc && (
          <img 
            src={logoSrc} 
            alt="Logo" 
            style={{ 
              height: '60px', 
              marginBottom: '10px',
              objectFit: 'contain'
            }} 
          />
        )}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '10px 0'
        }}>
          📊 تقرير المبيعات اليومية
        </h1>
        <div style={{
          fontSize: '16px',
          color: '#6b7280',
          marginTop: '8px'
        }}>
          {dateStr}
        </div>
        <div style={{
          fontSize: '14px',
          color: '#9ca3af',
          marginTop: '4px'
        }}>
          وقت الطباعة: {timeStr}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '15px',
        marginBottom: '25px'
      }}>
        <div style={{
          backgroundColor: '#dbeafe',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: 'bold' }}>
            إجمالي المبيعات
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '8px' }}>
            {totalSales.toFixed(2)} ج.م
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#dcfce7',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '2px solid #22c55e'
        }}>
          <div style={{ fontSize: '14px', color: '#15803d', fontWeight: 'bold' }}>
            عدد الطلبات المُسلمة
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#14532d', marginTop: '8px' }}>
            {totalOrders} طلب
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#fef3c7',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '2px solid #f59e0b'
        }}>
          <div style={{ fontSize: '14px', color: '#92400e', fontWeight: 'bold' }}>
            رسوم الخدمة
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#78350f', marginTop: '8px' }}>
            {totalOrders * 20} ج.م
          </div>
        </div>
      </div>

      {/* Products Summary */}
      <div style={{ marginBottom: '25px' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '15px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '8px'
        }}>
          📦 ملخص المنتجات المباعة
        </h2>
        
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ 
                padding: '12px', 
                textAlign: 'right', 
                borderBottom: '2px solid #d1d5db',
                fontWeight: 'bold'
              }}>#</th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'right', 
                borderBottom: '2px solid #d1d5db',
                fontWeight: 'bold'
              }}>المنتج</th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'center', 
                borderBottom: '2px solid #d1d5db',
                fontWeight: 'bold'
              }}>الكمية</th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'center', 
                borderBottom: '2px solid #d1d5db',
                fontWeight: 'bold'
              }}>إجمالي المبيعات</th>
            </tr>
          </thead>
          <tbody>
            {productsArray.map((product, index) => (
              <tr key={index} style={{ 
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: index % 2 === 0 ? '#fff' : '#f9fafb'
              }}>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {index + 1}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb'
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span style={{ fontWeight: '500' }}>{product.name}</span>
                  </div>
                </td>
                <td style={{ 
                  padding: '10px', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#059669'
                }}>
                  {product.quantity}
                </td>
                <td style={{ 
                  padding: '10px', 
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  {product.totalSales.toFixed(2)} ج.م
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
              <td colSpan="2" style={{ padding: '12px', textAlign: 'right', borderTop: '2px solid #d1d5db' }}>
                الإجمالي
              </td>
              <td style={{ padding: '12px', textAlign: 'center', borderTop: '2px solid #d1d5db', color: '#059669' }}>
                {productsArray.reduce((sum, p) => sum + p.quantity, 0)}
              </td>
              <td style={{ padding: '12px', textAlign: 'center', borderTop: '2px solid #d1d5db' }}>
                {totalProductsSales.toFixed(2)} ج.م
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Orders List */}
      <div style={{ marginBottom: '25px' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '15px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '8px'
        }}>
          📋 قائمة الطلبات المُسلمة
        </h2>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px'
        }}>
          {invoices.map((invoice, index) => {
            const customer = invoice.delivery?.customer || invoice.customerInfo;
            const deliveredAt = invoice.bosta?.deliveredAt;
            const deliveredTime = deliveredAt ? new Date(deliveredAt).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit'
            }) : '-';
            
            return (
              <div key={index} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#fafafa'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  <span>طلب #{invoice.orderId || invoice.id}</span>
                  <span style={{ color: '#059669' }}>{invoice.summary?.total.toFixed(2)} ج.م</span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  <div>👤 {customer?.name || 'عميل'}</div>
                  <div>📞 {customer?.phone || '-'}</div>
                  <div>🕐 وقت التسليم: {deliveredTime}</div>
                  <div>📦 المنتجات: {invoice.items?.length || 0}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '2px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {vendorInfo?.displayName || vendorInfo?.name || 'المتجر'}
        </div>
        {storeLink && (
          <div style={{ marginBottom: '5px' }}>
            🌐 {storeLink}
          </div>
        )}
        <div>
          طُبع في: {new Date().toLocaleString('ar-EG')}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function DailySalesReport() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>جاري التحميل...</div>}>
      <DailySalesReportContent />
    </Suspense>
  );
}
