import { cookies } from "next/headers";

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');
    const search = searchParams.get('search') || '';
    const perPage = searchParams.get('per_page') || '50';
    const page = searchParams.get('page') || '1';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    
    // Single customer endpoint
    if (customerId) {
      const singleCustomerUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-customers/${encodeURIComponent(customerId)}`;
      const res = await fetch(singleCustomerUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: `API Error ${res.status}` }), {
          status: res.status,
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), { status: 200 });
    }
    
    // List customers endpoint
    let apiUrl = `${API_BASE}/wp-json/spare2app/v1/vendor-customers?per_page=${perPage}&page=${page}`;
    
    if (search) {
      apiUrl += `&search=${encodeURIComponent(search)}`;
    }

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API Error ${res.status}` }), {
        status: res.status,
      });
    }

    const data = await res.json();
    
    const customers = data.customers || (Array.isArray(data) ? data : []);
    const paginationInfo = data.pagination || {};
    
    console.log('👥 Customers returned from Spare2App API:', {
      count: customers.length,
      pagination: paginationInfo,
    });
    
    const total = paginationInfo.total || customers.length;
    const totalPages = paginationInfo.total_pages || 1;
    const hasMore = paginationInfo.has_more || false;
    
    const response = {
      customers: customers,
      total: total,
      page: parseInt(page),
      per_page: parseInt(perPage),
      total_pages: totalPages,
      has_more: hasMore,
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
