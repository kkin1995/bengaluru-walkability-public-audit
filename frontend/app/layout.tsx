import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Kannada } from "next/font/google";
import "./globals.css";
import { FooterBoundary } from "./components/FooterBoundary";

// Self-hosted Google Fonts via next/font — exposed as CSS variables
// for the design system to reference in globals.css (--font-sans etc.).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const notoSansKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans-kannada",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bengaluru Walkability Audit",
  description:
    "Help improve pedestrian infrastructure in Bengaluru by reporting issues near you.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  // maximumScale removed — allows browser zoom per WCAG 1.4.4
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${inter.variable} ${jetbrainsMono.variable} ${notoSansKannada.variable}`;
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Leaflet CSS — loaded globally so SSR-disabled map components still style correctly */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen antialiased flex flex-col"><div className="flex-1">{children}</div><FooterBoundary /></body>
    </html>
  );
}
