"use client";
import Link from "next/link";
import LogoutButton from "../components/LogoutButton";

export default function ClientLayout({ children }) {
  return (
    <>
      <nav className="p-4 flex justify-between bg-white shadow">
        <Link href="/" className="font-bold text-xl">
          لوحة التحكم
        </Link>
        <LogoutButton />
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </>
  );
}
