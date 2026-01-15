import { cookies } from "next/headers";

/**
 * 🧪 WCFM API Testing Endpoint
 * 
 * يستخدم الـ token من الـ cookies تلقائياً
 * ويجرب كل الـ WCFM endpoints
 */

export async function GET(req) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return new Response(JSON.stringify({ 
      error: "Unauthorized - Please login first" 
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.spare2app.com';
  const { searchParams } = new URL(req.url);
  const testType = searchParams.get('test') || 'all';

  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    // ============================================
    // 1️⃣ TEST: WCFM Orders API
    // ============================================
    if (testType === 'all' || testType === 'orders') {
      console.log('🧪 Testing WCFM Orders API...');
      
      try {
        // Test 1: Get recent orders
        const ordersUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders?per_page=5`;
        const ordersRes = await fetch(ordersUrl, { headers, cache: 'no-store' });
        const ordersData = await ordersRes.json();
        
        results.tests.orders = {
          success: ordersRes.ok,
          status: ordersRes.status,
          endpoint: '/wp-json/wcfmmp/v1/orders',
          count: Array.isArray(ordersData) ? ordersData.length : 0,
          sample: Array.isArray(ordersData) && ordersData.length > 0 ? ordersData[0] : null,
          responseStructure: Array.isArray(ordersData) && ordersData.length > 0 ? Object.keys(ordersData[0]) : [],
        };
        
        // Test 2: Date filter
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const afterDate = sevenDaysAgo.toISOString();
        const dateFilterUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders?after=${encodeURIComponent(afterDate)}&per_page=10`;
        const dateFilterRes = await fetch(dateFilterUrl, { headers, cache: 'no-store' });
        const dateFilterData = await dateFilterRes.json();
        
        results.tests.ordersDateFilter = {
          success: dateFilterRes.ok,
          status: dateFilterRes.status,
          afterDate: afterDate,
          count: Array.isArray(dateFilterData) ? dateFilterData.length : 0,
        };
        
        // Test 3: Get single order
        if (Array.isArray(ordersData) && ordersData.length > 0) {
          const firstOrderId = ordersData[0].id;
          const singleOrderUrl = `${API_BASE}/wp-json/wcfmmp/v1/orders/${firstOrderId}`;
          const singleOrderRes = await fetch(singleOrderUrl, { headers, cache: 'no-store' });
          const singleOrderData = await singleOrderRes.json();
          
          results.tests.singleOrder = {
            success: singleOrderRes.ok,
            status: singleOrderRes.status,
            orderId: firstOrderId,
            hasVendorDetails: singleOrderData?.vendor_order_details ? true : false,
            sample: singleOrderData,
          };
        }
        
      } catch (error) {
        results.tests.orders = {
          success: false,
          error: error.message
        };
      }
    }

    // ============================================
    // 2️⃣ TEST: WCFM Notifications API
    // ============================================
    if (testType === 'all' || testType === 'notifications') {
      console.log('🧪 Testing WCFM Notifications API...');
      
      try {
        // Test 1: Unread order notifications
        const unreadUrl = `${API_BASE}/wp-json/wcfmmp/v1/notifications?notification_type=order&notification_status=unread&per_page=20`;
        const unreadRes = await fetch(unreadUrl, { headers, cache: 'no-store' });
        const unreadData = await unreadRes.json();
        
        results.tests.notifications_unread = {
          success: unreadRes.ok,
          status: unreadRes.status,
          endpoint: '/wp-json/wcfmmp/v1/notifications',
          count: Array.isArray(unreadData) ? unreadData.length : 0,
          sample: Array.isArray(unreadData) && unreadData.length > 0 ? unreadData[0] : null,
          responseStructure: Array.isArray(unreadData) && unreadData.length > 0 ? Object.keys(unreadData[0]) : [],
        };
        
        // Test 2: All notification types
        const allUrl = `${API_BASE}/wp-json/wcfmmp/v1/notifications?notification_type=all&per_page=10`;
        const allRes = await fetch(allUrl, { headers, cache: 'no-store' });
        const allData = await allRes.json();
        
        results.tests.notifications_all = {
          success: allRes.ok,
          status: allRes.status,
          count: Array.isArray(allData) ? allData.length : 0,
          types: Array.isArray(allData) ? [...new Set(allData.map(n => n.message_type))] : [],
        };
        
      } catch (error) {
        results.tests.notifications = {
          success: false,
          error: error.message
        };
      }
    }

    // ============================================
    // 3️⃣ TEST: Vendor Settings API
    // ============================================
    if (testType === 'all' || testType === 'settings') {
      console.log('🧪 Testing WCFM Vendor Settings API...');
      
      try {
        // يحتاج vendor ID - نجربه بـ ID = 2 (مثال)
        const settingsUrl = `${API_BASE}/wp-json/wcfmmp/v1/settings/id/2`;
        const settingsRes = await fetch(settingsUrl, { headers, cache: 'no-store' });
        const settingsData = await settingsRes.json();
        
        results.tests.vendorSettings = {
          success: settingsRes.ok,
          status: settingsRes.status,
          endpoint: '/wp-json/wcfmmp/v1/settings/id/{id}',
          hasSettings: settingsData && typeof settingsData === 'object',
          availableSettings: settingsData ? Object.keys(settingsData) : [],
          sample: settingsData,
        };
        
      } catch (error) {
        results.tests.vendorSettings = {
          success: false,
          error: error.message
        };
      }
    }

    // ============================================
    // 4️⃣ TEST: Restricted Capabilities API
    // ============================================
    if (testType === 'all' || testType === 'capabilities') {
      console.log('🧪 Testing WCFM Restricted Capabilities API...');
      
      try {
        const capUrl = `${API_BASE}/wp-json/wcfmmp/v1/restricted-capabilities`;
        const capRes = await fetch(capUrl, { headers, cache: 'no-store' });
        const capData = await capRes.json();
        
        results.tests.restrictedCapabilities = {
          success: capRes.ok,
          status: capRes.status,
          endpoint: '/wp-json/wcfmmp/v1/restricted-capabilities',
          capabilities: capData,
          restrictedFeatures: capData ? Object.entries(capData).filter(([k, v]) => v === 'yes').map(([k]) => k) : [],
        };
        
      } catch (error) {
        results.tests.restrictedCapabilities = {
          success: false,
          error: error.message
        };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
