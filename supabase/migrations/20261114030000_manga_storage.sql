-- ที่เก็บรูปหน้ามังงะ: Supabase Storage บัคเก็ตส่วนตัว (ไม่มี URL สาธารณะ)
-- ผู้อ่านได้รูปผ่าน "ลิงก์ที่หมดอายุ" (signed URL) ที่ออกให้ได้เฉพาะรูปที่ตัวเองมีสิทธิ์อ่านตาม can_access()
-- → ป้องกันสองชั้นแบบเดียวกับเนื้อหานิยาย: ตาราง manga_pages (RLS) + วัตถุในบัคเก็ต (policy ด้านล่าง)
-- ชื่อไฟล์ (object name) = manga_pages.image_key เช่น "<title_id>/<episode_id>/<หน้า>-<สุ่ม>.webp"

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'manga', 'manga', false,
  10 * 1024 * 1024, -- ไฟล์ละไม่เกิน 10 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists manga_objects_read on storage.objects;
create policy manga_objects_read on storage.objects for select
  using (
    bucket_id = 'manga'
    and (
      is_admin()
      or exists (
        select 1 from public.manga_pages p
        where p.image_key = storage.objects.name
          and public.can_access(p.episode_id)
      )
    )
  );

-- เขียน/แก้/ลบ: แอดมินเท่านั้น
drop policy if exists manga_objects_insert on storage.objects;
create policy manga_objects_insert on storage.objects for insert
  with check (bucket_id = 'manga' and is_admin());

drop policy if exists manga_objects_update on storage.objects;
create policy manga_objects_update on storage.objects for update
  using (bucket_id = 'manga' and is_admin())
  with check (bucket_id = 'manga' and is_admin());

drop policy if exists manga_objects_delete on storage.objects;
create policy manga_objects_delete on storage.objects for delete
  using (bucket_id = 'manga' and is_admin());

-- คีย์รูปต้องไม่ซ้ำ (หนึ่งไฟล์ผูกกับหนึ่งหน้า) และเลขหน้าไม่ซ้ำในตอนเดียวกัน (มี PK อยู่แล้ว)
create unique index if not exists manga_pages_image_key_idx on manga_pages (image_key);
