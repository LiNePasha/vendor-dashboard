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

async function hasWebikersAccess(token) {
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

function parseWpError(detailsText) {
  try {
    return JSON.parse(detailsText || "{}");
  } catch {
    return null;
  }
}

export async function GET(_req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasWebikersAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const API_BASE = getApiBase();
    const res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video/${id}?context=edit`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: errText }), {
        status: res.status,
      });
    }

    const row = await res.json();
    return new Response(JSON.stringify(row), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasWebikersAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { title, content, status, acf } = body || {};

    const payload = {};
    if (title !== undefined) payload.title = title;
    if (content !== undefined) payload.content = content;
    if (status !== undefined) payload.status = status;
    if (acf !== undefined) payload.acf = acf;

    const API_BASE = getApiBase();
    let res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const firstErrText = await res.text();
      const wpErr = parseWpError(firstErrText);
      const cannotPublish = res.status === 403 && wpErr?.code === "rest_cannot_publish";

      if (cannotPublish && payload.status === "publish") {
        // 1) Retry without status so we can update fields while preserving current status
        const { status: _ignoredStatus, ...retryWithoutStatus } = payload;
        res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(retryWithoutStatus),
          cache: "no-store",
        });

        if (res.ok) {
          const updatedNoStatus = await res.json();
          return new Response(
            JSON.stringify({
              ...updatedNoStatus,
              _notice: "تم تعديل البيانات، لكن حسابك لا يملك صلاحية تغيير الحالة إلى Publish.",
            }),
            { status: 200 }
          );
        }

        // 2) Last fallback: save as draft if server still refuses the update
        const retryPayload = { ...payload, status: "draft" };
        res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(retryPayload),
          cache: "no-store",
        });

        if (!res.ok) {
          const retryErrText = await res.text();
          return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: retryErrText }), {
            status: res.status,
          });
        }

        const updatedDraft = await res.json();
        return new Response(
          JSON.stringify({
            ...updatedDraft,
            _notice: "تم الحفظ كمسودة لأن حسابك لا يملك صلاحية النشر المباشر.",
            _auto_status: "draft",
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: firstErrText }), {
        status: res.status,
      });
    }

    const updated = await res.json();
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasWebikersAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { id } = await params;
    const API_BASE = getApiBase();
    const res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video/${id}?force=true`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: errText }), {
        status: res.status,
      });
    }

    const deleted = await res.json();
    return new Response(JSON.stringify(deleted), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
