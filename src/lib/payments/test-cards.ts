// The card numbers the mock gateway accepts, modelled on Stripe's test cards.
// Kept in its own file with no server imports so the payment form can list
// them in the browser.

export type TestCard = {
  number: string;
  brand: string;
  label: string;
} & (
  | { outcome: "approved" }
  | { outcome: "declined"; code: string; message: string }
);

export const TEST_CARDS: TestCard[] = [
  {
    number: "4242424242424242",
    brand: "Visa",
    label: "Payment succeeds",
    outcome: "approved",
  },
  {
    number: "4000000000000002",
    brand: "Visa",
    label: "Card is declined",
    outcome: "declined",
    code: "card_declined",
    message: "The card was declined. Try a different card.",
  },
  {
    number: "4000000000009995",
    brand: "Visa",
    label: "Insufficient funds",
    outcome: "declined",
    code: "insufficient_funds",
    message: "The card has insufficient funds. Try a different card.",
  },
];

export const TEST_CARD_OPTIONS = TEST_CARDS.map(({ number, label }) => ({
  number,
  label,
}));
