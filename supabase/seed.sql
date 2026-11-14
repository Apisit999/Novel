-- ข้อมูลตัวอย่างสำหรับพัฒนา (รันอัตโนมัติด้วย `supabase db reset`)
-- รันซ้ำได้: ลบเฉพาะแถวตัวอย่าง (ตาม slug) แล้วใส่ใหม่ — ไม่แตะข้อมูลอื่น

delete from titles
 where slug in ('sample-novel', 'moonlit-garden', 'dragon-ledger', 'sample-manga', 'sample-video');

insert into tags (slug, name) values
  ('fantasy', 'แฟนตาซี'),
  ('romance', 'โรแมนติก'),
  ('action', 'แอ็คชัน')
on conflict (slug) do nothing;

insert into titles (id, type, slug, name, synopsis, status, access, published) values
  ('00000000-0000-0000-0000-000000000001', 'novel', 'sample-novel', 'นิยายตัวอย่าง',
   'เรื่องย่อของนิยายตัวอย่างสำหรับทดสอบระบบ', 'ongoing', 'free', true),
  ('00000000-0000-0000-0000-000000000004', 'novel', 'moonlit-garden', 'สวนใต้แสงจันทร์',
   'เรื่องรักอบอุ่นของคนสองคนในสวนเก่าแห่งหนึ่ง', 'completed', 'free', true),
  ('00000000-0000-0000-0000-000000000005', 'novel', 'dragon-ledger', 'บัญชีมังกร',
   'นักบัญชีหนุ่มถูกลากเข้าสู่สงครามระหว่างอาณาจักรมังกร', 'ongoing', 'premium', true),
  ('00000000-0000-0000-0000-000000000002', 'manga', 'sample-manga', 'มังงะตัวอย่าง',
   'มังงะตัวอย่างสำหรับทดสอบระบบ', 'ongoing', 'free', true),
  ('00000000-0000-0000-0000-000000000003', 'video', 'sample-video', 'วิดีโอตัวอย่าง',
   'วิดีโอ placeholder สำหรับทดสอบระบบ', 'ongoing', 'premium', true);

insert into title_tags (title_id, tag_id)
select t.id, g.id
from (values
  ('sample-novel', 'fantasy'), ('sample-novel', 'action'),
  ('moonlit-garden', 'romance'), ('dragon-ledger', 'fantasy')
) as m(title_slug, tag_slug)
join titles t on t.slug = m.title_slug
join tags g on g.slug = m.tag_slug;

-- ตอนของนิยาย: sample-novel 2 ตอน (ตอน 2 เป็น premium), moonlit-garden 5 ตอน, dragon-ledger 4 ตอน
-- id สร้างจาก md5 ให้คงที่ทุกครั้งที่ seed
insert into episodes (id, title_id, number, name, access, status)
select md5('ep:' || t.slug || ':' || n)::uuid, t.id, n,
       'ตอนที่ ' || n || case when t.slug = 'sample-novel' and n = 2 then ' (premium)' else '' end,
       (case when t.slug = 'sample-novel' and n = 2 then 'premium' else 'inherit' end)::episode_access,
       'published'
from (values ('sample-novel', 2), ('moonlit-garden', 5), ('dragon-ledger', 4)) as c(slug, cnt)
join titles t on t.slug = c.slug
cross join lateral generate_series(1, c.cnt) as n;

-- เนื้อหาต้นฉบับ (ไทย) + คำแปล English (คนแปล) + 中文 (แปลอัตโนมัติ)
insert into novel_bodies (episode_id, body_markdown, word_count)
select e.id,
       'นี่คือเนื้อหาตัวอย่างของตอนที่ ' || e.number
         || E'\n\nย่อหน้าตัวอย่างสำหรับทดสอบการเลื่อนอ่านและแถบความคืบหน้า ข้อความนี้ยาวพอให้เห็นการตัดบรรทัดบนหน้าจอหลายขนาด ตั้งแต่มือถือจนถึงจอคอมพิวเตอร์'
         || E'\n\nย่อหน้าที่สามของตอน ใช้ทดสอบการปรับขนาดตัวอักษร ฟอนต์ และธีมสีของตัวอ่าน'
         || E'\n\nย่อหน้าที่สี่ ผู้อ่านสามารถปัดหรือกดลูกศรเพื่อไปตอนถัดไปได้'
         || E'\n\nย่อหน้าสุดท้ายของตอน',
       80
from episodes e join titles t on t.id = e.title_id
where t.type = 'novel' and t.slug in ('sample-novel', 'moonlit-garden', 'dragon-ledger');

insert into novel_translations (episode_id, lang, body_markdown, machine)
select e.id, 'en',
       'This is the sample content of episode ' || e.number || '.'
         || E'\n\nA sample paragraph for testing scrolling and the progress bar. This text is long enough to show line wrapping on many screen sizes, from phones to desktop monitors.'
         || E'\n\nThe third paragraph, used to test font size, typeface and color themes in the reader.'
         || E'\n\nThe fourth paragraph. Readers can swipe or press the arrow keys to reach the next episode.'
         || E'\n\nThe last paragraph of the episode.',
       false
from episodes e join titles t on t.id = e.title_id
where t.type = 'novel' and t.slug in ('sample-novel', 'moonlit-garden', 'dragon-ledger');

insert into novel_translations (episode_id, lang, body_markdown, machine)
select e.id, 'zh',
       '这是第 ' || e.number || ' 集的示例内容。'
         || E'\n\n用于测试滚动和进度条的示例段落。这段文字足够长，可以在从手机到电脑显示器的多种屏幕尺寸上显示换行效果。'
         || E'\n\n第三段，用于测试阅读器中的字体大小、字体和颜色主题。'
         || E'\n\n第四段。读者可以滑动或按方向键前往下一集。'
         || E'\n\n本集的最后一段。',
       true
from episodes e join titles t on t.id = e.title_id
where t.type = 'novel' and t.slug in ('sample-novel', 'moonlit-garden', 'dragon-ledger');

-- มังงะ / วิดีโอ: โครงตัวอย่าง (ตัวอ่านมาในเฟส 4/5)
insert into episodes (id, title_id, number, name, access, status) values
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002', 1, 'ตอนที่ 1', 'inherit', 'published'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000003', 1, 'ตอนที่ 1', 'inherit', 'published');

insert into manga_pages (episode_id, page_no, image_key, width, height) values
  ('00000000-0000-0000-0001-000000000003', 1, 'seed/manga/page-1.webp', 800, 1200);

insert into video_assets (episode_id, stream_uid, duration_sec, ready) values
  ('00000000-0000-0000-0001-000000000004', 'placeholder-stream-uid', 60, false);
