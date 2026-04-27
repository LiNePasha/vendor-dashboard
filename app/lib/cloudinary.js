/**
 * Upload image to Cloudinary via internal API route (server-side)
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The uploaded image URL
 */
export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'فشل رفع الصورة');
  }

  const data = await response.json();
  return data.url;
}
