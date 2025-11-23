import { google } from 'googleapis';

export async function GET() {
  try {
    // Parse the private key from environment variable
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Initialize Google Auth with Service Account credentials (same as working code)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: process.env.GOOGLE_AUTH_URI,
        token_uri: process.env.GOOGLE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // Get the Google Sheets API client
    const sheets = google.sheets({ version: 'v4', auth });

    // First, get sheet metadata to find the actual sheet name
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });

    // Get the first sheet's title (or you can specify which sheet you want)
    const firstSheetTitle = sheetMetadata.data.sheets[0].properties.title;

    // Fetch data from the sheet using the correct sheet name
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${firstSheetTitle}!A1:Z1000`,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return Response.json({ 
        success: false, 
        message: 'لا توجد بيانات في الجدول' 
      }, { status: 404 });
    }

    // First row is headers
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return Response.json({ 
      success: true, 
      headers,
      data,
      total: data.length 
    });

  } catch (error) {
    console.error('Google Sheets API Error:', error);
    return Response.json({ 
      success: false, 
      message: 'حدث خطأ في جلب البيانات',
      error: error.message 
    }, { status: 500 });
  }
}
