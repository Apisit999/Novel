-- ที่เก็บรูปปกเรื่อง: บัคเก็ตสาธารณะ (ปกเป็นข้อมูลหน้าร้าน ทุกคนเห็นได้อยู่แล้ว ไม่ใช่เนื้อหา premium)
-- ชื่อไฟล์ = titles.cover_key เช่น "<title_id>/<เวลา>-<สุ่ม>.webp"
-- เขียน/แก้/ลบ: แอดมินเท่านั้น (public ใช้กับการ "อ่าน" เท่านั้น)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists covers_objects_insert on storage.objects;
create policy covers_objects_insert on storage.objects for insert
  with check (bucket_id = 'covers' and is_admin());

drop policy if exists covers_objects_update on storage.objects;
create policy covers_objects_update on storage.objects for update
  using (bucket_id = 'covers' and is_admin())
  with check (bucket_id = 'covers' and is_admin());

drop policy if exists covers_objects_delete on storage.objects;
create policy covers_objects_delete on storage.objects for delete
  using (bucket_id = 'covers' and is_admin());
