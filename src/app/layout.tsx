import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppLoader } from "@/components/AppLoader";

export const metadata: Metadata = {
  title: { default: "Trade With Ray", template: "%s · Trade With Ray" },
  description: "Trade With Ray — structured trading courses, progress tracking and certificates.",
  applicationName: "Trade With Ray",
};

export const viewport: Viewport = { themeColor: "#020813", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
