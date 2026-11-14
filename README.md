# AanDoo (อ่านดู) — นิยาย + มังงะ + วิดีโอ

แผนงานทั้งหมดอยู่ใน [PLAN.md](./PLAN.md)

## เริ่มใช้งานบนเครื่องใหม่

ต้องมี Node.js 22+ และ Git

```bash
git clone https://github.com/Apisit999/Novel.git
cd Novel
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev                  # เปิด http://localhost:3000
```

ตอนนี้เว็บรันได้โดยยังไม่ต้องมี Supabase (ค่า Supabase ใน `.env.local` เว้นว่างได้จนถึงเฟส 0.3)

### ติดตั้งเครื่องมือทดสอบ (ครั้งแรกครั้งเดียว)

```bash
npx playwright install chromium
```

## คำสั่ง

| คำสั่ง                   | ทำอะไร                                    |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | เซิร์ฟเวอร์พัฒนา                              |
| `npm run build`        | สร้างเวอร์ชันใช้งานจริง                        |
| `npm run lint`         | ตรวจโค้ดด้วย ESLint                         |
| `npm run typecheck`    | ตรวจ TypeScript                           |
| `npm test`             | เทสต์หน่วย (Vitest)                         |
| `npm run test:e2e`     | เทสต์เปิดเว็บจริงด้วย Playwright (build ให้เอง) |
| `npm run format`       | จัดรูปแบบโค้ดด้วย Prettier                    |
| `npm run format:check` | ตรวจรูปแบบโดยไม่แก้ไฟล์ (ใช้ใน CI)             |

CI (GitHub Actions) รันชุดเดียวกับที่ใช้ในเครื่อง: format → lint → typecheck → test → e2e (e2e รวมการ build)

## โครงสร้าง

- `src/app/` หน้าเว็บ · `src/content-types/` ทะเบียนประเภทเนื้อหา (นิยาย/มังงะ/วิดีโอ)
- `src/features/access/` ระบบสิทธิ์ `canAccess()` · `src/lib/` env, flags
- `supabase/migrations/` โครงฐานข้อมูล (ยังไม่ได้ทดสอบกับ Postgres จริง)
- `tests/e2e/` เทสต์ Playwright

## หมายเหตุสำคัญ

- โปรเจกต์ใช้ Next.js เวอร์ชันใหม่ที่ API ต่างจากเวอร์ชันเก่า อ่านเอกสารที่ติดมาใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดใหม่
- เปิด `cacheComponents` อยู่: ค่าที่เปลี่ยนตามเวลา/สุ่ม (เช่น `new Date()`) ต้องห่อด้วย `"use cache"` หรือ `connection()`
- **อย่าเปิด `partialPrefetching`**: ทดสอบแล้วทำให้เส้นทางที่ไม่มีอยู่ (เช่น `/browse/podcast`) ตอบ HTTP 200 แทน 404 (soft 404) มีเทสต์ e2e คุมไว้
- โปรเจกต์ Astro ต้นแบบเก่าอยู่ที่ branch `legacy-astro` (ในเครื่องเท่านั้น ยังไม่ได้ push)
