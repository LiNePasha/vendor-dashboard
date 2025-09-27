"use client";

import { useState, useEffect, useRef } from "react";

const STATUS_OPTIONS = [
  { value: "on-hold", label: "معلق", color: "bg-yellow-500" },
  { value: "processing", label: "قيد التجهيز", color: "bg-blue-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "cancelled", label: "ملغى", color: "bg-gray-500" },
  { value: "refunded", label: "تم الاسترجاع", color: "bg-purple-500" },
  { value: "failed", label: "فشل", color: "bg-red-500" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState(null);
  const modalRef = useRef(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders", {
          credentials: "include", // ⚡ مهم جدًا
        });
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        console.error(err);
        showToast("فشل جلب الطلبات", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ⚡ مهم
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      const updatedOrder = await res.json();

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: updatedOrder.status } : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: updatedOrder.status });
      }
      showToast("تم تحديث حالة الطلب!");
    } catch (err) {
      console.error(err);
      showToast("فشل تغيير الحالة!", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast("تم نسخ العنوان!");
  };

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setSelectedOrder(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const fullName =
      `${order.billing.first_name} ${order.billing.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      order.id.toString().includes(searchTerm);
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const openModal = async (order) => {
    setSelectedOrder(order);
    setModalLoading(true);
    // Simulate fetch delay for modal data
    setTimeout(() => setModalLoading(false), 800);
  };

  return (
    <div className="p-6 relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded text-white z-50 ${
            toast.type === "error" ? "bg-red-500" : "bg-green-500"
          } animate-slide-in`}
        >
          {toast.message}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">📦 الطلبات</h1>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="ابحث بالرقم أو اسم العميل..."
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow p-4 flex flex-col justify-between animate-pulse h-48"
            >
              {/* Header: رقم الطلب + status */}
              <div className="flex justify-between items-center mb-3">
                <div className="h-5 bg-gray-300 rounded w-1/4" />{" "}
                {/* رقم الطلب */}
                <div className="h-5 bg-gray-300 rounded w-16" /> {/* Status */}
              </div>

              {/* محتوى الطلب */}
              <div className="flex gap-3">
                {/* صورة المنتج */}
                <div className="w-16 h-16 bg-gray-300 rounded" />

                {/* تفاصيل الطلب */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />{" "}
                    {/* اسم العميل */}
                    <div className="h-4 bg-gray-200 rounded w-1/2" />{" "}
                    {/* طريقة الدفع */}
                    <div className="h-4 bg-gray-200 rounded w-1/3" />{" "}
                    {/* المجموع */}
                  </div>
                </div>
              </div>

              {/* Footer: زر التفاصيل + select status */}
              <div className="flex justify-between items-center mt-3">
                <div className="h-8 bg-gray-300 rounded w-24" />{" "}
                {/* Details button */}
                <div className="h-8 bg-gray-300 rounded w-20" />{" "}
                {/* Status select */}
              </div>
            </div>
          ))
        ) : filteredOrders.length === 0 ? (
          <p className="col-span-full text-gray-500 text-center">
            لا توجد طلبات مطابقة للبحث
          </p>
        ) : (
          filteredOrders.map((order) => {
            const statusObj = STATUS_OPTIONS.find(
              (s) => s.value === order.status
            );
            const isNew = order.status === "on-hold";

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow p-4 flex flex-col justify-between border-2 transform transition hover:scale-[1.02] ${
                  isNew ? "border-yellow-400" : "border-transparent"
                }`}
              >
                <div className="mb-3">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-lg">#{order.id}</h2>
                    <span
                      className={`px-2 py-1 rounded text-white text-sm ${
                        statusObj?.color || "bg-gray-500"
                      }`}
                    >
                      {statusObj?.label || order.status}
                    </span>
                  </div>

                  <p className="text-gray-600 mt-1">
                    {order.payment_method_title}
                  </p>
                  <p className="text-gray-600 mt-1">
                    المجموع: {order.total} {order.currency}
                  </p>

                  {isNew && (
                    <span className="inline-block bg-red-500 text-white text-xs px-2 py-0.5 rounded mt-1 animate-pulse">
                      طلب جديد
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center mt-3 gap-2">
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                    onClick={() => openModal(order)}
                  >
                    التفاصيل
                  </button>

                  <select
                    disabled={updatingStatus}
                    className="border rounded px-2 py-1"
                    value={order.status}
                    onChange={(e) =>
                      handleStatusChange(order.id, e.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={handleOutsideClick}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative"
          >
            {modalLoading ? (
              // Full Skeleton Modal
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>

                <div className="space-y-2 mt-4">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-300 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-4 bg-gray-200 rounded w-1/3 mt-4"></div>
              </div>
            ) : (
              // Actual Modal Content
              <>
                <button
                  className="absolute top-3 right-3 text-gray-600 text-2xl font-bold"
                  onClick={() => setSelectedOrder(null)}
                >
                  &times;
                </button>
                <h2 className="text-xl font-bold mb-4">
                  الطلب #{selectedOrder.id}
                </h2>

                <section className="mb-4">
                  <h3 className="font-semibold">بيانات العميل</h3>
                  <p>
                    {selectedOrder.billing.first_name}{" "}
                    {selectedOrder.billing.last_name}
                  </p>
                  <p>{selectedOrder.billing.email}</p>
                  <p>{selectedOrder.billing.phone}</p>
                  <p className="flex items-center gap-2">
                    {selectedOrder.billing.address_1},{" "}
                    {selectedOrder.billing.state}
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `${selectedOrder.billing.address_1}, ${selectedOrder.billing.state}`
                        )
                      }
                      className="text-sm text-blue-500 hover:underline"
                    >
                      نسخ
                    </button>
                    {selectedOrder.meta_data.find(
                      (m) => m.key === "_billing_maps_link"
                    ) && (
                      <a
                        href={
                          selectedOrder.meta_data.find(
                            (m) => m.key === "_billing_maps_link"
                          ).value
                        }
                        target="_blank"
                        className="text-sm text-green-500 hover:underline"
                      >
                        افتح في الخرائط
                      </a>
                    )}
                  </p>
                </section>

                <section className="mb-4">
                  <h3 className="font-semibold">طريقة الدفع</h3>
                  <p>{selectedOrder.payment_method_title}</p>
                </section>

                <section className="mb-4">
                  <h3 className="font-semibold">المنتجات</h3>
                  <ul className="space-y-2">
                    {selectedOrder.line_items.map((item) => (
                      <li key={item.id} className="flex items-center gap-4">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p>
                            السعر: {item.price} {selectedOrder.currency}
                          </p>
                          <p>الكمية: {item.quantity}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold">المجموع</h3>
                  <p>
                    {selectedOrder.total} {selectedOrder.currency}
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
