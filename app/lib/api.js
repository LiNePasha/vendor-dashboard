import { cookies } from "next/headers";

export async function apiFetch(endpoint, options = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) throw new Error("Unauthorized: No token found in cookies");

  const res = await fetch(`https://spare2app.com/wp-json/${endpoint}`, {
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
