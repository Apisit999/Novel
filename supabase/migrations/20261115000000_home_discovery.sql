-- เฟส 6: หน้าแรกแบบ Netflix — เรื่องเด่นที่แอดมินเลือก + ยอดอ่าน/ดู

-- เรื่องเด่น (แบนเนอร์หน้าแรก) — แอดมินติ๊กเลือกได้หลายเรื่อง หน้าแรกเลือกเรื่องที่อัปเดตล่าสุดในกลุ่มนี้
alter table titles add column featured boolean not null default false;

-- ยอดอ่าน/ดู แยกตารางจาก titles เพื่อไม่ให้ trigger updated_at ทำให้ "อัปเดตล่าสุด" เพี้ยนทุกครั้งที่มีคนเปิดอ่าน
create table title_views (
  title_id   uuid primary key references titles (id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0)
);
alter table title_views enable row level security;

-- อ่านได้เฉพาะของเรื่องที่เผยแพร่แล้ว (ยอดไม่ใช่ความลับ ใช้เรียงความนิยม); เขียนได้ผ่านฟังก์ชันด้านล่างเท่านั้น
create policy title_views_read on title_views for select
  using (exists (select 1 from titles t where t.id = title_id and (t.published or is_admin())));

create function record_title_view(p_slug text) returns void
language sql security definer set search_path = public as $$
  insert into title_views (title_id, view_count)
  select t.id, 1 from titles t where t.slug = p_slug and t.published
  on conflict (title_id) do update set view_count = title_views.view_count + 1;
$$;

-- เรียกได้เฉพาะเซิร์ฟเวอร์ของเรา (service role) — ไม่ให้เบราว์เซอร์ยิงปั่นยอดตรง ๆ ด้วย anon key
revoke execute on function record_title_view(text) from public, anon, authenticated;
grant execute on function record_title_view(text) to service_role;
