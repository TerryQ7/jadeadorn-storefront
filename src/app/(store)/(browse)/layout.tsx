import type { Viewport } from "next";
import { StoreShell } from "@/components/StoreShell";

// Browsing pages (home, category, product) sit on the black canvas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreShell canvas="night">{children}</StoreShell>;
}
