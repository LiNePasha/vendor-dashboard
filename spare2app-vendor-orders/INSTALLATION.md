# Installation Guide

## Manual Installation

### Step 1: Upload Plugin Files

1. Download the `spare2app-vendor-orders` folder
2. Connect to your WordPress site via FTP or File Manager
3. Navigate to `wp-content/plugins/`
4. Upload the entire `spare2app-vendor-orders` folder
5. The structure should look like:
   ```
   wp-content/
   └── plugins/
       └── spare2app-vendor-orders/
           ├── spare2app-vendor-orders.php
           ├── README.md
           ├── readme.txt
           ├── CHANGELOG.md
           ├── INSTALLATION.md
           └── includes/
               └── class-vendor-orders-endpoint.php
   ```

### Step 2: Activate Plugin

1. Log in to WordPress admin dashboard
2. Go to **Plugins** → **Installed Plugins**
3. Find "Spare2App Vendor Orders"
4. Click **Activate**

### Step 3: Verify Installation

1. After activation, you should see a success message
2. Check that no warnings appear about missing dependencies
3. If you see a warning about WooCommerce, install and activate WooCommerce first
4. If you see a warning about WCFM, it's optional but recommended for vendor functionality

### Step 4: Test API Endpoint

You can test the endpoint using curl or Postman:

```bash
curl -X GET "https://yoursite.com/wp-json/spare2app/v1/vendor-orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "orders": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8,
    "has_more": true
  }
}
```

## Requirements Checklist

Before installation, ensure you have:

- [ ] WordPress 5.0 or higher
- [ ] WooCommerce 3.0 or higher (required)
- [ ] WCFM Marketplace plugin (recommended for vendor functionality)
- [ ] PHP 7.4 or higher
- [ ] JWT authentication plugin (e.g., JWT Auth for WP REST API)

## Frontend Integration

After plugin installation, update your Next.js API route:

### File: `app/api/orders/route.js`

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('after');
  const dateTo = searchParams.get('before');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '20';

  // Get token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('spare2app_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build API URL - NOW USING spare2app/v1/vendor-orders
  let apiUrl = `${process.env.NEXT_PUBLIC_API_BASE}/wp-json/spare2app/v1/vendor-orders?per_page=${perPage}&page=${page}`;

  // Add filters
  if (status && status !== 'all') {
    apiUrl += `&status=${encodeURIComponent(status)}`;
  }
  if (search) {
    apiUrl += `&search=${encodeURIComponent(search)}`;
  }
  if (dateFrom) {
    apiUrl += `&after=${encodeURIComponent(dateFrom)}`;
  }
  if (dateTo) {
    apiUrl += `&before=${encodeURIComponent(dateTo)}`;
  }

  // Fetch from WordPress
  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

## Troubleshooting

### Plugin Not Activating

**Problem:** Plugin fails to activate
**Solution:**
1. Check PHP version is 7.4 or higher
2. Ensure WooCommerce is installed and activated
3. Check for PHP errors in WordPress debug log
4. Verify file permissions are correct (644 for files, 755 for directories)

### Dependency Warning

**Problem:** Warning about WooCommerce not installed
**Solution:**
1. Install WooCommerce from Plugins → Add New
2. Activate WooCommerce
3. Try activating Spare2App Vendor Orders again

### API Returns 401 Error

**Problem:** Unauthorized error when calling API
**Solution:**
1. Verify JWT token is valid
2. Check token is being sent in Authorization header
3. Ensure user is logged in
4. Verify JWT Auth plugin is installed and configured

### API Returns 403 Error

**Problem:** Forbidden error when calling API
**Solution:**
1. User must have vendor role (WCFM)
2. Or user must be admin with `manage_woocommerce` capability
3. Check WCFM is installed if using vendor accounts

### No Orders Returned

**Problem:** API returns empty orders array
**Solution:**
1. Check if vendor has orders in WCFM marketplace orders table
2. Verify orders are assigned to the vendor
3. Try removing filters to see all orders
4. Check database table `wp_wcfm_marketplace_orders` exists

### Filters Not Working

**Problem:** Status or search filters return wrong results
**Solution:**
1. This is why we created this plugin! Make sure you're calling `/spare2app/v1/vendor-orders` not `/wcfmmp/v1/orders`
2. Verify parameters are being sent correctly
3. Check the API response in browser dev tools
4. Status should be one of: pending, processing, on-hold, completed, cancelled, refunded, failed

## Uninstallation

To remove the plugin:

1. Deactivate the plugin from WordPress admin
2. Delete the plugin files from `wp-content/plugins/spare2app-vendor-orders`
3. Plugin settings are automatically cleaned up on deactivation

## Support

For issues or questions:
1. Check this installation guide
2. Review the README.md file
3. Check WordPress debug log for errors
4. Contact Spare2App development team

## Next Steps

After successful installation:
1. ✅ Test the API endpoint with Postman or curl
2. ✅ Update your frontend to use the new endpoint
3. ✅ Test all filters (status, search, dates)
4. ✅ Verify pagination works correctly
5. ✅ Test with vendor accounts to ensure proper filtering
