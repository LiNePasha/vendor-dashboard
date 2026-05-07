"use client";

import { useEffect, useMemo, useState } from "react";

const EMPTY_FORM = {
  title: "",
  content: "",
  status: "draft",
  videoLink: "",
};

function isProbablyUrl(value) {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

export default function WebikersVideosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [typeCheck, setTypeCheck] = useState({ loading: true, ok: false, details: null });

  const canSubmit = useMemo(() => {
    return form.title.trim().length > 0 && isProbablyUrl(form.videoLink) && !saving;
  }, [form.title, form.videoLink, saving]);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4500);
  };

  const loadTypeCheck = async () => {
    setTypeCheck({ loading: true, ok: false, details: null });
    try {
      const res = await fetch("/api/webikers-videos?check=1", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setTypeCheck({ loading: false, ok: false, details: data });
        return;
      }
      setTypeCheck({ loading: false, ok: true, details: data });
    } catch (err) {
      setTypeCheck({ loading: false, ok: false, details: { error: err.message } });
    }
  };

  const loadItems = async (nextPage = page, nextSearch = search, nextStatus = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        per_page: "20",
        status: nextStatus,
      });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());

      const res = await fetch(`/api/webikers-videos?${params.toString()}`, { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الفيديوهات");
      }

      setItems(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
      setPage(data.page || 1);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypeCheck();
    loadItems(1, "", "any");
  }, []);

  const onCreate = async () => {
    if (!isProbablyUrl(form.videoLink)) {
      showMessage("⚠️ رابط الفيديو غير صحيح (لازم يبدأ بـ http أو https)", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/webikers-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          status: form.status,
          acf: {
            link: form.videoLink.trim(),
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة الفيديو");
      }

      showMessage(data?._notice ? `✅ تم الإضافة - ${data._notice}` : "✅ تم إضافة الفيديو", data?._notice ? "warning" : "success");
      setForm(EMPTY_FORM);
      await loadItems(1, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row?.title?.raw || row?.title?.rendered || row?.title || "",
      content: row?.content?.raw || row?.content?.rendered || "",
      status: row?.status || "draft",
      videoLink: row?.acf?.link || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onUpdate = async () => {
    if (!editingId) return;

    if (!isProbablyUrl(form.videoLink)) {
      showMessage("⚠️ رابط الفيديو غير صحيح (لازم يبدأ بـ http أو https)", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/webikers-videos/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          status: form.status,
          acf: {
            link: form.videoLink.trim(),
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "فشل تحديث الفيديو");
      }

      showMessage(data?._notice ? `✅ تم التحديث - ${data._notice}` : "✅ تم تحديث الفيديو", data?._notice ? "warning" : "success");
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadItems(page, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("هل متأكد من حذف الفيديو؟")) return;

    try {
      const res = await fetch(`/api/webikers-videos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "فشل حذف الفيديو");
      }

      showMessage("🗑️ تم حذف الفيديو", "success");
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await loadItems(page, search, statusFilter);
    } catch (err) {
      showMessage(`❌ ${err.message}`, "error");
    }
  };

  const onSearch = async () => {
    await loadItems(1, search, statusFilter);
  };

  const onFilterStatus = async (value) => {
    setStatusFilter(value);
    await loadItems(1, search, value);
  };

  return (
    <div className="min-h-screen bg-[#181f2a] p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🎬 إدارة فيديوهات Webikers</h1>
        <p className="text-gray-300 text-sm">إضافة وتعديل وحذف عناصر post type: <code>webikers_video</code></p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === "success" ? "bg-green-100 text-green-800 border border-green-300" :
          message.type === "error" ? "bg-red-100 text-red-800 border border-red-300" :
          message.type === "warning" ? "bg-amber-100 text-amber-800 border border-amber-300" :
          "bg-blue-100 text-blue-800 border border-blue-300"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#232b3b] border border-gray-700 rounded-xl p-5">
          <h2 className="text-xl text-white font-bold mb-4">{editingId ? `✏️ تعديل فيديو #${editingId}` : "➕ إضافة فيديو جديد"}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">العنوان *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
                placeholder="عنوان الفيديو"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
              >
                <option value="draft">Draft</option>
                <option value="publish">Publish</option>
                <option value="private">Private</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">رابط الفيديو (ACF: link) *</label>
              <input
                type="url"
                value={form.videoLink}
                onChange={(e) => setForm((s) => ({ ...s, videoLink: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-xs text-gray-400 mt-1">سيتم الحفظ داخل ACF في الحقل: <code>link</code></p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">المحتوى (اختياري)</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
                placeholder="وصف الفيديو أو النص"
              />
            </div>

            <div className="flex gap-2">
              {!editingId ? (
                <button
                  onClick={onCreate}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold"
                >
                  {saving ? "⏳ جاري الحفظ..." : "✅ إضافة"}
                </button>
              ) : (
                <>
                  <button
                    onClick={onUpdate}
                    disabled={!canSubmit}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold"
                  >
                    {saving ? "⏳ جاري التحديث..." : "💾 حفظ التعديل"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY_FORM);
                    }}
                    className="px-5 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-bold"
                  >
                    إلغاء
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#232b3b] border border-gray-700 rounded-xl p-5">
          <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
            <h2 className="text-xl text-white font-bold">📋 الفيديوهات ({total})</h2>
            <button
              onClick={() => loadItems(page, search, statusFilter)}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
            >
              🔄 تحديث
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="بحث بالعنوان..."
              className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => onFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-600 bg-[#1b2230] text-white"
            >
              <option value="any">كل الحالات</option>
              <option value="publish">Publish</option>
              <option value="draft">Draft</option>
              <option value="private">Private</option>
              <option value="pending">Pending</option>
            </select>
            <button
              onClick={onSearch}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              🔎 بحث
            </button>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {loading ? (
              <div className="text-gray-300 py-6 text-center">⏳ جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="text-gray-400 py-6 text-center">لا توجد عناصر حالياً</div>
            ) : (
              items.map((row) => (
                <div key={row.id} className="border border-gray-700 rounded-lg p-3 bg-[#1b2230]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">#{row.id} - {row?.title?.rendered || "(بدون عنوان)"}</p>
                      <p className="text-xs text-gray-400 mt-1">الحالة: <span className="text-gray-200">{row.status}</span></p>
                      <p className="text-xs text-gray-400">التاريخ: {row.date_gmt || row.date}</p>
                      {row?.acf?.link && (
                        <a
                          href={row.acf.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-300 hover:text-cyan-200 underline break-all"
                        >
                          🔗 {row.acf.link}
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => onEdit(row)}
                        className="px-2.5 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => onDelete(row.id)}
                        className="px-2.5 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              disabled={page <= 1 || loading}
              onClick={() => loadItems(page - 1, search, statusFilter)}
              className="px-3 py-2 rounded bg-gray-700 disabled:opacity-50 text-white text-sm"
            >
              السابق
            </button>
            <span className="text-gray-300 text-sm">صفحة {page} من {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => loadItems(page + 1, search, statusFilter)}
              className="px-3 py-2 rounded bg-gray-700 disabled:opacity-50 text-white text-sm"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
