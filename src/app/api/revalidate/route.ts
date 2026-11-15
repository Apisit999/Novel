import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { parseServerEnv } from "@/lib/env";

/**
 * เคลียร์แคชข้อมูลทันที — ใช้หลังแก้ฐานข้อมูลโดยตรง (นำเข้าข้อมูล สคริปต์ เทสต์) ที่ไม่ได้ผ่านหลังบ้าน
 * (หลังบ้านเคลียร์แคชเองอยู่แล้วหลังบันทึกทุกครั้ง)
 *
 *   curl -X POST https://เว็บ/api/revalidate -H "x-revalidate-secret: <REVALIDATE_SECRET>"
 *   (ระบุ tag เฉพาะได้: -d '{"tags":["catalog"]}' -H "content-type: application/json")
 *
 * ไม่ตั้ง REVALIDATE_SECRET → endpoint นี้ปิด (ตอบ 404 เหมือนไม่มีอยู่)
 */
const ALLOWED_TAGS = ["catalog", "settings", "home"] as const;
const bodySchema = z.object({ tags: z.array(z.enum(ALLOWED_TAGS)).min(1).optional() });

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y); // เทียบแบบเวลาคงที่ กันเดารหัสจากเวลาตอบ
}

export async function POST(request: Request) {
  const secret = parseServerEnv(process.env).REVALIDATE_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  if (!safeEqual(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let tags: readonly string[] = ALLOWED_TAGS;
  const text = await request.text();
  if (text) {
    try {
      const parsed = bodySchema.parse(JSON.parse(text));
      if (parsed.tags) tags = parsed.tags;
    } catch {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
  }

  for (const tag of tags) revalidateTag(tag, { expire: 0 }); // หมดอายุทันที ไม่ให้เสิร์ฟของเก่าอีก
  return Response.json({ revalidated: tags });
}
