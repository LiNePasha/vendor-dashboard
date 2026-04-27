import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const userRoleCookie = cookieStore.get('userRole')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = decodeToken(token);
    const roles = decoded?.data?.user?.roles || [];
    const isAdmin =
      userRoleCookie === 'admin' ||
      roles.includes('administrator') ||
      roles.includes('shop_manager');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const fetchRoleUsers = async (role) => {
      const url = new URL(`${API_BASE}/wp-json/wp/v2/users`);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('context', 'edit');
      url.searchParams.set('roles', role);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        return [];
      }

      const users = await res.json();
      return Array.isArray(users) ? users : [];
    };

    const [wcfmVendors, wholesaleVendors] = await Promise.all([
      fetchRoleUsers('wcfm_vendor'),
      fetchRoleUsers('wholesale_vendor'),
    ]);

    const usersById = new Map();
    [...wcfmVendors, ...wholesaleVendors].forEach((u) => {
      if (u?.id) usersById.set(u.id, u);
    });

    const vendors = Array.from(usersById.values())
      .map((u) => ({
        id: u.id,
        name: u.name || u.slug || `Vendor #${u.id}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    return NextResponse.json({ vendors });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
