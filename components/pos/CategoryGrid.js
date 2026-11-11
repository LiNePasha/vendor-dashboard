"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

function CategorySkeleton() {
  return (
    <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 p-6 rounded-3xl shadow-xl border-2 border-indigo-100 animate-pulse">
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl mb-4" />
        <div className="h-6 bg-gray-200 rounded-xl w-28 mb-2" />
        <div className="h-4 bg-gray-200 rounded-lg w-20" />
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
        <div className="text-center py-12 mb-8">
          <div className="inline-block animate-spin text-8xl mb-6">🏪</div>
          <p className="text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text font-black text-2xl">
            جاري تحميل التصنيفات...
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 md:gap-7">
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
      <div className="text-center py-24 bg-white rounded-3xl shadow-2xl border-2 border-gray-100">
        <div className="text-9xl mb-8">📂</div>
        <p className="text-gray-700 text-3xl font-black mb-3">لا توجد تصنيفات</p>
        <p className="text-gray-400 text-lg">قم بإضافة منتجات مع تصنيفاتها أولاً</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        {selectedParent ? (
          <>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-2 mx-auto px-4 py-2 bg-white border border-slate-300 text-gray-800 rounded-lg hover:bg-slate-50 transition-all font-bold shadow-md"
            >
              <span className="text-lg">⬅️</span>
              <span>رجوع للتصنيفات الرئيسية</span>
            </button>
            <h1 className="text-2xl font-bold mb-2 text-blue-900">
              📁 {selectedParent.name}
            </h1>
            <p className="text-gray-600 text-sm font-bold">
              {displayedCategories.length} تصنيف فرعي
            </p>
          </>
        ) : (
          <>
            {/* <h1 className="text-2xl font-bold mb-2 text-blue-900">
              🏪 اختر التصنيف
            </h1>
            <p className="text-gray-600 text-sm font-bold">
              {parentCategories.length} تصنيف رئيسي
            </p> */}
          </>
        )}
      </div>

      {/* "جميع المنتجات" Button */}
      {!selectedParent && (
        <div className="max-w-2xl mx-auto mb-3 sm:mb-4">
          <button
            onClick={() => onSelectCategory('all')}
            className="w-full bg-slate-700 text-white p-3 sm:p-4 rounded-lg shadow-lg hover:shadow-xl transition-all hover:bg-slate-800 border border-slate-600 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl sm:text-3xl">🛒</span>
                <div className="text-right">
                  <h3 className="font-bold text-base sm:text-lg">جميع المنتجات</h3>
                  <p className="text-white/80 text-xs">تصفح كل ما لدينا</p>
                </div>
              </div>
              <span className="text-2xl">⬅️</span>
            </div>
          </button>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {displayedCategories.map((category) => {
          const hasChildren = getChildren(category.id).length > 0;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all bg-white border border-gray-200 hover:border-blue-400"
            >
              {/* Image Background */}
              {category.image ? (
                <div className="relative h-28 sm:h-32 md:h-36 overflow-hidden bg-gray-50">
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-all duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    priority={displayedCategories.indexOf(category) < 6}
                    loading={displayedCategories.indexOf(category) < 6 ? 'eager' : 'lazy'}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2Y5ZmFmYiIvPjwvc3ZnPg=="
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              ) : (
                <div className="h-28 sm:h-32 md:h-36 bg-gray-100 flex items-center justify-center">
                  <span className="text-4xl opacity-50">📦</span>
                </div>
              )}

              {/* Content */}
              <div className="p-2 sm:p-3 bg-white relative">
                <h3 className="font-bold text-xs sm:text-sm mb-2 line-clamp-2 text-gray-900 group-hover:text-blue-600 text-right transition-colors">
                  {category.name}
                </h3>
                
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="bg-slate-600 text-white px-2 py-1 rounded-lg text-xs font-bold border border-slate-500 shadow-md">
                    📦 {category.count || 0}
                  </span>
                  
                  {hasChildren && (
                    <span className="bg-orange-500 text-white px-2 py-1 rounded-lg text-xs font-bold border border-orange-400 flex items-center gap-1 shadow-md">
                      <span>📁</span>
                      <span>{getChildren(category.id).length}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Corner Indicator */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="bg-white rounded-full p-2 shadow-lg border border-blue-300">
                  <span className="text-lg">
                    {hasChildren ? '📁' : '→'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Helper Text */}
      <div className="text-center text-gray-500 text-base font-bold pt-8 bg-gradient-to-r from-indigo-50 to-purple-50 py-4 rounded-2xl border-2 border-indigo-100">
        💡 {selectedParent ? 'اختر تصنيف فرعي لعرض المنتجات' : 'اضغط على التصنيف لعرض الفرعيات أو المنتجات'}
      </div>
    </div>
  );
}
