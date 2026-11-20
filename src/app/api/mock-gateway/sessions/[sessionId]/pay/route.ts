import { isMockGatewayEnabled } from "@/lib/payments";
import { payMockSession } from "@/lib/payments/mock-gateway";

// POST /api/mock-gateway/sessions/:sessionId/pay
// Part of the MOCK payment gateway, not the store. This is the one endpoint
// that sees a card number, mirroring how card details go straight to the
// provider in production and never to the merchant's own API.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  // Once a real provider is configured, this endpoint does not exist.
  if (!isMockGatewayEnabled()) {
    return Response.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const { sessionId } = await params;
  const body = await request.json().catch(() => null);

  const result = await payMockSession(sessionId, {
    number: String(body?.number ?? ""),
    expiry: String(body?.expiry ?? ""),
    cvc: String(body?.cvc ?? ""),
  });

  if (!result.ok) {
    const status = result.code === "session_not_found" ? 404 : 402;
    return Response.json(
      { error: { code: result.code, message: result.message, field: result.field } },
      { status },
    );
  }
  return Response.json({ redirectUrl: `/orders/${result.orderId}` });
}
