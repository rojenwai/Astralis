import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  weight: ["300", "400"],
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  weight: ["200", "300", "400"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "ASTRALIS — Listening to the Universe",
  description:
    "A living digital artwork that translates real astronomical events — neutrinos, gamma-ray bursts, gravitational waves, solar weather — into light, motion and sound.",
};

export const viewport: Viewport = {
  themeColor: "#000005",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
