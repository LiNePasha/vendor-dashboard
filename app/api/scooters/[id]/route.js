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

// GET /api/scooters/[id]?type=new_scooter|used_scooter
export async function GET(_req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasScooterAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(_req.url);
    const type = searchParams.get("type") || "new_scooter";
    const API_BASE = getApiBase();

    const res = await fetch(`${API_BASE}/wp-json/wp/v2/${type}/${id}?context=edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `API Error ${res.status}`, details: errText }),
        { status: res.status }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// PUT /api/scooters/[id]  → update scooter
export async function PUT(req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasScooterAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { type = "new_scooter", title, content, status, acf = {} } = body;
    const API_BASE = getApiBase();

    const payload = { title, content, status, acf };

    const res = await fetch(`${API_BASE}/wp-json/wp/v2/${type}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      // If cannot publish, retry without changing status
      if (data?.code === "rest_cannot_publish") {
        const { status: _s, ...payloadWithoutStatus } = payload;
        const retryRes = await fetch(`${API_BASE}/wp-json/wp/v2/${type}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payloadWithoutStatus),
        });
        const retryData = await retryRes.json();
        if (!retryRes.ok) {
          return new Response(
            JSON.stringify({ error: retryData?.message || "فشل التحديث", details: retryData }),
            { status: retryRes.status }
          );
        }
        return new Response(
          JSON.stringify({ ...retryData, _notice: "تم الحفظ – لا يمكنك تغيير الحالة إلى منشور" }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({ error: data?.message || `Error ${res.status}`, details: data }),
        { status: res.status }
      );
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// DELETE /api/scooters/[id]?type=new_scooter|used_scooter
export async function DELETE(req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasScooterAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "new_scooter";
    const API_BASE = getApiBase();

    const res = await fetch(`${API_BASE}/wp-json/wp/v2/${type}/${id}?force=true`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Delete Error ${res.status}`, details: errText }),
        { status: res.status }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
