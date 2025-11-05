"use client";

import localforage from 'localforage';

// Initialize localforage
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

  async clearAll() {
    await localforage.setItem('invoices', []);
  }
};

// Cart management in localforage
export const cartStorage = {
  async saveCart(items) {
    await localforage.setItem('current-cart', items);
  },

  async getCart() {
    const cart = await localforage.getItem('current-cart');
    return cart || [];
  },

  async clearCart() {
    await localforage.setItem('current-cart', []);
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