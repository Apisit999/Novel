-- การลบ/แก้วัตถุใน Storage ต้องมองเห็นวัตถุนั้นผ่าน policy select ก่อน
-- (บัคเก็ต public ให้ผู้เยี่ยมชมโหลดรูปผ่าน URL ได้ แต่ไม่ได้ให้สิทธิ์ select ผ่าน API)
-- → ให้แอดมินเห็นวัตถุในบัคเก็ต covers เพื่อลบ/เปลี่ยนปกเดิมได้
drop policy if exists covers_objects_select on storage.objects;
create policy covers_objects_select on storage.objects for select
  using (bucket_id = 'covers' and is_admin());
