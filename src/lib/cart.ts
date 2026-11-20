"use client";

import { useSyncExternalStore } from "react";
import {
  addLine,
  parseStoredCart,
  quantityOf,
  removeLine,
  setLineQuantity,
  type CartLine,
} from "@/lib/cart-lines";

// The bag lives in the browser (localStorage) and holds only product ids and
// quantities. There is deliberately no price in here: anything stored on the
// customer's device can be edited, so the server prices the bag on every view
// and again when the order is placed.

export type { CartLine };

const STORAGE_KEY = "jadeadorn.cart.v1";
const CHECKOUT_KEY = "jadeadorn.checkout.v1";
const EMPTY: CartLine[] = [];

const listeners = new Set<() => void>();
// Used when localStorage is unavailable (some private-browsing modes).
let memoryFallback: string | null = null;
let cachedRaw: string | null | undefined;
let cachedLines: CartLine[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback;
  }
}

function writeRaw(raw: string | null): void {
  memoryFallback = raw;
  try {
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // The in-memory copy above keeps the bag working for this page view.
  }
}

// useSyncExternalStore needs the same array back until the data changes, so
// the parsed result is cached against the raw string it came from.
function getSnapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    const lines = parseStoredCart(raw);
    cachedLines = lines.length > 0 ? lines : EMPTY;
  }
  return cachedLines;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Fires when another tab changes the bag.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function save(lines: CartLine[]): void {
  writeRaw(lines.length > 0 ? JSON.stringify(lines) : null);
  listeners.forEach((listener) => listener());
}

export const cart = {
  /** Returns how many were actually added, which is less than asked once a line reaches its cap. */
  add(productId: number, quantity = 1): number {
    const before = getSnapshot();
    const after = addLine(before, productId, quantity);
    save(after);
    return quantityOf(after, productId) - quantityOf(before, productId);
  },
  setQuantity(productId: number, quantity: number): void {
    save(setLineQuantity(getSnapshot(), productId, quantity));
  },
  remove(productId: number): void {
    save(removeLine(getSnapshot(), productId));
  },
  clear(): void {
    save(EMPTY);
  },
};

export function useCartLines(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** False during server rendering and hydration, true once the browser's own data can be shown. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// --- Checkout attempt -------------------------------------------------------
// Remembers the idempotency key for the order being placed. The key stays the
// same while the submitted details stay the same (so a double tap or a retry
// after a dropped connection cannot create a second order) and is replaced as
// soon as the bag or the address changes.

export type CheckoutAttempt = {
  fingerprint: string;
  key: string;
  orderId?: string;
};

function randomKey(): string {
  // getRandomValues works on plain http:// too (e.g. testing from a phone on
  // the local network), where crypto.randomUUID is not available.
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readAttempt(): CheckoutAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_KEY);
    return raw ? (JSON.parse(raw) as CheckoutAttempt) : null;
  } catch {
    return null;
  }
}

function writeAttempt(attempt: CheckoutAttempt | null): void {
  try {
    if (attempt) {
      window.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(attempt));
    } else {
      window.sessionStorage.removeItem(CHECKOUT_KEY);
    }
  } catch {
    // Without sessionStorage a reload loses the key; a single page view is still safe.
  }
}

let currentAttempt: CheckoutAttempt | null = null;

export function idempotencyKeyFor(fingerprint: string): string {
  const stored = currentAttempt ?? readAttempt();
  if (stored && stored.fingerprint === fingerprint) {
    currentAttempt = stored;
    return stored.key;
  }
  currentAttempt = { fingerprint, key: randomKey() };
  writeAttempt(currentAttempt);
  return currentAttempt.key;
}

export function rememberOrderForAttempt(orderId: string): void {
  const stored = currentAttempt ?? readAttempt();
  if (!stored) return;
  currentAttempt = { ...stored, orderId };
  writeAttempt(currentAttempt);
}

/** Empties the bag once the order placed from it has been paid. */
export function finishCheckout(orderId: string): void {
  const stored = currentAttempt ?? readAttempt();
  if (stored?.orderId !== orderId) return;
  currentAttempt = null;
  writeAttempt(null);
  cart.clear();
}
