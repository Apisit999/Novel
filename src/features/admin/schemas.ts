import { z } from "zod";

/** slug: ตัวพิมพ์เล็ก ตัวเลข และขีดกลาง (ใช้ใน URL — ภาษาไทยให้ทับศัพท์เป็นอังกฤษ) */
export const slugSchema = z
  .string()
  .trim()
  .min(2, "slug สั้นเกินไป")
  .max(80, "slug ยาวเกินไป")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง (เช่น moonlit-garden)");

export const titleSchema = z.object({
  type: z.enum(["novel", "manga", "video"]),
  slug: slugSchema,
  name: z.string().trim().min(1, "กรุณากรอกชื่อเรื่อง").max(200),
  synopsis: z.string().trim().max(5000).default(""),
  /** ชื่อผู้แต่ง/ผู้สร้าง (ว่าง = ไม่ระบุ) */
  author: z
    .string()
    .trim()
    .max(100, "ชื่อผู้แต่งยาวเกินไป (ไม่เกิน 100 ตัวอักษร)")
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(["ongoing", "completed", "hiatus"]),
  rating: z.enum(["all", "13", "18"]),
  /** วันอัปเดตประจำสัปดาห์ 0 = อาทิตย์ … 6 = เสาร์ (ว่าง = ไม่ระบุ) */
  update_day: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(0).max(6).nullable()),
  access: z.enum(["free", "premium"]),
  published: z.boolean(),
  /** เรื่องเด่น: ขึ้นแบนเนอร์หน้าแรก */
  featured: z.boolean(),
  /** คั่นด้วยจุลภาค — แท็กใหม่จะถูกสร้างให้ */
  tags: z
    .string()
    .transform((s) =>
      [
        ...new Set(
          s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ].slice(0, 20),
    )
    .pipe(z.array(z.string().max(40))),
});

/** เบราว์เซอร์ส่งการขึ้นบรรทัดใหม่ของช่องข้อความมาเป็น CRLF → เก็บเป็น LF (ตัวแสดงผลแยกย่อหน้าด้วย LF) */
const lf = (s: string) => s.replace(/\r\n?/g, "\n");

export const episodeSchema = z
  .object({
    number: z.coerce.number().int("เลขตอนต้องเป็นจำนวนเต็ม").positive("เลขตอนต้องมากกว่า 0"),
    name: z.string().trim().min(1, "กรุณากรอกชื่อตอน").max(200),
    access: z.enum(["inherit", "free", "premium"]),
    status: z.enum(["draft", "scheduled", "published"]),
    /** "YYYY-MM-DDTHH:mm" เวลาไทย (จาก input datetime-local) */
    publishAt: z.string().optional(),
    body: z.string().max(500_000).transform(lf),
    en: z.string().max(500_000).transform(lf),
    enMachine: z.boolean(),
    zh: z.string().max(500_000).transform(lf),
    zhMachine: z.boolean(),
  })
  .refine((v) => v.status !== "scheduled" || !!v.publishAt, {
    message: "ตั้งเวลาเผยแพร่ต้องระบุวันและเวลา",
    path: ["publishAt"],
  });

/** แปลงเวลาไทยจากฟอร์ม → ISO (UTC) ; ว่าง/ผิดรูปแบบ → null */
export function thaiLocalToIso(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" เวลาไทย สำหรับใส่ใน input datetime-local */
export function isoToThaiLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** นับคำไทย/อังกฤษคร่าว ๆ ด้วย Intl.Segmenter (เก็บใน word_count) */
export function countWords(text: string): number {
  const seg = new Intl.Segmenter("th", { granularity: "word" });
  let n = 0;
  for (const s of seg.segment(text)) if (s.isWordLike) n++;
  return n;
}
