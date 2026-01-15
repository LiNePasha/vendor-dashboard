import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "Vendor Dashboard",
  description: "WCFM Vendor Dashboard PWA",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
