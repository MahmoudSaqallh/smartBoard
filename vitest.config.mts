import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests cover pure whiteboard logic and the store, so a Node environment is enough.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
