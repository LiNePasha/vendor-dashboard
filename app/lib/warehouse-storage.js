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

  // حفظ المخزون المحلي لمتغير
  async setVariationLocalStock(variationId, localStock) {
    const allData = await localforage.getItem('variation-local-stocks') || {};
    allData[variationId] = {
      localStock: Number(localStock) || 0,
      updatedAt: new Date().toISOString()
    };
    await localforage.setItem('variation-local-stocks', allData);
  },

  // جلب المخزون المحلي لمتغير
  async getVariationLocalStock(variationId) {
    const allData = await localforage.getItem('variation-local-stocks') || {};
    return allData[variationId]?.localStock || 0;
  },

  // جلب كل المخزون المحلي للمتغيرات
  async getAllVariationLocalStocks() {
    return await localforage.getItem('variation-local-stocks') || {};
  },

  // حفظ مخزون محلي لعدة متغيرات دفعة واحدة
  async setMultipleVariationLocalStocks(variations) {
    const allData = await localforage.getItem('variation-local-stocks') || {};
    variations.forEach(v => {
      if (v.id && typeof v.localStock !== 'undefined') {
        allData[v.id] = {
          localStock: Number(v.localStock) || 0,
          updatedAt: new Date().toISOString()
        };
      }
    });
    await localforage.setItem('variation-local-stocks', allData);
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
      balance: 0, // الرصيد الحالي (موجب = ليه فلوس، سالب = علينا فلوس)
      totalPurchases: 0, // إجمالي المشتريات
      totalPayments: 0, // إجمالي المدفوعات
      transactions: [], // سجل المعاملات
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

  // إضافة معاملة (شراء أو دفع)
  async addTransaction(supplierId, transaction) {
    const suppliers = await this.getAllSuppliers();
    const updated = suppliers.map(s => {
      if (s.id === supplierId) {
        const newTransaction = {
          id: `txn-${Date.now()}`,
          type: transaction.type, // 'purchase' أو 'payment'
          amount: parseFloat(transaction.amount),
          description: transaction.description || '',
          date: new Date().toISOString(),
          ...transaction
        };
        
        const transactions = [...(s.transactions || []), newTransaction];
        
        // تحديث الرصيد
        let newBalance = s.balance || 0;
        if (transaction.type === 'purchase') {
          // شراء = زيادة الدين (سالب)
          newBalance -= parseFloat(transaction.amount);
        } else if (transaction.type === 'payment') {
          // دفع = تقليل الدين (موجب)
          newBalance += parseFloat(transaction.amount);
        }
        
        return {
          ...s,
          transactions,
          balance: newBalance,
          totalPurchases: transaction.type === 'purchase' 
            ? (s.totalPurchases || 0) + parseFloat(transaction.amount)
            : (s.totalPurchases || 0),
          totalPayments: transaction.type === 'payment'
            ? (s.totalPayments || 0) + parseFloat(transaction.amount)
            : (s.totalPayments || 0)
        };
      }
      return s;
    });
    
    await localforage.setItem('suppliers', updated);
    return updated.find(s => s.id === supplierId);
  },

  // حذف معاملة
  async deleteTransaction(supplierId, transactionId) {
    const suppliers = await this.getAllSuppliers();
    const updated = suppliers.map(s => {
      if (s.id === supplierId) {
        const transaction = s.transactions.find(t => t.id === transactionId);
        if (!transaction) return s;
        
        const transactions = s.transactions.filter(t => t.id !== transactionId);
        
        // إلغاء تأثير المعاملة على الرصيد
        let newBalance = s.balance || 0;
        if (transaction.type === 'purchase') {
          newBalance += parseFloat(transaction.amount);
        } else if (transaction.type === 'payment') {
          newBalance -= parseFloat(transaction.amount);
        }
        
        return {
          ...s,
          transactions,
          balance: newBalance,
          totalPurchases: transaction.type === 'purchase'
            ? (s.totalPurchases || 0) - parseFloat(transaction.amount)
            : (s.totalPurchases || 0),
          totalPayments: transaction.type === 'payment'
            ? (s.totalPayments || 0) - parseFloat(transaction.amount)
            : (s.totalPayments || 0)
        };
      }
      return s;
    });
    
    await localforage.setItem('suppliers', updated);
    return updated.find(s => s.id === supplierId);
  },

  // جلب الدائنين (الناس اللي مديونين ليك بفلوس - balance موجب)
  // DEPRECATED: استخدم creditorsStorage بدلاً منها
  async getCreditors() {
    const suppliers = await this.getAllSuppliers();
    return suppliers.filter(s => (s.balance || 0) > 0);
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

// ================== Creditors Storage (الدائنين - ناس مديونين ليك) ==================
export const creditorsStorage = {
  storageKey: 'spare2app_creditors',

  // جلب كل الدائنين
  async getAllCreditors() {
    try {
      const data = await localforage.getItem(this.storageKey);
      return data || [];
    } catch (error) {
      console.error('Error loading creditors:', error);
      return [];
    }
  },

  // إضافة دائن جديد
  async addCreditor(creditorData) {
    const creditors = await this.getAllCreditors();
    const newCreditor = {
      id: `creditor-${Date.now()}`,
      name: creditorData.name,
      phone: creditorData.phone || '',
      email: creditorData.email || '',
      notes: creditorData.notes || '',
      balance: 0, // موجب = مديون ليك، سالب = انت مديون له
      totalDebts: 0, // إجمالي الديون
      totalPayments: 0, // إجمالي المدفوعات
      transactions: [],
      createdAt: new Date().toISOString(),
      ...creditorData
    };

    creditors.push(newCreditor);
    await localforage.setItem(this.storageKey, creditors);
    return newCreditor;
  },

  // تحديث بيانات دائن
  async updateCreditor(creditorId, updates) {
    const creditors = await this.getAllCreditors();
    const updated = creditors.map(c => 
      c.id === creditorId ? { ...c, ...updates } : c
    );
    await localforage.setItem(this.storageKey, updated);
    return updated.find(c => c.id === creditorId);
  },

  // إضافة معاملة (دين جديد أو دفعة)
  async addTransaction(creditorId, transaction) {
    const creditors = await this.getAllCreditors();
    const updated = creditors.map(c => {
      if (c.id === creditorId) {
        const newTransaction = {
          id: `txn-${Date.now()}`,
          type: transaction.type, // 'debt' أو 'payment'
          amount: parseFloat(transaction.amount),
          description: transaction.description || '',
          date: new Date().toISOString(),
          ...transaction
        };
        
        const transactions = [...(c.transactions || []), newTransaction];
        
        // تحديث الرصيد
        let newBalance = c.balance || 0;
        if (transaction.type === 'debt') {
          // دين جديد = زيادة المبلغ المستحق ليك (موجب)
          newBalance += parseFloat(transaction.amount);
        } else if (transaction.type === 'payment') {
          // دفعة = تقليل الدين (سالب)
          newBalance -= parseFloat(transaction.amount);
        }
        
        return {
          ...c,
          transactions,
          balance: newBalance,
          totalDebts: transaction.type === 'debt' 
            ? (c.totalDebts || 0) + parseFloat(transaction.amount)
            : (c.totalDebts || 0),
          totalPayments: transaction.type === 'payment'
            ? (c.totalPayments || 0) + parseFloat(transaction.amount)
            : (c.totalPayments || 0)
        };
      }
      return c;
    });
    
    await localforage.setItem(this.storageKey, updated);
    return updated.find(c => c.id === creditorId);
  },

  // حذف معاملة
  async deleteTransaction(creditorId, transactionId) {
    const creditors = await this.getAllCreditors();
    const updated = creditors.map(c => {
      if (c.id === creditorId) {
        const txn = c.transactions.find(t => t.id === transactionId);
        if (!txn) return c;
        
        const transactions = c.transactions.filter(t => t.id !== transactionId);
        
        // عكس تأثير المعاملة
        let newBalance = c.balance || 0;
        if (txn.type === 'debt') {
          newBalance -= txn.amount;
        } else if (txn.type === 'payment') {
          newBalance += txn.amount;
        }
        
        return {
          ...c,
          transactions,
          balance: newBalance,
          totalDebts: txn.type === 'debt' 
            ? (c.totalDebts || 0) - txn.amount
            : (c.totalDebts || 0),
          totalPayments: txn.type === 'payment'
            ? (c.totalPayments || 0) - txn.amount
            : (c.totalPayments || 0)
        };
      }
      return c;
    });
    
    await localforage.setItem(this.storageKey, updated);
    return updated.find(c => c.id === creditorId);
  },

  // جلب الدائنين اللي ليك فلوس عندهم (balance موجب)
  async getActiveCreditors() {
    const creditors = await this.getAllCreditors();
    return creditors.filter(c => (c.balance || 0) > 0);
  },

  // حذف دائن
  async deleteCreditor(creditorId) {
    const creditors = await this.getAllCreditors();
    const filtered = creditors.filter(c => c.id !== creditorId);
    await localforage.setItem(this.storageKey, filtered);
    return true;
  }
};
