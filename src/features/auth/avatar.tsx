import type { User } from "@supabase/supabase-js";

/** ชื่อ/รูปจากข้อมูลที่ผู้ให้บริการ (Google) ส่งมา — ไม่มี (เช่นสมัครด้วยอีเมล) ก็ถอยไปใช้อีเมล */
export function profileOf(user: User) {
  const meta = user.user_metadata as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const name = str(meta.full_name) ?? str(meta.name) ?? user.email?.split("@")[0] ?? "ผู้ใช้";
  const picture = str(meta.avatar_url) ?? str(meta.picture);
  const provider =
    typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  return { name, picture, provider };
}

/** วงกลมรูปโปรไฟล์ — ไม่มีรูปแสดงตัวอักษรแรกของชื่อ */
export function Avatar({ name, picture, size }: { name: string; picture?: string; size: number }) {
  if (picture) {
    return (
      // รูปจาก Google (โดเมนภายนอก) — ใช้ <img> ธรรมดา ไม่ผ่านตัวย่อรูปของ Next เพื่อไม่ต้องตั้งโดเมนอนุญาต
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="bg-accent text-accent-foreground flex items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
