# AanDoo (อ่านดู) — นิยาย + มังงะ + วิดีโอ

แผนงานทั้งหมดอยู่ใน [PLAN.md](./PLAN.md)

## เริ่มใช้งานบนเครื่องใหม่

ต้องมี Node.js 22+ และ Git — เว็บอ่านข้อมูลจากฐานข้อมูล Supabase จึง **ต้องมีค่าเชื่อมต่อก่อนรัน**

```bash
git clone https://github.com/Apisit999/Novel.git
cd Novel
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
```

แล้วเลือกฐานข้อมูลอย่างใดอย่างหนึ่ง:

**ก) ใช้โปรเจกต์ Supabase บนคลาวด์ (ไม่ต้องมี Docker)** — สร้างโปรเจกต์ที่ supabase.com แล้วใส่ใน `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `SUPABASE_SERVICE_ROLE_KEY` (secret key — ความลับ)
จากนั้นนำโครงฐานข้อมูลขึ้นไปครั้งแรก: ใส่ `SUPABASE_ACCESS_TOKEN` และ `SUPABASE_DB_PASSWORD` แล้ว `npx supabase link --project-ref <ref>` และ `npm run db:push`
(ใส่ข้อมูลตัวอย่างด้วย `supabase/seed.sql`)

**ข) ใช้ฐานข้อมูลในเครื่อง (ต้องมี Docker Desktop)** — `npx supabase start` (รัน migration + seed ให้เอง) แล้วดูค่าด้วย `npx supabase status -o env`
ใส่ `API_URL`/`ANON_KEY`(หรือ `PUBLISHABLE_KEY`)/`SERVICE_ROLE_KEY`(หรือ `SECRET_KEY`) ลง `.env.local` และตั้ง `SUPABASE_DB_URL` เป็น `DB_URL` ที่ได้

```bash
npm run dev                  # เปิด http://localhost:3000
```

### ตั้งตัวเองเป็นแอดมิน

ล็อกอินเข้าเว็บหนึ่งครั้ง แล้วรัน `npm run make-admin -- อีเมลของคุณ` จากนั้นเข้า `/admin` ได้ (ถอนสิทธิ์: เพิ่ม `--revoke`)

### ติดตั้งเครื่องมือทดสอบ (ครั้งแรกครั้งเดียว)

```bash
npx playwright install chromium webkit
```

## คำสั่ง

| คำสั่ง                              | ทำอะไร                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                     | เซิร์ฟเวอร์พัฒนา                                                      |
| `npm run build`                   | สร้างเวอร์ชันใช้งานจริง (ต้องมีฐานข้อมูล)                                  |
| `npm run lint`                    | ตรวจโค้ดด้วย ESLint                                                 |
| `npm run typecheck`               | ตรวจ TypeScript                                                   |
| `npm test`                        | เทสต์หน่วย (Vitest)                                                 |
| `npm run test:db`                 | เทสต์ RLS/สิทธิ์กับฐานข้อมูลจริง (รันในทรานแซกชันแล้ว rollback ไม่ทิ้งข้อมูล)     |
| `npm run test:e2e`                | เทสต์เปิดเว็บจริงด้วย Playwright 5 โปรเจกต์ (build ให้เอง)               |
| `npm run format` / `format:check` | จัดรูปแบบโค้ด / ตรวจรูปแบบโดยไม่แก้ไฟล์ (ใช้ใน CI)                        |
| `npm run db:push`                 | ส่ง migration ขึ้นโปรเจกต์ที่ link ไว้                                   |
| `npm run db:types:remote`         | สร้าง `src/types/database.ts` จากฐานข้อมูลจริง (ทุกครั้งหลังแก้ migration) |
| `npm run make-admin -- อีเมล`      | ตั้ง/ถอนสิทธิ์แอดมิน                                                    |

CI (GitHub Actions) รัน: format → lint → typecheck → unit → **เริ่ม Supabase ในเครื่อง** → test:db → e2e
หมายเหตุ: เทสต์ล็อกอิน/หลังบ้านใช้โควตาการยืนยันลิงก์ของ Supabase บนคลาวด์ (30 ครั้ง/5 นาที) อย่ารันวนติดกันหลายรอบ — ใน CI ใช้ฐานข้อมูลในเครื่องซึ่งผ่อนโควตาไว้แล้ว

## Deploy ขึ้น Vercel (ยังไม่ได้ทำ — build production ผ่านแล้วในเครื่อง)

1. Import repo ที่ vercel.com (ล็อกอินด้วย GitHub) — `main` = production, branch อื่น = preview
2. ตั้ง Environment Variables ใน Vercel: `NEXT_PUBLIC_SITE_URL` (โดเมนจริง), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (ตั้งเป็น Sensitive), `SIGNUP_ENABLED` (ไม่บังคับ) — `NEXT_PUBLIC_SUPABASE_URL` ต้องมีตอน build ด้วย เพราะ `next.config.ts` ใช้อนุญาตโดเมนรูปปก (`next/image`)
3. Supabase → Authentication → URL Configuration: ตั้ง **Site URL** เป็นโดเมนจริง และเพิ่ม **Redirect URLs** `https://โดเมนจริง/**`
4. Google Login ตั้งค่าไว้แล้วสำหรับ localhost — เมื่อมีโดเมนจริง: ใส่โดเมนใน Authorized domains ของ OAuth consent screen และกด Publish app (ค้างที่ Testing = ล็อกอินได้เฉพาะ Test users) ส่วน redirect URI ของ Google ยังเป็น `https://<project>.supabase.co/auth/v1/callback` ตัวเดิม ไม่ต้องเปลี่ยน
5. ก่อนเปิดตัว: ตั้ง SMTP ของตัวเองใน Supabase (ถ้าเปิดล็อกอินอีเมล), ตั้ง region ฟังก์ชัน Vercel ใกล้ฐานข้อมูล (Mumbai → `bom1`) เพื่อลดความหน่วง
6. อย่าใช้โปรเจกต์ Supabase ตัวเดียวกันเป็นทั้งที่พัฒนาและ production — สร้างแยกก่อนเปิดตัว แล้ว `db:push` + ใส่ข้อมูลจริงผ่านหลังบ้าน (ไม่ต้องรัน seed.sql)

## โครงสร้าง

- `src/app/` หน้าเว็บ · `src/content-types/` ทะเบียนประเภทเนื้อหา (นิยาย/มังงะ/วิดีโอ)
- `src/features/access/` ระบบสิทธิ์ `canAccess()` · `src/lib/` env, flags
- `supabase/migrations/` โครงฐานข้อมูล (ทดสอบแล้วกับ Postgres จริงด้วย `npm run test:db`) · `supabase/seed.sql` ข้อมูลตัวอย่าง
- `src/features/admin/` หลังบ้าน · `src/features/auth/` ล็อกอิน · `src/features/library/` เรื่องที่ชอบ/อ่านต่อ · `src/server/` ไคลเอนต์ฐานข้อมูล (server-only)
- `tests/e2e/` เทสต์ Playwright

## หมายเหตุสำคัญ

- โปรเจกต์ใช้ Next.js เวอร์ชันใหม่ที่ API ต่างจากเวอร์ชันเก่า อ่านเอกสารที่ติดมาใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดใหม่
- เปิด `cacheComponents` อยู่: ค่าที่เปลี่ยนตามเวลา/สุ่ม (เช่น `new Date()`) ต้องห่อด้วย `"use cache"` หรือ `connection()`
- **อย่าเปิด `partialPrefetching`**: ทดสอบแล้วทำให้เส้นทางที่ไม่มีอยู่ (เช่น `/browse/podcast`) ตอบ HTTP 200 แทน 404 (soft 404) มีเทสต์ e2e คุมไว้
- โปรเจกต์ Astro ต้นแบบเก่าอยู่ที่ branch `legacy-astro` (ในเครื่องเท่านั้น ยังไม่ได้ push)
