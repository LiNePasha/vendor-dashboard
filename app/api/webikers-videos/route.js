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

export async function GET(req) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasWebikersAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const checkType = searchParams.get("check") === "1";
    const API_BASE = getApiBase();

    if (checkType) {
      const typeRes = await fetch(`${API_BASE}/wp-json/wp/v2/types/webikers_video`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!typeRes.ok) {
        const errText = await typeRes.text();
        return new Response(
          JSON.stringify({
            ok: false,
            exists: false,
            error: `Post type check failed (${typeRes.status})`,
            details: errText,
          }),
          { status: typeRes.status }
        );
      }

      const typeData = await typeRes.json();
      return new Response(
        JSON.stringify({
          ok: true,
          exists: true,
          slug: typeData?.slug || "webikers_video",
          rest_base: typeData?.rest_base || "webikers_video",
          supports: typeData?.supports || {},
          labels: typeData?.labels || {},
        }),
        { status: 200 }
      );
    }

    const perPage = searchParams.get("per_page") || "20";
    const page = searchParams.get("page") || "1";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "any";

    const url = new URL(`${API_BASE}/wp-json/wp/v2/webikers_video`);
    url.searchParams.set("per_page", perPage);
    url.searchParams.set("page", page);
    url.searchParams.set("_embed", "1");
    url.searchParams.set("context", "edit");

    if (search) url.searchParams.set("search", search);
    if (status) url.searchParams.set("status", status);

    const res = await fetch(url.toString(), {
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

    const rows = await res.json();
    const total = parseInt(res.headers.get("x-wp-total") || `${rows.length}`, 10);
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);

    return new Response(
      JSON.stringify({
        items: Array.isArray(rows) ? rows : [],
        total,
        total_pages: totalPages,
        page: parseInt(page, 10),
        per_page: parseInt(perPage, 10),
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST(req) {
  const token = await getToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!(await hasWebikersAccess(token))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, content, status = "draft", acf = {} } = body || {};

    if (!title || !String(title).trim()) {
      return new Response(JSON.stringify({ error: "title is required" }), { status: 400 });
    }

    const API_BASE = getApiBase();
    const payload = {
      title,
      content,
      status,
      acf,
    };

    let res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    // لو المستخدم اختار publish وماعندوش صلاحية: نعمل fallback لـ draft بدل الفشل
    if (!res.ok) {
      const firstErrText = await res.text();
      const wpErr = parseWpError(firstErrText);
      const cannotPublish = res.status === 403 && wpErr?.code === "rest_cannot_publish";

      if (cannotPublish && status === "publish") {
        res = await fetch(`${API_BASE}/wp-json/wp/v2/webikers_video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...payload, status: "draft" }),
          cache: "no-store",
        });

        if (!res.ok) {
          const retryErrText = await res.text();
          return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: retryErrText }), {
            status: res.status,
          });
        }

        const createdDraft = await res.json();
        return new Response(
          JSON.stringify({
            ...createdDraft,
            _notice: "تم الحفظ كمسودة لأن حسابك لا يملك صلاحية النشر المباشر.",
            _auto_status: "draft",
          }),
          { status: 201 }
        );
      }

      return new Response(JSON.stringify({ error: `API Error ${res.status}`, details: firstErrText }), {
        status: res.status,
      });
    }

    const created = await res.json();
    return new Response(JSON.stringify(created), { status: 201 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
