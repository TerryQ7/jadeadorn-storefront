"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Totals } from "@/components/Totals";
import {
  cart,
  idempotencyKeyFor,
  rememberOrderForAttempt,
  useCartLines,
  useHydrated,
} from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { US_STATES } from "@/lib/us-states";
import { useQuote } from "@/lib/use-quote";
import { useResetOnRestore } from "@/lib/use-reset-on-restore";

type FieldErrors = Record<string, string>;

type CheckoutResponse =
  | { orderId: string; paymentUrl: string }
  | {
      error: {
        code: string;
        message: string;
        fields?: FieldErrors;
        unavailableProductIds?: number[];
      };
    };

export function CheckoutForm() {
  const hydrated = useHydrated();
  const lines = useCartLines();
  const { quote, removedCount } = useQuote(lines, hydrated);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useResetOnRestore(setSubmitting);

  const removedNotice = removedCount > 0 && (
    <p className="notice" role="status">
      {removedCount === 1
        ? "One item is no longer available and was removed from your bag."
        : `${removedCount} items are no longer available and were removed from your bag.`}
    </p>
  );

  if (!hydrated) {
    return <p className="muted" aria-busy="true">Loading checkout…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="empty">
        {removedNotice}
        <p>{formError ?? "Your bag is empty, so there is nothing to check out."}</p>
        <Link href="/#shop" className="button button--primary">
          Browse the collection
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    const details = {
      items: lines,
      email: text("email"),
      shipping: {
        name: text("name"),
        line1: text("line1"),
        line2: text("line2"),
        city: text("city"),
        state: text("state"),
        zip: text("zip"),
      },
    };

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...details,
          // Same details => same key => the server returns the order it
          // already made instead of creating a second one.
          idempotencyKey: idempotencyKeyFor(JSON.stringify(details)),
        }),
      });
      const body: CheckoutResponse = await response.json();

      if ("error" in body) {
        if (body.error.unavailableProductIds) {
          body.error.unavailableProductIds.forEach((id) => cart.remove(id));
        }
        setErrors(body.error.fields ?? {});
        setFormError(body.error.message);
        setSubmitting(false);
        const firstInvalid = Object.keys(body.error.fields ?? {})[0];
        if (firstInvalid) {
          const input = formRef.current?.elements.namedItem(
            firstInvalid.replace("shipping.", ""),
          );
          if (input instanceof HTMLElement) input.focus();
        }
        return;
      }

      rememberOrderForAttempt(body.orderId);
      // A full navigation: the payment page belongs to the payment provider.
      window.location.assign(body.paymentUrl);
    } catch {
      setFormError(
        "We couldn't reach the store. Check your connection and try again. You won't be charged twice.",
      );
      setSubmitting(false);
    }
  }

  const field = (
    name: string,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    errorKey = `shipping.${name}`,
  ) => {
    const error = errors[errorKey];
    return (
      <div className={`field field--${name}`}>
        <label htmlFor={`checkout-${name}`}>{label}</label>
        <input
          id={`checkout-${name}`}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `checkout-${name}-error` : undefined}
          {...props}
        />
        {error && (
          <p className="field__error" id={`checkout-${name}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="checkout">
      <form ref={formRef} className="form" onSubmit={submit}>
        <fieldset>
          <legend>Contact</legend>
          {field(
            "email",
            "Email",
            {
              type: "email",
              autoComplete: "email",
              inputMode: "email",
              required: true,
              maxLength: 254,
            },
            "email",
          )}
        </fieldset>

        <fieldset>
          <legend>Shipping address</legend>
          <p className="muted">We ship within the United States.</p>
          {field("name", "Full name", {
            autoComplete: "shipping name",
            required: true,
            maxLength: 100,
          })}
          {field("line1", "Street address", {
            autoComplete: "shipping address-line1",
            required: true,
            maxLength: 120,
          })}
          {field("line2", "Apartment, suite (optional)", {
            autoComplete: "shipping address-line2",
            maxLength: 120,
          })}
          <div className="form__row">
            {field("city", "City", {
              autoComplete: "shipping address-level2",
              required: true,
              maxLength: 80,
            })}
            <div className="field field--state">
              <label htmlFor="checkout-state">State</label>
              <select
                id="checkout-state"
                name="state"
                autoComplete="shipping address-level1"
                required
                defaultValue=""
                aria-invalid={errors["shipping.state"] ? true : undefined}
                aria-describedby={
                  errors["shipping.state"] ? "checkout-state-error" : undefined
                }
              >
                <option value="" disabled>
                  Select
                </option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              {errors["shipping.state"] && (
                <p className="field__error" id="checkout-state-error">
                  {errors["shipping.state"]}
                </p>
              )}
            </div>
            {field("zip", "ZIP code", {
              autoComplete: "shipping postal-code",
              inputMode: "numeric",
              required: true,
              maxLength: 10,
            })}
          </div>
        </fieldset>

        {formError && (
          <p className="notice notice--error" role="alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          className="button button--primary button--block"
          disabled={submitting}
        >
          {submitting ? "Saving your order…" : "Continue to payment"}
        </button>
        <p className="form__hint">
          You&apos;ll enter card details on the next page. This is a test
          checkout: no real payment is taken.
        </p>
      </form>

      <aside className="summary" aria-label="Order summary">
        <h2>In your bag</h2>
        {removedNotice}
        {quote ? (
          <>
            <ul className="summary__lines">
              {quote.lines.map((line) => (
                <li key={line.productId}>
                  <span>
                    {line.name}
                    <span className="muted"> × {line.quantity}</span>
                  </span>
                  <span>{formatCents(line.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <Totals
              subtotalCents={quote.subtotalCents}
              shippingCents={quote.shippingCents}
              totalCents={quote.totalCents}
            />
          </>
        ) : (
          <p className="muted" aria-busy="true">Loading…</p>
        )}
        <Link href="/cart" className="summary__back">
          Edit bag
        </Link>
      </aside>
    </div>
  );
}
