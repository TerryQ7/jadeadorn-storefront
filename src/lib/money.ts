// Money is stored and computed as integer cents everywhere; this is the only
// place it becomes a display string.
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
