import { z } from "zod";

// The seam between the store and whoever takes the money. The store knows
// only this file; the mock gateway (and later Stripe) sits behind it.

export type PaymentSession = {
  provider: string;
  sessionId: string;
  /** Where to send the customer to pay. Card details are entered there. */
  paymentUrl: string;
};

export interface PaymentProvider {
  readonly name: string;
  createSession(order: {
    orderId: string;
    orderNumber: string;
    amountCents: number;
    currency: string;
  }): Promise<PaymentSession>;
}

/** What the provider tells us afterwards, by signed webhook. */
export const paymentEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  createdAt: z.string(),
  data: z.object({
    sessionId: z.string(),
    orderId: z.string(),
    amountCents: z.number().int().nonnegative(),
    currency: z.string(),
    card: z.object({ brand: z.string(), last4: z.string().length(4) }).optional(),
    failureCode: z.string().optional(),
  }),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;
