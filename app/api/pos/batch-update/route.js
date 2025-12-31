import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function processUpdate(update, headers, WC_BASE) {
    try {
        // إذا كان هناك variationId استخدم endpoint المتغير
        let url;
        if (update.variationId) {
            url = `${WC_BASE}/products/${update.productId}/variations/${update.variationId}`;
        } else {
            url = `${WC_BASE}/products/${update.productId}`;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ stock_quantity: update.newQuantity })
        });

        const text = await response.text().catch(() => null);
        let data = null;
        if (text) {
            try { 
                data = JSON.parse(text); 
            } catch (e) { 
                data = null; 
            }
        }

        if (response.ok && data?.id) {
            return {
                productId: update.productId,
                variationId: update.variationId,
                status: 'updated',
                newQuantity: update.newQuantity
            };
        }

        // Quick verification if update seems to have failed
        let verifyUrl;
        if (update.variationId) {
            verifyUrl = `${WC_BASE}/products/${update.productId}/variations/${update.variationId}`;
        } else {
            verifyUrl = `${WC_BASE}/products/${update.productId}`;
        }
        const verifyRes = await fetch(verifyUrl, {
            method: 'GET',
            headers
        });
        
        if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData && Number(verifyData.stock_quantity) === Number(update.newQuantity)) {
                return {
                    productId: update.productId,
                    variationId: update.variationId,
                    status: 'updated',
                    newQuantity: update.newQuantity
                };
            }
        }

        return {
            productId: update.productId,
            variationId: update.variationId,
            status: 'failed',
            error: data?.message || `HTTP ${response.status}`,
            raw: text
        };

    } catch (error) {
        return {
            productId: update.productId,
            variationId: update.variationId,
            status: 'failed',
            error: error.message
        };
    }
}

export async function POST(request) {
    try {
        const { updates } = await request.json();
        
        if (!Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
        }

        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
        const WC_BASE = `${API_BASE}/wp-json/wc/v3`;
        
        // Setup authentication headers
        const cookieStore = cookies ? await cookies() : null;
        const token = cookieStore?.get('token')?.value;

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        } else if (process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET) {
            headers.Authorization = `Basic ${Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString('base64')}`;
        }

        // Process updates in parallel with a maximum of 5 concurrent requests
        const batchSize = 5;
        let results = [];

        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(update => processUpdate(update, headers, WC_BASE))
            );
            results = results.concat(batchResults);
        }

        // Count successes and failures
        const successCount = results.filter(r => r.status === 'updated').length;
        const failureCount = results.filter(r => r.status === 'failed').length;

        // Return appropriate status code based on results
        if (failureCount === 0) {
            return NextResponse.json({
                updated: successCount,
                details: results
            });
        }

        return NextResponse.json({
            updated: successCount,
            failed: failureCount,
            details: results
        }, { status: 207 });

    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}