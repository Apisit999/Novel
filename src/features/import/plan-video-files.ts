/** วางแผนนำเข้าไฟล์วิดีโอหลายไฟล์: ไฟล์ละตอน เลขตอนจากตัวเลขแรกในชื่อไฟล์ ถ้าไม่มี/ซ้ำไล่ต่อจากเลขสูงสุด */
export interface VideoPlan {
  file: File;
  number: number;
  name: string;
  ext: "mp4" | "webm";
  /** ข้อความปัญหา (ว่าง = ใช้ได้) */
  problem?: string;
}

const natural = (a: string, b: string) =>
  a.localeCompare(b, "th", { numeric: true, sensitivity: "base" });

export function planVideoFiles(files: File[], startAt: number, maxBytes: number): VideoPlan[] {
  const used = new Set<number>();
  return [...files]
    .sort((a, b) => natural(a.name, b.name))
    .map((file) => {
      const ext = file.type === "video/webm" ? "webm" : "mp4";
      const m = /\d+/.exec(file.name);
      let number = m ? parseInt(m[0], 10) : 0;
      if (number < 1 || used.has(number)) number = Math.max(startAt - 1, 0, ...used) + 1;
      used.add(number);
      const stem = file.name.replace(/\.[^.]+$/, "").trim();
      const problem =
        file.type !== "video/mp4" && file.type !== "video/webm"
          ? "รองรับเฉพาะ MP4/WebM"
          : file.size > maxBytes
            ? "ไฟล์ใหญ่เกิน 50 MB"
            : undefined;
      return { file, number, name: (stem || `ตอนที่ ${number}`).slice(0, 200), ext, problem };
    });
}
