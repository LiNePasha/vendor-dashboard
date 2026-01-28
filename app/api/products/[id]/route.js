import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET: جلب منتج واحد بالتفصيل
 * Query params: include_variations=true لجلب الـ variations
 */
export async function GET(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeVariations = searchParams.get('include_variations') === 'true';

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // 1. Fetch product details
    const productRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!productRes.ok) {
      throw new Error('Failed to fetch product');
    }

    let product = await productRes.json();

    // 2. Format product data
    const formattedProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      type: product.type,
      status: product.status,
      sku: product.sku,
      price: product.price,
      regular_price: product.regular_price,
      sale_price: product.sale_price,
      stock_quantity: product.stock_quantity,
      stock_status: product.stock_status,
      manage_stock: product.manage_stock,
      description: product.description,
      short_description: product.short_description,
      images: product.images || [],
      categories: product.categories || [],
      tags: product.tags || [],
      attributes: product.attributes || [],
      meta_data: product.meta_data || []
    };

    // Extract purchase price from meta_data
    const purchasePriceMeta = product.meta_data?.find(m => m.key === '_purchase_price');
    if (purchasePriceMeta) {
      formattedProduct.purchase_price = purchasePriceMeta.value;
    }

    // 3. Fetch variations if requested and product is variable
    if (includeVariations && product.type === 'variable') {
      try {
        const variationsRes = await fetch(
          `${API_BASE}/wp-json/wc/v3/products/${id}/variations?per_page=100`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (variationsRes.ok) {
          const variations = await variationsRes.json();
          
          formattedProduct.variations = variations.map(v => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            regular_price: v.regular_price,
            sale_price: v.sale_price,
            stock_quantity: v.stock_quantity,
            stock_status: v.stock_status,
            manage_stock: v.manage_stock,
            attributes: v.attributes,
            image: v.image,
            description: v.attributes.map(a => a.option).join(' - ')
          }));
          
          formattedProduct.variations_count = variations.length;
        }
      } catch (err) {
        console.error('Error fetching variations:', err);
        formattedProduct.variations = [];
      }
    }

    return NextResponse.json({
      success: true,
      product: formattedProduct
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch product' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH: تحديث منتج موجود
 * Body: product data to update
 */
export async function PATCH(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    // 🔥 Fetch current product to compare images
    let currentProduct = null;
    try {
      const productRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (productRes.ok) {
        currentProduct = await productRes.json();
      }
    } catch (err) {
      console.error('Failed to fetch current product:', err);
    }

    // Build update payload
    const updatePayload = {};

    if (body.name) updatePayload.name = body.name;
    if (body.sku) updatePayload.sku = body.sku;

    // 🔥 Handle product type
    if (body.type) updatePayload.type = body.type;

    // 🔥 Handle attributes for variable products
    if (body.attributes && Array.isArray(body.attributes)) {
      updatePayload.attributes = body.attributes;
    }

    // Only set prices for simple products
    if (body.type !== 'variable') {
      if (body.sellingPrice) updatePayload.regular_price = String(body.sellingPrice);
      if (body.stock !== undefined) {
        updatePayload.stock_quantity = Number(body.stock);
        updatePayload.manage_stock = true; // 🆕 تفعيل إدارة المخزون تلقائياً
      }
      // Handle salePrice - allow empty string to clear it
      if (body.salePrice !== undefined) {
        const salePriceValue = String(body.salePrice || '').trim();
        updatePayload.sale_price = salePriceValue;
      }
    }

    if (body.categories) updatePayload.categories = body.categories.map(catId => ({ id: parseInt(catId) }));

    // 🔥 دعم images مع منع التكرار
    // Only update images if they actually changed
    if (Array.isArray(body.images) && body.images.length > 0) {
      const currentImages = currentProduct?.images?.map(img => img.src) || [];
      const newImages = body.images;
      
      // Compare arrays - only update if different
      const imagesChanged = 
        currentImages.length !== newImages.length ||
        !currentImages.every((src, idx) => src === newImages[idx]);
      
      if (imagesChanged) {
        updatePayload.images = newImages.map(src => ({ src }));
      }
    } else if (body.imageUrl) {
      // دعم القديم imageUrl
      const currentImageUrl = currentProduct?.images?.[0]?.src;
      if (currentImageUrl !== body.imageUrl) {
        updatePayload.images = [{ src: body.imageUrl }];
      }
    }

    // Add purchase price to meta_data
    if (body.purchasePrice !== undefined) {
      updatePayload.meta_data = [
        { key: '_purchase_price', value: String(body.purchasePrice) }
      ];
    }

    // Update product
    const updateRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json();
      throw new Error(errorData.message || 'Failed to update product');
    }

    const updatedProduct = await updateRes.json();

    return NextResponse.json({
      success: true,
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to update product' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: حذف منتج
 */
export async function DELETE(req, { params }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';

    const deleteRes = await fetch(`${API_BASE}/wp-json/wc/v3/products/${id}?force=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!deleteRes.ok) {
      throw new Error('Failed to delete product');
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to delete product' 
      },
      { status: 500 }
    );
  }
}
