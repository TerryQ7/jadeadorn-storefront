import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Inter, with its optical-size axis: large sizes get the Display cut that
// shopify/DESIGN.md names as the open substitute for Neue Haas Grotesk
// Display, small sizes get the text cut. One file, shipped with the app, so
// nothing is fetched from a font service at build time or in the browser.
const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["Helvetica", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "JadeAdorn — Beaded bracelets, natural stone and malas",
    template: "%s — JadeAdorn",
  },
  description:
    "Everyday beaded bracelets, natural stone, wood beads and malas. Free U.S. shipping on orders of $100 or more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-scroll-behavior tells Next.js the smooth scrolling set in CSS is
    // intentional, so it can switch it off during page-to-page navigation.
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
