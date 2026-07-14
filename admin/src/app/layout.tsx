import { Outfit } from 'next/font/google';
import type { Metadata } from "next";
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

const outfit = Outfit({
  subsets: ["latin"],
});

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
    <html lang="tr">
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
