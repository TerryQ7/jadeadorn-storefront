"use client";

import { useEffect, useState } from "react";
import { cart, type CartLine } from "@/lib/cart";
import type { Quote } from "@/lib/pricing";

// Which bag the latest response was for, and whether it succeeded.
type Fetched = { lines: CartLine[]; failed: boolean };

/**
 * Asks the server to price the current bag. The browser never does this sum
 * itself: it does not know the prices.
 *
 * Returns the last good quote while a newer one is loading, so the page does
 * not flicker on every quantity change.
 */
export function useQuote(lines: CartLine[], enabled: boolean) {
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);
  const [removedCount, setRemovedCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || lines.length === 0) return;
    const controller = new AbortController();

    fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Quote failed: ${response.status}`);
        const body: { quote: Quote; unavailableProductIds: number[] } =
          await response.json();
        setFetched({ lines, failed: false });
        setLastQuote(body.quote);
        if (body.unavailableProductIds.length > 0) {
          setRemovedCount((n) => n + body.unavailableProductIds.length);
          // Drop items that are no longer sold. This changes `lines`, which
          // triggers a fresh quote for what remains.
          body.unavailableProductIds.forEach((id) => cart.remove(id));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setFetched({ lines, failed: true });
      });

    return () => controller.abort();
  }, [lines, enabled, attempt]);

  const current = fetched && fetched.lines === lines ? fetched : null;

  return {
    quote: lines.length === 0 ? null : lastQuote,
    loading: enabled && lines.length > 0 && current === null,
    failed: current?.failed ?? false,
    removedCount,
    retry: () => {
      setFetched(null);
      setAttempt((n) => n + 1);
    },
  };
}
