'use client';

import { useMemo, useState } from 'react';

const createItem = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  code: '',
  name: '',
  quantity: 1,
  imageUrl: '',
  ...overrides,
});

const DEFAULT_ITEMS = [
  createItem({ code: 'VRT300001', name: 'عصايه غيارات', quantity: 1 }),
  createItem({ code: 'VRT300002', name: 'بلاطه شحن', quantity: 1 }),
  createItem({ code: 'VRT300003', name: 'الكتروني', quantity: 1 }),
  createItem({ code: 'VRT300004', name: 'مبينه تكرير', quantity: 1 }),
  createItem({ code: 'VRT300005', name: 'كاربيرتير', quantity: 1 }),
  createItem({ code: 'VRT300006', name: 'دبوس', quantity: 3 }),
  createItem({ code: 'VRT300008', name: 'مقص', quantity: 3 }),
  createItem({ code: 'VRT300010', name: 'فلتر هواء كامل', quantity: 1 }),
  createItem({ code: 'VRT300012', name: 'مكنه سرعه', quantity: 3 }),
  createItem({ code: 'VRT300013', name: 'شداد جنزير', quantity: 3 }),
  createItem({ code: 'VRT300016', name: 'دواسه خلفي', quantity: 3 }),
  createItem({ code: 'VRT300017', name: 'دواسه خلفي', quantity: 3 }),
  createItem({ code: 'VRT300018', name: 'فانوس امامي', quantity: 3 }),
  createItem({ code: 'VRT300019', name: 'حليه فلاشر تانك', quantity: 5 }),
  createItem({ code: 'VRT300020', name: 'حليه فلاشر تانك', quantity: 5 }),
  createItem({ code: 'VRT300021', name: 'فانوس خلفي', quantity: 2 }),
  createItem({ code: 'VRT300026', name: 'جنط امامي أحمر / جنط خلفي برتقالي', quantity: 1 }),
  createItem({ code: 'VRT300027', name: 'جنط خلفي', quantity: 1 }),
  createItem({ code: 'VRT300028', name: 'شلتون', quantity: 2 }),
  createItem({ code: 'VRT300029', name: 'مريا', quantity: 2 }),
  createItem({ code: 'VRT300030', name: 'مريا', quantity: 2 }),
  createItem({ code: 'VRT300031', name: 'طقم كوتك', quantity: 2 }),
  createItem({ code: 'VRT300032', name: 'فلانشه امور', quantity: 2 }),
  createItem({ code: 'VRT300033', name: 'ترس جر خلفي', quantity: 2 }),
  createItem({ code: 'VRT300034', name: 'جنزير', quantity: 1 }),
  createItem({ code: 'VRT300035', name: 'كتل+اسطوانه بكر كتل+اسطوانه بكر أساسي', quantity: 2 }),
  createItem({ code: 'VRT300036', name: 'ملقن بكر خلفي ملقن بالحامل', quantity: 2 }),
  createItem({ code: 'VRT300037', name: 'فيره خلفي يمين', quantity: 1 }),
  createItem({ code: 'VRT300038', name: 'فيره دواسه', quantity: 1 }),
  createItem({ code: 'VRT300040', name: 'حليه دواسه', quantity: 1 }),
  createItem({ code: 'VRT300041', name: 'حليه شاسيه', quantity: 1 }),
  createItem({ code: 'VRT300042', name: 'فيره تانك تحت', quantity: 1 }),
  createItem({ code: 'VRT300043', name: 'فيره تانك تحت', quantity: 1 }),
  createItem({ code: 'VRT300044', name: 'حليه وسط 1-أ/1-ب', quantity: 1 }),
  createItem({ code: 'VRT300045', name: 'فيره فانوس امامي', quantity: 1 }),
  createItem({ code: 'VRT300046', name: 'علبه جادون', quantity: 1 }),
  createItem({ code: 'VRT300047', name: 'علب جلب', quantity: 1 }),
  createItem({ code: 'VRT300048', name: 'علب جلب', quantity: 1 }),
  createItem({ code: 'VRT300049', name: 'رفرف امامي', quantity: 1 }),
  createItem({ code: 'VRT300050', name: 'فيره تانك', quantity: 1 }),
  createItem({ code: 'VRT300051', name: 'فيره تانك', quantity: 1 }),
  createItem({ code: 'VRT300052', name: 'فيره تانك وسط', quantity: 1 }),
  createItem({ code: 'VRT300053', name: 'جلب تانك', quantity: 1 }),
  createItem({ code: 'VRT300056', name: 'حماية فوق الفانوس', quantity: 1 }),
  createItem({ code: 'VRT300057', name: 'بلاطة تحت الفانوس', quantity: 1 }),
  createItem({ code: 'VRT300058', name: 'فيره خلفي', quantity: 1 }),
  createItem({ code: 'VRT300059', name: 'فيره فانوس خلفي', quantity: 1 }),
  createItem({ code: 'VRT300060', name: 'فيره فوق الموتور', quantity: 1 }),
  createItem({ code: 'VRT300061', name: 'فيره فوق الموتور', quantity: 1 }),
  createItem({ code: 'VRT300062', name: 'فيره فوق الموتور ألوان', quantity: 1 }),
  createItem({ code: 'VRT300064', name: 'سلك بنزين', quantity: 1 }),
  createItem({ code: 'VRT300065', name: 'سلك دبرياج', quantity: 1 }),
  createItem({ code: 'VRT300066', name: 'سلك حرارة', quantity: 1 }),
  createItem({ code: 'VRT300067', name: 'ضفيرة', quantity: 2 }),
  createItem({ code: 'VRT300068', name: 'كتلة كهرباء شمال', quantity: 1 }),
  createItem({ code: 'VRT300069', name: 'كتلة كهرباء يمين', quantity: 1 }),
  createItem({ code: 'VRT300070', name: 'يد دبرياج بالفيز', quantity: 1 }),
  createItem({ code: 'VRT300071', name: 'فلاشر امامي شمال', quantity: 1 }),
  createItem({ code: 'VRT300072', name: 'فلاشر امامي يمين', quantity: 1 }),
  createItem({ code: 'VRT300073', name: 'فلاشر خلفي شمال', quantity: 1 }),
  createItem({ code: 'VRT300074', name: 'فلاشر خلفي يمين', quantity: 1 }),
  createItem({ code: 'VRT300076', name: 'خرطوم تبريد زيت', quantity: 1 }),
  createItem({ code: 'VRT300077', name: 'فيره رفرف ترابي', quantity: 2 }),
  createItem({ code: 'VRT300007', name: 'رفرفة فورش', quantity: 2 }),
  createItem({ code: 'VRT300011', name: 'شكمان', quantity: 1 }),
  createItem({ code: 'VRT300014', name: 'دواسه امامي بالحامل شمال', quantity: 2 }),
  createItem({ code: 'VRT300015', name: 'دواسه امامي بالحامل يمين', quantity: 2 }),
  createItem({ code: 'VRT300022', name: 'مبرد', quantity: 1 }),
  createItem({ code: 'VRT300023', name: 'شلته', quantity: 1 }),
  createItem({ code: 'VRT300024', name: 'عمود فورش شمال', quantity: 2 }),
  createItem({ code: 'VRT300025', name: 'عمود فورش يمين / مساعد نص خلفي', quantity: 2 }),
];

export default function PDFExportPage() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [items, search]);

  const updateItem = (id, field, value) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value } : item));
  };

  const addItem = () => {
    setItems((prev) => [...prev, createItem()]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearItems = () => {
    setItems([]);
  };

  const printPdf = () => {
    window.print();
  };

  const printableItems = items.filter((item) => item.name || item.imageUrl || item.quantity);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">PDF Export</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Product List PDF Export</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Enter the items manually, add the image link and quantity, then print to generate a clean and organized PDF for your China supplier.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={addItem}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                ➕ Add New Item
              </button>
              <button
                onClick={clearItems}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                🧹 Clear All
              </button>
              <button
                onClick={printPdf}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                📄 Print / Export PDF
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Quick Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item name or code..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Manual Item List</h2>
            <div className="text-sm text-slate-500">{items.length} items</div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              No matching items. You can add a new item from the top of the page.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">Item {index + 1}</div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Item Code</label>
                      <input
                        value={item.code}
                        onChange={(e) => updateItem(item.id, 'code', e.target.value)}
                        placeholder="VRT300001"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Item Name</label>
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        placeholder="Example: USB Cable"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Image Link</label>
                      <input
                        value={item.imageUrl}
                        onChange={(e) => updateItem(item.id, 'imageUrl', e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="print-only hidden print:block">
        <div className="rounded-none bg-white p-6 text-slate-900">
          <div className="mb-6 border-b border-slate-300 pb-4">
            <h1 className="text-2xl font-bold">Product List</h1>
            <p className="mt-2 text-sm text-slate-600">
              A clean product list prepared manually with item names, quantities, and optional images.
            </p>
          </div>

          {printableItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              No items to display in the PDF.
            </div>
          ) : (
            <div className="space-y-4">
              {printableItems.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{index + 1}</p>
                      <h2 className="text-lg font-bold text-slate-900">{item.name || 'Unnamed Item'}</h2>
                      <p className="text-sm text-slate-600">Code: {item.code || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      Quantity: {item.quantity || 1}
                    </div>
                  </div>

                  <div className={`grid gap-4 ${item.imageUrl ? 'lg:grid-cols-[180px_1fr]' : 'lg:grid-cols-1'}`}>
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name || 'Item image'}
                        className="h-44 w-full rounded-xl border border-slate-200 object-cover"
                      />
                    )}

                    <div className="space-y-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">Name</div>
                        <div className="text-base font-bold text-slate-900">{item.name || 'Unnamed Item'}</div>
                      </div>
                      {item.code && (
                        <div>
                          <div className="text-sm font-semibold text-slate-700">Code</div>
                          <div className="text-base text-slate-900">{item.code}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print-only {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  );
}
