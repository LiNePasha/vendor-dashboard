import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * POST /api/analyze-invoice
 * 
 * Analyzes invoice image using Groq Vision API and extracts structured product data
 * 
 * Request body:
 * - imageUrl: string (required) - URL of the uploaded invoice image
 * 
 * Response:
 * - success: boolean
 * - products: Array of extracted products with { name, sku, quantity, price }
 * - error: string (if failed)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'يجب إرسال رابط الصورة' },
        { status: 400 }
      );
    }

    // Validate Groq API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'مفتاح Groq API غير موجود في البيئة' },
        { status: 500 }
      );
    }

    console.log('🔍 Analyzing invoice image:', imageUrl);

    // Call Groq Vision API with structured prompt
    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct', // Llama 4 Scout (replaces llama-3.2-90b-vision-preview)
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `أنت خبير في تحليل الفواتير. قم بتحليل هذه الفاتورة واستخرج جميع المنتجات الموجودة فيها.

**تعليمات مهمة:**
1. استخرج كل منتج بشكل منفصل
2. إذا كان المنتج مكتوب بالعربية، أعد كتابته كما هو
3. إذا كان المنتج مكتوب بالإنجليزية، أعد كتابته كما هو
4. ابحث عن: اسم المنتج، الكمية، السعر، رقم SKU/الباركود (إن وجد)
5. إذا لم تجد معلومة معينة، ضع null

**صيغة الإخراج المطلوبة (JSON فقط، بدون أي نص إضافي):**
\`\`\`json
{
  "products": [
    {
      "name": "اسم المنتج",
      "sku": "رقم SKU أو الباركود أو null",
      "quantity": عدد صحيح,
      "price": رقم عشري
    }
  ]
}
\`\`\`

**ملاحظات:**
- quantity يجب أن يكون عدد صحيح (integer)
- price يجب أن يكون رقم (number) بدون رمز العملة
- إذا كان السعر الإجمالي فقط موجود، احسب سعر الوحدة (الإجمالي ÷ الكمية)
- تجاهل الإجماليات والضرائب ورسوم التوصيل
- ركز فقط على أسطر المنتجات`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 2000,
      top_p: 1,
      stream: false,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log('📝 Groq Response:', responseText);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON
    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('Raw response:', jsonText);
      return NextResponse.json(
        { 
          success: false, 
          error: 'فشل في تحليل استجابة الـ AI. يرجى التأكد من وضوح الصورة.',
          rawResponse: responseText.substring(0, 500) // للمساعدة في التشخيص
        },
        { status: 500 }
      );
    }

    // Validate and clean products data
    const products = (parsedData.products || []).map(product => ({
      name: String(product.name || '').trim(),
      sku: product.sku ? String(product.sku).trim() : null,
      quantity: parseInt(product.quantity) || 1,
      price: parseFloat(product.price) || 0,
    })).filter(p => p.name); // Remove products without names

    console.log(`✅ Extracted ${products.length} products`);

    return NextResponse.json({
      success: true,
      products,
      rawResponse: responseText, // للمراجعة
    });

  } catch (error) {
    console.error('❌ Invoice analysis error:', error);
    
    // Handle specific Groq API errors
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { success: false, error: 'مفتاح API غير صالح' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'حدث خطأ أثناء تحليل الفاتورة',
      },
      { status: 500 }
    );
  }
}
