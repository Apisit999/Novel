import { crc32, deflateSync } from "node:zlib";

/**
 * สร้างไฟล์ PNG สีเดียวขนาด width×height (ไม่พึ่งไลบรารีรูปภาพ) ไว้ใช้เป็นหน้ามังงะตัวอย่างในเทสต์
 * โครงสร้าง: signature + IHDR + IDAT (zlib ของแถวพิกเซลที่ขึ้นต้นด้วย filter 0) + IEND
 */
export function solidPng(
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // 10-12: compression, filter, interlace = 0

  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
