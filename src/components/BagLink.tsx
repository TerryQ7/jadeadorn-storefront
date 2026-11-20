"use client";

import Link from "next/link";
import { useCartLines } from "@/lib/cart";

export function BagLink() {
  const lines = useCartLines();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Link
      href="/cart"
      className="button button--outline bag-link"
      aria-label={count === 0 ? "Bag, empty" : `Bag, ${count} ${count === 1 ? "item" : "items"}`}
    >
      Bag
      {count > 0 && (
        <span className="bag-link__count" aria-hidden="true">
          {count}
        </span>
      )}
    </Link>
  );
}
