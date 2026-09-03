import { cookies } from "next/headers";

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";
    const sourceFilter = searchParams.get("source_filter") || "spare2app";
    const vendorId = searchParams.get("vendor_id") || "";
    const after = searchParams.get("after") || "";
    const before = searchParams.get("before") || "";
    const paidOnly = searchParams.get("paid_only") || '';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.spare2app.com";

    const params = new URLSearchParams({ period, source_filter: sourceFilter });
    if (vendorId) params.set("vendor_id", vendorId);
    if (after) params.set("after", after);
    if (before) params.set("before", before);
    if (paidOnly) params.set("paid_only", paidOnly);

    const apiUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-orders/spare2app-fees-report?${params.toString()}`;

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      return new Response(
        JSON.stringify({
          error: `API Error ${res.status}`,
          details,
        }),
        { status: res.status }
      );
    }

    const data = await res.json();

    const debug = searchParams.get("debug") === '1';

    // Enrich rows with normalized Kashier info + debug flags
    const enriched = (data?.rows || []).map((r) => {
      const txMeta = Array.isArray(r.meta_data) ? r.meta_data.find((m) => m.key === '_kashier_transaction_id') : null;
      const statusMeta = Array.isArray(r.meta_data) ? r.meta_data.find((m) => m.key === '_kashier_payment_status') : null;
      const tx = r._kashier_transaction_id || (txMeta && txMeta.value) || '';
      const status = r._kashier_payment_status || (statusMeta && statusMeta.value) || '';
      const paymentMethod = (r.payment_method || r.payment_method_title || '').toString().toLowerCase();
      const orderAmount = Number(r.order_amount || 0);
      const totalPaid = Number(r.total_paid || 0);
      const paidEnough = totalPaid >= orderAmount - 0.009;
      const statusNorm = (status || '').toString().toLowerCase();
      // Stricter Kashier detection: prefer explicit transaction id or payment method containing 'kashier'.
      // Do NOT treat vague status strings like 'success' or 'paid' alone as proof of Kashier payment.
      const hasTx = tx && String(tx).trim() !== '';
      const isKashierMethod = paymentMethod.includes('kashier') || hasTx;
      const orderStatus = (r.status || r.order_status || r.order_status_name || '').toString().toLowerCase();

      return {
        ...r,
        _kashier_transaction_id: tx,
        _kashier_payment_status: status,
        _payment_method_norm: paymentMethod,
        _debug: { paidEnough, isKashierMethod, hasTx, statusNorm, orderStatus, orderAmount, totalPaid }
      };
    });

    // If the caller requested paid-only, filter rows to include only strictly Kashier-paid orders
    if (paidOnly === '1') {
      const afterDate = after ? new Date(after) : null;
      const beforeDate = before ? new Date(before) : null;

      // Strict policy: require explicit Kashier transaction id (hasTx) AND paidEnough.
      const filtered = enriched.filter((r) => {
        const { paidEnough, hasTx } = r._debug || { paidEnough: false, hasTx: false };
        if (!paidEnough || !hasTx) return false;
        if (afterDate || beforeDate) {
          const created = r.date_created ? new Date(r.date_created) : null;
          if (!created) return false;
          if (afterDate && created < afterDate) return false;
          if (beforeDate && created > beforeDate) return false;
        }
        return true;
      });

      const summary = {
        total_orders: filtered.length,
        total_order_amount: filtered.reduce((s, x) => s + Number(x.order_amount || 0), 0),
        total_paid: filtered.reduce((s, x) => s + Number(x.total_paid || 0), 0),
        total_fees_above_order: filtered.reduce((s, x) => s + Number(x.fees_above_order || 0), 0),
        total_service_fee: filtered.reduce((s, x) => s + Number(x.service_fee || 0), 0),
        total_transfer_fee: filtered.reduce((s, x) => s + Number(x.transfer_fee || 0), 0),
        mismatch_count: filtered.filter((r) => (Number(r.fee_diff || 0) > 0.009)).length,
      };

      const payload = { ...data, rows: filtered, summary };
      if (debug) payload.debug_rows = enriched;
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    const payload = { ...data, rows: enriched };
    if (debug) payload.debug_rows = enriched;
    return new Response(JSON.stringify(payload), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
