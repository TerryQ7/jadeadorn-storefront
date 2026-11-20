"use client";

import { MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

export function QuantityStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  /** What is being counted, for screen readers, e.g. the product name. */
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY_PER_LINE}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
