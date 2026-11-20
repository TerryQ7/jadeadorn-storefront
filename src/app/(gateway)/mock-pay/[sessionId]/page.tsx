import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MockPayForm } from "@/components/MockPayForm";
import { formatCents } from "@/lib/money";
import { isMockGatewayEnabled } from "@/lib/payments";
import { getMockSession } from "@/lib/payments/mock-gateway";
import "./gateway.css";

// The MOCK payment gateway's hosted payment page. It is styled differently
// from the store on purpose: in production this page belongs to the payment
// provider and lives on their domain.

export const metadata: Metadata = {
  title: { absolute: "Test payment — Mock Gateway" },
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ sessionId: string }> };

export default function MockPayPage({ params }: Props) {
  return (
    <div className="gw">
      <p className="gw-banner">
        <strong>Test mode.</strong> This is a mock payment gateway. No money
        moves. Never enter a real card number.
      </p>
      <main className="gw-panel">
        <p className="gw-brand">Mock Gateway</p>
        <Suspense fallback={<p aria-busy="true">Loading payment…</p>}>
          <Session params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Session({ params }: Props) {
  await connection();
  if (!isMockGatewayEnabled()) notFound();
  const { sessionId } = await params;
  const session = await getMockSession(sessionId);

  if (!session) {
    return (
      <>
        <h1>Payment link not found</h1>
        <p>This payment link is not valid.</p>
        <a className="gw-back" href="/cart">
          Return to JadeAdorn
        </a>
      </>
    );
  }

  if (session.status === "paid") {
    return (
      <>
        <h1>Already paid</h1>
        <p>Order {session.orderNumber} has been paid.</p>
        <a className="gw-back" href={`/orders/${session.orderId}`}>
          View your order
        </a>
      </>
    );
  }

  const amount = formatCents(session.amountCents);
  return (
    <>
      <h1>Pay JadeAdorn</h1>
      <dl className="gw-summary">
        <div>
          <dt>Order</dt>
          <dd>{session.orderNumber}</dd>
        </div>
        <div>
          <dt>Amount due</dt>
          <dd data-testid="amount-due">{amount}</dd>
        </div>
      </dl>
      <MockPayForm sessionId={session.id} amountLabel={amount} />
      <a className="gw-back" href="/checkout">
        Cancel and return to JadeAdorn
      </a>
    </>
  );
}
