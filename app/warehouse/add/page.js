'use client';

import { useRouter } from 'next/navigation';
import ProductFormModal from '../../../components/ProductFormModal';
import { useState } from 'react';

export default function AddProductPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    router.push('/products');
  };

  return (
    <ProductFormModal
      isOpen={isOpen}
      onClose={handleClose}
      mode="create"
      onSuccess={(data) => {
        router.push('/products');
      }}
    />
  );
}
