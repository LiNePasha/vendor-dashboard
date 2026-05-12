import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';

function getCloudinaryConfig() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

function validateCloudinaryConfig(config) {
  const missing = [];
  if (!config.cloud_name) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!config.api_key) missing.push('CLOUDINARY_API_KEY');
  if (!config.api_secret) missing.push('CLOUDINARY_API_SECRET');
  return missing;
}

/**
 * POST: رفع صورة إلى Cloudinary
 * Body: FormData with 'image' field
 */
export async function POST(request) {
  try {
    const config = getCloudinaryConfig();
    const missingVars = validateCloudinaryConfig(config);

    if (missingVars.length > 0) {
      return NextResponse.json(
        {
          error: 'Cloudinary configuration is missing',
          details: `Missing env vars: ${missingVars.join(', ')}`,
          missingVars,
        },
        { status: 500 }
      );
    }

    cloudinary.config(config);

    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!image.type || !image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type', details: 'Only image files are allowed' }, { status: 400 });
    }

    const maxBytes = 10 * 1024 * 1024;
    if (typeof image.size === 'number' && image.size > maxBytes) {
      return NextResponse.json({ error: 'Image too large', details: 'Max size is 10MB' }, { status: 400 });
    }

    // تحويل الصورة إلى Buffer
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // رفع الصورة إلى Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'scooters',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(new Error(error?.message || 'Cloudinary upload failed'));
          else if (!result?.secure_url) reject(new Error('Cloudinary did not return secure_url'));
          else resolve(result);
        }
      ).end(buffer);
    });

    const finalUrl = String(result.secure_url || '').trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      return NextResponse.json(
        { error: 'Invalid uploaded URL', details: `Cloudinary returned invalid URL: ${finalUrl}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: finalUrl,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    );
  }
}
