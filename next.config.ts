import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy
 * - สคริปต์ต้องมาจากโดเมนเราเอง (กันสคริปต์ภายนอกที่ถูกฉีดเข้ามาโหลด/ส่งข้อมูลออก) แต่ยังต้องยอม 'unsafe-inline'
 *   เพราะสคริปต์ตั้งธีมและสคริปต์ฝังของ Next ยังไม่ใช้ nonce (nonce ทำให้ทุกหน้าต้องเรนเดอร์สดและเสียแคช —
 *   เก็บไว้เป็นงานต่อยอด ดู PLAN.md); dev ต้องการ 'unsafe-eval' เพิ่ม
 * - ไม่ใส่ upgrade-insecure-requests: Safari ใช้กับ http://localhost ด้วยแล้วสคริปต์โหลดไม่ได้ (HSTS ทำหน้าที่นี้บนเว็บจริงอยู่แล้ว)
 * - ส่วนที่เหลือเข้มเต็มที่: ไม่มี <object>/<base> แปลก ๆ, ฟอร์มส่งกลับโดเมนเราเท่านั้น, ห้ามถูกฝังเฟรม,
 *   รูป/วิดีโอ/การเชื่อมต่อมาได้เฉพาะโดเมนเรากับ Supabase ของเรา
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https/, "wss")}${isProd ? "" : " ws:"}`
    .replace(/\s+/g, " ")
    .trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** HTTP security headers (ใช้กับทุกหน้า) */
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // กันเว็บอื่นฝังเราในเฟรม (clickjacking) — ซ้ำกับ frame-ancestors สำหรับเบราว์เซอร์เก่า
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // บังคับ HTTPS 2 ปี (เบราว์เซอร์ละเว้นบน http://localhost) — ไม่ใส่ preload เพราะถอนยาก
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" }, // แยกหน้าต่างเราออกจากเว็บอื่นที่เปิดเรา
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

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
