import { defineConfig } from "vitest/config";

// เทสต์ฐานข้อมูล: รันแยกจาก unit test (ต้องมี Supabase local หรือโปรเจกต์ที่ link ไว้)
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
