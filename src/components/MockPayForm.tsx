"use client";

import { useState } from "react";
import { TEST_CARD_OPTIONS } from "@/lib/payments/test-cards";
import { useResetOnRestore } from "@/lib/use-reset-on-restore";

type PayResponse =
  | { redirectUrl: string }
  | { error: { code: string; message: string; field?: string } };

const groupDigits = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})(?=.)/g, "$1 ");

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

export function MockPayForm({
  sessionId,
  amountLabel,
}: {
  sessionId: string;
  amountLabel: string;
}) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(
    null,
  );
  const [paying, setPaying] = useState(false);
  useResetOnRestore(setPaying);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (paying) return;
    setPaying(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/mock-gateway/sessions/${encodeURIComponent(sessionId)}/pay`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ number, expiry, cvc }),
        },
      );
      const body: PayResponse = await response.json();
      if ("error" in body) {
        setError(body.error);
        setPaying(false);
        return;
      }
      window.location.assign(body.redirectUrl);
    } catch {
      setError({ message: "Could not reach the gateway. Try again." });
      setPaying(false);
    }
  }

  // Marks the field the gateway complained about and points it at the message.
  const fieldState = (field: string) =>
    error?.field === field
      ? { "aria-invalid": true, "aria-describedby": "gw-error" }
      : {};

  return (
    <form className="gw-form" onSubmit={pay}>
      <fieldset className="gw-cards">
        <legend>Test cards</legend>
        <p>Choose one to fill in the form. Only these numbers are accepted.</p>
        <ul>
          {TEST_CARD_OPTIONS.map((card) => (
            <li key={card.number}>
              <button
                type="button"
                onClick={() => {
                  setNumber(groupDigits(card.number));
                  // Always a few years ahead, so the shortcut never expires.
                  setExpiry(`12/${(new Date().getFullYear() + 5) % 100}`);
                  setCvc("123");
                  setError(null);
                }}
              >
                <code>{groupDigits(card.number)}</code>
                <span>{card.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="gw-field">
        <label htmlFor="gw-number">Card number</label>
        {/* autocomplete is off on purpose: the browser must not offer a saved real card. */}
        <input
          id="gw-number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="4242 4242 4242 4242"
          value={number}
          onChange={(e) => setNumber(groupDigits(e.target.value))}
          {...fieldState("number")}
          required
        />
      </div>
      <div className="gw-row">
        <div className="gw-field">
          <label htmlFor="gw-expiry">Expiry (MM/YY)</label>
          <input
            id="gw-expiry"
            inputMode="numeric"
            autoComplete="off"
            placeholder="12/34"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            {...fieldState("expiry")}
            required
          />
        </div>
        <div className="gw-field">
          <label htmlFor="gw-cvc">Security code</label>
          <input
            id="gw-cvc"
            inputMode="numeric"
            autoComplete="off"
            placeholder="123"
            maxLength={4}
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
            {...fieldState("cvc")}
            required
          />
        </div>
      </div>

      {error && (
        <p className="gw-error" id="gw-error" role="alert">
          {error.message}
        </p>
      )}

      <button type="submit" className="gw-pay" disabled={paying}>
        {paying ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}
