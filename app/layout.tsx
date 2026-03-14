import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "./components/ui/NavBar";
import { SmoothScroll } from "./components/ui/animations/SmoothScroll";
import Cursor from "./components/ui/animations/Cursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PreSynth | Polymarket x Synthdata Terminal",
  description: "Advanced analytics terminal for prediction markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-[#0a0a0c] text-white`}
        suppressHydrationWarning
      >
        <SmoothScroll>
          <Cursor />
          <NavBar />
          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>
        </SmoothScroll>
      </body>
    </html>
  );
}
