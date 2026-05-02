'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : 0;
}

function getMetaValue(order, key) {
  return order?.meta_data?.find((m) => m.key === key)?.value;
}

function formatMoney(value) {
  return `${toNumber(value).toFixed(2)} ج.م`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ar-EG');
}

function Spare2appFeesReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendor_id') || '';
  const period = searchParams.get('period') || 'week';
  const sourceFilter = searchParams.get('source_filter') || 'spare2app';

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('جاري تحميل البيانات...');
  const [rows, setRows] = useState([]);
  const [summaryFromApi, setSummaryFromApi] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        setLoadingText('جاري تحميل التقرير الأسبوعي من الباك إند...');

        const params = new URLSearchParams({ period });
        params.set('source_filter', sourceFilter);
        if (vendorId) {
          params.set('vendor_id', vendorId);
        }

        const response = await fetch(`/api/orders/spare2app-fees-report?${params.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || `فشل تحميل التقرير (HTTP ${response.status})`);
        }

        const data = await response.json();
        const reportRows = (data?.rows || []).map((row, index) => ({
          idx: index + 1,
          orderId: row?.order_id,
          dateCreated: row?.date_created,
          customerName: row?.customer_name || 'عميل',
          phone: row?.phone || '-',
          paymentMethod: row?.payment_method_title || '-',
          orderAmount: toNumber(row?.order_amount),
          totalPaid: toNumber(row?.total_paid),
          feeAboveOrder: toNumber(row?.fees_above_order),
          serviceFee: toNumber(row?.service_fee),
          transferFee: toNumber(row?.transfer_fee),
          knownFees: toNumber(row?.known_fees),
          feeDiff: toNumber(row?.fee_diff),
        }));

        setRows(reportRows);
        setSummaryFromApi(data?.summary || null);
        setRange({ from: data?.from || '', to: data?.to || '' });
      } catch (err) {
        console.error('spare2app fees report error:', err);
        setError(err?.message || 'فشل إنشاء التقرير');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [vendorId, period, sourceFilter]);

  const sourceLabel = sourceFilter === 'non_spare2app' ? 'غير spare2app' : 'spare2app';

  const computedSummary = useMemo(() => {
    const totalOrders = rows.length;
    const totalOrderAmount = rows.reduce((sum, r) => sum + r.orderAmount, 0);
    const totalPaid = rows.reduce((sum, r) => sum + r.totalPaid, 0);
    const totalFeesAbove = rows.reduce((sum, r) => sum + r.feeAboveOrder, 0);
    const totalServiceFees = rows.reduce((sum, r) => sum + r.serviceFee, 0);
    const totalTransferFees = rows.reduce((sum, r) => sum + r.transferFee, 0);
    const mismatchCount = rows.filter((r) => r.feeDiff > 0.009).length;

    return {
      totalOrders,
      totalOrderAmount,
      totalPaid,
      totalFeesAbove,
      totalServiceFees,
      totalTransferFees,
      mismatchCount,
    };
  }, [rows]);

  const summary = summaryFromApi
    ? {
        totalOrders: toNumber(summaryFromApi.total_orders),
        totalOrderAmount: toNumber(summaryFromApi.total_order_amount),
        totalPaid: toNumber(summaryFromApi.total_paid),
        totalFeesAbove: toNumber(summaryFromApi.total_fees_above_order),
        totalServiceFees: toNumber(summaryFromApi.total_service_fee),
        totalTransferFees: toNumber(summaryFromApi.total_transfer_fee),
        mismatchCount: toNumber(summaryFromApi.mismatch_count),
      }
    : computedSummary;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md w-full">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">تقرير رسوم {sourceLabel}</h2>
          <p className="text-gray-600 text-sm">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-lg w-full">
          <h2 className="text-xl font-bold text-red-700 mb-3">❌ حصل خطأ</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg bg-gray-800 text-white hover:bg-black"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900">📑 تقرير أوردرات {sourceLabel} + Fees</h1>
              <p className="text-sm text-gray-600 mt-1">
                تقرير <span className="font-bold text-cyan-700">أسبوعي</span> لكل الأوردرات اللي مصدرها
                {' '}<span className="font-bold text-cyan-700">
                  {sourceFilter === 'non_spare2app' ? '_order_source ≠ spare2app' : '_order_source = spare2app'}
                </span>
                {' '}+ إجمالي الرسوم المدفوعة فوق قيمة الأوردر
              </p>
              {(range.from || range.to) && (
                <p className="text-xs text-gray-500 mt-1">
                  الفترة: {formatDate(range.from)} → {formatDate(range.to)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 font-bold"
              >
                🖨️ طباعة
              </button>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 font-bold"
              >
                ← رجوع
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">عدد الأوردرات</p>
            <p className="text-2xl font-black text-gray-900">{summary.totalOrders}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">إجمالي قيمة الأوردرات</p>
            <p className="text-2xl font-black text-blue-700">{formatMoney(summary.totalOrderAmount)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">إجمالي المدفوع</p>
            <p className="text-2xl font-black text-emerald-700">{formatMoney(summary.totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">إجمالي Fees فوق قيمة الأوردر</p>
            <p className="text-2xl font-black text-fuchsia-700">{formatMoney(summary.totalFeesAbove)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">إجمالي Service Fee</p>
            <p className="text-2xl font-black text-orange-700">{formatMoney(summary.totalServiceFees)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">إجمالي Transfer Fee</p>
            <p className="text-2xl font-black text-violet-700">{formatMoney(summary.totalTransferFees)}</p>
          </div>
        </div>

        {summary.mismatchCount > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
            ⚠️ في {summary.mismatchCount} أوردر الفرق فيه بين
            <span className="font-bold"> (total_paid - order_amount)</span>
            {' '}و{' '}
            <span className="font-bold">(service_fee + transfer_fee)</span>.
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">رقم الأوردر</th>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">العميل</th>
                  <th className="px-3 py-2 text-right">الموبايل</th>
                  <th className="px-3 py-2 text-right">طريقة الدفع</th>
                  <th className="px-3 py-2 text-right">قيمة الأوردر</th>
                  <th className="px-3 py-2 text-right">المدفوع</th>
                  <th className="px-3 py-2 text-right">Fees فوق الأوردر</th>
                  <th className="px-3 py-2 text-right">Service Fee</th>
                  <th className="px-3 py-2 text-right">Transfer Fee</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      لا توجد أوردرات مطابقة للفلتر: {sourceLabel}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.orderId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{row.idx}</td>
                      <td className="px-3 py-2 font-bold text-cyan-700">#{row.orderId}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.dateCreated)}</td>
                      <td className="px-3 py-2">{row.customerName}</td>
                      <td className="px-3 py-2">{row.phone}</td>
                      <td className="px-3 py-2">{row.paymentMethod}</td>
                      <td className="px-3 py-2 font-semibold">{formatMoney(row.orderAmount)}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">{formatMoney(row.totalPaid)}</td>
                      <td className="px-3 py-2 font-bold text-fuchsia-700">{formatMoney(row.feeAboveOrder)}</td>
                      <td className="px-3 py-2 text-orange-700">{formatMoney(row.serviceFee)}</td>
                      <td className="px-3 py-2 text-violet-700">{formatMoney(row.transferFee)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-black">
                    <td className="px-3 py-3" colSpan={6}>الإجمالي</td>
                    <td className="px-3 py-3 text-blue-700">{formatMoney(summary.totalOrderAmount)}</td>
                    <td className="px-3 py-3 text-emerald-700">{formatMoney(summary.totalPaid)}</td>
                    <td className="px-3 py-3 text-fuchsia-700">{formatMoney(summary.totalFeesAbove)}</td>
                    <td className="px-3 py-3 text-orange-700">{formatMoney(summary.totalServiceFees)}</td>
                    <td className="px-3 py-3 text-violet-700">{formatMoney(summary.totalTransferFees)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}

export default function Spare2appFeesReportPage() {
  return (
    <Suspense fallback={<div className="p-6">جاري التحميل...</div>}>
      <Spare2appFeesReportContent />
    </Suspense>
  );
}
