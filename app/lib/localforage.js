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