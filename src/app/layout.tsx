import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/pivot/pwa-manager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Pivot - A small next step";
const DESCRIPTION = "A calm pause space for choosing a different next step when an urge appears.";

export const metadata: Metadata = {
  // Absolute base so the share image (app/opengraph-image.tsx) resolves in unfurls.
  metadataBase: new URL("https://pivot.n8builds.dev"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Pivot", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  applicationName: "Pivot",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pivot" },
  icons: {
    // The SVG switches between a sage and a paper p with the tab bar's color scheme; the ICO is the fallback.
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4d6d5a",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
