import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function addToBag(page: Page, productSlug: string) {
  await page.goto(`/products/${productSlug}`);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("Added 1 to your bag.")).toBeVisible();
}

async function fillCheckout(page: Page, overrides: { zip?: string } = {}) {
  await page.getByLabel("Email").fill("mei.lin@example.com");
  await page.getByLabel("Full name").fill("Mei Lin");
  await page.getByLabel("Street address").fill("12 Orchard St");
  await page.getByLabel("City").fill("Brooklyn");
  await page.getByLabel("State").selectOption("NY");
  await page.getByLabel("ZIP code").fill(overrides.zip ?? "11201");
}

test("a customer browses a category, buys a product and gets a saved confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Buddhist Mala" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Buddhist Mala" }),
  ).toBeVisible();
  await expect(page.getByText("3 pieces")).toBeVisible();

  await page.getByRole("link", { name: /Sandalwood Prayer Mala/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sandalwood Prayer Mala" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByRole("link", { name: "View bag" }).click();

  const summary = page.getByLabel("Order summary");
  await expect(summary).toContainText("Add $42.00 more for free shipping.");
  await expect(summary).toContainText("Subtotal$58.00");
  await expect(summary).toContainText("Shipping$6.95");
  await expect(summary).toContainText("Estimated total$64.95");

  await page.getByRole("link", { name: "Checkout" }).click();
  await fillCheckout(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page.getByText("Test mode.")).toBeVisible();
  await expect(page.getByTestId("amount-due")).toHaveText("$64.95");
  await page.getByRole("button", { name: /Payment succeeds/ }).click();
  await page.getByRole("button", { name: "Pay $64.95" }).click();

  await expect(
    page.getByRole("heading", { name: "Thank you. Your order is confirmed." }),
  ).toBeVisible();
  const orderNumber = await page.getByTestId("order-number").textContent();
  expect(orderNumber).toMatch(/^JA-[2-9A-Z]{6}$/);
  await expect(page.getByText("Total paid")).toBeVisible();
  await expect(page.getByText("Visa ending in 4242")).toBeVisible();

  // The order is stored on the server, not in the page: it survives a reload.
  await page.reload();
  await expect(page.getByTestId("order-number")).toHaveText(orderNumber!);
  await expect(page.getByText("12 Orchard St")).toBeVisible();

  // And the bag was emptied once the order was paid.
  await expect(page.getByRole("link", { name: "Bag, empty" })).toBeVisible();
});

test("a declined card leaves the order unpaid until another card succeeds", async ({
  page,
}) => {
  await addToBag(page, "black-onyx-bead-bracelet");
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await page.getByRole("button", { name: /Card is declined/ }).click();
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(
    page.getByText("The card was declined. Try a different card."),
  ).toBeVisible();

  await page.getByRole("button", { name: /Payment succeeds/ }).click();
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you. Your order is confirmed." }),
  ).toBeVisible();
});

test("shipping becomes free when the bag reaches $100", async ({ page }) => {
  await addToBag(page, "sandalwood-prayer-mala"); // $58
  await addToBag(page, "black-onyx-bead-bracelet"); // $42
  await page.goto("/cart");

  const summary = page.getByLabel("Order summary");
  await expect(summary).toContainText("Your order ships free.");
  await expect(summary).toContainText("ShippingFree");
  await expect(summary).toContainText("Estimated total$100.00");
});

test("changing a quantity in the bag updates the total", async ({ page }) => {
  await addToBag(page, "minimal-wood-bead-bracelet"); // $29
  await page.goto("/cart");

  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByLabel("Order summary")).toContainText("Subtotal$58.00");

  await page
    .getByRole("button", { name: "Remove Minimal Wood Bead Bracelet" })
    .click();
  await expect(page.getByText("Your bag is empty.")).toBeVisible();
});

test("the server rejects an invalid ZIP code and says which field to fix", async ({
  page,
}) => {
  await addToBag(page, "black-onyx-bead-bracelet");
  await page.goto("/checkout");
  await fillCheckout(page, { zip: "1120" });
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page.getByText("Enter a 5-digit ZIP code")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("an order link that does not exist shows the not-found page", async ({
  page,
}) => {
  await page.goto("/orders/ord_this-order-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "We couldn't find that page." }),
  ).toBeVisible();
});

test.describe("payment webhook over HTTP", () => {
  const SECRET = "e2e-webhook-secret"; // matches playwright.config.ts

  function sign(body: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac("sha256", SECRET)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }

  async function createPendingOrder(request: Page["request"]) {
    const quote = await request.post("/api/quote", {
      data: { items: [{ productId: 1, quantity: 1 }] },
    });
    const { quote: priced } = await quote.json();
    const checkout = await request.post("/api/checkout", {
      data: {
        items: [{ productId: 1, quantity: 1 }],
        email: "webhook@example.com",
        shipping: {
          name: "Webhook Test",
          line1: "1 Main St",
          city: "Albany",
          state: "NY",
          zip: "12207",
        },
        idempotencyKey: `e2e-webhook-${Date.now()}-${Math.random()}`,
      },
    });
    expect(checkout.ok()).toBe(true);
    const { orderId, paymentUrl } = await checkout.json();
    return {
      orderId: orderId as string,
      // The payment URL ends with the session id the store opened.
      sessionId: (paymentUrl as string).split("/").pop()!,
      totalCents: priced.totalCents as number,
    };
  }

  function successEvent(order: {
    orderId: string;
    sessionId: string;
    totalCents: number;
  }) {
    return JSON.stringify({
      id: `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "payment.succeeded",
      createdAt: new Date().toISOString(),
      data: {
        sessionId: order.sessionId,
        orderId: order.orderId,
        amountCents: order.totalCents,
        currency: "usd",
      },
    });
  }

  test("an unsigned or forged event cannot mark an order paid", async ({
    page,
  }) => {
    const order = await createPendingOrder(page.request);
    const { orderId } = order;
    const body = successEvent(order);

    const unsigned = await page.request.post("/api/webhooks/payment", {
      data: body,
      headers: { "content-type": "application/json" },
    });
    const forged = await page.request.post("/api/webhooks/payment", {
      data: body,
      headers: {
        "content-type": "application/json",
        "x-payment-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
      },
    });

    expect(unsigned.status()).toBe(400);
    expect(forged.status()).toBe(400);
    await page.goto(`/orders/${orderId}`);
    await expect(
      page.getByRole("heading", { name: "This order hasn't been paid yet." }),
    ).toBeVisible();
  });

  test("a correctly signed event marks the order paid, once", async ({
    page,
  }) => {
    const order = await createPendingOrder(page.request);
    const { orderId } = order;
    const body = successEvent(order);
    const headers = {
      "content-type": "application/json",
      "x-payment-signature": sign(body),
    };

    const first = await page.request.post("/api/webhooks/payment", {
      data: body,
      headers,
    });
    const redelivered = await page.request.post("/api/webhooks/payment", {
      data: body,
      headers,
    });

    expect(await first.json()).toEqual({ received: true, outcome: "applied" });
    expect(await redelivered.json()).toEqual({
      received: true,
      outcome: "duplicate",
    });
    await page.goto(`/orders/${orderId}`);
    await expect(
      page.getByRole("heading", { name: "Thank you. Your order is confirmed." }),
    ).toBeVisible();
  });
});
