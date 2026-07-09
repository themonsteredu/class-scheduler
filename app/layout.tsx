import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "수업 스케줄러",
  description: "진로수업 강사 파견 중개 관리",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "수업 스케줄러",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
