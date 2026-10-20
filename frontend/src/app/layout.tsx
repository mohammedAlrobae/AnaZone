import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnaZone - Voice Companion & World Explorer",
  description: "AnaZone - Real-time Voice Companion and World Explorer",
};

import { LanguageProvider } from "@/lib/i18n";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="h-full scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
