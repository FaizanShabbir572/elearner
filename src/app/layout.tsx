import type { Metadata } from "next";
import "./globals.css";
import { AppLoader } from "@/components/AppLoader";

export const metadata: Metadata = {
  title: { default: "LearnHub", template: "%s · LearnHub" },
  description: "Courses, progress tracking and certificates.",
};

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
