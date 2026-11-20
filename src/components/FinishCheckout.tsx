"use client";

import { useEffect } from "react";
import { finishCheckout } from "@/lib/cart";

/** Rendered on a paid order's page: empties the bag that order was placed from. */
export function FinishCheckout({ orderId }: { orderId: string }) {
  useEffect(() => {
    finishCheckout(orderId);
  }, [orderId]);
  return null;
}
