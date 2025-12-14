"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

function CategorySkeleton() {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-md animate-pulse">
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-20 h-20 bg-gray-200 rounded-full mb-4" />
        <div className="h-5 bg-gray-200 rounded w-24 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-16" />
      </div>
    </div>
  );
}

export function CategoryGrid({ categories, loading, onSelectCategory, totalProducts }) {
  const [selectedParent, setSelectedParent] = useState(null);

  // 🆕 فصل التصنيفات الرئيسية عن الفرعية
  const { parentCategories, childCategories } = useMemo(() => {
    const parents = categories.filter(cat => cat.parent === 0);
    const children = categories.filter(cat => cat.parent !== 0);
    
    return {
      parentCategories: parents,
      childCategories: children
    };
  }, [categories]);

  // 🆕 دالة الحصول على التصنيفات الفرعية لتصنيف معين
  const getChildren = (parentId) => {
    return childCategories.filter(cat => cat.parent === parentId);
  };

  // 🆕 التصنيفات المعروضة (رئيسية أو فرعية حسب الاختيار)
  const displayedCategories = useMemo(() => {
    if (selectedParent) {
      return getChildren(selectedParent.id);
    }
    return parentCategories;
  }, [selectedParent, parentCategories, childCategories]);

  const handleCategoryClick = (category) => {
    const children = getChildren(category.id);
    
    if (children.length > 0) {
      // لو عنده فرعيات، اعرضهم
      setSelectedParent(category);
    } else {
      // لو مفيش فرعيات، اختاره للمنتجات
      onSelectCategory(category.id);
    }
  };

  const handleBack = () => {
    setSelectedParent(null);
  };

  // 🆕 عرض Loading فقط إذا كان في حالة تحميل
  if (loading) {
    return (
      <>
        <div className="text-center py-8 mb-6">
          <div className="inline-block animate-spin text-6xl mb-3">🏪</div>
          <p className="text-blue-600 font-bold text-xl">جاري تحميل التصنيفات...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <CategorySkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  // 🆕 عرض "لا توجد تصنيفات" فقط بعد انتهاء التحميل
  if (!loading && (!categories || categories.length === 0)) {
    return (
      <div className="text-center py-20">
        <div className="text-8xl mb-6">📂</div>
        <p className="text-gray-600 text-2xl font-semibold mb-2">لا توجد تصنيفات</p>
        <p className="text-gray-400">قم بإضافة منتجات مع تصنيفاتها أولاً</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-6">
        {selectedParent ? (
          <>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-2 mx-auto px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold shadow-sm"
            >
              <span className="text-xl">⬅️</span>
              <span>رجوع للتصنيفات الرئيسية</span>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              📁 {selectedParent.name}
            </h1>
            <p className="text-gray-600 text-lg">
              {displayedCategories.length} تصنيف فرعي
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              🏪 اختر التصنيف
            </h1>
            <p className="text-gray-600 text-lg">
              {parentCategories.length} تصنيف رئيسي
            </p>
          </>
        )}
      </div>

      {/* "جميع المنتجات" Button */}
      {!selectedParent && (
        <div className="max-w-md mx-auto mb-6">
          <button
            onClick={() => onSelectCategory('all')}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl">🛒</span>
                <div className="text-right">
                  <h3 className="font-bold text-xl">جميع المنتجات</h3>
                </div>
              </div>
              <span className="text-3xl">⬅️</span>
            </div>
          </button>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
        {displayedCategories.map((category) => {
          const hasChildren = getChildren(category.id).length > 0;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className="relative overflow-hidden rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] bg-white group border border-gray-100"
            >
              {/* Image Background */}
              {category.image ? (
                <div className="relative h-36 md:h-44 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    priority={displayedCategories.indexOf(category) < 6}
                    loading={displayedCategories.indexOf(category) < 6 ? 'eager' : 'lazy'}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y5ZmFmYiIvPjwvc3ZnPg=="
                  />
                  {/* Soft Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/10 to-transparent" />
                  
                  {/* Shine Effect on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              ) : (
                <div className="h-36 md:h-44 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
                  <span className="text-5xl opacity-40">📦</span>
                </div>
              )}

              {/* Content */}
              <div className="p-3 bg-white">
                <h3 className="font-bold text-sm md:text-base mb-2 line-clamp-2 text-gray-800 text-right leading-snug">
                  {category.name}
                </h3>
                
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-100">
                    {category.count || 0} منتج
                  </span>
                  
                  {hasChildren && (
                    <span className="bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold border border-amber-200 flex items-center gap-1">
                      <span>📁</span>
                      <span>{getChildren(category.id).length}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Subtle Corner Indicator */}
              <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110">
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                  <span className="text-xl">
                    {hasChildren ? '📁' : '→'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <div className="text-center text-gray-500 text-sm pt-6">
        💡 {selectedParent ? 'اختر تصنيف فرعي لعرض المنتجات' : 'اضغط على التصنيف لعرض الفرعيات أو المنتجات'}
      </div>
    </div>
  );
}
