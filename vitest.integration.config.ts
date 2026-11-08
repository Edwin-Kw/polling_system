import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/api/test/**/*.integration.test.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
