import { cookies } from "next/headers";

export async function apiFetch(endpoint, options = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) throw new Error("Unauthorized: No token found in cookies");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
  const res = await fetch(`${API_BASE}/wp-json/${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`API Error: ${res.status}`);

  return await res.json();
}
