import "server-only";
import type { requireAdmin } from "./guard";

type Ctx = Awaited<ReturnType<typeof requireAdmin>>;

/**
 * บันทึกการกระทำของแอดมิน (ตาราง admin_audit_log — เพิ่มได้อย่างเดียว)
 * ทำแบบ "พยายามบันทึก": ถ้าบันทึกไม่ได้ (เช่นยังไม่ได้รัน migration) จะแจ้งใน log ของเซิร์ฟเวอร์แต่ไม่ทำให้งานของแอดมินล้ม
 * detail ใส่เฉพาะข้อมูลที่ไม่ลับ (จำนวน/เลขตอน/ชนิดการกระทำ) — ห้ามใส่เนื้อหานิยายหรือโทเค็น
 */
export async function auditLog(
  ctx: Ctx,
  action: string,
  target?: string,
  detail: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  try {
    const { error } = await ctx.db.from("admin_audit_log").insert({
      admin_id: ctx.user.id,
      admin_email: ctx.user.email ?? null,
      action,
      target: target ?? null,
      detail,
    });
    if (error) console.error("audit log:", error.message);
  } catch (e) {
    console.error("audit log:", e instanceof Error ? e.message : e);
  }
}
