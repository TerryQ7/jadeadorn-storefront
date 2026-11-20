"use client";

import { useEffect } from "react";

/**
 * Clears a "busy" flag when the browser brings the page back from its
 * back/forward cache. Without this, a customer who submits a form, lands on
 * the next page and presses Back would find the button still disabled and
 * reading "Saving…", because the old page is restored exactly as it was left.
 */
export function useResetOnRestore(setBusy: (busy: false) => void): void {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [setBusy]);
}
