-- วันอัปเดตประจำสัปดาห์ของเรื่อง (0 = อาทิตย์ … 6 = เสาร์ ตามเวลาไทย; null = ไม่ระบุ/ไม่ประจำ)
-- ไว้ทำตารางอัปเดตรายวันและบอกผู้อ่านว่า "อัปเดตทุกวันจันทร์"
alter table titles add column update_day smallint check (update_day between 0 and 6);

-- จำนวนผู้ติดตามต่อเรื่อง (นับจากรายการโปรดของผู้ใช้ที่ล็อกอิน)
-- bookmarks เปิดอ่านได้เฉพาะของตัวเอง (RLS) จึงนับผ่านฟังก์ชัน security definer ที่คืนเฉพาะ "จำนวน" ไม่เปิดเผยว่าใครติดตาม
-- เฉพาะเรื่องที่เผยแพร่แล้ว
create function title_follower_counts()
returns table (slug text, followers bigint)
language sql stable security definer set search_path = public as $$
  select t.slug, count(b.user_id)::bigint
  from titles t
  join bookmarks b on b.title_id = t.id
  where t.published
  group by t.slug
$$;

grant execute on function title_follower_counts() to anon, authenticated;
