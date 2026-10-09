import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { CompanyBar } from "@/components/layout/company-bar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "BTB Solutions",
  description: "Job costing and progress billing for BTB Builders Sdn Bhd",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <CompanyBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
