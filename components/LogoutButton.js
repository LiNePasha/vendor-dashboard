"use client";

export default function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-red-600 font-bold hover:underline"
    >
      تسجيل الخروج
    </button>
  );
}
