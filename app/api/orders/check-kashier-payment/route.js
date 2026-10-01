import { cookies } from "next/headers";

const KASHIER_V3 = "https://api.kashier.io/v3/payment/orders";

/**
 * POST /api/orders/check-kashier-payment
 * Body: { orderId, merchantId, apiPassword }
 *
 * يتحقق من حالة الدفع في Kashier v3 API.
 * لا يعتمد الدفع إلا بعد مطابقة رقم الأوردر حرفيًا ومعاملة ناجحة.
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

  const { orderId, merchantId, apiPassword, testConnection = false } = body || {};

  if (!orderId || !merchantId || !apiPassword) {
    return Response.json(
      { error: "orderId و merchantId و apiPassword مطلوبين" },
      { status: 400 }
    );
  }

  const isConnectionTest = testConnection === true;
  if (!isConnectionTest && !/^\d+$/.test(String(orderId))) {
    return Response.json({ error: "رقم الأوردر غير صالح" }, { status: 400 });
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";
  let wooOrder = null;

  // لا نبحث في Kashier إلا بعد التأكد أن الأوردر موجود فعلًا وأن وسيلة الدفع Kashier.
  if (!isConnectionTest) {
    const wooRes = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);

    if (!wooRes?.ok) {
      return Response.json({
        paid: false,
        updated: false,
        message: "⚠️ لم يتم العثور على الأوردر أو لا تملك صلاحية الوصول إليه",
      });
    }

    const wooPayload = await wooRes.json().catch(() => null);
    wooOrder = wooPayload?.order || wooPayload;
    if (String(wooOrder?.id) !== String(orderId)) {
      return Response.json({ paid: false, updated: false, message: "⚠️ رقم الأوردر لا يطابق سجل المتجر" });
    }

    const paymentMethod = String(wooOrder.payment_method || "").toLowerCase();
    if (!paymentMethod.includes("kashier")) {
      return Response.json({
        paid: false,
        updated: false,
        message: "ℹ️ وسيلة الدفع لهذا الأوردر ليست Kashier؛ لم يتم تغيير حالته",
      });
    }

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

  // اختبار الاتصال لا يقرأ/يحدّث أي أوردر أو حالة دفع.
  if (isConnectionTest) {
    return Response.json({
      success: true,
      paid: false,
      message: "✅ الاتصال بـ Kashier ناجح",
    });
  }

  // ── 2. تحليل نتيجة Kashier v3 ────────────────────────────────────
  // `search` may return partial matches; never trust the first result.
  const kashierOrders = Array.isArray(kashierData?.data)
    ? kashierData.data
    : (kashierData?.data ? [kashierData.data] : []);
  const requestedOrderId = String(orderId).trim();
  const orderData = kashierOrders.find((candidate) => {
    const references = [
      candidate?.merchantOrderId,
      candidate?.merchant_order_id,
      candidate?.orderReference,
      candidate?.order_reference,
      candidate?.merchantOrderNumber,
      candidate?.merchant_order_number,
    ].filter(value => value !== undefined && value !== null).map(String);
    return references.some(reference => reference.trim() === requestedOrderId);
  });

  if (!orderData) {
    return Response.json({
      paid: false,
      updated: false,
      paymentStatus: "",
      transactionId: "",
      message: "⏳ لم يتم العثور على عملية Kashier مرتبطة برقم هذا الأوردر تحديدًا",
    });
  }

  const responseMerchantId = orderData.merchantId || orderData.merchant_id || orderData.mid;
  if (responseMerchantId && String(responseMerchantId) !== String(merchantId)) {
    return Response.json({
      paid: false,
      updated: false,
      message: "⚠️ عملية الدفع تابعة لحساب Kashier مختلف؛ لم يتم تحديث الأوردر",
    });
  }

  const paymentStatus = orderData?.status || "";
  const successfulCapturedTransactions = (Array.isArray(orderData?.transactions) ? orderData.transactions : []).filter((transaction) =>
    String(transaction?.status || "").toUpperCase() === "SUCCESS" &&
    String(transaction?.operation || "").toLowerCase() !== "3dsecure_verify" &&
    Boolean(transaction?.transactionId)
  );
  const capturedTransaction = successfulCapturedTransactions.at(-1);
  const isPaid = String(paymentStatus).toUpperCase() === "CAPTURED" && Boolean(capturedTransaction);

  // لا نعرض أي transaction ID إلا من معاملة نجاح مؤكدة.
  const transactionId = isPaid ? capturedTransaction.transactionId : "";

  // إصلاح الحالة القديمة الخاطئة فقط إذا وجدنا سجل Kashier المطابق حرفيًا
  // ويؤكد صراحةً أن الدفع ما زال معلقًا/فشل. أخطاء الاتصال أو عدم وجود سجل لا تغيّر WooCommerce.
  const unpaidKashierStatuses = ["PENDING", "FAILED", "DECLINED", "AUTHORIZED", "EXPIRED", "CANCELLED", "VOIDED", "INITIATED"];
  if (!isPaid &&
      ["processing", "completed"].includes(String(wooOrder?.status || "").toLowerCase()) &&
      unpaidKashierStatuses.includes(String(paymentStatus).toUpperCase())) {
    const correctionRes = await fetch(`${API_BASE}/wp-json/wc/v3/orders/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "pending",
        meta_data: [
          { key: "_kashier_payment_status", value: paymentStatus },
          { key: "_payment_status", value: ["PENDING", "AUTHORIZED", "INITIATED"].includes(String(paymentStatus).toUpperCase()) ? "awaiting" : "failed" },
        ],
      }),
      cache: "no-store",
    }).catch(() => null);

    return Response.json({
      paid: false,
      updated: Boolean(correctionRes?.ok),
      corrected: Boolean(correctionRes?.ok),
      paymentStatus,
      transactionId: "",
      message: correctionRes?.ok
        ? "⚠️ تأكد أن الدفع غير مكتمل؛ تم تصحيح حالة الأوردر إلى غير مدفوع"
        : "⚠️ الدفع غير مكتمل، لكن تعذر تصحيح حالة الأوردر تلقائيًا",
    });
  }

  // ── 3. لو مدفوع، حدّث الأوردر في WooCommerce ──────────────────────
  if (isPaid) {
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
            { key: "_kashier_payment_pending", value: "no" },
            { key: "_payment_status", value: "completed" },
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



