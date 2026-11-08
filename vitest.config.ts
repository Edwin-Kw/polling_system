import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          include: ["apps/api/src/**/*.test.ts", "packages/shared/src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
          setupFiles: ["./apps/web/src/test/setup.ts"],
        },
      },
    ],
  },
});
