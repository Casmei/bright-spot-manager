import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DATABASE_URL for the integration tests comes from .env, like the db:* scripts
    env: loadEnv("test", process.cwd(), ""),
  },
});
