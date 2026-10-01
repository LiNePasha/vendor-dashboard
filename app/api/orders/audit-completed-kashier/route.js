import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";
const KASHIER_V3 = "https://api.kashier.io/v3/payment/orders";
const UNPAID_STATUSES = new Set([
  "PENDING",
  "FAILED",
  "DECLINED",
  "AUTHORIZED",
  "EXPIRED",
  "CANCELLED",
  "VOIDED",
  "INITIATED",
]);

function getExactMerchantOrder(orderList, requestedOrderId) {
  const entries = Array.isArray(orderList) ? orderList : orderList ? [orderList] : [];
  return entries.find((entry) => {
    const refs = [
      entry?.merchantOrderId,
      entry?.merchant_order_id,
      entry?.orderReference,
      entry?.order_reference,
      entry?.merchantOrderNumber,
      entry?.merchant_order_number,
    ];
    return refs.some((value) => value !== undefined && value !== null && String(value).trim() === String(requestedOrderId));
  }) || null;
}

async function inspectCompletedOrder(orderId, expectedTransactionId, token, apiPassword) {
  const normalizedExpectedTx = String(expectedTransactionId || "").trim().toUpperCase();
  if (!/^TX-\d+$/.test(normalizedExpectedTx)) {
    return { orderId, result: "excluded", message: "كود المعاملة ليس بصيغة TX-رقم" };
  }

  try {
    const orderRes = await fetch(`${API_BASE}/wp-json/wcfmmp/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!orderRes.ok) {
      return { orderId, result: "review", message: "تعذر قراءة الأوردر أو لا توجد صلاحية" };
    }

    const payload = await orderRes.json();
    const order = payload?.order || payload;
    if (String(order?.id) !== String(orderId)) {
      return { orderId, result: "review", message: "رقم الأوردر لا يطابق السجل" };
    }
    if (String(order.status || "").toLowerCase() !== "completed") {
      return { orderId, result: "review", message: "الأوردر لم يعد مكتملًا وقت الفحص" };
    }
    if (!String(order.payment_method || "").toLowerCase().includes("kashier")) {
      return { orderId, result: "excluded", message: "وسيلة الدفع ليست Kashier" };
    }

    const paymentRes = await fetch(`${KASHIER_V3}?search=${encodeURIComponent(orderId)}`, {
      headers: {
        Authorization: apiPassword,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!paymentRes.ok) {
      return { orderId, result: "review", message: `تعذر فحص Kashier (HTTP ${paymentRes.status})` };
    }

    const paymentPayload = await paymentRes.json();
    const paymentOrder = getExactMerchantOrder(paymentPayload?.data, orderId);
    const customerName = `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim() || "عميل";
    const total = Number(order.total || 0);
    const shipping = Number(order.shipping_total || 0);
    const common = {
      orderId: String(order.id),
      orderNumber: String(order.number || order.id),
      expectedTransactionId: normalizedExpectedTx,
      customerName,
      phone: order.billing?.phone || "",
      dateCreated: order.date_created || "",
      total,
      shipping,
      productAmount: Math.max(0, total - shipping),
    };

    if (!paymentOrder) {
      return {
        ...common,
        result: "review",
        message: "لم يوجد سجل Kashier مطابق حرفيًا لرقم الأوردر",
        paymentStatus: "NOT_FOUND",
      };
    }

    const paymentStatus = String(paymentOrder.status || "").toUpperCase();
    const transactions = Array.isArray(paymentOrder.transactions) ? paymentOrder.transactions : [];
    const matchingTransaction = transactions.find((transaction) =>
      String(transaction?.transactionId || "").trim().toUpperCase() === normalizedExpectedTx
    );

    if (!matchingTransaction) {
      return {
        ...common,
        result: "excluded",
        message: "كود TX غير موجود ضمن معاملات هذا الأوردر في Kashier",
        paymentStatus,
      };
    }

    const isSuccessfulCapture =
      String(matchingTransaction.status || "").toUpperCase() === "SUCCESS" &&
      String(matchingTransaction.operation || "").toLowerCase() !== "3dsecure_verify";
    const isCaptured = paymentStatus === "CAPTURED" && isSuccessfulCapture;

    if (isCaptured) {
      return {
        ...common,
        result: "paid",
        message: "تم تأكيد الدفع من Kashier",
        paymentStatus,
        transactionId: matchingTransaction.transactionId,
      };
    }

    if (UNPAID_STATUSES.has(paymentStatus)) {
      return {
        ...common,
        result: "unpaid",
        message: "كود TX مطابق، وKashier يؤكد عدم اكتمال الدفع",
        paymentStatus,
        transactionId: matchingTransaction.transactionId,
      };
    }

    return {
      ...common,
      result: "review",
      message: paymentStatus
        ? `حالة غير حاسمة من Kashier: ${paymentStatus}`
        : "لا توجد حالة دفع واضحة من Kashier",
      paymentStatus: paymentStatus || "UNKNOWN",
      transactionId: "",
    };
  } catch (error) {
    return { orderId, result: "review", message: `خطأ أثناء الفحص: ${error.message}` };
  }
}

export async function POST(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orders, apiPassword } = body || {};
  if (!Array.isArray(orders) || orders.length === 0 || orders.length > 40 || !apiPassword) {
    return Response.json({ error: "أرسل من 1 إلى 40 أوردر مع أكواد TX وإعداد Kashier" }, { status: 400 });
  }
  if (orders.some((item) =>
    !/^\d+$/.test(String(item?.orderId || "")) || !/^TX-\d+$/i.test(String(item?.transactionId || "").trim())
  )) {
    return Response.json({ error: "كل أوردر لازم يكون له رقم صحيح وكود TX صالح" }, { status: 400 });
  }

  const uniqueOrders = [...new Map(orders.map(item => [String(item.orderId), {
    orderId: String(item.orderId),
    transactionId: String(item.transactionId).trim(),
  }])).values()];
  const results = [];
  // Limit concurrency to avoid rate-limiting Kashier or the store API.
  for (let offset = 0; offset < uniqueOrders.length; offset += 5) {
    const batch = uniqueOrders.slice(offset, offset + 5);
    results.push(...await Promise.all(batch.map((item) => inspectCompletedOrder(item.orderId, item.transactionId, token, apiPassword))));
  }

  const excluded = results.filter((row) => row?.result === "excluded").length;
  const rows = results.filter((row) => row && row.result !== "excluded");
  return Response.json({
    checked: rows.length,
    excluded,
    paid: rows.filter((row) => row.result === "paid").length,
    unpaid: rows.filter((row) => row.result === "unpaid").length,
    review: rows.filter((row) => row.result === "review").length,
    confirmedUnpaidTotal: rows
      .filter((row) => row.result === "unpaid")
      .reduce((sum, row) => sum + Number(row.productAmount || 0), 0),
    rows,
  });
}
