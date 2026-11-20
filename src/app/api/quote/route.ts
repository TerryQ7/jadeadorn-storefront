import { quoteCart } from "@/lib/checkout";

// POST /api/quote  { items: [{ productId, quantity }] }
// Prices a bag for display. The browser keeps only ids and quantities; names
// and prices always come from here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await quoteCart(body?.items);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    quote: result.quote,
    unavailableProductIds: result.unavailableProductIds,
  });
}
