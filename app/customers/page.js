"use client";

import { useState, useEffect, useMemo } from "react";
import usePOSStore from "@/app/stores/pos-store";
import { useRouter } from "next/navigation";
import offlineCustomersStorage from "@/app/lib/offline-customers-storage";
import CustomerModal from "@/components/CustomerModal";

export default function CustomersPage() {
  const router = useRouter();
  const fetchCustomersFromAPI = usePOSStore((state) => state.fetchCustomersFromAPI);
  const fetchCustomersStatsFromAPI = usePOSStore((state) => state.fetchCustomersStatsFromAPI);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // all, active, inactive
  const [typeFilter, setTypeFilter] = useState("all"); // all, online, offline
  const [sortBy, setSortBy] = useState("total_spent"); // total_spent, orders_count, last_order_date
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [offlineCustomers, setOfflineCustomers] = useState([]);
  const [onlineCustomers, setOnlineCustomers] = useState([]); // 🆕 من الـ API
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    active: 0,
    total_revenue: 0,
    average_order_value: 0
  });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  
  // 🆕 Pagination state for online customers
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 🆕 Fetch online customers from API
  const loadOnlineCustomers = async (page = 1, append = false) => {
    try {
      const result = await fetchCustomersFromAPI({
        search: searchTerm,
        per_page: 50,
        page: page,
      });
      
      if (result.success) {
        const customers = result.customers.map(c => ({
          ...c,
          type: 'online',
          source: 'الموقع'
        }));
        
        if (append) {
          setOnlineCustomers(prev => [...prev, ...customers]);
        } else {
          setOnlineCustomers(customers);
        }
        
        setTotalPages(result.pagination.totalPages);
        setHasMore(result.pagination.hasMore);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error loading online customers:', error);
    }
  };
  
  // 🆕 Load stats from API
  const loadStats = async () => {
    try {
      const result = await fetchCustomersStatsFromAPI();
      if (result.success) {
        const apiStats = result.stats;
        
        // Combine with offline customers
        const offlineActive = offlineCustomers.filter(c => c.totalOrders > 0).length;
        const offlineRevenue = offlineCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        
        setStats({
          total: apiStats.total_customers + offlineCustomers.length,
          online: apiStats.total_customers,
          offline: offlineCustomers.length,
          active: apiStats.active_customers + offlineActive,
          total_revenue: apiStats.total_revenue + offlineRevenue,
          average_order_value: apiStats.average_order_value,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadOfflineCustomers();
      await loadOnlineCustomers(1, false);
      await loadStats();
      setLoading(false);
    };
    loadData();
  }, []);
  
  // Reload when search changes
  useEffect(() => {
    if (!loading) {
      loadOnlineCustomers(1, false);
    }
  }, [searchTerm]);

  const loadOfflineCustomers = async () => {
    const customers = await offlineCustomersStorage.getAllOfflineCustomers();
    setOfflineCustomers(customers);
  };
  
  // 🆕 Load more online customers
  const loadMoreCustomers = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadOnlineCustomers(currentPage + 1, true);
    setLoadingMore(false);
  };

  // 🆕 جلب طلبات العميل الأوفلاين من LocalForage
  useEffect(() => {
    const loadCustomerInvoices = async () => {
      if (selectedCustomer && selectedCustomer.type === 'offline') {
        try {
          const localforage = (await import('localforage')).default;
          localforage.config({ name: 'vendor-pos', storeName: 'invoices' });
          const allInvoices = await localforage.getItem('invoices') || [];
          
          // فلترة الفواتير بتاعة هذا العميل
          const customerOrders = allInvoices
            .filter(inv => 
              inv.orderType === 'delivery' && 
              inv.delivery?.customer?.id === selectedCustomer.id
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          
          setCustomerInvoices(customerOrders);
        } catch (error) {
          console.error('Error loading customer invoices:', error);
          setCustomerInvoices([]);
        }
      } else {
        setCustomerInvoices([]);
      }
    };
    
    loadCustomerInvoices();
  }, [selectedCustomer]);

  // Get online customers from orders - REMOVED, now using API
  // const onlineCustomers = useMemo(() => getCustomers(), [orders]);
  
  // دمج العملاء الأونلاين والأوفلاين
  const allCustomers = useMemo(() => {
    const online = onlineCustomers; // Already formatted from API
    const offline = offlineCustomers.map(c => { 
      const totalSpent = c.totalSpent || 0;
      const ordersCount = c.totalOrders || 0;
      const averageOrder = ordersCount > 0 ? totalSpent / ordersCount : 0;
      
      return {
        ...c, 
        type: 'offline',
        source: 'محلي',
        total_spent: totalSpent,
        orders_count: ordersCount,
        average_order: averageOrder,
        last_order_date: c.lastOrderAt || c.updatedAt
      };
    });
    return [...online, ...offline];
  }, [onlineCustomers, offlineCustomers]);

  // Stats are now loaded from API - removed calculation from useMemo

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = allCustomers;

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((c) => c.type === typeFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "total_spent") return (b.total_spent || 0) - (a.total_spent || 0);
      if (sortBy === "orders_count") return (b.orders_count || 0) - (a.orders_count || 0);
      if (sortBy === "last_order_date")
        return new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0);
      return 0;
    });

    return filtered;
  }, [allCustomers, searchTerm, statusFilter, sortBy, typeFilter]);

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowCustomerModal(true);
  };

  const handleEditCustomer = (customer) => {
    if (customer.type === 'offline') {
      setEditingCustomer(customer);
      setShowCustomerModal(true);
    } else {
      alert('لا يمكن تعديل العملاء من وردبريس');
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (customer.type === 'offline') {
      if (confirm(`هل تريد حذف العميل "${customer.name}"؟`)) {
        try {
          await offlineCustomersStorage.deleteOfflineCustomer(customer.id);
          await loadOfflineCustomers();
          alert('✅ تم حذف العميل بنجاح');
        } catch (error) {
          alert('❌ فشل في حذف العميل');
        }
      }
    } else {
      alert('لا يمكن حذف العملاء من وردبريس');
    }
  };

  const handleCustomerSaved = async () => {
    await loadOfflineCustomers();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <span className="text-4xl">👥</span>
              العملاء
            </h1>
            <p className="text-gray-600">
              {loading
                ? "جاري التحميل..."
                : `${allCustomers.length} عميل - ${stats.online} أونلاين، ${stats.offline} أوفلاين`}
            </p>
          </div>
          <button
            onClick={handleAddCustomer}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold transition-all shadow-lg flex items-center gap-2"
          >
            <span className="text-xl">➕</span>
            إضافة عميل
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">إجمالي العملاء</div>
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">عملاء أونلاين</div>
            <div className="text-2xl font-bold text-blue-600">{stats.online}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">عملاء أوفلاين</div>
            <div className="text-2xl font-bold text-green-600">{stats.offline}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">عملاء نشطون</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">إجمالي الإيرادات</div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(stats.total_revenue)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">متوسط الطلب</div>
            <div className="text-lg font-bold text-purple-600">
              {formatCurrency(stats.average_order_value)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">
                🔍
              </span>
              <input
                type="text"
                placeholder="ابحث بالاسم أو الرقم أو الإيميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">كل الأنواع</option>
              <option value="online">أونلاين (الموقع)</option>
              <option value="offline">أوفلاين (محلي)</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="total_spent">الأكثر إنفاقاً</option>
              <option value="orders_count">الأكثر طلبات</option>
              <option value="last_order_date">الأحدث نشاطاً</option>
            </select>
          </div>
        </div>

        {/* Customers Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin text-6xl mb-4">⏳</div>
            <p className="text-gray-600">جاري تحميل البيانات...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">لا يوجد عملاء</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-right font-bold">العميل</th>
                    <th className="px-6 py-4 text-right font-bold">النوع</th>
                    <th className="px-6 py-4 text-right font-bold">التواصل</th>
                    <th className="px-6 py-4 text-right font-bold">عدد الطلبات</th>
                    <th className="px-6 py-4 text-right font-bold">إجمالي الإنفاق</th>
                    <th className="px-6 py-4 text-right font-bold">آخر طلب</th>
                    <th className="px-6 py-4 text-center font-bold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">
                          {customer.name}
                        </div>
                        {(customer.address?.city || customer.city) && (
                          <div className="text-sm text-gray-500">
                            📍 {customer.address?.city || customer.city}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            customer.type === "online"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {customer.type === "online" ? "🌐 أونلاين" : "🏪 أوفلاين"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {customer.phone && (
                          <div className="text-sm text-gray-700">
                            📱 {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="text-sm text-gray-500">
                            📧 {customer.email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800">
                          {customer.orders_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          {formatCurrency(customer.total_spent || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {customer.last_order_date && (
                          <div className="text-sm text-gray-700">
                            {formatDate(customer.last_order_date)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold"
                          >
                            التفاصيل
                          </button>
                          {customer.type === 'offline' && (
                            <>
                              <button
                                onClick={() => handleEditCustomer(customer)}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(customer)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-lg mb-1">
                        {customer.name}
                      </h3>
                      {customer.phone && (
                        <div className="text-sm text-gray-600">📱 {customer.phone}</div>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        customer.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {customer.status === "active" ? "نشط" : "غير نشط"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                    <div>
                      <div className="text-gray-500">طلبات مدفوعة</div>
                      <div className="font-semibold text-gray-800">
                        {customer.orders_count}
                        {customer.orders && customer.orders.length > customer.orders_count && (
                          <span className="text-xs text-gray-500">
                            {" "}/ {customer.orders.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">إجمالي الإنفاق</div>
                      <div className="font-bold text-green-600">
                        {formatCurrency(customer.total_spent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">متوسط الطلب</div>
                      <div className="text-gray-700">
                        {formatCurrency(customer.average_order)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">آخر طلب</div>
                      <div className="text-gray-700">
                        منذ {customer.days_since_last_order} يوم
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
                  >
                    عرض التفاصيل
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 🆕 Load More Button for Online Customers */}
      {typeFilter !== 'offline' && hasMore && !loading && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMoreCustomers}
            disabled={loadingMore}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 
              text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                جاري التحميل...
              </>
            ) : (
              <>
                📥 تحميل المزيد ({currentPage} / {totalPages})
              </>
            )}
          </button>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  تفاصيل العميل: {selectedCustomer.name}
                </h2>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Contact Info */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  معلومات التواصل
                </h3>
                <div className="space-y-2">
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <span>📱</span>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <span>📧</span>
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-start gap-2 text-gray-700">
                      <span>📍</span>
                      <span>
                        {typeof selectedCustomer.address === 'string' 
                          ? selectedCustomer.address 
                          : `${selectedCustomer.address.street || ''} ${selectedCustomer.address.building || ''} ${selectedCustomer.address.floor ? `الدور ${selectedCustomer.address.floor}` : ''} ${selectedCustomer.address.apartment ? `شقة ${selectedCustomer.address.apartment}` : ''} ${selectedCustomer.address.area || ''} ${selectedCustomer.address.city || ''} ${selectedCustomer.address.state || ''} ${selectedCustomer.address.landmark ? `علامة: ${selectedCustomer.address.landmark}` : ''}`.trim()
                        }
                        {selectedCustomer.city && typeof selectedCustomer.address !== 'object' && `, ${selectedCustomer.city}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 mb-1">إجمالي الطلبات</div>
                  <div className="text-2xl font-bold text-blue-700">
                    {selectedCustomer.orders?.length || selectedCustomer.orders_count || 0}
                  </div>
                  <div className="text-xs text-blue-500 mt-1">
                    مدفوعة: {selectedCustomer.orders_count || 0}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 mb-1">إجمالي الإنفاق</div>
                  <div className="text-xl font-bold text-green-700">
                    {formatCurrency(selectedCustomer.total_spent)}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-purple-600 mb-1">متوسط الطلب</div>
                  <div className="text-xl font-bold text-purple-700">
                    {formatCurrency(selectedCustomer.average_order)}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-sm text-orange-600 mb-1">آخر نشاط</div>
                  <div className="text-lg font-bold text-orange-700">
                    منذ {selectedCustomer.days_since_last_order} يوم
                  </div>
                </div>
              </div>

              {/* Orders History */}
              {selectedCustomer.type === 'online' && selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                // 🌐 طلبات الموقع (WooCommerce)
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    تاريخ الطلبات ({selectedCustomer.orders.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedCustomer.orders
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((order) => {
                      const isPaid = order.status === 'completed' || order.status === 'processing';
                      const statusLabel = 
                        order.status === 'completed' ? '✅ مكتمل' :
                        order.status === 'processing' ? '⏳ قيد التنفيذ' :
                        order.status === 'cancelled' ? '❌ ملغي' :
                        order.status === 'refunded' ? '↩️ مسترجع' :
                        order.status === 'failed' ? '⚠️ فشل' :
                        order.status === 'on-hold' ? '⏸️ معلق' : order.status;

                      return (
                        <div
                          key={order.id}
                          className={`rounded-lg p-3 transition-colors ${
                            isPaid 
                              ? 'bg-green-50 hover:bg-green-100' 
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-800">
                              طلب #{order.id}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(order.date)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">
                                {order.items_count} منتج
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white border">
                                {statusLabel}
                              </span>
                            </div>
                            <span className={`font-bold ${isPaid ? 'text-green-600' : 'text-gray-500'}`}>
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedCustomer.type === 'offline' && customerInvoices.length > 0 ? (
                // 🏪 طلبات الكاشير (POS)
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    📦 طلبات الكاشير ({customerInvoices.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {customerInvoices.map((invoice) => {
                      const invoiceDate = new Date(invoice.date);
                      const itemsCount = (invoice.items?.length || 0) + (invoice.services?.length || 0);
                      
                      return (
                        <div
                          key={invoice.id}
                          className="rounded-lg p-3 bg-green-50 hover:bg-green-100 transition-colors border-2 border-green-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-800">
                              🏪 فاتورة #{invoice.id}
                            </span>
                            <span className="text-xs text-gray-500">
                              {invoiceDate.toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                          
                          {/* قائمة المنتجات */}
                          {invoice.items && invoice.items.length > 0 && (
                            <div className="mb-2 bg-white rounded p-2 border border-green-200">
                              <div className="text-xs text-gray-600 font-semibold mb-1">📦 المنتجات:</div>
                              {invoice.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1">
                                  <span className="text-gray-700">
                                    {item.name} <span className="text-gray-500">(×{item.quantity})</span>
                                  </span>
                                  <span className="font-semibold text-gray-800">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* قائمة الخدمات */}
                          {invoice.services && invoice.services.length > 0 && (
                            <div className="mb-2 bg-yellow-50 rounded p-2 border border-yellow-200">
                              <div className="text-xs text-gray-600 font-semibold mb-1">🔧 الخدمات:</div>
                              {invoice.services.map((service, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1">
                                  <span className="text-gray-700">{service.description}</span>
                                  <span className="font-semibold text-gray-800">
                                    {formatCurrency(service.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* الإجمالي */}
                          <div className="flex items-center justify-between text-sm pt-2 border-t border-green-300">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">
                                {itemsCount} عنصر
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white">
                                ✅ مدفوع
                              </span>
                            </div>
                            <span className="font-bold text-green-700 text-base">
                              {formatCurrency(invoice.summary?.total || 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-gray-600">لا توجد طلبات لهذا العميل بعد</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSuccess={handleCustomerSaved}
      />
    </div>
  );
}
