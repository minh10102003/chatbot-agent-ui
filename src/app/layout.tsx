
import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Sidebar } from "@/components/ui/sidebar";
import { RightSidebar } from "@/components/ui/right-sidebar";
import { ThreadProvider } from "@/providers/Thread"; // <-- Thêm dòng này

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Data Chat",
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className + " bg-background text-foreground"}>
        <NuqsAdapter>
          <ThreadProvider>
            <div className="flex min-h-screen">
              {/* Sidebar trái */}
              <Sidebar />

              {/* Main content */}
              <main className="flex-1 p-8">{children}</main>

              {/* Sidebar phải (bạn có thể bỏ nếu không dùng) */}
              <RightSidebar />
            </div>
          </ThreadProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
