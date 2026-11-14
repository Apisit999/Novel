-- โปรไฟล์ตอนสมัครด้วย Google (OAuth): ดึงชื่อและรูปจากบัญชีที่ผู้ให้บริการส่งมา
-- Google ส่ง full_name / name / avatar_url / picture ใน raw_user_meta_data
-- (ผู้ใช้อีเมลล้วนไม่มีค่าเหล่านี้ → ใช้ชื่อหน้า @ เหมือนเดิม และไม่มีรูป)

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  );
  return new;
end $$;
