'use client';

import { useState, useEffect } from 'react';
import offlineCustomersStorage from '@/app/lib/offline-customers-storage';
import BostaLocationSelector from './BostaLocationSelector';
import { BostaAPI } from '@/app/lib/bosta-api';
import { getBostaSettings } from '@/app/lib/bosta-helpers';

/**
 * CustomerModal - مودال لإضافة/تعديل العملاء الأوفلاين
 */
export default function CustomerModal({ isOpen, onClose, customer = null, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [shippingFees, setShippingFees] = useState(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      cityId: '',
      cityNameEn: '',  // الاسم الإنجليزي للمدينة
      state: '',
      district: '',
      districtId: '',
      zoneId: '',
      area: '',
      building: '',
      floor: '',
      apartment: '',
      landmark: ''
    },
    notes: ''
  });

  // تحميل بيانات العميل للتعديل
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: {
          street: customer.address?.street || '',
          city: customer.address?.city || '',
          cityId: customer.address?.cityId || '',
          cityNameEn: customer.address?.cityNameEn || '',  // الاسم الإنجليزي
          state: customer.address?.state || '',
          district: customer.address?.district || '',
          districtId: customer.address?.districtId || '',
          zoneId: customer.address?.zoneId || '',
          area: customer.address?.area || '',
          building: customer.address?.building || '',
          floor: customer.address?.floor || '',
          apartment: customer.address?.apartment || '',
          landmark: customer.address?.landmark || ''
        },
        notes: customer.notes || ''
      });
    } else {
      // إعادة تعيين النموذج عند الإغلاق
      setForm({
        name: '',
        phone: '',
        email: '',
        address: {
          street: '',
          city: '',
          cityId: '',
          cityNameEn: '',  // الاسم الإنجليزي للمدينة
          state: '',
          district: '',
          districtId: '',
          zoneId: '',
          area: '',
          building: '',
          floor: '',
          apartment: '',
          landmark: ''
        },
        notes: ''
      });
    }
  }, [customer, isOpen]);

  // حساب تكلفة الشحن عند تغيير المدينة (فقط لو فيه cityNameEn)
  useEffect(() => {
    if (form.address.city && form.address.cityNameEn) {
      calculateShipping();
    } else if (form.address.city && !form.address.cityNameEn) {
      // عميل قديم مفيش عنده cityNameEn - متحسبش
      console.log('⏭️ تخطي حساب الشحن - عميل قديم بدون cityNameEn');
      setShippingFees(null);
    }
  }, [form.address.city, form.address.cityNameEn]);

  const calculateShipping = async () => {
    try {
      const settings = await getBostaSettings();
      
      if (!settings.enabled || !settings.apiKey) {
        return;
      }

      // استخدام pickupCity من الإعدادات مباشرة
      const pickupCityName = settings.pickupCity || 'Cairo';
      
      // استخدام الاسم الإنجليزي للمدينة
      const dropOffCityName = form.address.cityNameEn || form.address.city;
      
      // لو مفيش city name أصلاً، متحسبش
      if (!dropOffCityName || !form.address.city) {
        console.log('⏭️ تخطي حساب الشحن - لا توجد مدينة محددة');
        setShippingFees(null);
        return;
      }

      setLoadingFees(true);
      const bostaAPI = new BostaAPI(settings.apiKey);
      
      console.log('📍 Using pickup city:', pickupCityName);
      console.log('📍 Drop-off city (EN):', dropOffCityName);
      console.log('📍 Drop-off city (AR):', form.address.city);
      
      const result = await bostaAPI.calculateShippingFees({
        cod: 0, // بدون دفع عند الاستلام
        dropOffCity: dropOffCityName,  // الاسم الإنجليزي
        pickupCity: pickupCityName,
        size: 'Normal',
        type: 'SEND'
      });

      if (result.error) {
        console.error('فشل حساب تكلفة الشحن:', result.error);
        setShippingFees(null);
      } else if (result.success && result.data) {
        setShippingFees(result);
      } else {
        console.warn('⚠️ استجابة غير متوقعة من API:', result);
        setShippingFees(null);
      }
    } catch (error) {
      console.error('خطأ في حساب تكلفة الشحن:', error);
      setShippingFees(null);
    } finally {
      setLoadingFees(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      alert('⚠️ اسم العميل مطلوب');
      return;
    }

    if (!form.phone.trim()) {
      alert('⚠️ رقم الهاتف مطلوب');
      return;
    }

    setLoading(true);
    try {
      // إضافة تكلفة الشحن للبيانات
      const customerData = {
        ...form,
        shippingCost: shippingFees?.data?.priceAfterVat || 0
      };

      let result;
      if (customer) {
        // تحديث عميل موجود
        result = await offlineCustomersStorage.updateOfflineCustomer(customer.id, customerData);
      } else {
        // إضافة عميل جديد
        result = await offlineCustomersStorage.addOfflineCustomer(customerData);
      }

      if (onSuccess) {
        onSuccess(result);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('❌ فشل في حفظ العميل: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 top-20">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">👤</span>
            {customer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* معلومات أساسية */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 border-b pb-2">📋 المعلومات الأساسية</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="محمد أحمد"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  رقم الهاتف <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="01012345678"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* عنوان التوصيل */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 border-b pb-2">📍 عنوان التوصيل</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">المحافظة</label>
                <input
                  type="text"
                  value={form.address.state}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="القاهرة"
                />
              </div>

              {/* استخدام BostaLocationSelector للمدينة والمنطقة */}
              <div className="md:col-span-2">
                <BostaLocationSelector
                  address={form.address}
                  onAddressChange={(newAddress) => setForm({ ...form, address: newAddress })}
                  disabled={loading}
                />
              </div>

              {/* عرض تكلفة الشحن */}
              {shippingFees && !shippingFees.error && shippingFees.data && (
                <div className="md:col-span-2 bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">💰 تكلفة الشحن المتوقعة</p>
                      <p className="text-xs text-gray-500 mt-1">
                        (بدون دفع عند الاستلام - الحجم: Normal)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {shippingFees.data.priceAfterVat?.toFixed(2)} جنيه
                      </p>
                      <p className="text-xs text-gray-500">شامل الضريبة</p>
                    </div>
                  </div>
                  
                  {/* تفاصيل التكلفة */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-green-200 text-xs">
                    <div className="bg-white rounded p-2">
                      <p className="text-gray-500">رسوم الشحن</p>
                      <p className="font-bold text-gray-800">{shippingFees.data.shippingFee} جنيه</p>
                    </div>
                    {shippingFees.data.bostaMaterialFee && (
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">رسوم التغليف</p>
                        <p className="font-bold text-gray-800">{shippingFees.data.bostaMaterialFee.amount} جنيه</p>
                      </div>
                    )}
                    {shippingFees.data.transit && (
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">رسوم النقل</p>
                        <p className="font-bold text-gray-800">{shippingFees.data.transit.cost} جنيه</p>
                      </div>
                    )}
                    <div className="bg-white rounded p-2">
                      <p className="text-gray-500">الضريبة (14%)</p>
                      <p className="font-bold text-gray-800">
                        {(shippingFees.data.priceAfterVat - shippingFees.data.priceBeforeVat).toFixed(2)} جنيه
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">المنطقة</label>
                <input
                  type="text"
                  value={form.address.area}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, area: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="الحي العاشر"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">الشارع</label>
                <input
                  type="text"
                  value={form.address.street}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="شارع النزهة"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">رقم العقار</label>
                <input
                  type="text"
                  value={form.address.building}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, building: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="12"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">الدور</label>
                <input
                  type="text"
                  value={form.address.floor}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, floor: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="الثالث"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">الشقة</label>
                <input
                  type="text"
                  value={form.address.apartment}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, apartment: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="5"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">علامة مميزة</label>
                <input
                  type="text"
                  value={form.address.landmark}
                  onChange={(e) => setForm({ ...form, address: { ...form.address, landmark: e.target.value }})}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="بجوار مسجد..."
                />
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="أي ملاحظات إضافية..."
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <span className="text-xl">💾</span>
                  {customer ? 'حفظ التعديلات' : 'إضافة العميل'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
