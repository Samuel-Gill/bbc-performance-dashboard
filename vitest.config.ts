import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    pool: "threads",
    maxWorkers: 1,
    isolate: true,
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 60000,
  },
});
