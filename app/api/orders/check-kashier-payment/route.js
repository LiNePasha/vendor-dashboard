import { cookies } from "next/headers";

const KASHIER_V3 = "https://api.kashier.io/v3/payment/orders";

/**
 * POST /api/orders/check-kashier-payment
 * Body: { orderId, merchantId, apiPassword }
 *
 * يتحقق من حالة الدفع في Kashier v3 API.
 * لو الدفع اتم → يحدّث حالة الأوردر لـ processing ويحفظ Kashier transaction ID كـ meta.
 */
export async function POST(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId, merchantId, apiPassword } = body || {};

  if (!orderId || !merchantId || !apiPassword) {
    return Response.json(
      { error: "orderId و merchantId و apiPassword مطلوبين" },
      { status: 400 }
    );
  }

  // ── 1. استعلام Kashier v3 API ──────────────────────────────────────
  // v3 API uses `search` param (not merchantOrderId)
  const kashierUrl = `${KASHIER_V3}?search=${encodeURIComponent(orderId)}`;

  let kashierData;
  try {
    const kashierRes = await fetch(kashierUrl, {
      headers: {
        "Authorization": apiPassword,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!kashierRes.ok) {
      const errText = await kashierRes.text();
      return Response.json(
        { error: `Kashier API error ${kashierRes.status}`, details: errText },
        { status: 502 }
      );
    }

    kashierData = await kashierRes.json();
  } catch (err) {
    return Response.json(
      { error: "فشل الاتصال بـ Kashier", details: err.message },
      { status: 502 }
    );
  }

  // ── 2. تحليل نتيجة Kashier v3 ────────────────────────────────────
  // v3 response: { status: "SUCCESS", data: [{ status: "CAPTURED", transactions: [...] }] }
  const orderData = kashierData?.data?.[0];
  const paymentStatus = orderData?.status || "";
  const isPaid = paymentStatus.toUpperCase() === "CAPTURED";

  // استخراج transaction ID من آخر transaction ناجحة
  let transactionId = "";
  if (orderData?.transactions?.length) {
    const captured = orderData.transactions
      .filter(t => t.status === "SUCCESS" && t.operation !== "3dsecure_verify")
      .pop();
    transactionId = captured?.transactionId || orderData.transactions.at(-1)?.transactionId || "";
  }

  // ── 3. لو مدفوع، حدّث الأوردر في WooCommerce ──────────────────────
  if (isPaid) {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";

    // تحقق من صلاحية التاجر على الأوردر أولاً
    const checkRes = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${orderId}`, {
      headers: { "Authorization": `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);

    if (!checkRes?.ok) {
      return Response.json({
        paid: true,
        updated: false,
        paymentStatus,
        transactionId,
        message: "✅ الدفع تم لكن الأوردر غير موجود أو غير مسموح بالوصول إليه",
      });
    }

    // تحديث حالة الأوردر + حفظ Kashier transaction ID كـ meta
    try {
      const updateRes = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "processing",
          meta_data: [
            { key: "_kashier_transaction_id", value: transactionId },
            { key: "_kashier_payment_status", value: paymentStatus },
          ],
        }),
        cache: "no-store",
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return Response.json({
          paid: true,
          updated: false,
          paymentStatus,
          transactionId,
          updateError: errText,
          message: `✅ الدفع تم بـ ${transactionId || 'Kashier'} لكن فشل تحديث حالة الأوردر`,
        });
      }
    } catch (err) {
      return Response.json({
        paid: true,
        updated: false,
        paymentStatus,
        transactionId,
        updateError: err.message,
        message: `✅ الدفع تم بـ ${transactionId || 'Kashier'} لكن فشل تحديث حالة الأوردر`,
      });
    }

    return Response.json({
      paid: true,
      updated: true,
      paymentStatus,
      transactionId,
      message: `✅ تم الدفع وتحديث الأوردر${transactionId ? ` — معاملة: ${transactionId}` : ''}`,
    });
  }

  // ── 4. لو لسه مش مدفوع ────────────────────────────────────────────
  return Response.json({
    paid: false,
    updated: false,
    paymentStatus,
    transactionId: "",
    message: paymentStatus
      ? `⏳ حالة الدفع في Kashier: ${paymentStatus}`
      : "⚠️ لم يتم الدفع أو لا توجد معاملة مرتبطة",
  });
}



