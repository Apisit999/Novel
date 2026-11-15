-- เฟส A: หน้าหลักอัตโนมัติ + ผังจัดวางแอดมิน
-- 1) ยอดเข้าชมรายวัน (ให้ "ฮิต" = ช่วงนี้ ไม่ใช่ยอดสะสมตลอดกาล)
-- 2) ส่วนของหน้าแรก (home_sections) ที่แอดมินเรียง/เปิดปิด/ตั้งเวลา
-- 3) การปักโปรโมทเรื่อง (home_pins) และชุดคัดสรร (collections)

-- ---------------------------------------------------------------- ยอดรายวัน
create table title_views_daily (
  title_id   uuid not null references titles (id) on delete cascade,
  day        date not null default (now() at time zone 'Asia/Bangkok')::date,
  view_count integer not null default 0 check (view_count >= 0),
  primary key (title_id, day)
);
create index title_views_daily_day_idx on title_views_daily (day);
alter table title_views_daily enable row level security;

create policy title_views_daily_read on title_views_daily for select
  using (exists (select 1 from titles t where t.id = title_id and (t.published or is_admin())));

-- นับทั้งยอดสะสมเดิมและยอดรายวัน (ยังเรียกได้เฉพาะ service role เหมือนเดิม)
create or replace function record_title_view(p_slug text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select t.id into v_id from titles t where t.slug = p_slug and t.published;
  if v_id is null then
    return;
  end if;
  insert into title_views (title_id, view_count) values (v_id, 1)
  on conflict (title_id) do update set view_count = title_views.view_count + 1;
  insert into title_views_daily (title_id, day, view_count)
  values (v_id, (now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (title_id, day) do update set view_count = title_views_daily.view_count + 1;
end;
$$;
revoke execute on function record_title_view(text) from public, anon, authenticated;
grant execute on function record_title_view(text) to service_role;

-- ---------------------------------------------------------------- ส่วนของหน้าแรก
-- kind เป็น text + check (เพิ่มชนิดใหม่ = แก้ constraint ใน migration ถัดไป ไม่ต้องแก้ enum)
create table home_sections (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in
               ('spotlight', 'top_ten', 'type_zone', 'latest', 'tag_chips', 'collection', 'banner')),
  title      text not null default '' check (char_length(title) <= 120),
  position   integer not null default 0,
  enabled    boolean not null default true,
  config     jsonb not null default '{}'::jsonb,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index home_sections_position_idx on home_sections (position);
create trigger home_sections_updated_at before update on home_sections
  for each row execute function set_updated_at();
alter table home_sections enable row level security;

-- ผู้เยี่ยมชมเห็นเฉพาะส่วนที่เปิดอยู่และอยู่ในช่วงเวลา; แอดมินเห็นและแก้ได้ทั้งหมด
create policy home_sections_read on home_sections for select
  using (
    is_admin()
    or (
      enabled
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );
create policy home_sections_admin on home_sections for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- ปักโปรโมท
-- placement: spotlight = ขึ้นแบนเนอร์ก่อน, top_ten_boost = ดันขึ้นอันดับ, hidden = ไม่แสดงในหน้าแรก
create table home_pins (
  id         uuid primary key default gen_random_uuid(),
  title_id   uuid not null references titles (id) on delete cascade,
  placement  text not null check (placement in ('spotlight', 'top_ten_boost', 'hidden')),
  position   integer not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  note       text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index home_pins_title_idx on home_pins (title_id);
alter table home_pins enable row level security;

create policy home_pins_read on home_pins for select
  using (
    is_admin()
    or (
      (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and exists (select 1 from titles t where t.id = title_id and t.published)
    )
  );
create policy home_pins_admin on home_pins for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- ชุดคัดสรร
create table collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger collections_updated_at before update on collections
  for each row execute function set_updated_at();
alter table collections enable row level security;

create table collection_items (
  collection_id uuid not null references collections (id) on delete cascade,
  title_id      uuid not null references titles (id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, title_id)
);
create index collection_items_pos_idx on collection_items (collection_id, position);
alter table collection_items enable row level security;

create policy collections_read on collections for select using (published or is_admin());
create policy collections_admin on collections for all
  using (is_admin()) with check (is_admin());

-- รายการในชุด: เห็นเฉพาะชุดที่เผยแพร่ และเรื่องที่เผยแพร่แล้ว
create policy collection_items_read on collection_items for select
  using (
    is_admin()
    or (
      exists (select 1 from collections c where c.id = collection_id and c.published)
      and exists (select 1 from titles t where t.id = title_id and t.published)
    )
  );
create policy collection_items_admin on collection_items for all
  using (is_admin()) with check (is_admin());
