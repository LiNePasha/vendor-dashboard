"use client";

function ProductSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow animate-pulse">
      <div className="bg-gray-200 h-40 rounded mb-4" />
      <div className="h-4 bg-gray-200 rounded mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export function ProductGrid({ products, loading, search, category, onAddToCart }) {
  const filteredProducts = products
    .filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || product.categories?.includes(category);
      return matchesSearch && matchesCategory;
    });

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredProducts.map((product) => (
        <div key={product.id} className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition">
          <div className="relative h-40 mb-4">
            <img
              src={product.images[0]?.src || '/placeholder.png'}
              alt={product.name}
              className="w-full h-full object-contain"
            />
            <span className={`absolute top-2 right-2 px-2 py-1 rounded text-sm font-medium
              ${product.stock_quantity > 5 
                ? 'bg-green-100 text-green-800'
                : product.stock_quantity > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              المخزون: {product.stock_quantity}
            </span>
          </div>
          
          <h3 className="font-medium text-gray-900 mb-1 truncate">
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">
              {product.regular_price || product.price} ج.م
            </span>
            <button
              onClick={() => onAddToCart(product)}
              disabled={product.stock_quantity === 0}
              className={`px-3 py-1 rounded-lg text-sm font-medium
                ${product.stock_quantity > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              إضافة
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}