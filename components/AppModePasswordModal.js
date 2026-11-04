"use client";

import { useEffect, useState } from "react";
import { APP_MODE_LABELS, setAppMode } from "@/app/lib/roles-permissions";

export default function AppModePasswordModal({ mode, onClose }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword("");
  }, [mode]);

  if (!mode) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (setAppMode(mode, password)) onClose();
    else setPassword("");
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        dir="rtl"
      >
        <h2 className="mb-2 text-lg font-bold text-gray-900">
          تغيير الوضع إلى {APP_MODE_LABELS[mode]}
        </h2>
        <label htmlFor="app-mode-password" className="mb-2 block text-sm font-medium text-gray-700">
          كلمة المرور
        </label>
        <input
          id="app-mode-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            تأكيد
          </button>
        </div>
      </form>
    </div>
  );
}
