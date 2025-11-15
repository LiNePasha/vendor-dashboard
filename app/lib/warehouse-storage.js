"use client";

import localforage from 'localforage';

// ============================================
// Warehouse Storage - ربط بيانات محلية بمنتجات WooCommerce
// ============================================

export const warehouseStorage = {
  // حفظ/تحديث بيانات منتج
  async setProductData(wooProductId, data) {
    const allData = await this.getAllProductsData();
    const existing = allData.find(p => p.wooProductId === wooProductId);
    
    if (existing) {
      // تحديث
      const updated = allData.map(p => 
        p.wooProductId === wooProductId 
          ? { ...p, ...data, updatedAt: new Date().toISOString() }
          : p
      );
      await localforage.setItem('warehouse-products', updated);
    } else {
      // إضافة جديد
      allData.push({
        wooProductId,
        suppliers: [],
        purchasePrice: 0,
        localStock: 0,
        notes: '',
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await localforage.setItem('warehouse-products', allData);
    }
  },

  // جلب بيانات منتج واحد
  async getProductData(wooProductId) {
    const allData = await this.getAllProductsData();
    return allData.find(p => p.wooProductId === wooProductId) || null;
  },

  // جلب كل البيانات المحلية
  async getAllProductsData() {
    const data = await localforage.getItem('warehouse-products');
    return data || [];
  },

  // إضافة مورد لمنتج
  async addSupplierToProduct(wooProductId, supplier) {
    const productData = await this.getProductData(wooProductId);
    const suppliers = productData?.suppliers || [];
    
    // تجنب التكرار
    const exists = suppliers.find(s => s.supplierId === supplier.supplierId);
    if (!exists) {
      suppliers.push({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        addedAt: new Date().toISOString()
      });
      
      await this.setProductData(wooProductId, {
        ...productData,
        suppliers
      });
    }
  },

  // حذف مورد من منتج
  async removeSupplierFromProduct(wooProductId, supplierId) {
    const productData = await this.getProductData(wooProductId);
    if (productData) {
      const suppliers = productData.suppliers.filter(s => s.supplierId !== supplierId);
      await this.setProductData(wooProductId, {
        ...productData,
        suppliers
      });
    }
  },

  // مسح كل البيانات
  async clearAll() {
    await localforage.setItem('warehouse-products', []);
  }
};

// ============================================
// Suppliers Storage - إدارة الموردين
// ============================================

export const suppliersStorage = {
  // إضافة مورد جديد
  async addSupplier(supplier) {
    const suppliers = await this.getAllSuppliers();
    const newSupplier = {
      id: `sup-${Date.now()}`,
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      notes: supplier.notes || '',
      createdAt: new Date().toISOString()
    };
    suppliers.push(newSupplier);
    await localforage.setItem('suppliers', suppliers);
    return newSupplier;
  },

  // تحديث مورد
  async updateSupplier(supplierId, updates) {
    const suppliers = await this.getAllSuppliers();
    const updated = suppliers.map(s =>
      s.id === supplierId ? { ...s, ...updates } : s
    );
    await localforage.setItem('suppliers', updated);
  },

  // حذف مورد
  async deleteSupplier(supplierId) {
    const suppliers = await this.getAllSuppliers();
    const filtered = suppliers.filter(s => s.id !== supplierId);
    await localforage.setItem('suppliers', filtered);
  },

  // جلب مورد واحد
  async getSupplier(supplierId) {
    const suppliers = await this.getAllSuppliers();
    return suppliers.find(s => s.id === supplierId) || null;
  },

  // جلب كل الموردين
  async getAllSuppliers() {
    const suppliers = await localforage.getItem('suppliers');
    return suppliers || [];
  },

  // مسح كل الموردين
  async clearAll() {
    await localforage.setItem('suppliers', []);
  }
};
