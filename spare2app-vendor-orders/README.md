# Spare2App Vendor Orders

WordPress plugin that provides enhanced REST API endpoints for WCFM vendor orders with proper filtering support.

## Features

- ✅ **Server-Side Filtering**: Status, search, and date range filters work correctly
- ✅ **Vendor-Specific**: Only shows orders belonging to the authenticated vendor
- ✅ **Pagination**: Proper pagination with total count and "has more" indicator
- ✅ **Search**: Search by order ID, customer name, or phone number
- ✅ **Date Filtering**: Filter orders by date range
- ✅ **Full Order Details**: Complete order information including line items and meta data
- ✅ **Secure**: JWT authentication and vendor permission checks

## Requirements

- WordPress 5.0+
- WooCommerce 3.0+
- WCFM Marketplace (optional, but recommended)
- PHP 7.4+

## Installation

1. Download or clone this repository
2. Upload to `wp-content/plugins/spare2app-vendor-orders`
3. Activate the plugin through the 'Plugins' menu in WordPress
4. The API endpoint will be available at `/wp-json/spare2app/v1/vendor-orders`

## API Endpoints

### Get Vendor Orders

**Endpoint:** `GET /wp-json/spare2app/v1/vendor-orders`

**Authentication:** Bearer token (JWT)

**Query Parameters:**
- `status` (string): Filter by order status (pending, processing, on-hold, completed, cancelled, refunded, failed)
- `search` (string): Search in order ID, customer name, or phone
- `after` (string): Filter orders after this date (ISO 8601 format)
- `before` (string): Filter orders before this date (ISO 8601 format)
- `per_page` (integer): Number of orders per page (default: 20, max: 100)
- `page` (integer): Current page number (default: 1)

**Example Request:**
```bash
curl -X GET "https://yoursite.com/wp-json/spare2app/v1/vendor-orders?status=processing&per_page=20&page=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 123,
      "number": "123",
      "status": "processing",
      "currency": "EGP",
      "date_created": "2024-01-15 10:30:00",
      "date_modified": "2024-01-15 10:30:00",
      "total": "500.00",
      "total_tax": "0.00",
      "shipping_total": "50.00",
      "payment_method": "cod",
      "payment_method_title": "Cash on Delivery",
      "customer_note": "",
      "billing": {
        "first_name": "Ahmed",
        "last_name": "Mohamed",
        "phone": "01234567890",
        "email": "ahmed@example.com",
        "address_1": "123 Street",
        "city": "Cairo",
        "country": "EG"
      },
      "shipping": {
        "first_name": "Ahmed",
        "last_name": "Mohamed",
        "address_1": "123 Street",
        "city": "Cairo",
        "country": "EG"
      },
      "line_items": [
        {
          "id": 456,
          "name": "Product Name",
          "product_id": 789,
          "variation_id": 0,
          "quantity": 2,
          "subtotal": "400.00",
          "total": "400.00",
          "sku": "PROD-123"
        }
      ],
      "meta_data": []
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8,
    "has_more": true
  }
}
```

### Get Single Order

**Endpoint:** `GET /wp-json/spare2app/v1/vendor-orders/{id}`

**Authentication:** Bearer token (JWT)

**Example Request:**
```bash
curl -X GET "https://yoursite.com/wp-json/spare2app/v1/vendor-orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Frontend Integration

### Using with Next.js API Route

```javascript
// app/api/orders/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '20';
  
  let apiUrl = `${process.env.NEXT_PUBLIC_API_BASE}/wp-json/spare2app/v1/vendor-orders?per_page=${perPage}&page=${page}`;
  
  if (status && status !== 'all') {
    apiUrl += `&status=${encodeURIComponent(status)}`;
  }
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

### Using with React + Zustand

```javascript
// stores/pos-store.js
fetchOrders: async (filters = {}) => {
  const { status, search, dateFrom, dateTo, page = 1, append = false } = filters;
  
  let url = `/api/orders?page=${page}&per_page=20`;
  if (status && status !== 'all') url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (dateFrom) url += `&after=${dateFrom}`;
  if (dateTo) url += `&before=${dateTo}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (append && page > 1) {
    set(state => ({
      orders: [...state.orders, ...data.orders]
    }));
  } else {
    set({ orders: data.orders });
  }
  
  return {
    total_pages: data.pagination.total_pages,
    has_more: data.pagination.has_more
  };
}
```

## Troubleshooting

### Orders not showing

1. Make sure WCFM Marketplace is installed and activated
2. Verify that the vendor has orders assigned to them in the WCFM orders table
3. Check that the JWT token is valid and the user is authenticated as a vendor

### Filters not working

1. Verify you're using the correct status values: `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`
2. Date filters should be in ISO 8601 format (e.g., `2024-01-15T00:00:00`)
3. Check the WordPress debug log for any errors

### Permission errors

1. Make sure the user is logged in and has a valid JWT token
2. Verify the user has the vendor role (WCFM)
3. Admins with `manage_woocommerce` capability can see all orders

## Changelog

### Version 1.0.0
- Initial release
- Vendor orders endpoint with filtering
- Search functionality
- Date range filtering
- Pagination support
- Single order endpoint

## Support

For issues and feature requests, please contact the development team.

## License

This plugin is proprietary software developed for Spare2App.
