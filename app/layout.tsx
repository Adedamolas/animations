import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const SITE = "https://animations.adedamola.work";
const DESCRIPTION =
  "A playground for pouring out motion ideas — physics-driven, fluid web animations by Adedamola.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Animations — Adedamola",
  description: DESCRIPTION,
  // og:image comes from the per-route `opengraph-image.png` files (each
  // experiment snapshots its own page; the root one is the gallery). og:title
  // / description fall back to each page's own metadata.
  openGraph: {
    type: "website",
    siteName: "Animations — Adedamola",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
