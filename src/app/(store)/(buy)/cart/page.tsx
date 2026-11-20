import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Your bag" };

export default function CartPage() {
  return (
    <>
      <h1 className="page-title">Your bag</h1>
      <CartView />
    </>
  );
}
