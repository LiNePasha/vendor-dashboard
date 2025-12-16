'use client';

import { useState } from 'react';

/**
 * VariationImageUpload Component
 * يسمح برفع صورة لكل variation
 * @param {Object} variation - الـ variation object
 * @param {Function} onImageUpload - callback عند رفع الصورة (variation, imageUrl)
 */
export default function VariationImageUpload({ variation, onImageUpload }) {
  const [uploading, setUploading] = useState(false);
  // Handle both string and object formats for image
  const initialImage = variation.image 
    ? (typeof variation.image === 'string' ? variation.image : variation.image.src) 
    : null;
  const [preview, setPreview] = useState(initialImage);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🔵 [VariationImageUpload] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      alert('⚠️ يرجى اختيار صورة فقط');
      return;
    }

    // التحقق من حجم الملف (أقل من 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    // رفع الصورة على Cloudinary بدون معاينة مؤقتة
    setUploading(true);
    setPreview(null); // Clear any existing preview
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 [VariationImageUpload] Uploading to /api/upload...');
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 [VariationImageUpload] Response status:', uploadRes.status);

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('❌ [VariationImageUpload] Upload failed:', errorText);
        throw new Error('فشل رفع الصورة');
      }

      const uploadData = await uploadRes.json();
      console.log('✅ [VariationImageUpload] Upload successful:', uploadData);
      
      // استخدام الرابط كما هو من Cloudinary
      const imageUrl = uploadData.url;
      
      console.log('🖼️ [VariationImageUpload] Setting image URL:', imageUrl);
      
      // Update state and callback
      setPreview(imageUrl);
      onImageUpload(variation, imageUrl);
      
      console.log('✅ [VariationImageUpload] Image set successfully');
      
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('⚠️ فشل رفع الصورة، جرب مرة أخرى');
      setPreview(variation.image || null);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setPreview(null);
    onImageUpload(variation, null);
  };

  return (
    <div className="relative">
      {uploading ? (
        <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent mb-2"></div>
          <span className="text-xs text-blue-600 font-bold">جاري الرفع...</span>
        </div>
      ) : !preview ? (
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={uploading}
            id={`image-${variation.id}`}
            className="hidden"
          />
          <label
            htmlFor={`image-${variation.id}`}
            className="block w-full px-3 py-2 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all border-gray-300 hover:border-purple-400 hover:bg-purple-50"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs text-gray-600 font-medium">رفع صورة</span>
            </div>
          </label>
        </div>
      ) : (
        <div className="relative group">
          <img 
            src={preview} 
            alt="Variation" 
            className="w-full h-24 object-cover rounded-lg border-2 border-green-300 shadow-sm"
          />
          <div className="absolute inset-0 transition-all rounded-lg flex items-center justify-center gap-2">
            <label
              htmlFor={`image-${variation.id}`}
              className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all hover:bg-blue-700"
            >
              🔄 تغيير
            </label>
            <button
              type="button"
              onClick={removeImage}
              className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold transition-all hover:bg-red-700"
            >
              🗑️ حذف
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={uploading}
              id={`image-${variation.id}`}
              className="hidden"
            />
          </div>
          {/* Green checkmark badge */}
          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
