/**
 * แปลงรูปที่แอดมินเลือกให้เหมาะกับการอ่านบนเว็บ (ทำในเบราว์เซอร์ ก่อนอัปโหลด)
 * - ย่อให้กว้างไม่เกิน MAX_WIDTH (ประหยัดทราฟฟิก/พื้นที่ และโหลดเร็วบนมือถือ)
 * - แปลงเป็น WebP คุณภาพ 85 (เล็กกว่า JPEG/PNG มาก)
 * - ถ้าเบราว์เซอร์เข้ารหัส WebP ไม่ได้ หรือรูปยาวมากจน canvas รับไม่ไหว → ใช้ไฟล์ต้นฉบับ (ถ้าเป็นชนิดที่รับ)
 */
export const MAX_WIDTH = 1600;
const WEBP_QUALITY = 0.85;
const MAX_CANVAS_HEIGHT = 16000; // ขีดจำกัด canvas ที่ปลอดภัยข้ามเบราว์เซอร์

export interface ConvertedImage {
  blob: Blob;
  ext: "webp" | "jpg" | "png";
  width: number;
  height: number;
}

const EXT_BY_TYPE: Record<string, ConvertedImage["ext"] | undefined> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function convertForUpload(file: File): Promise<ConvertedImage> {
  const bitmap = await createImageBitmap(file);
  const { width: srcW, height: srcH } = bitmap;
  try {
    const scale = srcW > MAX_WIDTH ? MAX_WIDTH / srcW : 1;
    const width = Math.round(srcW * scale);
    const height = Math.round(srcH * scale);

    const original = EXT_BY_TYPE[file.type];
    if (scale === 1 && file.type === "image/webp") {
      return { blob: file, ext: "webp", width, height }; // เป็น WebP ขนาดพอดีอยู่แล้ว
    }
    if (height <= MAX_CANVAS_HEIGHT) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
      );
      if (blob && blob.type === "image/webp") return { blob, ext: "webp", width, height };
    }
    if (original) return { blob: file, ext: original, width: srcW, height: srcH };
    throw new Error(`รูปแบบไฟล์ไม่รองรับ: ${file.type || file.name}`);
  } finally {
    bitmap.close();
  }
}

/** เรียงชื่อไฟล์แบบมีตัวเลข (page-2 ก่อน page-10) ให้ตรงกับที่แอดมินคาดหวัง */
export function sortFilesNatural(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "th", { numeric: true, sensitivity: "base" }),
  );
}
