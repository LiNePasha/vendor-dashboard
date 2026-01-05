"use client";

import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'vendor-pos',
  storeName: 'invoices'
});

// Invoice storage utilities
export const invoiceStorage = {
  async saveInvoice(invoice) {
    const invoices = await this.getAllInvoices();
    invoices.push(invoice);
    await localforage.setItem('invoices', invoices);
  },

  async getAllInvoices() {
    const invoices = await localforage.getItem('invoices');
    return invoices || [];
  },

  async getInvoice(invoiceId) {
    const invoices = await this.getAllInvoices();
    return invoices.find(invoice => invoice.id === invoiceId);
  },

  async getUnsyncedInvoices() {
    const invoices = await this.getAllInvoices();
    return invoices.filter(invoice => !invoice.synced);
  },

  async markInvoiceAsSynced(invoiceId) {
    const invoices = await this.getAllInvoices();
    const updatedInvoices = invoices.map(invoice => 
      invoice.id === invoiceId ? { ...invoice, synced: true } : invoice
    );
    await localforage.setItem('invoices', updatedInvoices);
  },

  async updateInvoicePaymentStatus(invoiceId, paymentStatus) {
    const invoices = await this.getAllInvoices();
    const updatedInvoices = invoices.map(invoice => 
      invoice.id === invoiceId ? { ...invoice, paymentStatus } : invoice
    );
    await localforage.setItem('invoices', updatedInvoices);
  },

  async updateInvoiceNotes(invoiceId, notes) {
    const invoices = await this.getAllInvoices();
    const updatedInvoices = invoices.map(invoice => 
      invoice.id === invoiceId ? { ...invoice, notes } : invoice
    );
    await localforage.setItem('invoices', updatedInvoices);
  },

  async updateInvoice(invoiceId, updatedInvoice) {
    const invoices = await this.getAllInvoices();
    const updatedInvoices = invoices.map(invoice => 
      invoice.id === invoiceId ? updatedInvoice : invoice
    );
    await localforage.setItem('invoices', updatedInvoices);
  },

  async clearAll() {
    await localforage.setItem('invoices', []);
  }
};

// Cart management
export const cartStorage = {
  async saveCart(items) {
    await localforage.setItem('current-cart', items);
  },

  async getCart() {
    const cart = await localforage.getItem('current-cart');
    return cart || [];
  },

  async clearCart() {
    await localforage.removeItem('current-cart');
  }
};

// Wholesale price storage (local only - not synced to WooCommerce)
export const wholesalePriceStorage = {
  async setWholesalePrice(productId, price) {
    const prices = await this.getAllWholesalePrices();
    prices[productId] = parseFloat(price);
    await localforage.setItem('wholesale-prices', prices);
  },

  async getWholesalePrice(productId) {
    const prices = await this.getAllWholesalePrices();
    return prices[productId] || null;
  },

  async getAllWholesalePrices() {
    const prices = await localforage.getItem('wholesale-prices');
    return prices || {};
  },

  async removeWholesalePrice(productId) {
    const prices = await this.getAllWholesalePrices();
    delete prices[productId];
    await localforage.setItem('wholesale-prices', prices);
  },

  async clearAll() {
    await localforage.setItem('wholesale-prices', {});
  }
};

// Service templates storage (optional: for frequently used services)
export const serviceTemplatesStorage = {
  async addTemplate(service) {
    const templates = await this.getAllTemplates();
    const exists = templates.find(t => t.description.toLowerCase() === service.description.toLowerCase());
    if (!exists) {
      templates.push({ 
        description: service.description, 
        amount: service.amount,
        id: Date.now().toString()
      });
      await localforage.setItem('service-templates', templates);
    }
  },

  async getAllTemplates() {
    const templates = await localforage.getItem('service-templates');
    return templates || [];
  },

  async removeTemplate(id) {
    const templates = await this.getAllTemplates();
    const updated = templates.filter(t => t.id !== id);
    await localforage.setItem('service-templates', updated);
  },

  async clearAll() {
    await localforage.setItem('service-templates', []);
  }
};

// Products cache storage (Stale-While-Revalidate strategy)
export const productsCacheStorage = {
  async saveCache(products, categories = [], pagination = {}) {
    const cache = {
      products: products || [],
      categories: categories || [],
      pagination: pagination || {},
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString()
    };
    await localforage.setItem('products-cache', cache);
    return cache;
  },

  async getCache() {
    const cache = await localforage.getItem('products-cache');
    return cache || null;
  },

  async getCacheAge() {
    const cache = await this.getCache();
    if (!cache || !cache.timestamp) return Infinity;
    return Date.now() - cache.timestamp; // milliseconds
  },

  async isCacheStale(maxAgeMs = 3 * 60 * 1000) {
    const age = await this.getCacheAge();
    return age > maxAgeMs;
  },

  async invalidateCache() {
    const cache = await this.getCache();
    if (cache) {
      cache.timestamp = 0;
      await localforage.setItem('products-cache', cache);
    }
  },

  async updateProductInCache(productId, updates) {
    const cache = await this.getCache();
    if (!cache || !cache.products) return;

    const updatedProducts = cache.products.map(p => 
      p.id === productId ? { ...p, ...updates } : p
    );

    await this.saveCache(updatedProducts, cache.categories, cache.pagination);
  },

  async updateMultipleProductsInCache(updates) {
    const cache = await this.getCache();
    if (!cache || !cache.products) return;

    const updatesMap = new Map(updates.map(u => [u.productId || u.id, u]));
    const updatedProducts = cache.products.map(p => {
      const update = updatesMap.get(p.id);
      return update ? { ...p, ...update } : p;
    });

    await this.saveCache(updatedProducts, cache.categories, cache.pagination);
  },

  async addProductToCache(product) {
    const cache = await this.getCache();
    if (!cache) return;

    const products = [product, ...(cache.products || [])];
    await this.saveCache(products, cache.categories, cache.pagination);
  },

  async removeProductFromCache(productId) {
    const cache = await this.getCache();
    if (!cache || !cache.products) return;

    const products = cache.products.filter(p => p.id !== productId);
    await this.saveCache(products, cache.categories, cache.pagination);
  },

  async clearCache() {
    await localforage.removeItem('products-cache');
  }
};

export default localforage;