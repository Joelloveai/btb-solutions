import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  DATABASE_URL: "file:./test.db",
  NEXTAUTH_URL: `http://localhost:${PORT}`,
  NEXTAUTH_SECRET: "e2e-secret",
  SEED_EMAIL: "boss@btb.my",
  SEED_PASSWORD: "btb12345",
};

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: {
    command: `npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
