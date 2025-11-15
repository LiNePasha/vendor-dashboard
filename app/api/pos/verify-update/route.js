import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
    try {
        const { updates } = await request.json();
        
        if (!Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
        }

        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
        const WC_BASE = `${API_BASE}/wp-json/wc/v3`;

        // Read token from cookies (if present) to support session-based auth
        const cookieStore = cookies ? await cookies() : null;
        const token = cookieStore?.get('token')?.value;

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        } else if (process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET) {
            headers.Authorization = `Basic ${Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString('base64')}`;
        }

        // Verify all products in parallel
        const verifyPromises = updates.map(async (update) => {
            try {
                const response = await fetch(`${WC_BASE}/products/${update.productId}`, {
                    method: 'GET',
                    headers
                });

                const data = await response.json();

                if (response.ok && data && typeof data.stock_quantity !== 'undefined') {
                    const currentStock = Number(data.stock_quantity);
                    const expectedStock = Number(update.newQuantity);

                    return {
                        productId: update.productId,
                        status: currentStock === expectedStock ? 'verified' : 'mismatch',
                        currentStock,
                        expectedStock
                    };
                }

                return {
                    productId: update.productId,
                    status: 'failed',
                    error: data?.message || `HTTP ${response.status}`
                };

            } catch (error) {
                return {
                    productId: update.productId,
                    status: 'failed',
                    error: error.message
                };
            }
        });

        const results = await Promise.all(verifyPromises);

        // Count results
        const verifiedCount = results.filter(r => r.status === 'verified').length;
        const mismatchCount = results.filter(r => r.status === 'mismatch').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        return NextResponse.json({
            verified: verifiedCount,
            mismatched: mismatchCount,
            failed: failedCount,
            details: results
        });

    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}