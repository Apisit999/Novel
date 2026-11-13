# แผนพัฒนา: แพลตฟอร์มนิยาย + มังงะ + วิดีโอ (สไตล์ Netflix)

สถานะ: **แผนฉบับเต็ม รอตรวจก่อนลงมือ**

ข้อตกลงที่ยืนยันแล้ว

- เนื้อหาเป็นของเราเอง / มีสิทธิ์ครบ ลงผ่านหน้าแอดมิน (ยังไม่มีนักเขียนภายนอก)
- ช่วงแรก **เปิดฟรีทั้งหมด** แต่วางระบบสมาชิกรายเดือนไว้ เปิดเก็บเงินภายหลังได้โดยไม่รื้อโครง

ขนาดงาน: S = ไม่กี่ชั่วโมง · M = 1–2 วัน · L = หลายวัน (ประมาณคร่าว ๆ สำหรับคนเดียว)

---

## ส่วนที่ 1 — หลักการออกแบบรากฐาน

กติกา 6 ข้อที่ทุกเฟสต้องทำตาม เพื่อให้ต่อยอดง่ายและไม่ต้องรื้อ

1. **โมเดลข้อมูลเดียวทุกประเภท** — นิยาย มังงะ วิดีโอ คือ `title` → `episode` เหมือนกัน ต่างกันแค่ "เนื้อหาของตอน" ฟีเจอร์ร่วม (ค้นหา บุ๊กมาร์ก ประวัติ สิทธิ์) จึงเขียนครั้งเดียว
2. **Content-type registry** — แต่ละประเภทลงทะเบียนตัวเองในที่เดียว (ตัวอ่าน/ตัวเล่น, ตัวอัปโหลด, หน่วยของ progress) อยากเพิ่ม "พอดแคสต์" ในอนาคต = เพิ่มโฟลเดอร์ใหม่ 1 โฟลเดอร์ ไม่ต้องแก้หน้าแรก/ค้นหา/ห้องสมุด
3. **สิทธิ์ตัดสินที่จุดเดียว ฝั่งเซิร์ฟเวอร์** — ฟังก์ชัน `canAccess()` + Row Level Security ในฐานข้อมูล เนื้อหา premium ไม่ถูกส่งถึงเบราว์เซอร์ถ้าไม่มีสิทธิ์
4. **ฟีเจอร์เปิด/ปิดด้วย flag** — `PAYWALL_ENABLED`, `SIGNUP_ENABLED` ฯลฯ ปล่อยโค้ดก่อน เปิดใช้ทีหลัง
5. **ฐานข้อมูลเปลี่ยนผ่าน migration เท่านั้น** — ไม่แก้ตารางมือบนหน้าเว็บ Supabase ทุกการเปลี่ยนอยู่ใน Git ย้อนดูและสร้างซ้ำได้
6. **ทุกอย่างมี type + validation** — type ของตาราง gen จากฐานข้อมูลอัตโนมัติ ข้อมูลที่รับจากผู้ใช้ตรวจด้วย Zod ค่า env ตรวจตอนแอปเริ่ม (ขาดตัวไหนแอปไม่ขึ้น แทนที่จะพังกลางทาง)

---

## ส่วนที่ 2 — เทคโนโลยี

| ส่วน                 | เลือก                                     | เหตุผล                                     |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| เว็บ + API           | Next.js (App Router) + TypeScript strict | หน้าบ้าน + หลังบ้านในโปรเจกต์เดียว, SEO ดี       |
| UI                  | Tailwind CSS + shadcn/ui                 | ส่วนประกอบพร้อมใช้, ทำธีมสว่าง/ซีเปีย/มืดง่าย      |
| ฐานข้อมูล + ล็อกอิน     | Supabase (Postgres, Auth, RLS)           | ล็อกอินอีเมล/Google ในตัว, ฟรีช่วงเริ่ม           |
| ไฟล์รูป               | Cloudflare R2                            | ไม่คิดค่าส่งข้อมูลออก (สำคัญกับมังงะ)              |
| วิดีโอ                | Cloudflare Stream (สำรอง: Mux)           | แปลงไฟล์ + สตรีม + signed URL               |
| จ่ายเงิน (เฟส 7)      | Stripe — บัตร + PromptPay                 | รายเดือน + พอร์ทัลจัดการสมาชิก                 |
| ตรวจข้อมูล            | Zod                                      | ใช้ทั้งฟอร์ม, API, env                        |
| ทดสอบ               | Vitest (logic) + Playwright (flow หลัก)   |                                           |
| คุณภาพโค้ด            | ESLint + Prettier + `tsc`                |                                           |
| CI                  | GitHub Actions                           | lint + type + test ทุกครั้งที่ push            |
| โฮสต์                | Vercel (สำรอง: Cloudflare)               | deploy อัตโนมัติจาก Git, มี preview ทุก branch |
| ติดตาม error (เฟส 8) | Sentry                                   |                                           |

---

## ส่วนที่ 3 — โครงสร้างโฟลเดอร์

```
/
├─ src/
│  ├─ app/                    # หน้าเว็บ (routing เท่านั้น ไม่ใส่ logic หนัก)
│  │  ├─ (site)/              # หน้าผู้ใช้: หน้าแรก, เรื่อง, ตัวอ่าน, ค้นหา
│  │  ├─ (auth)/              # ล็อกอิน/สมัคร
│  │  ├─ account/             # โปรไฟล์, ห้องสมุด, สมาชิก
│  │  ├─ admin/               # หลังบ้าน (ล็อกเฉพาะ role=admin)
│  │  └─ api/                 # webhook (Stripe, Stream) และ endpoint อื่น
│  ├─ content-types/          # ★ registry — 1 โฟลเดอร์ต่อ 1 ประเภท
│  │  ├─ registry.ts
│  │  ├─ novel/               # Reader, AdminEditor, progress unit = %
│  │  ├─ manga/               # Reader, PageUploader, progress unit = หน้า
│  │  └─ video/               # Player, VideoUploader, progress unit = วินาที
│  ├─ features/               # ฟีเจอร์ร่วมทุกประเภท
│  │  ├─ catalog/             # ดึง/แสดงเรื่อง-ตอน
│  │  ├─ library/             # บุ๊กมาร์ก, ประวัติ, อ่าน/ดูต่อ
│  │  ├─ search/
│  │  ├─ access/              # canAccess(), ป้าย premium, paywall
│  │  └─ billing/             # Stripe (เฟส 7)
│  ├─ server/                 # โค้ดฝั่งเซิร์ฟเวอร์เท่านั้น
│  │  ├─ db.ts                # Supabase client (server/admin)
│  │  ├─ storage.ts           # R2 + signed URL
│  │  └─ stream.ts            # Cloudflare Stream
│  ├─ components/ui/          # ปุ่ม, การ์ด, dialog (shadcn)
│  ├─ lib/                    # util ทั่วไป, env.ts, flags.ts
│  └─ types/database.ts       # gen อัตโนมัติจาก Supabase
├─ supabase/
│  ├─ migrations/             # ★ ทุกการเปลี่ยนฐานข้อมูล
│  └─ seed.sql                # ข้อมูลตัวอย่าง (ย้ายนิยายตัวอย่างมาที่นี่)
├─ tests/e2e/                 # Playwright
├─ .github/workflows/ci.yml
├─ .env.example               # รายการ env ทั้งหมด (ไม่มีค่าจริง)
└─ PLAN.md, README.md
```

กติกาการ import: `app/` เรียก `features/` และ `content-types/` → ซึ่งเรียก `server/` · ห้าม component ฝั่ง client import จาก `server/` (บังคับด้วยแพ็กเกจ `server-only`)

---

## ส่วนที่ 4 — โมเดลข้อมูล

```
profiles        id (= auth.users.id), display_name, avatar_url,
                role: user | admin, created_at

titles          id, type: novel | manga | video, slug (unique), name,
                synopsis, cover_key, status: ongoing | completed | hiatus,
                rating: all | 13 | 18, access: free | premium,
                published: bool, created_at, updated_at

tags            id, slug, name
title_tags      title_id, tag_id

episodes        id, title_id, number, name,
                access: inherit | free | premium,
                status: draft | scheduled | published, publish_at,
                created_at, updated_at
                unique (title_id, number)

-- เนื้อหาของตอน แยกตามประเภท (ตารางนี้คือส่วนที่ RLS ล็อก)
novel_bodies    episode_id, body_markdown, word_count
manga_pages     episode_id, page_no, image_key, width, height
video_assets    episode_id, stream_uid, duration_sec, ready: bool

-- ผู้ใช้
progress        user_id, episode_id, position (numeric), completed: bool, updated_at
bookmarks       user_id, title_id, created_at

-- สมาชิก (สร้างตั้งแต่เฟส 0 แต่ยังว่าง)
plans           id, name, price_thb, interval: month | year, stripe_price_id, active
subscriptions   user_id, plan_id, status: active | past_due | canceled,
                current_period_end, stripe_customer_id, stripe_subscription_id
```

**กติกาสิทธิ์ (`canAccess`)**

```
effectiveAccess = episode.access == 'inherit' ? title.access : episode.access
if effectiveAccess == 'free'      → อนุญาต
if !PAYWALL_ENABLED               → อนุญาต   ← ช่วงเปิดฟรี
if user มี subscription active     → อนุญาต
อื่น ๆ                             → แสดง paywall (ส่งแค่ชื่อตอน ไม่ส่งเนื้อหา)
```

กติกาเดียวกันนี้เขียนเป็น SQL function ใช้ใน RLS ของ `novel_bodies` / `manga_pages` / `video_assets` เพื่อป้องกันสองชั้น

---

## ส่วนที่ 5 — เฟสการทำงาน

แต่ละเฟสต้องผ่าน "เกณฑ์เสร็จ" ก่อนไปเฟสถัดไป และ deploy ได้จริงทุกเฟส

### เฟส 0 — รากฐาน ★ (สำคัญที่สุด)

**0.1 ตั้งโปรเจกต์** — S

- [x] สร้าง Next.js + TypeScript strict + Tailwind (shadcn/ui เพิ่มตอนต้องใช้ component จริง)
- [x] ESLint, Prettier, path alias `@/`
- [x] เก็บโปรเจกต์ Astro เดิมไว้ใน branch `legacy-astro` แล้วย้ายฟอนต์ไทย/ธีมมา (สไตล์ตัวอ่านย้ายในเฟส 1)

**0.2 ค่า config และ flag** — S

- [ ] `src/lib/env.ts` ตรวจ env ด้วย Zod
- [ ] `src/lib/flags.ts` (`PAYWALL_ENABLED=false`, `SIGNUP_ENABLED=true`)
- [ ] `.env.example` ครบทุกตัว

**0.3 ฐานข้อมูล** — M

- [ ] ติดตั้ง Supabase CLI, เชื่อมโปรเจกต์
- [ ] migration แรก: ตารางทั้งหมดในส่วนที่ 4 + index + trigger `updated_at`
- [ ] SQL function `can_access(episode_id)` + RLS policy ทุกตาราง
- [ ] `seed.sql`: นิยายตัวอย่าง 1 เรื่อง, มังงะตัวอย่าง, วิดีโอ placeholder
- [ ] สคริปต์ `npm run db:types` gen type

**0.4 Content-type registry** — M

- [ ] นิยาม interface กลาง (ชื่อ, ไอคอน, ตัวแสดงผล, หน่วย progress, ตัวแก้ไขในแอดมิน)
- [ ] ลงทะเบียน novel / manga / video (ยังเป็นโครงเปล่าได้)

**0.5 ระบบสิทธิ์** — S

- [ ] `features/access/canAccess.ts` + unit test ครบทุกกรณี (free / premium / paywall ปิด / มีสมาชิก / หมดอายุ)

**0.6 Layout หลัก** — S

- [ ] Header (โลโก้, เมนูประเภท, ค้นหา, ปุ่มบัญชี), Footer, ธีม 3 แบบไม่กะพริบ, หน้า 404/500

**0.7 คุณภาพและการ deploy** — S

- [ ] Vitest + Playwright (เทสต์ "หน้าแรกเปิดได้")
- [ ] GitHub Actions: lint → typecheck → test
- [ ] ต่อ Vercel: `main` = production, branch อื่น = preview
- [ ] README: วิธีรันเครื่องใหม่ตั้งแต่ศูนย์

**เกณฑ์เสร็จเฟส 0:** clone ลงเครื่องใหม่ → ทำตาม README → รันได้ภายในไม่กี่คำสั่ง · CI เขียว · เว็บเปล่าขึ้นบน URL จริง · ทดสอบ RLS แล้วว่าผู้ใช้ทั่วไปอ่านตาราง premium ไม่ได้เมื่อเปิด paywall

---

### เฟส 1 — นิยาย — M

- [ ] หน้าเรื่อง (ใช้ร่วมทุกประเภท): ปก, เรื่องย่อ, แท็ก, สารบัญ, ปุ่มเริ่ม/อ่านต่อ
- [ ] ตัวอ่านนิยาย: ย้ายจาก Astro (ธีม, ฟอนต์, ขนาด, แถบความคืบหน้า, ปุ่มลูกศร)
- [ ] หน้ารวมนิยาย + กรองแท็ก/สถานะ
- [ ] SEO: metadata, Open Graph, sitemap, robots
- [ ] ป้าย "premium" + หน้าจอ paywall (ยังไม่แสดงเพราะ flag ปิด แต่ทดสอบได้)

**เสร็จเมื่อ:** อ่านนิยายตัวอย่างจากฐานข้อมูลได้ครบเหมือนเว็บเดิม

### เฟส 2 — บัญชีผู้ใช้ — M

- [ ] สมัคร/ล็อกอิน: อีเมล (magic link) + Google
- [ ] สร้าง `profiles` อัตโนมัติเมื่อสมัคร
- [ ] บันทึก progress (ไม่ล็อกอิน = เก็บในเครื่อง, ล็อกอินแล้ว = ย้ายขึ้นเซิร์ฟเวอร์)
- [ ] บุ๊กมาร์ก, ประวัติ, หน้า "ห้องสมุดของฉัน"
- [ ] ลบบัญชีได้เอง (รองรับ PDPA)

**เสร็จเมื่อ:** อ่านค้างในคอม → เปิดมือถือแล้วต่อได้

### เฟส 3 — หน้าแอดมิน — L

- [ ] ล็อกเฉพาะ `role=admin` (ตรวจทั้ง middleware และ RLS)
- [ ] CRUD เรื่อง: ชื่อ, เรื่องย่อ, ปก (อัปโหลด R2), แท็ก, สถานะ, free/premium, เรต
- [ ] CRUD ตอน: draft / ตั้งเวลา / เผยแพร่, เรียงลำดับตอน
- [ ] ตัวเขียนนิยาย (Markdown + พรีวิว, บันทึกอัตโนมัติ)

**เสร็จเมื่อ:** ลงนิยายเรื่องใหม่ได้ทั้งเรื่องโดยไม่แตะโค้ด

### เฟส 4 — มังงะ — L

- [ ] อัปโหลดหลายรูปแบบลากวาง → แปลง WebP + ย่อขนาด → R2
- [ ] เรียงหน้าใหม่ด้วยการลาก
- [ ] ตัวอ่าน: โหมดเลื่อนลง (webtoon) + โหมดพลิกหน้า, โหลดหน้าถัดไปล่วงหน้า, ซูมบนมือถือ
- [ ] รูปส่งผ่าน signed URL อายุสั้น

### เฟส 5 — วิดีโอ — L

- [ ] อัปโหลดจากแอดมินขึ้น Cloudflare Stream โดยตรง (ไม่ผ่านเซิร์ฟเวอร์เรา)
- [ ] webhook รับสถานะ "แปลงไฟล์เสร็จ"
- [ ] ตัวเล่น: ดูต่อจากจุดเดิม, เล่นตอนถัดไปอัตโนมัติ, ข้ามอินโทร (ถ้ากำหนดเวลาไว้)
- [ ] signed playback token ตามสิทธิ์

### เฟส 6 — หน้าแรกแบบ Netflix + ค้นหา — M/L

- [ ] แถว: อ่าน/ดูต่อ, อัปเดตล่าสุด, ยอดนิยม, ตามหมวด, แบนเนอร์เรื่องเด่น (เลือกจากแอดมิน)
- [ ] ค้นหาข้ามทุกประเภท — **ทดลองก่อน** 2 วิธีกับภาษาไทย: `pg_trgm` vs ตัดคำด้วย `Intl.Segmenter` แล้วค่อยเลือก
- [ ] นับยอดอ่าน/ดูแบบง่าย

### เฟส 7 — เปิดเก็บเงิน (เมื่อพร้อมทางธุรกิจ) — M

- [ ] สร้าง product/price ใน Stripe → ใส่ตาราง `plans`
- [ ] หน้าเลือกแผน → Stripe Checkout (บัตร + PromptPay)
- [ ] webhook → อัปเดต `subscriptions` (ทดสอบทุกเหตุการณ์: สมัคร, ต่ออายุ, ล้มเหลว, ยกเลิก)
- [ ] Stripe Customer Portal ให้ผู้ใช้จัดการเอง
- [ ] หน้าข้อตกลง / นโยบายความเป็นส่วนตัว / นโยบายคืนเงิน
- [ ] เปลี่ยน `PAYWALL_ENABLED=true`

### เฟส 8 — พร้อมใช้งานจริง (ทำควบคู่ก่อนเปิดตัว) — M

- [ ] Sentry, log, uptime monitor
- [ ] backup ฐานข้อมูลอัตโนมัติ + ทดลองกู้คืนจริง 1 ครั้ง
- [ ] rate limit การล็อกอิน/API
- [ ] ตรวจ performance บนมือถือ (Lighthouse) และ accessibility
- [ ] ระบบยืนยันอายุสำหรับเรต 18

### ภายหลัง (โครงข้อมูลรองรับแล้ว)

คอมเมนต์/รีวิว · แจ้งเตือนตอนใหม่ · เหรียญ/ซื้อรายตอน · นักเขียนภายนอก · แอปมือถือ (PWA ก่อน) · หลายภาษา

---

## ส่วนที่ 6 — วิธีทำงานประจำวัน

- **Git:** `main` ต้อง deploy ได้เสมอ · ทำงานบน branch `feat/...` → PR → CI เขียว → merge
- **ฐานข้อมูล:** แก้ด้วย `supabase migration new <ชื่อ>` เท่านั้น แล้วรัน `db:types`
- **เพิ่มประเภทเนื้อหาใหม่:** สร้าง `content-types/<ชื่อ>/` + migration ตารางเนื้อหา + ลงทะเบียนใน `registry.ts`
- **ความลับ:** ไม่ commit `.env` · คีย์ service role ของ Supabase และคีย์ Stripe ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น

---

## ส่วนที่ 7 — ความเสี่ยง

| ความเสี่ยง              | ผลกระทบ          | วิธีรับมือ                                                      |
| --------------------- | ---------------- | ----------------------------------------------------------- |
| ค้นหาภาษาไทยไม่แม่น      | ผู้ใช้หาเรื่องไม่เจอ   | ทดลองในเฟส 6 ก่อนเลือก, สำรอง: บริการค้นหาภายนอก                |
| ค่าวิดีโอโตตามผู้ชม        | ต้นทุนบานปลาย      | เช็กราคาปัจจุบันก่อนเฟส 5, ตั้ง budget alert                       |
| เนื้อหาหลุด/อัดหน้าจอ      | สูญรายได้          | signed URL + RLS กันลิงก์หลุด; การอัดหน้าจอกันไม่ได้ (DRM ไม่อยู่ในแผน) |
| VAT / PDPA / กฎผู้บริโภค | ปัญหากฎหมาย       | ปรึกษาผู้เชี่ยวชาญก่อนเฟส 7                                       |
| webhook Stripe พลาด   | ผู้ใช้จ่ายแล้วไม่ได้สิทธิ์ | idempotent handler + หน้าแอดมินแก้สิทธิ์มือ + ตรวจย้อนกับ Stripe     |
| ทำคนเดียว ขอบเขตบาน    | ไม่เสร็จสักที        | ยึดลำดับเฟส, ไอเดียใหม่ลงหัวข้อ "ภายหลัง"                          |

---

## ส่วนที่ 8 — ก่อนเริ่มเฟส 0 ต้องมี

- [ ] บัญชี GitHub (เก็บโค้ด + CI)
- [ ] บัญชี Supabase (สร้างโปรเจกต์ region Singapore)
- [ ] บัญชี Vercel (ล็อกอินด้วย GitHub)
- [ ] Docker Desktop (สำหรับรัน Supabase บนเครื่อง — ไม่บังคับ แต่ทดสอบ migration ได้ปลอดภัยกว่า)
- [ ] (เฟส 4–5) บัญชี Cloudflare · (เฟส 7) บัญชี Stripe
