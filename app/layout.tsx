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
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Animations — Adedamola",
    title: "Animations — Adedamola",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Animations playground by Adedamola",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Animations — Adedamola",
    description: DESCRIPTION,
    images: ["/og.png"],
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
