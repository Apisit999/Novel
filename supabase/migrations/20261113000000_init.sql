-- =====================================================================
-- Init schema: titles/episodes/content/progress/subscriptions + RLS
-- ⚠ ยังไม่เคยรันกับ Postgres จริง — ต้องทดสอบด้วย `supabase db reset`
--   และชุดทดสอบ RLS ก่อนเชื่อว่าถูกต้อง (ดู PLAN.md เฟส 0.3)
-- =====================================================================

-- ---------- enums ----------
create type content_type    as enum ('novel', 'manga', 'video');
create type title_status    as enum ('ongoing', 'completed', 'hiatus');
create type age_rating      as enum ('all', '13', '18');
create type access_level    as enum ('free', 'premium');
create type episode_access  as enum ('inherit', 'free', 'premium');
create type publish_status  as enum ('draft', 'scheduled', 'published');
create type user_role       as enum ('user', 'admin');
create type plan_interval   as enum ('month', 'year');
create type sub_status      as enum ('active', 'past_due', 'canceled');

-- ---------- helper: updated_at ----------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- app settings (สวิตช์ที่ RLS ต้องอ่านได้) ----------
create table app_settings (
  key   text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values ('paywall_enabled', 'false'::jsonb);

-- ---------- profiles ----------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         user_role not null default 'user',
  created_at   timestamptz not null default now()
);

-- สร้างโปรไฟล์อัตโนมัติเมื่อมีผู้ใช้สมัคร
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- catalog ----------
create table titles (
  id         uuid primary key default gen_random_uuid(),
  type       content_type not null,
  slug       text not null unique,
  name       text not null,
  synopsis   text not null default '',
  cover_key  text,
  status     title_status not null default 'ongoing',
  rating     age_rating not null default 'all',
  access     access_level not null default 'free',
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index titles_type_published_idx on titles (type, published, updated_at desc);
create trigger titles_updated_at before update on titles
  for each row execute function set_updated_at();

create table tags (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table title_tags (
  title_id uuid not null references titles (id) on delete cascade,
  tag_id   uuid not null references tags (id) on delete cascade,
  primary key (title_id, tag_id)
);
create index title_tags_tag_idx on title_tags (tag_id);

create table episodes (
  id           uuid primary key default gen_random_uuid(),
  title_id     uuid not null references titles (id) on delete cascade,
  number       integer not null check (number > 0),
  name         text not null,
  access       episode_access not null default 'inherit',
  status       publish_status not null default 'draft',
  publish_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (title_id, number)
);
create index episodes_title_idx on episodes (title_id, number);
create trigger episodes_updated_at before update on episodes
  for each row execute function set_updated_at();

-- ---------- episode content (ส่วนที่ RLS ล็อก) ----------
create table novel_bodies (
  episode_id    uuid primary key references episodes (id) on delete cascade,
  body_markdown text not null default '',
  word_count    integer not null default 0
);

create table manga_pages (
  episode_id uuid not null references episodes (id) on delete cascade,
  page_no    integer not null check (page_no > 0),
  image_key  text not null,
  width      integer,
  height     integer,
  primary key (episode_id, page_no)
);

create table video_assets (
  episode_id   uuid primary key references episodes (id) on delete cascade,
  stream_uid   text not null,
  duration_sec integer,
  ready        boolean not null default false
);

-- ---------- user data ----------
create table progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references episodes (id) on delete cascade,
  position   numeric not null default 0,
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index progress_user_recent_idx on progress (user_id, updated_at desc);

create table bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  title_id   uuid not null references titles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- ---------- billing (ว่างไว้ก่อนเฟส 7) ----------
create table plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  price_thb       integer not null check (price_thb >= 0),
  interval        plan_interval not null,
  stripe_price_id text unique,
  active          boolean not null default true
);

create table subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  plan_id                uuid references plans (id),
  status                 sub_status not null,
  current_period_end     timestamptz,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  updated_at             timestamptz not null default now()
);

-- =====================================================================
-- สิทธิ์เข้าถึงเนื้อหา — ต้องตรงกับ canAccess() ใน src/features/access
-- =====================================================================

-- ตอนนี้ผู้ใช้ทั่วไปมองเห็นหรือไม่ (เผยแพร่แล้ว และเรื่องเผยแพร่แล้ว)
create function episode_is_visible(p_episode_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from episodes e
    join titles t on t.id = e.title_id
    where e.id = p_episode_id
      and e.status = 'published'
      and t.published
  );
$$;

create function can_access(p_episode_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_admin()
    or (
      episode_is_visible(p_episode_id)
      and (
        -- เนื้อหาฟรี
        exists (
          select 1 from episodes e join titles t on t.id = e.title_id
          where e.id = p_episode_id
            and (case when e.access = 'inherit' then t.access::text else e.access::text end) = 'free'
        )
        -- paywall ปิด = เปิดฟรีทุกอย่าง
        or coalesce((select (value)::text = 'false' from app_settings where key = 'paywall_enabled'), false)
        -- สมาชิก: active หรือ canceled แต่ยังไม่หมดรอบบิล
        or exists (
          select 1 from subscriptions s
          where s.user_id = auth.uid()
            and (
              s.status = 'active'
              or (s.status = 'canceled' and s.current_period_end > now())
            )
        )
      )
    );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table app_settings  enable row level security;
alter table profiles      enable row level security;
alter table titles        enable row level security;
alter table tags          enable row level security;
alter table title_tags    enable row level security;
alter table episodes      enable row level security;
alter table novel_bodies  enable row level security;
alter table manga_pages   enable row level security;
alter table video_assets  enable row level security;
alter table progress      enable row level security;
alter table bookmarks     enable row level security;
alter table plans         enable row level security;
alter table subscriptions enable row level security;

-- app_settings: ใครก็อ่านได้ (ไม่ใช่ความลับ), แอดมินแก้ได้
create policy settings_read  on app_settings for select using (true);
create policy settings_admin on app_settings for all
  using (is_admin()) with check (is_admin());

-- profiles: เห็น/แก้ของตัวเอง; แอดมินเห็นทั้งหมด
create policy profiles_read_own on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- กันผู้ใช้แก้ role ตัวเอง: ให้แก้ได้เฉพาะคอลัมน์เหล่านี้
revoke update on profiles from authenticated, anon;
grant update (display_name, avatar_url) on profiles to authenticated;

-- catalog: คนทั่วไปเห็นเฉพาะที่เผยแพร่; แอดมินจัดการทั้งหมด
create policy titles_read  on titles for select using (published or is_admin());
create policy titles_admin on titles for all using (is_admin()) with check (is_admin());

create policy tags_read  on tags for select using (true);
create policy tags_admin on tags for all using (is_admin()) with check (is_admin());

create policy title_tags_read  on title_tags for select using (true);
create policy title_tags_admin on title_tags for all using (is_admin()) with check (is_admin());

-- episodes: เห็นรายการตอน (ชื่อ/ลำดับ) ได้ถ้าเผยแพร่แล้ว — แต่ "เนื้อหา" ถูกล็อกที่ตารางล่าง
create policy episodes_read  on episodes for select
  using (episode_is_visible(id) or is_admin());
create policy episodes_admin on episodes for all using (is_admin()) with check (is_admin());

-- เนื้อหาตอน: ต้องผ่าน can_access เท่านั้น
create policy novel_bodies_read on novel_bodies for select using (can_access(episode_id));
create policy novel_bodies_admin on novel_bodies for all
  using (is_admin()) with check (is_admin());

create policy manga_pages_read on manga_pages for select using (can_access(episode_id));
create policy manga_pages_admin on manga_pages for all
  using (is_admin()) with check (is_admin());

create policy video_assets_read on video_assets for select using (can_access(episode_id));
create policy video_assets_admin on video_assets for all
  using (is_admin()) with check (is_admin());

-- ข้อมูลผู้ใช้: เฉพาะของตัวเอง
create policy progress_own on progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bookmarks_own on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- billing: ผู้ใช้อ่านของตัวเองได้ ห้ามเขียนเอง (เขียนผ่าน service role จาก webhook เท่านั้น)
create policy plans_read  on plans for select using (active or is_admin());
create policy plans_admin on plans for all using (is_admin()) with check (is_admin());
create policy subscriptions_read_own on subscriptions for select
  using (user_id = auth.uid() or is_admin());
