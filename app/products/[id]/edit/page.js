'use client';

import { use } from 'react';
import ProductForm from '../../../../components/ProductForm';

export default function EditProductPage({ params }) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <ProductForm mode="edit" productId={id} />
      </div>
    </div>
  );
}
