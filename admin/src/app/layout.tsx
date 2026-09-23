import { Outfit } from 'next/font/google';
import type { Metadata } from "next";
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

const outfit = Outfit({
  // Turkce karakterler (g, s, I) yedek yazi tipine dusmesin.
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/*
 * Tema sinifini ILK BOYAMADAN once kur.
 *
 * Eskiden tema yalnizca ThemeProvider bagландiktan sonra uygulaniyordu:
 * koyu tema kullanan personel her sayfa acilisinda once beyaz bir ekran
 * goruyordu. Bu betik senkron calisir, React'ten oncedir.
 */
const TEMA_BETIGI = `
try {
  if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
`;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_BETIGI }} />
      </head>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>{children}</SidebarProvider>
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
