-- คำแปลของนิยายต่อตอน: ภาษาไทยคือต้นฉบับ (novel_bodies) ภาษาอื่นเก็บที่นี่
-- machine = true → แปลอัตโนมัติด้วย AI ยังไม่ผ่านการตรวจ (หน้าเว็บแสดงป้ายกำกับ)

create table novel_translations (
  episode_id    uuid not null references episodes (id) on delete cascade,
  lang          text not null check (lang ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  body_markdown text not null default '',
  machine       boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (episode_id, lang)
);

create trigger novel_translations_updated_at before update on novel_translations
  for each row execute function set_updated_at();

alter table novel_translations enable row level security;

-- สิทธิ์อ่านเท่ากับเนื้อหาต้นฉบับ: ผ่าน can_access เท่านั้น (ไม่ให้คำแปลของตอน premium รั่ว)
create policy novel_translations_read on novel_translations for select
  using (can_access(episode_id));
create policy novel_translations_admin on novel_translations for all
  using (is_admin()) with check (is_admin());
