const ghostBtnCls =
  "border-border bg-surface text-foreground flex min-h-11 items-center rounded-full border px-4 font-bold no-underline";

/** ลิงก์แชร์ (ลิงก์ธรรมดา ไม่ต้องใช้สคริปต์ของบริการภายนอก) — LINE สำคัญกับผู้ใช้ไทย */
export function shareUrls(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { id: "line", label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${u}` },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    { id: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
  ];
}

export function ShareLinks({ url, text }: { url: string; text: string }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted font-bold">แชร์:</span>
      {shareUrls(url, text).map((s) => (
        <a
          key={s.id}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`แชร์ไปที่ ${s.label}`}
          className={ghostBtnCls}
        >
          {s.label}
        </a>
      ))}
    </p>
  );
}
