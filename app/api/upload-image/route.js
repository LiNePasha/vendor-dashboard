import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false, // مهم جدًا
  },
};

export async function POST(req) {
  const uploadDir = path.join(process.cwd(), "/public/uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({ multiples: false, uploadDir, keepExtensions: true });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        return resolve(
          new Response(JSON.stringify({ error: "فشل رفع الصورة" }), { status: 500 })
        );
      }

      const file = files.file;
      if (!file) {
        return resolve(
          new Response(JSON.stringify({ error: "لا يوجد ملف" }), { status: 400 })
        );
      }

      const fileUrl = `/uploads/${path.basename(file.filepath)}`;
      resolve(new Response(JSON.stringify({ url: fileUrl }), { status: 200 }));
    });
  });
}
