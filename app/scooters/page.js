"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TABS = [
  { key: "new_scooter", label: "🆕 إسكوترات جديدة" },
  { key: "used_scooter", label: "🔄 إسكوترات مستعملة" },
];

const EMPTY_FORM = {
  title: "",
  content: "",
  status: "draft",
  brand: "",
  model: "",
  year: "",
  price: "",
  color: "",
  engine_cc: "",
  mileage: "",
  images: [], // array of URL strings
};

function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string" && x.trim());
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusLabel(s) {
  const map = { publish: "منشور", draft: "مسودة", private: "خاص", pending: "قيد المراجعة", trash: "محذوف" };
  return map[s] || s;
}

function statusColor(s) {
  const map = {
    publish: "bg-green-600",
    draft: "bg-gray-500",
    private: "bg-purple-600",
    pending: "bg-yellow-600",
    trash: "bg-red-700",
  };
  return map[s] || "bg-gray-500";
}

export default function ScootersPage() {
  const [activeTab, setActiveTab] = useState("new_scooter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [typeCheck, setTypeCheck] = useState({
    new_scooter: { loading: true, ok: false },
    used_scooter: { loading: true, ok: false },
  });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const isUsed = activeTab === "used_scooter";

  const canSubmit = useMemo(() => {
    return form.title.trim() && form.brand.trim() && form.model.trim() && !saving;
  }, [form.title, form.brand, form.model, saving]);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // ── CPT Availability Check ─────────────────────────────────
  const checkTypes = async () => {
    for (const t of ["new_scooter", "used_scooter"]) {
      fetch(`/api/scooters?check=1&type=${t}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setTypeCheck((prev) => ({ ...prev, [t]: { loading: false, ok: !!d.ok } })))
        .catch(() => setTypeCheck((prev) => ({ ...prev, [t]: { loading: false, ok: false } })));
    }
  };

  // ── Load Items ─────────────────────────────────────────────
  const loadItems = async (p = page, s = search, st = statusFilter, tab = activeTab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, page: String(p), per_page: "16", status: st });
      if (s.trim()) params.set("search", s.trim());
      const res = await fetch(`/api/scooters?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل التحميل");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setPage(data.page || 1);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkTypes();
  }, []);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setStatusFilter("any");
    loadItems(1, "", "any", activeTab);
  }, [activeTab]);

  // ── Build ACF payload from form ────────────────────────────
  const buildAcf = () => ({
    brand: form.brand.trim(),
    model: form.model.trim(),
    year: form.year ? Number(form.year) : null,
    price: form.price ? Number(form.price) : 0,
    color: form.color.trim(),
    engine_cc: form.engine_cc ? Number(form.engine_cc) : null,
    mileage: form.mileage ? Number(form.mileage) : null,
    images: JSON.stringify(form.images),
  });

  // ── Create ─────────────────────────────────────────────────
  const onCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/scooters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: activeTab,
          title: form.title.trim(),
          content: form.content.trim(),
          status: form.status,
          acf: buildAcf(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الإضافة");
      showMessage(data?._notice ? `✅ تم الإضافة – ${data._notice}` : "✅ تم إضافة الإسكوتر", data?._notice ? "warning" : "success");
      setForm({ ...EMPTY_FORM });
      await loadItems(1, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Update ─────────────────────────────────────────────────
  const onUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scooters/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: activeTab,
          title: form.title.trim(),
          content: form.content.trim(),
          status: form.status,
          acf: buildAcf(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل التحديث");
      showMessage(data?._notice ? `✅ تم التحديث – ${data._notice}` : "✅ تم تحديث الإسكوتر", data?._notice ? "warning" : "success");
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      await loadItems(page, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const onDelete = async (id) => {
    if (!confirm("هل متأكد من حذف هذا الإسكوتر؟")) return;
    try {
      const res = await fetch(`/api/scooters/${id}?type=${activeTab}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      showMessage("🗑️ تم الحذف", "success");
      if (editingId === id) { setEditingId(null); setForm({ ...EMPTY_FORM }); }
      await loadItems(page, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    }
  };

  // ── Edit ───────────────────────────────────────────────────
  const onEdit = (row) => {
    const acf = row?.acf || {};
    setEditingId(row.id);
    setForm({
      title: row?.title?.raw || row?.title?.rendered || row?.title || "",
      content: row?.content?.raw || row?.content?.rendered || "",
      status: row?.status || "draft",
      brand: acf.brand || "",
      model: acf.model || "",
      year: acf.year ? String(acf.year) : "",
      price: acf.price ? String(acf.price) : "",
      color: acf.color || "",
      engine_cc: acf.engine_cc ? String(acf.engine_cc) : "",
      mileage: acf.mileage ? String(acf.mileage) : "",
      images: parseImages(acf.images),
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  // ── Image Upload ───────────────────────────────────────────
  const handleImageUpload = async (files) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArray.length) return;
    const remainingSlots = Math.max(0, 10 - form.images.length);
    const uploadQueue = fileArray.slice(0, remainingSlots);
    if (!uploadQueue.length) {
      showMessage("⚠️ الحد الأقصى 10 صور", "warning");
      return;
    }
    setUploadingImages(true);
    try {
      for (const file of uploadQueue) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd, credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          const reason = data?.details || data?.error || `Upload failed (${res.status})`;
          showMessage(`⚠️ فشل رفع صورة: ${reason}`, "warning");
          continue;
        }
        const url = String(data?.url || "").trim();
        if (!/^https?:\/\//i.test(url)) {
          showMessage("⚠️ تم رفع الصورة لكن الرابط غير صالح", "warning");
          continue;
        }
        setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
      }
      if (fileArray.length > uploadQueue.length) {
        showMessage(`ℹ️ تم تجاهل ${fileArray.length - uploadQueue.length} صورة بسبب الحد الأقصى (10)`, "info");
      }
    } catch (err) {
      showMessage(`❌ خطأ في رفع الصور: ${err.message}`, "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const addManualImageUrl = () => {
    const url = manualImageUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      showMessage("⚠️ اكتب رابط صورة صحيح يبدأ بـ http أو https", "warning");
      return;
    }
    if (form.images.length >= 10) {
      showMessage("⚠️ الحد الأقصى 10 صور", "warning");
      return;
    }
    if (form.images.includes(url)) {
      showMessage("ℹ️ الرابط مضاف بالفعل", "info");
      return;
    }
    setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
    setManualImageUrl("");
  };

  const onSearch = () => loadItems(1, search, statusFilter);

  const onStatusFilter = (v) => {
    setStatusFilter(v);
    loadItems(1, search, v);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#181f2a] p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">🛵 إدارة الإسكوترات</h1>
        <p className="text-gray-400 text-sm">إضافة وتعديل إسكوترات جديدة ومستعملة عبر WordPress REST API</p>
      </div>

      {/* Flash Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium border ${
          message.type === "success" ? "bg-green-950 text-green-300 border-green-700" :
          message.type === "error"   ? "bg-red-950 text-red-300 border-red-700" :
          message.type === "warning" ? "bg-amber-950 text-amber-300 border-amber-700" :
          "bg-blue-950 text-blue-300 border-blue-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* CPT Status Banner */}
      <div className="mb-5 flex gap-3 flex-wrap">
        {TABS.map(({ key, label }) => {
          const check = typeCheck[key];
          return (
            <div key={key} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
              check.loading ? "border-gray-600 text-gray-400 bg-gray-800" :
              check.ok ? "border-green-700 text-green-400 bg-green-950" :
              "border-red-700 text-red-400 bg-red-950"
            }`}>
              {check.loading ? "⏳" : check.ok ? "✅" : "❌"} {label.split(" ")[1]}: {check.loading ? "جاري الفحص..." : check.ok ? "متاح" : "CPT غير مسجّل في WP"}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors ${
              activeTab === key
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-[#232b3b] text-gray-300 hover:bg-[#2a3547] border border-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ── Form ───────────────────────────────────────── */}
        <div ref={formRef} className="xl:col-span-2">
          <div className="bg-[#232b3b] border border-gray-700 rounded-xl p-5 sticky top-4">
            <h2 className="text-lg text-white font-bold mb-4">
              {editingId ? `✏️ تعديل إسكوتر #${editingId}` : "➕ إضافة إسكوتر"}
            </h2>

            <div className="space-y-3">

              {/* العنوان */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">اسم الإعلان *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                  placeholder="مثال: Yamaha NMAX 155 موديل 2024 للبيع"
                />
              </div>

              {/* الحالة */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">الحالة</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                >
                  <option value="draft">مسودة</option>
                  <option value="publish">منشور</option>
                  <option value="private">خاص</option>
                  <option value="pending">قيد المراجعة</option>
                </select>
              </div>

              {/* الماركة + الموديل */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">الماركة *</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="Yamaha"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">الموديل *</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="NMAX 155"
                  />
                </div>
              </div>

              {/* السنة + السعر + المحرك */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">السنة</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((s) => ({ ...s, year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="2024"
                    min="1990" max="2030"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">السعر (جنيه)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">المحرك (cc)</label>
                  <input
                    type="number"
                    value={form.engine_cc}
                    onChange={(e) => setForm((s) => ({ ...s, engine_cc: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="150"
                    min="50" max="1000"
                  />
                </div>
              </div>

              {/* اللون + الكيلومترات */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">اللون</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="أحمر"
                  />
                </div>
                {isUsed && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">الكيلومترات</label>
                    <input
                      type="number"
                      value={form.mileage}
                      onChange={(e) => setForm((s) => ({ ...s, mileage: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                )}
              </div>

              {/* الوصف */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">الوصف</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm resize-none"
                  placeholder="تفاصيل الإسكوتر..."
                />
              </div>

              {/* الصور */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  الصور ({form.images.length}/10)
                  {uploadingImages && <span className="mr-2 text-blue-400">⏳ جاري الرفع...</span>}
                </label>

                {/* Image Thumbnails */}
                {form.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.images.map((url, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-600 bg-gray-800">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={() => {
                            removeImage(idx);
                            showMessage("⚠️ رابط الصورة غير صالح وتمت إزالته", "warning");
                          }}
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 text-lg transition-opacity"
                          title="حذف الصورة"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImages || form.images.length >= 10}
                  className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                >
                  📷 اختر صور للرفع
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }}
                />

                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    value={manualImageUrl}
                    onChange={(e) => setManualImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white text-sm"
                    placeholder="أو الصق رابط صورة مباشر (https://...)"
                  />
                  <button
                    type="button"
                    onClick={addManualImageUrl}
                    className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold"
                  >
                    ➕ إضافة رابط
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                {!editingId ? (
                  <button
                    onClick={onCreate}
                    disabled={!canSubmit}
                    className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm"
                  >
                    {saving ? "⏳ جاري الحفظ..." : "✅ إضافة"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onUpdate}
                      disabled={!canSubmit}
                      className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm"
                    >
                      {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديل"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-bold text-sm"
                    >
                      إلغاء
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── List ───────────────────────────────────────── */}
        <div className="xl:col-span-3">

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-600 bg-[#232b3b] text-white text-sm"
              placeholder="بحث..."
            />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-600 bg-[#232b3b] text-white text-sm"
            >
              <option value="any">كل الحالات</option>
              <option value="publish">منشور</option>
              <option value="draft">مسودة</option>
              <option value="private">خاص</option>
              <option value="pending">قيد المراجعة</option>
            </select>
            <button
              onClick={onSearch}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              🔍 بحث
            </button>
          </div>

          {/* Total Count */}
          <p className="text-gray-400 text-xs mb-3">{total} إسكوتر إجمالاً</p>

          {/* Loading */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#232b3b] rounded-xl h-48 animate-pulse border border-gray-700" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🛵</div>
              <p>لا توجد إسكوترات</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const acf = item?.acf || {};
                const images = parseImages(acf.images);
                const firstImage = images[0] || null;
                const title = item?.title?.rendered || item?.title?.raw || item?.title || `#${item.id}`;
                return (
                  <div
                    key={item.id}
                    className={`bg-[#232b3b] border rounded-xl overflow-hidden transition-all ${
                      editingId === item.id ? "border-blue-500 shadow-lg shadow-blue-900/30" : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {/* Image */}
                    <div className="h-36 bg-gray-800 relative overflow-hidden">
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🛵</div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`text-xs text-white px-2 py-0.5 rounded-full font-medium ${statusColor(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      {images.length > 1 && (
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          📷 {images.length}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="text-white text-sm font-bold truncate mb-1" title={title}>
                        {title}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mb-2">
                        {acf.brand && <span>🏷️ {acf.brand}</span>}
                        {acf.model && <span>📋 {acf.model}</span>}
                        {acf.year && <span>📅 {acf.year}</span>}
                        {acf.engine_cc && <span>⚙️ {acf.engine_cc}cc</span>}
                        {acf.mileage && <span>📍 {Number(acf.mileage).toLocaleString()} كم</span>}
                        {acf.color && <span>🎨 {acf.color}</span>}
                      </div>
                      {acf.price > 0 && (
                        <p className="text-green-400 font-bold text-sm mb-2">
                          {Number(acf.price).toLocaleString("ar-EG")} ج
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-bold border border-blue-700/30 transition-colors"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-bold border border-red-700/30 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); loadItems(p); }}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg bg-[#232b3b] border border-gray-600 text-gray-300 disabled:opacity-40 hover:bg-[#2a3547] text-sm"
              >
                ‹ السابق
              </button>
              <span className="px-4 py-2 text-gray-400 text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); loadItems(p); }}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg bg-[#232b3b] border border-gray-600 text-gray-300 disabled:opacity-40 hover:bg-[#2a3547] text-sm"
              >
                التالي ›
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
