import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// End-to-end tests drive the production build in a phone-sized browser,
// against their own database file so they never touch local demo data.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_PATH: "data/e2e.db",
      PAYMENT_WEBHOOK_SECRET: "e2e-webhook-secret",
    },
  },
});
