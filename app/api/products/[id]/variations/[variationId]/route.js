import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function PUT(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, variationId } = await params;
    const body = await req.json();

    // Update variation via WooCommerce API
    const response = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}/variations/${variationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to update variation' },
        { status: response.status }
      );
    }

    const variation = await response.json();
    return NextResponse.json({ success: true, variation });
  } catch (error) {
    console.error('Error updating variation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, variationId } = await params;

    console.log(`🗑️ Attempting to delete variation ${variationId} from product ${id}`);

    // Delete variation via WooCommerce API
    const response = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}/variations/${variationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // Add force=true to permanently delete
      params: { force: true }
    });

    const responseText = await response.text();
    console.log(`WooCommerce response status: ${response.status}`);
    console.log(`WooCommerce response:`, responseText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }
      console.error('❌ WooCommerce error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to delete variation' },
        { status: response.status }
      );
    }

    const result = JSON.parse(responseText);
    console.log('✅ Variation deleted successfully');
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error deleting variation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
