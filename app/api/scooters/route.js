import { cookies } from "next/headers";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";
}

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString());
  } catch {
    return null;
  }
}

async function hasScooterAccess(token) {
  const cookieStore = await cookies();
  const userRole = cookieStore.get("userRole")?.value;
  const decoded = decodeToken(token);
  const user = decoded?.data?.user || {};
  const userId = Number(user?.id);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdmin =
    userRole === "admin" ||
    roles.includes("administrator") ||
    roles.includes("shop_manager");
  return isAdmin || userId === 5453;
}

// GET /api/scooters?type=new_scooter|used_scooter&page=1&search=...&status=any
// GET /api/scooters?check=1&type=new_scooter  → checks if CPT is registered & accessible
export async function GET(req) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasScooterAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "new_scooter";
  const checkOnly = searchParams.get("check") === "1";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "20";
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "any";
  const API_BASE = getApiBase();

  try {
    // ── CPT Availability Check ─────────────────────────────
    if (checkOnly) {
      const res = await fetch(`${API_BASE}/wp-json/wp/v2/types/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ ok: false, exists: false, error: `CPT check failed (${res.status})`, details: errText }),
          { status: res.status }
        );
      }
      const data = await res.json();
      return new Response(JSON.stringify({ ok: true, exists: true, ...data }), { status: 200 });
    }

    // ── List Items ─────────────────────────────────────────
    const params = new URLSearchParams({ page, per_page: perPage, context: "edit", status });
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`${API_BASE}/wp-json/wp/v2/${type}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `WP API Error ${res.status}`, details: errText }),
        { status: res.status }
      );
    }

    const items = await res.json();
    const total = Number(res.headers.get("X-WP-Total") || 0);
    const totalPages = Number(res.headers.get("X-WP-TotalPages") || 1);

    return new Response(
      JSON.stringify({ items, total, total_pages: totalPages, page: Number(page) }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// POST /api/scooters  → create new scooter
export async function POST(req) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasScooterAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const body = await req.json();
    const { type = "new_scooter", title, content, status = "draft", acf = {} } = body;
    const API_BASE = getApiBase();

    const payload = { title, content, status, acf };

    const res = await fetch(`${API_BASE}/wp-json/wp/v2/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      // Fallback: if cannot publish, retry as draft
      if (data?.code === "rest_cannot_publish") {
        const fallback = await fetch(`${API_BASE}/wp-json/wp/v2/${type}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...payload, status: "draft" }),
        });
        const fallbackData = await fallback.json();
        if (!fallback.ok) {
          return new Response(
            JSON.stringify({ error: fallbackData?.message || "فشل إنشاء الإسكوتر", details: fallbackData }),
            { status: fallback.status }
          );
        }
        return new Response(
          JSON.stringify({ ...fallbackData, _notice: "تم الحفظ كمسودة – يحتاج مراجعة الأدمن للنشر" }),
          { status: 201 }
        );
      }

      return new Response(
        JSON.stringify({ error: data?.message || `Error ${res.status}`, details: data }),
        { status: res.status }
      );
    }

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
