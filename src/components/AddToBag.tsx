"use client";

import Link from "next/link";
import { useState } from "react";
import { QuantityStepper } from "@/components/QuantityStepper";
import { cart } from "@/lib/cart";
import { MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

export function AddToBag({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [quantity, setQuantity] = useState(1);
  // null until the button is used; afterwards, how many the last tap added.
  const [added, setAdded] = useState<number | null>(null);

  return (
    <div className="buy">
      <div className="buy__row">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={productName}
        />
        <button
          type="button"
          className="button button--outline buy__add"
          onClick={() => setAdded(cart.add(productId, quantity))}
        >
          Add to bag
        </button>
      </div>
      <p className="buy__status" role="status">
        {added !== null && (
          <>
            {added > 0
              ? `Added ${added} to your bag. `
              : `Your bag already holds the limit of ${MAX_QUANTITY_PER_LINE}. `}
            <Link href="/cart">View bag</Link>
          </>
        )}
      </p>
    </div>
  );
}
