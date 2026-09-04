import { Suspense } from 'react';
import { Spare2appFeesReportContent } from './Spare2appFeesReportContent';

export default function Spare2appFeesReportPrint() {
  return (
    <Suspense fallback={<div dir="rtl" className="p-6">جاري إعداد صفحة الطباعة...</div>}>
      <Spare2appFeesReportContent />
    </Suspense>
  );
}
