import { z } from "zod";

/** ตอนมังงะ: ข้อมูลตอนอย่างเดียว (รูปหน้าอัปโหลดแยก) */
export const mangaEpisodeSchema = z
  .object({
    number: z.coerce.number().int("เลขตอนต้องเป็นจำนวนเต็ม").positive("เลขตอนต้องมากกว่า 0"),
    name: z.string().trim().min(1, "กรุณากรอกชื่อตอน").max(200),
    access: z.enum(["inherit", "free", "premium"]),
    status: z.enum(["draft", "scheduled", "published"]),
    publishAt: z.string().optional(),
  })
  .refine((v) => v.status !== "scheduled" || !!v.publishAt, {
    message: "ตั้งเวลาเผยแพร่ต้องระบุวันและเวลา",
    path: ["publishAt"],
  });

/** นามสกุลไฟล์รูปที่รับ (ตรงกับ allowed_mime_types ของบัคเก็ต) */
export const imageExtSchema = z.enum(["webp", "jpg", "png"]);

export const MAX_PAGES_PER_BATCH = 60;

export const registerSchema = z.array(
  z.object({
    key: z.string().min(1).max(300),
    width: z.number().int().positive().max(20000),
    height: z.number().int().positive().max(200000),
  }),
);
