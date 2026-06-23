"use client";

import { useEffect, useMemo, useState } from "react";

const emptyProduct = {
  name: "",
  url: "",
  priceFrom: "",
  priceTo: "",
  note: "",
};

export default function PresentationPage() {
  const [product, setProduct] = useState(emptyProduct);
  const [products, setProducts] = useState([]);
  const [title, setTitle] = useState("قائمة المنتجات للتقديم");
  const [subtitle, setSubtitle] = useState("تقديم سريع للمنتجات والأسعار والروابط");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("presentationProducts");
    const savedTitle = window.localStorage.getItem("presentationTitle");
    const savedSubtitle = window.localStorage.getItem("presentationSubtitle");
    if (saved) {
      setProducts(JSON.parse(saved));
    }
    if (savedTitle) setTitle(savedTitle);
    if (savedSubtitle) setSubtitle(savedSubtitle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("presentationProducts", JSON.stringify(products));
    window.localStorage.setItem("presentationTitle", title);
    window.localStorage.setItem("presentationSubtitle", subtitle);
  }, [products, title, subtitle]);

  const totalItems = products.length;

  const handleAdd = () => {
    if (!product.name.trim()) return;
    setProducts((prev) => [
      ...prev,
      {
        ...product,
        priceFrom: product.priceFrom.trim(),
        priceTo: product.priceTo.trim(),
      },
    ]);
    setProduct(emptyProduct);
  };

  const handleRemove = (index) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8 print:hidden">
          <div className="rounded-3xl bg-white shadow-lg border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">صفحة عرض المنتجات</h1>
                <p className="mt-2 text-slate-600">أدخل منتجاتك، روابطها، ونطاق السعر لتحصل على صفحة عرض جاهزة للطباعة.</p>
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-700 px-6 py-3 text-white font-semibold shadow-lg hover:brightness-110 transition"
              >
                🖨️ طباعة أو حفظ PDF
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-3xl bg-white shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">بيانات الصفحة</h2>
              <div className="grid gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">العنوان الرئيسي</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً: أفضل منتجات الصيف"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">النص التوضيحي</span>
                  <textarea
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="مثلاً: عرض خاص للأسواق والمطاعم"
                    rows={3}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl bg-white shadow-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">المعلومات الحالية</h2>
              <div className="text-slate-700 space-y-2">
                <p>عدد المنتجات: <strong>{totalItems}</strong></p>
                <p>تاريخ الطباعة: <strong>{formattedDate}</strong></p>
                <p>يمكنك إضافة منتجات جديدة ثم الضغط على طباعة للحصول على PDF جميل.</p>
              </div>
            </section>
          </div>

          <section className="rounded-3xl bg-white shadow-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">أضف منتجاً جديداً</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">اسم المنتج</span>
                <input
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  placeholder="مثلاً: سماعة بلوتوث"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">رابط المنتج</span>
                <input
                  value={product.url}
                  onChange={(e) => setProduct({ ...product, url: e.target.value })}
                  placeholder="https://"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">سعر من</span>
                <input
                  value={product.priceFrom}
                  onChange={(e) => setProduct({ ...product, priceFrom: e.target.value })}
                  placeholder="مثلاً: 120 جنيه"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">سعر إلى</span>
                <input
                  value={product.priceTo}
                  onChange={(e) => setProduct({ ...product, priceTo: e.target.value })}
                  placeholder="مثلاً: 150 جنيه"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">ملاحظة أو تفاصيل قصيرة</span>
                <textarea
                  value={product.note}
                  onChange={(e) => setProduct({ ...product, note: e.target.value })}
                  rows={3}
                  placeholder="مثلاً: أفضل اختيار للمطاعم أو بيع بالجملة"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3 print:hidden">
              <button
                onClick={handleAdd}
                className="rounded-2xl bg-sky-600 px-6 py-3 text-white font-semibold shadow hover:bg-sky-700 transition"
              >
                + أضف المنتج
              </button>
              <button
                onClick={() => setProducts([])}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-700 font-semibold shadow-sm hover:bg-slate-50 transition"
              >
                مسح القائمة
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-[40px] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] border border-slate-200 p-8 print:p-0">
          <div className="print:hidden mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-sky-600">عرض تقديمي</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-slate-600 max-w-2xl">{subtitle}</p>
            </div>
            <div className="text-slate-500 text-sm">
              <p>التاريخ: {formattedDate}</p>
              <p>عدد المنتجات: {totalItems}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 print:border-none print:bg-transparent">
                <p className="text-lg font-medium">لم يتم إضافة أي منتج بعد.</p>
                <p className="mt-2 text-slate-500">استخدم النموذج أعلاه لإضافة تفاصيل المنتج ثم اطبع الصفحة.</p>
              </div>
            ) : (
              products.map((item, index) => (
                <article
                  key={index}
                  className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 shadow-sm print:border print:border-slate-200 print:bg-white"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{item.name}</h3>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sky-600 hover:text-sky-800 transition break-all"
                        >
                          {item.url}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 text-right">
                      <span className="text-slate-500">نطاق السعر</span>
                      <p className="text-xl font-semibold text-slate-900">
                        {item.priceFrom || "-"} {item.priceTo ? `إلى ${item.priceTo}` : ""}
                      </p>
                    </div>
                  </div>
                  {item.note && <p className="mt-4 text-slate-700 leading-relaxed">{item.note}</p>}
                  <div className="mt-5 flex justify-between items-center print:hidden">
                    <span className="text-slate-500 text-sm">عنصر #{index + 1}</span>
                    <button
                      onClick={() => handleRemove(index)}
                      className="rounded-2xl bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition"
                    >
                      حذف
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .print\:hidden {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
          .rounded-[30px] {
            border-radius: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
