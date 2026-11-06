
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,

    env: {
      NODE_ENV: "test",
      SESSION_SECRET:
        "test_session_secret_key_must_be_at_least_32_chars",
      MONGODB_URI:
        "mongodb://127.0.0.1:27017/supplysense_test",
      CLIENT_ORIGIN: "http://localhost:5173",
    },
  },
});
