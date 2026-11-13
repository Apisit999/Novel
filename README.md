# ห้องสมุดนิยาย (นิยาย + มังงะ + วิดีโอ)

แผนงานทั้งหมดอยู่ใน [PLAN.md](./PLAN.md)

## เริ่มใช้งานบนเครื่องใหม่

ต้องมี Node.js 22+ และ Git

```bash
git clone <repo-url>
cd <โฟลเดอร์>
npm install
npm run dev        # เปิด http://localhost:3000
```

## คำสั่ง

| คำสั่ง                   | ทำอะไร                        |
| ---------------------- | ----------------------------- |
| `npm run dev`          | เซิร์ฟเวอร์พัฒนา                  |
| `npm run build`        | สร้างเวอร์ชันใช้งานจริง            |
| `npm run lint`         | ตรวจโค้ดด้วย ESLint             |
| `npm run typecheck`    | ตรวจ TypeScript               |
| `npm run format`       | จัดรูปแบบโค้ดด้วย Prettier        |
| `npm test`             | รันเทสต์ (Vitest)               |
| `npm run format:check` | ตรวจรูปแบบโดยไม่แก้ไฟล์ (ใช้ใน CI) |

## หมายเหตุ

- โปรเจกต์ใช้ Next.js เวอร์ชันใหม่ที่ API ต่างจากเวอร์ชันเก่า อ่านเอกสารที่ติดมาใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดใหม่
- เปิด `cacheComponents` อยู่: ค่าที่เปลี่ยนตามเวลา/สุ่ม (เช่น `new Date()`) ต้องห่อด้วย `"use cache"` หรือ `connection()`
- โปรเจกต์ Astro ต้นแบบเก่าเก็บไว้ที่ branch `legacy-astro`
