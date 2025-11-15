"use client";
import { useState } from "react";

export default function TestNotificationPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const testSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      setMessage("✅ تم تشغيل الصوت!");
    } catch (error) {
      setMessage("❌ فشل تشغيل الصوت: " + error.message);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?status=processing&per_page=5', {
        credentials: 'include',
      });
      const data = await res.json();
      setMessage(`✅ تم جلب ${data.total} طلب قيد التجهيز`);
      console.log('Orders:', data);
    } catch (error) {
      setMessage("❌ فشل جلب الطلبات: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">🧪 اختبار نظام الإشعارات</h1>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-3">اختبار الصوت:</h2>
          <button
            onClick={testSound}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            🔊 تشغيل صوت التنبيه
          </button>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-xl font-semibold mb-3">اختبار API الطلبات:</h2>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "⏳ جاري الجلب..." : "📦 جلب الطلبات"}
          </button>
        </div>

        {message && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <p className="text-lg">{message}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h2 className="text-xl font-semibold mb-3">📋 التعليمات:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>🔔 الجرس في الـ Header يفحص الطلبات كل 30 ثانية</li>
            <li>🔊 سيتم تشغيل صوت تلقائياً عند وصول طلب جديد</li>
            <li>📊 العداد يظهر عدد الطلبات قيد التجهيز (processing)</li>
            <li>🎯 اضغط على الجرس لرؤية آخر 5 طلبات</li>
          </ul>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-xl font-semibold mb-3">⚙️ ملاحظات:</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>الصوت يعمل بـ Web Audio API (لا يحتاج ملفات خارجية)</li>
            <li>الفحص الدوري يبدأ تلقائياً عند تحميل الصفحة</li>
            <li>يمكن تغيير مدة الفحص من 30 ثانية إلى أي مدة أخرى</li>
            <li>الأنيميشن: رنين الجرس عند وصول طلب جديد</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
