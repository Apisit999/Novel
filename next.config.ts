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

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    // รูปปกอยู่ในบัคเก็ต covers (สาธารณะ) ของ Supabase เท่านั้น
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/covers/**",
          },
        ]
      : [],
  },
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
