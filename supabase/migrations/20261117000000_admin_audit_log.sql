-- บันทึกการกระทำของแอดมิน (audit log): ใครทำอะไรกับอะไรเมื่อไหร่ — เพิ่มได้อย่างเดียว แก้/ลบไม่ได้
create table admin_audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  admin_id    uuid references auth.users (id) on delete set null,
  admin_email text,
  action      text not null check (char_length(action) between 1 and 80),
  target      text check (char_length(target) <= 300),
  detail      jsonb not null default '{}'::jsonb
);
create index admin_audit_log_at_idx on admin_audit_log (at desc);
alter table admin_audit_log enable row level security;

-- อ่านได้เฉพาะแอดมิน; เพิ่มได้เฉพาะแอดมินและต้องลงชื่อตัวเองเท่านั้น (แอบสวมรอยคนอื่นไม่ได้)
create policy admin_audit_read on admin_audit_log for select using (is_admin());
create policy admin_audit_insert on admin_audit_log for insert
  with check (is_admin() and admin_id = auth.uid());

-- ไม่มี policy update/delete และถอนสิทธิ์ระดับตารางซ้ำอีกชั้น (แม้แอดมินก็แก้ประวัติไม่ได้)
revoke update, delete, truncate on admin_audit_log from anon, authenticated;
