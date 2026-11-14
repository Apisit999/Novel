import type { ReactNode } from "react";

/**
 * แปลง Markdown ชุดเล็กที่ใช้เขียนนิยาย → React element โดยตรง
 * รองรับ: หัวข้อ (# ## ###), ตัวหนา **x**, ตัวเอียง *x*, เส้นคั่น ---, ขึ้นบรรทัดใหม่ในย่อหน้า
 * ไม่ใช้ dangerouslySetInnerHTML — ข้อความทุกส่วนผ่าน React escape จึงฝัง HTML/สคริปต์ไม่ได้
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).map((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function lines(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, i, all) => {
    const nodes = inline(line);
    return i < all.length - 1 ? [...nodes, <br key={`br${i}`} />] : nodes;
  });
}

const HEADINGS = {
  1: "text-2xl font-bold",
  2: "text-xl font-bold",
  3: "text-lg font-bold",
} as const;

export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const heading = /^(#{1,3})\s+(.+)$/.exec(block);
        if (heading) {
          const level = heading[1].length as 1 | 2 | 3;
          const Tag = `h${level + 1}` as "h2" | "h3" | "h4"; // h1 เป็นชื่อตอนของหน้าแล้ว
          return (
            <Tag key={i} className={HEADINGS[level]}>
              {inline(heading[2])}
            </Tag>
          );
        }
        if (/^-{3,}$/.test(block.trim())) {
          return <hr key={i} className="border-border my-2" />;
        }
        return <p key={i}>{lines(block)}</p>;
      })}
    </>
  );
}
