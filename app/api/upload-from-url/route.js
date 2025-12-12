import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST: رفع صورة من URL مباشرة
 * Body: { url: string }
 */
export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // التحقق من أن الرابط HTTP/HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // 🔥 رفع مباشر من URL إلى Cloudinary
    // Cloudinary يدعم Facebook وInstagram وأي رابط صورة
    const result = await cloudinary.uploader.upload(url, {
      folder: "products",
      // تحويل تلقائي لـ WebP
      format: "webp",
      quality: "auto",
    });

    return NextResponse.json({ 
      url: result.secure_url,
      originalUrl: url 
    });
  } catch (err) {
    console.error("Upload from URL error:", err);
    return NextResponse.json(
      { error: "فشل رفع الصورة من الرابط" }, 
      { status: 500 }
    );
  }
}
