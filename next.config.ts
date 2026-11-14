import type { NextConfig } from "next";

/**
 * HTTP security headers (ใช้กับทุกหน้า)
 * - ยังไม่ใส่ Content-Security-Policy: ต้องใช้ nonce กับสคริปต์ตั้งธีมและสคริปต์ของ Next (ดู PLAN.md)
 * - HSTS ให้โฮสต์ (Vercel) ตั้งให้เมื่อมี HTTPS
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // กันเว็บอื่นฝังเราในเฟรม (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
