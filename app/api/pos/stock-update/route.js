import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function updateSingleProduct(productId, newQuantity, token, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
    const res = await fetch(
      `${API_BASE}/wp-json/wc/v3/products/${productId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          manage_stock: true,
          stock_quantity: newQuantity
        }),
        signal: controller.signal
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      
      if ((res.status === 503 || res.status === 429) && attempt < 3) {
        const delay = attempt === 1 ? 1000 : 2000;
        await new Promise(r => setTimeout(r, delay));
        return updateSingleProduct(productId, newQuantity, token, attempt + 1);
      }
      
      throw new Error(`API Error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (attempt < 3) {
        return updateSingleProduct(productId, newQuantity, token, attempt + 1);
      }
      throw new Error('Update timeout after 3 attempts');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function processInBatches(updates, token) {
  const batchSize = 3;
  const results = [];
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    const batchPromises = batch.map(({ productId, newQuantity }) => 
      updateSingleProduct(productId, newQuantity, token)
        .then(result => ({ status: 'fulfilled', value: result }))
        .catch(error => ({ status: 'rejected', reason: error }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < updates.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { updates } = await req.json();
    const results = await processInBatches(updates, token);
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    if (failed.length > 0) {
      if (successful.length > 0) {
        return NextResponse.json({
          partialSuccess: true,
          updated: successful.length,
          failed: failed.length,
          errors: failed.map(f => f.reason.message)
        }, { status: 207 });
      }
      
      return NextResponse.json({ 
        error: 'Stock update failed',
        errors: failed.map(f => f.reason.message)
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      updated: successful.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Stock update failed' },
      { status: 500 }
    );
  }
}