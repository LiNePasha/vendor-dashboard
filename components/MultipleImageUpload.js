'use client';

import { useState } from 'react';

/**
 * MultipleImageUpload Component
 * رفع صور متعددة للمنتج مع preview و drag & drop
 */
export default function MultipleImageUpload({ images = [], onChange, maxImages = 8, uploading = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  // رفع صورة واحدة
  const uploadImage = async (file, index) => {
    setUploadingIndex(index);
    
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('فشل رفع الصورة');

      const data = await res.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingIndex(null);
    }
  };

  // معالجة اختيار الصور
  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;
    
    if (fileArray.length > remainingSlots) {
      alert(`يمكنك إضافة ${remainingSlots} صورة فقط`);
      return;
    }

    // إنشاء previews فوراً
    const newPreviews = [];
    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        newPreviews.push({ preview, file, uploading: true, id: Date.now() + Math.random() });
      }
    }
    
    // تحديث الواجهة مباشرة
    onChange([...images, ...newPreviews]);

    // رفع الصور واحدة واحدة
    for (let i = 0; i < newPreviews.length; i++) {
      const currentPreview = newPreviews[i];
      
      try {
        const url = await uploadImage(currentPreview.file, i);
        
        // 🔥 تحديث الصورة باستخدام callback للحصول على آخر state
        onChange(prevImages => 
          prevImages.map(img => 
            img.id === currentPreview.id 
              ? { url, preview: url, uploading: false, id: img.id }
              : img
          )
        );
      } catch (error) {
        // إزالة الصورة الفاشلة
        onChange(prevImages => 
          prevImages.filter(img => img.id !== currentPreview.id)
        );
        alert('فشل رفع إحدى الصور');
      }
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // حذف صورة
  const handleRemove = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  // تغيير ترتيب الصور
  const handleReorder = (fromIndex, toIndex) => {
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          صور المنتج ({images.length}/{maxImages})
        </label>
        {images.length > 0 && (
          <p className="text-xs text-gray-500">اسحب لإعادة ترتيب الصور</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {/* عرض الصور الموجودة */}
        {images.map((img, index) => (
          <div
            key={index}
            draggable={!img.uploading}
            onDragStart={(e) => e.dataTransfer.setData('index', index)}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.preventDefault();
              const fromIndex = parseInt(e.dataTransfer.getData('index'));
              handleReorder(fromIndex, index);
            }}
            className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all cursor-move group"
          >
            {img.uploading ? (
              // Loading
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-2"></div>
                <p className="text-white text-xs font-medium">جاري الرفع...</p>
              </div>
            ) : (
              <>
                <img
                  src={img.url || img.preview}
                  alt={`صورة ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Badge الصورة الرئيسية */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                    رئيسية
                  </div>
                )}

                {/* زر الحذف */}
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  title="حذف"
                >
                  ×
                </button>

                {/* رقم الترتيب */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {index + 1}
                </div>
              </>
            )}
          </div>
        ))}

        {/* زر إضافة صور جديدة */}
        {images.length < maxImages && (
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative aspect-square bg-gradient-to-br rounded-xl border-2 border-dashed cursor-pointer hover:scale-105 transition-all flex flex-col items-center justify-center gap-2 ${
              dragOver
                ? 'from-blue-100 to-blue-200 border-blue-500 scale-105'
                : 'from-gray-50 to-gray-100 border-gray-300 hover:border-blue-400'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              disabled={uploading}
            />
            <div className="text-4xl">📷</div>
            <div className="text-center px-2">
              <p className="text-sm font-medium text-gray-700">أضف صور</p>
              <p className="text-xs text-gray-500 mt-1">اسحب أو اضغط</p>
            </div>
          </label>
        )}
      </div>

      {/* ملاحظات */}
      <div className="bg-blue-50 hidden md:block border border-blue-200 rounded-lg p-3 text-xs text-gray-700 space-y-1">
        <p className="flex items-start gap-2">
          <span className="text-blue-600">💡</span>
          <span>الصورة الأولى ستكون الصورة الرئيسية للمنتج</span>
        </p>
        <p className="flex items-start gap-2">
          <span className="text-blue-600">🔄</span>
          <span>اسحب الصور لإعادة ترتيبها</span>
        </p>
        <p className="flex items-start gap-2">
          <span className="text-blue-600">🖼️</span>
          <span>يمكنك إضافة حتى {maxImages} صور للمنتج</span>
        </p>
      </div>
    </div>
  );
}
