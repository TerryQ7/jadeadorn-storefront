import type { Viewport } from "next";
import { StoreShell } from "@/components/StoreShell";

// Buying pages (bag, checkout, order) flip to the light canvas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d4f9e0",
};

export default function BuyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreShell canvas="light">{children}</StoreShell>;
}
