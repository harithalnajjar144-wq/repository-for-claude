import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "حلالي | سوق المواشي الرقمي في العراق", template: "%s | حلالي" },
  description:
    "منصة حلالي لبيع وشراء المواشي والحيوانات في العراق: إعلانات موثقة، مزادات محمية بالتأمين، أطباء بيطريون ومحلات أعلاف ومستلزمات.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { themeColor: "#216a43" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="topo-bg min-h-screen">
        <Header />
        <main className="min-h-[60vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
