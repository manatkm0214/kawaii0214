import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from "next/image";
// MascotWidgetは存在しないため削除

function Header() {
  // const DynamicLogoImage = require("@/lib/components/LogoImage").default;
  return (
    <header className="w-full flex flex-col items-center justify-center py-4 bg-linear-to-r from-pink-200 via-purple-100 to-yellow-100 shadow-lg z-10 relative">
      {/* <DynamicLogoImage /> 削除 */}
      <h1 className="idol-title text-3xl sm:text-4xl font-bold tracking-wide drop-shadow-lg mt-2">きらきら家計簿</h1>
    </header>
  );
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "きらきら家計簿",
  description: "AIと一緒に賢く管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ロゴ画像ヘッダー（localStorage対応） */}
        <Header />
        <main className="flex-1 flex flex-col min-h-0">
          {children}
        </main>
        <div className="bg-linear-to-r from-blue-500 to-pink-500">
          {/* <MascotWidget /> 削除 */}
        </div>
      </body>
    </html>
  );
}
