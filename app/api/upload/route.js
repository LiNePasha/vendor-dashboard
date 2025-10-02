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
    const formData = await req.formData();
    const file = formData.get("file"); // الصورة اللي هترفعها

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    // نحول الصورة لـ Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // رفع لـ Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "products" }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        })
        .end(buffer);
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}
