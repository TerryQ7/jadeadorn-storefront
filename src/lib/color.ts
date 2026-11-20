/** Blends a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const weight = Math.abs(amount);
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    return Math.round(value + (target - value) * weight)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}
