import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node by default — most of what is worth testing here is pure colour
    // math. The DOM probe opts into jsdom with a per-file docblock.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
