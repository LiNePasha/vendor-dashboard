'use client';

import { useState, useEffect } from 'react';
import offlineCustomersStorage from '@/app/lib/offline-customers-storage';
import CustomerModal from './CustomerModal';

/**
 * CustomerSelector - مكون لاختيار عميل أو إضافة عميل جديد
 */
export default function CustomerSelector({ selectedCustomer, onSelect, onClear }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const allCustomers = await offlineCustomersStorage.getAllOfflineCustomers();
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const handleSelectCustomer = (customer) => {
    onSelect(customer);
    setShowDropdown(false);
    setSearch('');
  };

  const handleAddNewCustomer = () => {
    setShowCustomerModal(true);
    setShowDropdown(false);
  };

  const handleCustomerAdded = async (newCustomer) => {
    await loadCustomers();
    onSelect(newCustomer);
  };

  return (
    <div className="relative">
      {selectedCustomer ? (
        // عرض العميل المختار
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">👤</span>
                <h3 className="font-bold text-lg text-gray-800">{selectedCustomer.name}</h3>
              </div>
              
              {selectedCustomer.phone && (
                <div className="text-sm text-gray-700 mb-1">
                  📱 {selectedCustomer.phone}
                </div>
              )}
              
              {selectedCustomer.address && (
                <div className="text-sm text-gray-600 mt-2">
                  <div className="font-semibold mb-1">📍 العنوان:</div>
                  <div className="pr-4 text-gray-700">
                    {[
                      selectedCustomer.address.state,
                      selectedCustomer.address.city,
                      selectedCustomer.address.area,
                      selectedCustomer.address.street,
                      selectedCustomer.address.building && `عقار ${selectedCustomer.address.building}`,
                      selectedCustomer.address.floor && `دور ${selectedCustomer.address.floor}`,
                      selectedCustomer.address.apartment && `شقة ${selectedCustomer.address.apartment}`,
                    ].filter(Boolean).join(' - ')}
                  </div>
                  {selectedCustomer.address.landmark && (
                    <div className="text-xs text-gray-500 mt-1 pr-4">
                      🎯 {selectedCustomer.address.landmark}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={onClear}
              className="text-red-600 hover:bg-red-100 rounded-full p-2 transition-all"
              title="إزالة العميل"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        // واجهة اختيار/إضافة عميل
        <div>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="🔍 ابحث عن عميل أو أضف جديد..."
              className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">
              👤
            </span>
          </div>

          {showDropdown && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                  جاري التحميل...
                </div>
              ) : (
                <>
                  {/* زر إضافة عميل جديد */}
                  <button
                    onClick={handleAddNewCustomer}
                    className="w-full px-4 py-3 text-right hover:bg-blue-50 transition-all border-b flex items-center gap-2 font-semibold text-blue-600"
                  >
                    <span className="text-xl">➕</span>
                    إضافة عميل جديد
                  </button>

                  {/* قائمة العملاء */}
                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      لا يوجد عملاء
                    </div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-4 py-3 text-right hover:bg-blue-50 transition-all border-b last:border-b-0"
                      >
                        <div className="font-semibold text-white">{customer.name}</div>
                        {customer.phone && (
                          <div className="text-sm text-white">📱 {customer.phone}</div>
                        )}
                        {customer.address?.city && (
                          <div className="text-xs text-white">📍 {customer.address.city}</div>
                        )}
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          )}

          {/* Overlay لإغلاق الـ dropdown */}
          {showDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
          )}
        </div>
      )}

      {/* Customer Modal */}
      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSuccess={handleCustomerAdded}
      />
    </div>
  );
}
