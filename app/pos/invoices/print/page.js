'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoiceStorage } from '@/app/lib/localforage';
import { getVendorLogo, getVendorStoreLink } from '@/app/lib/vendor-constants';
import usePOSStore from '@/app/stores/pos-store';

function PrintInvoiceContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const idsParam = searchParams.get('ids'); // 🔥 Support multiple IDs
  
  const invoiceIds = useMemo(() => {
    if (idsParam) {
      // Multiple IDs separated by comma
      return idsParam.split(',').map(id => String(id).trim()).filter(Boolean);
    } else if (idParam) {
      // Single ID
      return [String(idParam)];
    }
    return [];
  }, [idParam, idsParam]);

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
          .map(id => allInvoices.find(i => String(i.id) === String(id)))
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
  if (invoices.length === 0) return;
    
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
  }, [invoices, vendorInfo]);

  if (invoiceIds.length === 0) {
    console.log('❌ No invoice IDs');
    return <div style={{ padding: 16 }}>لا يوجد معرف فاتورة للطباعة</div>;
  }
  if (loading || invoices.length === 0 || !vendorInfo) {
    console.log('⏳ Loading state:', { loading, invoicesCount: invoices.length, hasVendor: !!vendorInfo });
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>جاري التحميل...</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {invoices.length === 0 && 'تحميل الفواتير...'}
          {!vendorInfo && 'تحميل بيانات المتجر...'}
        </div>
      </div>
    );
  }

  // Use STATIC logo based on vendor ID (not from API)
  const logoSrc = getVendorLogo(vendorInfo?.id);
  
  // Get store link based on vendor ID
  const storeLink = getVendorStoreLink(vendorInfo?.id);
  
  // 🔥 Render single invoice component
  const renderInvoice = (invoice, index) => {
    // التحقق من نوع الطلب
    const isDelivery = invoice.orderType === 'delivery';
    const customer = invoice.delivery?.customer;
    const address = customer?.address || {};
    const deliveryNotes = invoice.delivery?.notes;
  
  // 🔍 Console Debug للطلبات الأونلاين
  console.log('🔍 Invoice Debug Info:', {
    orderId: invoice.orderId,
    source: invoice.source,
    deliveryFee: invoice.summary?.deliveryFee,
    hasDeliveryPayment: !!invoice.deliveryPayment,
    deliveryPaymentStatus: invoice.deliveryPayment?.status,
    paymentMethod: invoice.paymentMethod,
    isOnlineOrder: invoice.source === 'order' || !!invoice.orderId,
    shouldShowBox: (invoice.source === 'order' || invoice.orderId) && invoice.summary?.deliveryFee > 0,
    // 🏠 Debug للعنوان
    customerAddress: customer?.address,
    addressType: typeof customer?.address,
    addressKeys: customer?.address ? Object.keys(customer.address) : []
  });
  
  // 🆕 بيانات الدفع الجزئي
  const paymentDetails = invoice.paymentDetails;
  const isHalfPayment = paymentDetails?.type === 'half_payment';
  
  // 🆕 تقسيم العنوان التفصيلي من _shipping_address_index
  const parseShippingAddress = (addressString) => {
    if (!addressString) return null;
    
    // تقسيم النص على المسافات المتعددة (2 spaces or more)
    const parts = addressString.split(/\s{2,}/).filter(part => part.trim());
    
    return {
      fullText: addressString,
      parts: parts,
      // محاولة استخراج معلومات محددة
      name: parts[0] || '',
      details: parts[1] || '',
      city: parts[2] || '',
      country: parts.find(p => p.match(/^[A-Z]{2}$/)) || '', // EG, SA, etc
      phone: parts.find(p => p.match(/^\d{11,}$/)) || '' // رقم الهاتف
    };
  };
  
  const shippingAddressParsed = invoice.delivery?.address 
    ? parseShippingAddress(invoice.delivery.address)
    : (invoice.customerInfo?.address ? parseShippingAddress(invoice.customerInfo.address) : null);
  
  // تنسيق العنوان الكامل
  const fullAddress = typeof address === 'string' 
    ? address // لو العنوان string، استخدمه مباشرة
    : [
        address.state,
        address.city,
        address.area,
        address.street,
        address.building && `عقار ${address.building}`,
        address.floor && `دور ${address.floor}`,
        address.apartment && `شقة ${address.apartment}`,
      ].filter(Boolean).join(' - ');
  
  // Translate payment method to Arabic
  const paymentMethodAr = {
    cash: '💵 كاش',
    wallet: '👛 محفظة',
    instapay: '📱 انستا باي',
    card: '💳 بطاقة'
  }[invoice.paymentMethod] || invoice.paymentMethod;

  return (
    <div key={invoice.id} className="receipt-print" style={{
        width: '72mm',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        lineHeight: '1.3',
        direction: 'rtl',
        backgroundColor: 'white',
        color: '#222',
        padding: '3mm',
        margin: 0
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', borderBottom: '1px dashed #000', paddingBottom: '2mm', color: '#222' }}>
          <img src={logoSrc} alt="Logo" style={{ width: '45px', height: 'auto', margin: '0 auto 2mm', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          {vendorInfo?.name && (
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '1mm', color: '#111' }}>{vendorInfo.name}</div>
          )}
          {vendorInfo?.phone && (
            <div style={{ fontSize: '10px', marginBottom: '1mm', color: '#222' }}>📞 {vendorInfo.phone}</div>
          )}
          {vendorInfo?.address && typeof vendorInfo.address === 'string' && (
            <div style={{ fontSize: '9px', marginTop: '1mm', color: '#222' }}>{vendorInfo.address}</div>
          )}
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2mm', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
          {isDelivery ? '🚚 فاتورة توصيل' : '🏪 فاتورة بيع'}
        </div>

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

        {/* Customer Info (for online orders or delivery) */}
        {((invoice.customerInfo && (invoice.customerInfo.name || invoice.customerInfo.phone)) || (isDelivery && customer)) && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '1px solid #000',
            fontSize: '9px',
            color: '#000'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '10px' }}>
              {isDelivery ? '📦 بيانات التوصيل:' : 'بيانات العميل:'}
            </div>
            
            {/* Delivery customer info */}
            {isDelivery && customer && (
              <>
                {customer.name && (
                  <div style={{ marginBottom: '0.5mm' }}>👤 {customer.name}</div>
                )}
                {customer.phone && (
                  <div style={{ marginBottom: '0.5mm' }}>📞 {customer.phone}</div>
                )}
                {fullAddress && (
                  <div style={{ marginBottom: '0.5mm', lineHeight: '1.3' }}>📍 {fullAddress}</div>
                )}
                {address.landmark && (
                  <div style={{ marginBottom: '0.5mm', lineHeight: '1.3', fontStyle: 'italic' }}>🏷️ {address.landmark}</div>
                )}
              </>
            )}
            
            {/* Online order customer info */}
            {!isDelivery && invoice.customerInfo && !shippingAddressParsed && (
              <>
                {invoice.customerInfo.name && (
                  <div style={{ marginBottom: '0.5mm' }}>👤 {invoice.customerInfo.name}</div>
                )}
                {invoice.customerInfo.phone && (
                  <div style={{ marginBottom: '0.5mm' }}>📞 {invoice.customerInfo.phone}</div>
                )}
                {invoice.customerInfo.address && (
                  <div style={{ marginBottom: '0.5mm', lineHeight: '1.4', fontSize: '8px' }}>📍 {invoice.customerInfo.address}</div>
                )}
              </>
            )}
            
            {/* 🆕 عرض العنوان المقسم بشكل منظم */}
            {!isDelivery && shippingAddressParsed && (
              <div style={{ fontSize: '9px' }}>
                {shippingAddressParsed.name && (
                  <div style={{ marginBottom: '0.5mm', fontWeight: 'bold' }}>
                    👤 {shippingAddressParsed.name}
                  </div>
                )}
                {shippingAddressParsed.details && (
                  <div style={{ marginBottom: '0.5mm', fontSize: '8px', lineHeight: '1.3' }}>
                    🏠 {shippingAddressParsed.details}
                  </div>
                )}
                {shippingAddressParsed.city && (
                  <div style={{ marginBottom: '0.5mm' }}>
                    📍 {shippingAddressParsed.city}
                  </div>
                )}
                {shippingAddressParsed.phone && (
                  <div style={{ marginBottom: '0.5mm' }}>
                    📞 {shippingAddressParsed.phone}
                  </div>
                )}
                {shippingAddressParsed.country && (
                  <div style={{ marginBottom: '0.5mm', fontSize: '8px', color: '#666' }}>
                    🌍 {shippingAddressParsed.country}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Invoice info */}
        <div style={{ fontSize: '9px', marginBottom: '2mm', display: 'flex', justifyContent: 'space-between' }}>
          <span>#{invoice.id}</span>
          <span>{new Date(invoice.date).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Items */}
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '2mm', paddingBottom: '2mm', marginBottom: '2mm' }}>
          {invoice.items?.length > 0 && invoice.items.map((item) => {
            const hasDiscount = item.originalPrice && item.originalPrice > item.price;
            const discountPercent = hasDiscount 
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;
            
            return (
              <div key={item.id} style={{ marginBottom: '2mm' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5mm', fontSize: '12px', color: '#000' }}>
                  {item.name}
                  {hasDiscount && (
                    <span style={{ 
                      marginRight: '2mm', 
                      fontSize: '9px', 
                      border: '1px solid #000',
                      padding: '0.5mm 1mm', 
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      [خصم {discountPercent}%]
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#000' }}>
                  <span>
                    {hasDiscount ? (
                      <>
                        <span style={{ fontWeight: 'normal' }}>{item.quantity} × </span>
                        <span style={{ 
                          textDecoration: 'line-through', 
                          marginLeft: '1mm', 
                          marginRight: '1mm',
                          fontSize: '8px'
                        }}>
                          {item.originalPrice}
                        </span>
                        <span style={{ fontWeight: 'bold', marginLeft: '1mm' }}>
                          {item.price} ج.م
                        </span>
                      </>
                    ) : (
                      <span>{item.quantity} × {item.price} ج.م</span>
                    )}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{Number(item.totalPrice || (item.price * item.quantity)).toFixed(2)} ج.م</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Services */}
        {invoice.services?.length > 0 && (
          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '2mm', marginBottom: '2mm' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '1mm', color: '#000' }}>رسوم خدمات:</div>
            {invoice.services.map((service, index) => (
              <div key={index} style={{ marginBottom: '1mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#000' }}>
                  <span>• {service.description}</span>
                  <span style={{ fontWeight: 'bold' }}>{Number(service.amount).toFixed(2)} ج.م</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div style={{ marginBottom: '2mm', fontSize: '10px' }}>
          {invoice.summary?.productsSubtotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
              <span>مجموع المنتجات:</span>
              <span>{Number(invoice.summary.productsSubtotal).toFixed(2)} ج.م</span>
            </div>
          )}
          {invoice.summary?.servicesTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#000' }}>
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
          {invoice.summary.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#000', fontWeight: 'bold' }}>
              <span>• رسوم التوصيل:</span>
              <span>+ {Number(invoice.summary.deliveryFee).toFixed(2)} ج.م</span>
            </div>
          )}
          {invoice.summary.invoiceDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', color: '#d97706', fontWeight: 'bold' }}>
              <span>🎁 خصم الفاتورة:</span>
              <span>- {Number(invoice.summary.invoiceDiscount).toFixed(2)} ج.م</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '1mm', marginTop: '1mm' }}>
            <span>الإجمالي:</span>
            <span>{Number(invoice.summary.total).toFixed(2)} ج.م</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm', fontSize: '10px' }}>
            <span>الدفع:</span>
            <span>{paymentMethodAr}</span>
          </div>
        </div>

        {/* 🆕 بيانات الدفع الجزئي */}
        {isHalfPayment && paymentDetails && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '2px solid #000',
            backgroundColor: '#fff9e6',
            fontSize: '9px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '11px', color: '#000', textAlign: 'center' }}>
              ⚠️ دفع جزئي - نصف المبلغ
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000' }}>
              <span style={{ fontWeight: 'bold' }}>المبلغ المدفوع:</span>
              <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{Number(paymentDetails.paidAmount).toFixed(2)} ج.م ✓</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
              <span style={{ fontWeight: 'bold' }}>المبلغ المتبقي:</span>
              <span style={{ fontWeight: 'bold', color: '#dc2626' }}>{Number(paymentDetails.remainingAmount)} + {Number(invoice.summary.deliveryFee)} ج.م</span>
            </div>
            {paymentDetails.note && (
              <div style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000', fontSize: '8px', lineHeight: '1.3' }}>
                📝 {paymentDetails.note} + مصاريف الشحن {Number(invoice.summary.deliveryFee)}
              </div>
            )}
          </div>
        )}

        {/* 🆕 بيانات دفع التوصيل من الكاشير */}
        {invoice.deliveryPayment && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '2px solid #000',
            backgroundColor: (invoice.deliveryPayment.status === 'fully_paid' || invoice.deliveryPayment.status === 'fully_paid_no_delivery') ? '#d1fae5' : '#fff9e6',
            fontSize: '9px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '11px', color: '#000', textAlign: 'center' }}>
              {invoice.deliveryPayment.status === 'cash_on_delivery' && '💵 الدفع عند الاستلام'}
              {invoice.deliveryPayment.status === 'half_paid' && '⚠️ نصف المبلغ مدفوع'}
              {invoice.deliveryPayment.status === 'fully_paid' && '✅ مدفوع بالكامل'}
              {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && '💳 مدفوع كاملاً بدون توصيل'}
            </div>
            
            {/* توضيح للطلبات الأونلاين: المدفوع في الستور والمطلوب تحصيله - بس لو مش fully_paid_no_delivery */}
            {(invoice.source === 'order' || invoice.orderId) && 
             invoice.summary.deliveryFee > 0 && 
             invoice.deliveryPayment.status !== 'fully_paid_no_delivery' && (
              <>
                <div style={{ backgroundColor: '#d1fae5', padding: '2mm', borderRadius: '1mm', marginTop: '2mm', marginBottom: '2mm', border: '1px solid #10b981' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1mm', fontSize: '9px', fontWeight: 'bold', color: '#047857' }}>
                    ✓ تم الدفع في الستور (ثمن المنتجات فقط)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '10px' }}>المبلغ المدفوع:</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '11px' }}>
                      {(Number(invoice.summary.total) - Number(invoice.summary.deliveryFee || 0)).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#fef3c7', padding: '3mm', borderRadius: '1mm', border: '3px solid #f59e0b' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1mm', fontSize: '10px', fontWeight: 'bold', color: '#dc2626' }}>
                    📦 المطلوب تحصيله من العميل
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '11px' }}>رسوم التوصيل:</span>
                    <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '14px' }}>
                      {Number(invoice.summary.deliveryFee || 0).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </>
            )}
            
            {invoice.deliveryPayment.status === 'half_paid' && invoice.deliveryPayment.paidAmount > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000' }}>
                  <span style={{ fontWeight: 'bold' }}>المبلغ المدفوع:</span>
                  <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{Number(invoice.deliveryPayment.paidAmount).toFixed(2)} ج.م ✓</span>
                </div>
                
                {/* تقسيم المبلغ المتبقي */}
                {(() => {
                  const totalRemaining = invoice.summary.total - invoice.deliveryPayment.paidAmount;
                  const deliveryFee = Number(invoice.summary.deliveryFee || 0);
                  const productsRemaining = totalRemaining - deliveryFee;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', backgroundColor: '#fef3c7', padding: '1mm', borderRadius: '1mm' }}>
                        <span style={{ fontWeight: 'bold' }}>المبلغ المتبقي للمنتجات:</span>
                        <span style={{ fontWeight: 'bold', color: '#dc2626' }}>{productsRemaining.toFixed(2)} ج.م (للبائع)</span>
                      </div>
                      {deliveryFee > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm', backgroundColor: '#dbeafe', padding: '1mm', borderRadius: '1mm' }}>
                          <span style={{ fontWeight: 'bold' }}>رسوم التوصيل المتبقية:</span>
                          <span style={{ fontWeight: 'bold', color: '#dc2626' }}>{deliveryFee.toFixed(2)} ج.م (للمندوب)</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1mm', paddingTop: '1mm', borderTop: '1px solid #000' }}>
                        <span style={{ fontWeight: 'bold' }}>إجمالي المتبقي للتحصيل:</span>
                        <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '10px' }}>{totalRemaining.toFixed(2)} ج.م</span>
                      </div>
                    </>
                  );
                })()}
                
                {invoice.deliveryPayment.note && (
                  <div style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000', fontSize: '8px', lineHeight: '1.3' }}>
                    📝 {invoice.deliveryPayment.note}
                  </div>
                )}
              </>
            )}

            {invoice.deliveryPayment.status === 'cash_on_delivery' && (
              <div style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000', fontSize: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                💰 المبلغ المطلوب تحصيله: {Number(invoice.summary.total).toFixed(2)} ج.م
              </div>
            )}

            {invoice.deliveryPayment.status === 'fully_paid' && invoice.summary.deliveryFee > 0 && (
              <>
                <div style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000', fontSize: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>✓ المدفوع (ثمن المنتجات):</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                      {(Number(invoice.summary.total) - Number(invoice.summary.deliveryFee || 0)).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>✓ رسوم التوصيل المدفوعة:</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                      {Number(invoice.summary.deliveryFee || 0).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#d1fae5', padding: '1mm', borderRadius: '1mm', marginTop: '1mm', borderTop: '1px solid #10b981' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '11px' }}>✓ إجمالي المدفوع:</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '11px' }}>
                      {Number(invoice.summary.total).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </>
            )}

            {invoice.deliveryPayment.status === 'fully_paid_no_delivery' && (
              <>
                <div style={{ marginTop: '1mm', paddingTop: '1mm', borderTop: '1px dashed #000', fontSize: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>✓ المدفوع (ثمن المنتجات):</span>
                    <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                      {(Number(invoice.summary.total) - Number(invoice.summary.deliveryFee || 0)).toFixed(2)} ج.م
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fef3c7', padding: '1mm', borderRadius: '1mm' }}>
                    <span style={{ fontWeight: 'bold', color: '#dc2626' }}>📦 المطلوب تحصيله (رسوم التوصيل):</span>
                    <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '11px' }}>
                      {Number(invoice.summary.deliveryFee || 0).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Delivery Notes */}
        {isDelivery && deliveryNotes && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '1px dashed #000',
            fontSize: '9px',
            color: '#000'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '10px' }}>• ملاحظات التوصيل:</div>
            <div style={{ lineHeight: '1.3' }}>{deliveryNotes}</div>
          </div>
        )}

        {/* Customer Note - ملاحظة العميل */}
        {invoice.customerNote && invoice.customerNote.trim() && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '2px solid #f59e0b',
            fontSize: '9px',
            color: '#000',
            backgroundColor: '#fef3c7'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '10px', color: '#d97706' }}>📝 ملاحظة العميل:</div>
            <div style={{ lineHeight: '1.4', whiteSpace: 'pre-wrap', color: '#92400e' }}>{invoice.customerNote}</div>
          </div>
        )}

        {/* Order Notes - ملاحظات على الطلب */}
        {invoice.orderNotes && (
          <div style={{ 
            marginBottom: '2mm', 
            padding: '2mm',
            border: '2px solid #000',
            fontSize: '9px',
            color: '#000',
            backgroundColor: '#f5f5f5'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm', fontSize: '10px' }}>💼 ملاحظاتنا على الطلب:</div>
            <div style={{ lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{invoice.orderNotes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '2mm', fontSize: '10px' }}>
          <div style={{ fontSize: '9px', color: '#222' }}>موقع {vendorInfo.name} الرسمي</div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '1mm', color: '#111' }}>{storeLink}</div>
          <div style={{ fontSize: '10px', marginTop: '2mm', color: '#222', fontWeight: 'bold' }}>شكراً لزيارتكم ونتمنى لكم يوماً سعيداً!</div>
        </div>
      </div>
  );
  }; // End of renderInvoice function

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
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          
          .receipt-print:last-child {
            page-break-after: auto !important;
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
      
      {invoices.map((invoice, index) => renderInvoice(invoice, index))}
    </>
  );
}

export default function PrintInvoicePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          <div>جاري التحميل...</div>
        </div>
      </div>
    }>
      <PrintInvoiceContent />
    </Suspense>
  );
}
