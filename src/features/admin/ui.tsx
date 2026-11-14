import type { ReactNode } from "react";

/** สไตล์ร่วมของฟอร์มหลังบ้าน (ปุ่ม/ช่องกรอกสูง ≥ 48px เหมือนหน้าผู้ใช้) */
export const inputCls =
  "border-border bg-surface text-foreground min-h-12 w-full rounded-xl border-2 px-4 py-2";
export const primaryBtn =
  "bg-accent text-accent-foreground min-h-12 cursor-pointer rounded-full px-8 font-bold disabled:opacity-60";
export const ghostBtn =
  "border-border bg-surface text-foreground flex min-h-12 items-center rounded-full border px-6 font-bold no-underline";
export const dangerBtn =
  "border-accent text-accent min-h-12 cursor-pointer rounded-full border-2 px-6 font-bold";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-bold">
        {label}
      </label>
      {children}
      {hint && <p className="text-muted text-sm">{hint}</p>}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  published: "เผยแพร่แล้ว",
  draft: "ฉบับร่าง",
  scheduled: "ตั้งเวลา",
};

export function Badge({ kind, children }: { kind?: string; children?: ReactNode }) {
  const tone =
    kind === "published"
      ? "bg-accent text-accent-foreground"
      : "border-border bg-surface text-foreground border";
  return (
    <span className={`${tone} rounded-full px-3 py-0.5 text-sm font-bold`}>
      {children ?? (kind && STATUS_BADGE[kind]) ?? kind}
    </span>
  );
}
