import { placeOrder } from "@/lib/checkout";

// POST /api/checkout
// Saves the order as "pending_payment" and answers with the page where the
// customer pays. No card data passes through this endpoint.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await placeOrder(body);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    paymentUrl: result.paymentUrl,
  });
}
