import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

// إعداد Cloudinary (حط القيم دي في .env.local)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST: رفع صورة
export async function POST(req) {
  try {
    console.log('🔵 [Upload API] Starting image upload...');
    const formData = await req.formData();
    const file = formData.get("file"); // الصورة اللي هترفعها

    if (!file) {
      console.error('❌ [Upload API] No file provided');
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log('📦 [Upload API] File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // نحول الصورة لـ Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('📤 [Upload API] Uploading to Cloudinary...');

    // رفع لـ Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ 
          folder: "products",
          resource_type: "auto"
        }, (err, res) => {
          if (err) {
            console.error('❌ [Upload API] Cloudinary error:', err);
            reject(err);
          } else {
            console.log('✅ [Upload API] Upload successful:', res.secure_url);
            resolve(res);
          }
        })
        .end(buffer);
    });

    console.log('📨 [Upload API] Returning URL:', result.secure_url);
    return NextResponse.json({ 
      url: result.secure_url,
      publicId: result.public_id 
    });
  } catch (err) {
    console.error('❌ [Upload API] Error:', err);
    return NextResponse.json({ error: "فشل رفع الصورة: " + err.message }, { status: 500 });
  }
}
