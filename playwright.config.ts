import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  DATABASE_URL: "file:./test.db",
  NEXTAUTH_URL: `http://localhost:${PORT}`,
  NEXTAUTH_SECRET: "e2e-secret",
  SEED_EMAIL: "boss@btb.my",
  SEED_PASSWORD: "btb12345",
  UPLOAD_DIR: "./uploads-test",
  // Tests always use local-disk photo storage, never a real R2 bucket, whatever .env contains.
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET_NAME: "",
  R2_ENDPOINT: "",
  // The service worker normally runs only in production builds; the tests exercise it in dev too.
  NEXT_PUBLIC_ENABLE_SW: "1",
  // Weather for the site diary comes from a local stand-in (tests/e2e/mock-weather.cjs), never the real service.
  OPENWEATHER_API_KEY: "e2e-key",
  OPENWEATHER_BASE_URL: "http://localhost:3199",
};

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: [
    { command: "node tests/e2e/mock-weather.cjs", url: "http://localhost:3199/health", reuseExistingServer: false, timeout: 30_000 },
    {
      command: `npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      env,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
