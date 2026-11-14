-- ข้อมูลตัวอย่างสำหรับพัฒนา (รันอัตโนมัติด้วย `supabase db reset`)

insert into tags (slug, name) values
  ('fantasy', 'แฟนตาซี'),
  ('romance', 'โรแมนติก'),
  ('action', 'แอ็คชัน');

insert into titles (id, type, slug, name, synopsis, status, access, published) values
  ('00000000-0000-0000-0000-000000000001', 'novel', 'sample-novel', 'นิยายตัวอย่าง',
   'เรื่องย่อของนิยายตัวอย่างสำหรับทดสอบระบบ', 'ongoing', 'free', true),
  ('00000000-0000-0000-0000-000000000002', 'manga', 'sample-manga', 'มังงะตัวอย่าง',
   'มังงะตัวอย่างสำหรับทดสอบระบบ', 'ongoing', 'free', true),
  ('00000000-0000-0000-0000-000000000003', 'video', 'sample-video', 'วิดีโอตัวอย่าง',
   'วิดีโอ placeholder สำหรับทดสอบระบบ', 'ongoing', 'premium', true);

insert into title_tags (title_id, tag_id)
select '00000000-0000-0000-0000-000000000001', id from tags where slug in ('fantasy', 'action');

insert into episodes (id, title_id, number, name, access, status) values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 1, 'ตอนที่ 1', 'inherit', 'published'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 2, 'ตอนที่ 2 (premium)', 'premium', 'published'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', 1, 'ตอนที่ 1', 'inherit', 'published'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000003', 1, 'ตอนที่ 1', 'inherit', 'published');

insert into novel_bodies (episode_id, body_markdown, word_count) values
  ('00000000-0000-0000-0001-000000000001', E'# ตอนที่ 1\n\nนี่คือเนื้อหาตัวอย่างของตอนแรก', 8),
  ('00000000-0000-0000-0001-000000000002', E'# ตอนที่ 2\n\nเนื้อหา premium สำหรับทดสอบ RLS', 6);

insert into manga_pages (episode_id, page_no, image_key, width, height) values
  ('00000000-0000-0000-0001-000000000003', 1, 'seed/manga/page-1.webp', 800, 1200);

insert into video_assets (episode_id, stream_uid, duration_sec, ready) values
  ('00000000-0000-0000-0001-000000000004', 'placeholder-stream-uid', 60, false);
