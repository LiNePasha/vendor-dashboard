'use client';

import ProductForm from '../../../components/ProductForm';

export default function AddProductPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <ProductForm mode="create" />
      </div>
    </div>
  );
}
