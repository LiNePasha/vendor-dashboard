"use client";

import { useState, useEffect, useMemo } from "react";
import usePOSStore from "@/app/stores/pos-store";
import { useRouter } from "next/navigation";

export default function CustomersPage() {
  const router = useRouter();
  const orders = usePOSStore((state) => state.orders);
  const fetchOrders = usePOSStore((state) => state.fetchOrders);
  const getCustomers = usePOSStore((state) => state.getCustomers);
  const getCustomersStats = usePOSStore((state) => state.getCustomersStats);
  const ordersLoading = usePOSStore((state) => state.ordersLoading);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // all, active, inactive
  const [sortBy, setSortBy] = useState("total_spent"); // total_spent, orders_count, last_order_date
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Fetch orders if not loaded
  useEffect(() => {
    if (orders.length === 0) {
      fetchOrders();
    }
  }, []);

  // Get customers from orders
  const customers = useMemo(() => getCustomers(), [orders]);
  const stats = useMemo(() => getCustomersStats(), [orders]);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "total_spent") return b.total_spent - a.total_spent;
      if (sortBy === "orders_count") return b.orders_count - a.orders_count;
      if (sortBy === "last_order_date")
        return new Date(b.last_order_date) - new Date(a.last_order_date);
      return 0;
    });

    return filtered;
  }, [customers, searchTerm, statusFilter, sortBy]);

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
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <span className="text-4xl">👥</span>
            العملاء
          </h1>
          <p className="text-gray-600">
            {ordersLoading
              ? "جاري التحميل..."
              : `${customers.length} عميل - ${stats.active} نشط`}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">إجمالي العملاء</div>
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">كل العملاء</option>
              <option value="active">نشط (آخر 30 يوم)</option>
              <option value="inactive">غير نشط</option>
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
        {ordersLoading ? (
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
                    <th className="px-6 py-4 text-right font-bold">التواصل</th>
                    <th className="px-6 py-4 text-right font-bold">عدد الطلبات</th>
                    <th className="px-6 py-4 text-right font-bold">إجمالي الإنفاق</th>
                    <th className="px-6 py-4 text-right font-bold">متوسط الطلب</th>
                    <th className="px-6 py-4 text-right font-bold">آخر طلب</th>
                    <th className="px-6 py-4 text-right font-bold">الحالة</th>
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
                        {customer.city && (
                          <div className="text-sm text-gray-500">
                            📍 {customer.city}
                          </div>
                        )}
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
                        <div>
                          <span className="font-semibold text-gray-800">
                            {customer.orders_count}
                          </span>
                          {customer.orders.length > customer.orders_count && (
                            <span className="text-xs text-gray-500 mr-1">
                              ({customer.orders.length} إجمالي)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          {formatCurrency(customer.total_spent)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700">
                          {formatCurrency(customer.average_order)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {formatDate(customer.last_order_date)}
                        </div>
                        <div className="text-xs text-gray-500">
                          منذ {customer.days_since_last_order} يوم
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            customer.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {customer.status === "active" ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                        >
                          التفاصيل
                        </button>
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
                        {customer.orders.length > customer.orders_count && (
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
                        {selectedCustomer.address}
                        {selectedCustomer.city && `, ${selectedCustomer.city}`}
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
                    {selectedCustomer.orders.length}
                  </div>
                  <div className="text-xs text-blue-500 mt-1">
                    مدفوعة: {selectedCustomer.orders_count}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
