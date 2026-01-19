'use client';

import { useEffect } from 'react';
import ProductForm from './ProductForm';

/**
 * ProductFormModal Component
 * Modal wrapper للـ ProductForm
 * @param {boolean} isOpen - حالة فتح/إغلاق الـ modal
 * @param {function} onClose - callback عند الإغلاق
 * @param {string} mode - 'create' أو 'edit'
 * @param {number} productId - ID المنتج (للتعديل فقط)
 * @param {function} onSuccess - callback عند النجاح
 */
export default function ProductFormModal({ isOpen, onClose, mode = 'create', productId = null, onSuccess }) {
  
  // منع scroll للصفحة الرئيسية لما الـ modal مفتوح
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // إغلاق بالـ Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-hidden animate-fadeIn"
      onClick={(e) => {
        // إغلاق لو ضغط على الـ backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative bg-white w-full h-full md:w-[98vw] md:h-[98vh] md:rounded-xl shadow-2xl flex flex-col animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 md:px-6 py-3 md:py-4 md:rounded-t-xl flex items-center justify-between shadow-lg">
          <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2">
            {mode === 'create' ? '➕ إضافة منتج جديد' : '✏️ تعديل المنتج'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-all text-white text-xl md:text-2xl font-bold"
            title="إغلاق (Esc)"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <ProductForm 
            mode={mode} 
            productId={productId}
            onSuccess={(data) => {
              if (onSuccess) onSuccess(data);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
