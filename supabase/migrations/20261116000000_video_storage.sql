-- ที่เก็บไฟล์วิดีโอ: Supabase Storage บัคเก็ตส่วนตัว (แบบเดียวกับมังงะ)
-- ผู้ดูได้ไฟล์ผ่าน "ลิงก์ที่หมดอายุ" ที่ออกให้ได้เฉพาะตอนที่มีสิทธิ์ตาม can_access()
-- video_assets.stream_uid เก็บ "ชื่อไฟล์ในบัคเก็ต" (object name) เช่น "<title_id>/<episode_id>/<เวลา>-<สุ่ม>.mp4"
-- (ชื่อคอลัมน์มาจากแผนเดิมที่ใช้ Cloudflare Stream — ถ้าย้ายไปบริการสตรีมภายหลัง คอลัมน์นี้เก็บรหัสวิดีโอแทนได้)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video', 'video', false,
  50 * 1024 * 1024, -- ไฟล์ละไม่เกิน 50 MB (เพดานของแพ็กเกจ Supabase ฟรี; ปรับได้เมื่ออัปเกรด)
  array['video/mp4', 'video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists video_objects_read on storage.objects;
create policy video_objects_read on storage.objects for select
  using (
    bucket_id = 'video'
    and (
      is_admin()
      or exists (
        select 1 from public.video_assets v
        where v.stream_uid = storage.objects.name
          and v.ready
          and public.can_access(v.episode_id)
      )
    )
  );

drop policy if exists video_objects_insert on storage.objects;
create policy video_objects_insert on storage.objects for insert
  with check (bucket_id = 'video' and is_admin());

drop policy if exists video_objects_update on storage.objects;
create policy video_objects_update on storage.objects for update
  using (bucket_id = 'video' and is_admin())
  with check (bucket_id = 'video' and is_admin());

drop policy if exists video_objects_delete on storage.objects;
create policy video_objects_delete on storage.objects for delete
  using (bucket_id = 'video' and is_admin());

-- หนึ่งไฟล์ผูกกับหนึ่งตอน
create unique index if not exists video_assets_stream_uid_idx on video_assets (stream_uid);
