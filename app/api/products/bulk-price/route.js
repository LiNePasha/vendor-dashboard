import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
const MAX_BATCH_SIZE = 100;

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

function parseNumber(value, fallback = 0) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function chunkArray(items, size = MAX_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizePrice(value) {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error('Invalid price value');
  }
  return numericValue.toFixed(2);
}

function computeNewPrice(currentPrice, operation, valueType, amount) {
  const current = Math.max(0, parseNumber(currentPrice, 0));

  if (operation === 'set') {
    return Math.max(0, amount);
  }

  if (valueType === 'percentage') {
    const delta = (current * amount) / 100;
    return operation === 'increase'
      ? Math.max(0, current + delta)
      : Math.max(0, current - delta);
  }

  return operation === 'increase'
    ? Math.max(0, current + amount)
    : Math.max(0, current - amount);
}

function getBasePriceForTarget(item, priceTarget) {
  const regularPrice = parseNumber(
    item.current_regular_price ?? item.regular_price ?? item.current_price ?? item.price,
    0
  );
  const salePriceRaw = item.current_sale_price ?? item.sale_price;
  const salePrice = Number.parseFloat(salePriceRaw);

  if (priceTarget === 'sale') {
    return Number.isFinite(salePrice) ? Math.max(0, salePrice) : Math.max(0, regularPrice);
  }

  return Math.max(0, regularPrice);
}

function getPricePlan(item, priceTarget, operation, valueType, amount) {
  const regularBase = Math.max(0, parseNumber(
    item.current_regular_price ?? item.regular_price ?? item.current_price ?? item.price,
    0
  ));

  const saleRaw = item.current_sale_price ?? item.sale_price;
  const parsedSale = Number.parseFloat(saleRaw);
  const hasSale = Number.isFinite(parsedSale);
  const saleBase = hasSale ? Math.max(0, parsedSale) : regularBase;

  if (priceTarget === 'sale') {
    return {
      regular: null,
      sale: computeNewPrice(saleBase, operation, valueType, amount),
      hadSaleBefore: hasSale,
    };
  }

  if (priceTarget === 'both') {
    const shouldUpdateSale = hasSale || operation === 'set';
    return {
      regular: computeNewPrice(regularBase, operation, valueType, amount),
      sale: shouldUpdateSale ? computeNewPrice(saleBase, operation, valueType, amount) : null,
      hadSaleBefore: hasSale,
    };
  }

  return {
    regular: computeNewPrice(regularBase, operation, valueType, amount),
    sale: null,
    hadSaleBefore: hasSale,
  };
}

function buildSimpleUpdatePayload(id, newPrice, priceTarget, clearSaleOnRegular) {
  if (typeof newPrice === 'object' && newPrice !== null) {
    const hasRegular = Number.isFinite(newPrice.regular);
    const hasSale = Number.isFinite(newPrice.sale);

    const payload = { id };
    if (hasRegular) {
      const normalizedRegular = normalizePrice(newPrice.regular);
      payload.regular_price = normalizedRegular;
      payload.price = normalizedRegular;
    }
    if (hasSale) {
      payload.sale_price = normalizePrice(newPrice.sale);
    } else if (priceTarget === 'regular' && clearSaleOnRegular) {
      payload.sale_price = '';
    }
    return payload;
  }

  const normalized = normalizePrice(newPrice);
  if (priceTarget === 'sale') {
    return {
      id,
      sale_price: normalized
    };
  }

  return {
    id,
    regular_price: normalized,
    price: normalized,
    ...(clearSaleOnRegular ? { sale_price: '' } : {})
  };
}

function buildVariationUpdatePayload(id, newPrice, priceTarget, clearSaleOnRegular) {
  if (typeof newPrice === 'object' && newPrice !== null) {
    const hasRegular = Number.isFinite(newPrice.regular);
    const hasSale = Number.isFinite(newPrice.sale);

    const payload = { id };
    if (hasRegular) {
      const normalizedRegular = normalizePrice(newPrice.regular);
      payload.regular_price = normalizedRegular;
      payload.price = normalizedRegular;
    }
    if (hasSale) {
      payload.sale_price = normalizePrice(newPrice.sale);
    } else if (priceTarget === 'regular' && clearSaleOnRegular) {
      payload.sale_price = '';
    }
    return payload;
  }

  const normalized = normalizePrice(newPrice);
  if (priceTarget === 'sale') {
    return {
      id,
      sale_price: normalized
    };
  }

  return {
    id,
    regular_price: normalized,
    price: normalized,
    ...(clearSaleOnRegular ? { sale_price: '' } : {})
  };
}

async function fetchVariationsForProduct(token, productId) {
  const response = await fetch(
    `${API_BASE}/wp-json/wc/v3/products/${productId}/variations?per_page=100`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json().catch(() => []);
  if (!response.ok) {
    const message = data?.message || `Failed to fetch variations for product ${productId}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function callWooBatchEndpoint(token, endpoint, updatePayload) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ update: updatePayload })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || `Woo batch API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function callWooPutEndpoint(token, endpoint, payload) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || `Woo update API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function isPermissionError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.status === 401 ||
    error.status === 403 ||
    msg.includes('غير مسموح') ||
    msg.includes('forbidden') ||
    msg.includes('not allowed')
  );
}

async function fallbackUpdateProductsIndividually(token, simpleProducts) {
  const updatedProducts = [];
  for (const product of simpleProducts) {
    const updated = await callWooPutEndpoint(
      token,
      `/wp-json/wc/v3/products/${product.id}`,
      {
        ...product,
        id: undefined
      }
    );
    updatedProducts.push(updated);
  }
  return updatedProducts;
}

async function fallbackUpdateVariationsIndividually(token, variationGroups) {
  const updatedVariations = [];
  for (const [parentId, variations] of variationGroups.entries()) {
    for (const variation of variations) {
      const updated = await callWooPutEndpoint(
        token,
        `/wp-json/wc/v3/products/${parentId}/variations/${variation.id}`,
        {
          ...variation,
          id: undefined
        }
      );
      updatedVariations.push(updated);
    }
  }
  return updatedVariations;
}

export async function POST(req) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updates = Array.isArray(body?.updates) ? body.updates : [];
    const operation = body?.operation || 'increase';
    const valueType = body?.valueType || 'percentage';
    const amount = parseNumber(body?.value, NaN);
    const priceTarget = ['regular', 'sale', 'both'].includes(body?.priceTarget)
      ? body.priceTarget
      : 'both';
    const clearSaleOnRegular = body?.clearSaleOnRegular !== false;

    if (!['increase', 'decrease', 'set'].includes(operation)) {
      return NextResponse.json({ success: false, error: 'Invalid operation' }, { status: 400 });
    }

    if (!['percentage', 'amount'].includes(valueType)) {
      return NextResponse.json({ success: false, error: 'Invalid valueType' }, { status: 400 });
    }

    // في حالة set مع manual_set_price: يمكن نسمح ب null للقيمة العامة
    const hasValidAmount = Number.isFinite(amount) && amount >= 0;
    if (operation !== 'set' && !hasValidAmount) {
      return NextResponse.json({ success: false, error: 'Invalid value' }, { status: 400 });
    }
    
    // لو set وليس في amount، تأكد أن كل المنتجات فيها manual_set_price
    if (operation === 'set' && !hasValidAmount) {
      const allHaveManual = updates.every(item => 
        Number.isFinite(Number.parseFloat(item.manual_set_price))
      );
      if (!allHaveManual) {
        return NextResponse.json({ 
          success: false, 
          error: 'Supply either a global value or manual_set_price for each product' 
        }, { status: 400 });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'updates array is required' },
        { status: 400 }
      );
    }

    const simpleProducts = [];
    const variationGroups = new Map();
    const applied = [];

    const simpleSeen = new Set();
    const variationSeen = new Set();

    const pushSimpleProduct = (rawItem) => {
      const productId = Number.parseInt(rawItem.id, 10);
      if (!Number.isFinite(productId)) return;

      const dedupeKey = `prod_${productId}`;
      if (simpleSeen.has(dedupeKey)) return;
      simpleSeen.add(dedupeKey);

      const regularBase = parseNumber(
        rawItem.current_regular_price ?? rawItem.regular_price ?? rawItem.current_price ?? rawItem.price,
        0
      );
      const saleRaw = rawItem.current_sale_price ?? rawItem.sale_price;
      const saleParsed = Number.parseFloat(saleRaw);
      const basePrice = getBasePriceForTarget(rawItem, priceTarget);
      const manualSet = Number.parseFloat(rawItem.manual_set_price);
      const effectiveAmount = operation === 'set' && Number.isFinite(manualSet) ? manualSet : amount;
      const plan = getPricePlan(rawItem, priceTarget, operation, valueType, effectiveAmount);

      simpleProducts.push(
        buildSimpleUpdatePayload(productId, plan, priceTarget, clearSaleOnRegular)
      );

      applied.push({
        id: productId,
        is_variation: false,
        price_target: priceTarget,
        old_price: Number(basePrice.toFixed(2)),
        old_regular_price: Number(regularBase.toFixed(2)),
        old_sale_price: Number.isFinite(saleParsed) ? Number(saleParsed.toFixed(2)) : null,
        new_regular_price: Number.isFinite(plan.regular) ? Number(plan.regular.toFixed(2)) : null,
        new_sale_price: Number.isFinite(plan.sale) ? Number(plan.sale.toFixed(2)) : (priceTarget === 'regular' && clearSaleOnRegular ? '' : null),
      });
    };

    const pushVariation = (parentId, variationData) => {
      const parsedParentId = Number.parseInt(parentId, 10);
      const variationId = Number.parseInt(variationData?.variation_id ?? variationData?.id, 10);

      if (!Number.isFinite(parsedParentId) || !Number.isFinite(variationId)) return;

      const dedupeKey = `${parsedParentId}_var_${variationId}`;
      if (variationSeen.has(dedupeKey)) return;
      variationSeen.add(dedupeKey);

      if (!variationGroups.has(parsedParentId)) {
        variationGroups.set(parsedParentId, []);
      }

      const regularBase = parseNumber(
        variationData.current_regular_price ?? variationData.regular_price ?? variationData.current_price ?? variationData.price,
        0
      );
      const saleRaw = variationData.current_sale_price ?? variationData.sale_price;
      const saleParsed = Number.parseFloat(saleRaw);
      const basePrice = getBasePriceForTarget(variationData, priceTarget);
      const manualSet = Number.parseFloat(variationData.manual_set_price);
      const effectiveAmount = operation === 'set' && Number.isFinite(manualSet) ? manualSet : amount;
      const plan = getPricePlan(variationData, priceTarget, operation, valueType, effectiveAmount);

      variationGroups.get(parsedParentId).push(
        buildVariationUpdatePayload(variationId, plan, priceTarget, clearSaleOnRegular)
      );

      applied.push({
        parent_id: parsedParentId,
        variation_id: variationId,
        is_variation: true,
        price_target: priceTarget,
        old_price: Number(basePrice.toFixed(2)),
        old_regular_price: Number(regularBase.toFixed(2)),
        old_sale_price: Number.isFinite(saleParsed) ? Number(saleParsed.toFixed(2)) : null,
        new_regular_price: Number.isFinite(plan.regular) ? Number(plan.regular.toFixed(2)) : null,
        new_sale_price: Number.isFinite(plan.sale) ? Number(plan.sale.toFixed(2)) : (priceTarget === 'regular' && clearSaleOnRegular ? '' : null),
      });
    };

    for (const item of updates) {
      if (item.is_variation || item.variation_id) {
        pushVariation(item.parent_id, item);
        continue;
      }

      const productId = Number.parseInt(item.id, 10);
      if (!Number.isFinite(productId)) continue;

      if (item.type === 'variable') {
        const variations = await fetchVariationsForProduct(token, productId);
        for (const variation of variations) {
          pushVariation(productId, {
            id: variation.id,
            regular_price: variation.regular_price,
            sale_price: variation.sale_price,
            price: variation.price,
            manual_set_price: item.manual_set_price
          });
        }
        continue;
      }

      pushSimpleProduct(item);
    }

    let updatedProducts = [];
    let updatedVariations = [];
    let usedFallback = false;

    try {
      for (const chunk of chunkArray(simpleProducts)) {
        const result = await callWooBatchEndpoint(token, '/wp-json/wc/v3/products/batch', chunk);
        updatedProducts.push(...(Array.isArray(result?.update) ? result.update : []));
      }

      for (const [parentId, variations] of variationGroups.entries()) {
        for (const chunk of chunkArray(variations)) {
          const result = await callWooBatchEndpoint(
            token,
            `/wp-json/wc/v3/products/${parentId}/variations/batch`,
            chunk
          );
          updatedVariations.push(...(Array.isArray(result?.update) ? result.update : []));
        }
      }
    } catch (batchError) {
      if (!isPermissionError(batchError)) {
        throw batchError;
      }

      console.warn('⚠️ Batch endpoint not permitted, falling back to individual updates...');
      usedFallback = true;
      updatedProducts = await fallbackUpdateProductsIndividually(token, simpleProducts);
      updatedVariations = await fallbackUpdateVariationsIndividually(token, variationGroups);
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedProducts.length + updatedVariations.length,
      priceTarget,
      mode: usedFallback ? 'fallback-individual' : 'batch',
      applied,
      updatedProducts,
      updatedVariations
    });
  } catch (error) {
    console.error('❌ Bulk price update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update prices' },
      { status: 500 }
    );
  }
}