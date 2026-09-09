import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 20_000,
    // Every test file shares one real Postgres database (see .env.test.example)
    // and truncates it between tests (tests/setup.ts) — running files in
    // parallel would let one file's truncate wipe another's fixtures mid-run.
    // The suite is small enough that serial execution is fine.
    fileParallelism: false,
  },
});
