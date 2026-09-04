"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function formatMoney(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)} ج.م`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ar-EG');
}

export function Spare2appFeesReportContent() {
  const searchParams = useSearchParams();
  const period = searchParams.get('period') || 'week';
  const sourceFilter = searchParams.get('source_filter') || 'spare2app';
  const vendorId = searchParams.get('vendor_id') || '';
  const after = searchParams.get('after') || '';
  const before = searchParams.get('before') || '';
  const paidOnly = searchParams.get('paid_only') || '';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ period });
        params.set('source_filter', sourceFilter);
        if (vendorId) params.set('vendor_id', vendorId);
        if (after) params.set('after', after);
        if (before) params.set('before', before);
        if (paidOnly) params.set('paid_only', paidOnly);

        const res = await fetch(`/api/orders/spare2app-fees-report?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) throw new Error('فشل تحميل البيانات');
        const json = await res.json();
        setData(json);
        // give browser a moment to render then call print
        setTimeout(() => window.print(), 500);
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    load();
  }, [period, sourceFilter, vendorId, after, before, paidOnly]);

  if (error) return <div dir="rtl" className="p-6">خطأ: {error}</div>;
  if (!data) return <div dir="rtl" className="p-6">جاري إعداد صفحة الطباعة...</div>;

  const rows = data.rows || [];

  return (
    <div dir="rtl" style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>تقرير أوردرات {sourceFilter === 'non_spare2app' ? 'غير spare2app' : sourceFilter}</h2>
        <div style={{ fontSize: 12 }}>{formatDate(data.from)} → {formatDate(data.to)}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #000', padding: 6, textAlign: 'right' }}>#</th>
            <th style={{ borderBottom: '1px solid #000', padding: 6, textAlign: 'right' }}>رقم الأوردر</th>
            <th style={{ borderBottom: '1px solid #000', padding: 6, textAlign: 'right' }}>التاريخ</th>
            <th style={{ borderBottom: '1px solid #000', padding: 6, textAlign: 'right' }}>معاملة كاشير</th>
            <th style={{ borderBottom: '1px solid #000', padding: 6, textAlign: 'right' }}>المدفوع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.order_id}>
              <td style={{ padding: 6, textAlign: 'right' }}>{i + 1}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>#{r.order_number || r.order_id}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{formatDate(r.date_created)}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{r._kashier_transaction_id || '-'}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{formatMoney(r.total_paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, textAlign: 'left', fontSize: 12 }}>
        <strong>الإجمالي:</strong>
        <div>عدد الأوردرات: {data.summary?.total_orders || 0}</div>
        <div>إجمالي المدفوع: {formatMoney(data.summary?.total_paid || 0)}</div>
      </div>
    </div>
  );
}
