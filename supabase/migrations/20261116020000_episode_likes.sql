-- ไลก์รายตอน: ต้องล็อกอิน (กันปั่นยอด) กดได้เฉพาะตอนที่ผู้ใช้เห็นอยู่ (เผยแพร่แล้ว)
create table episode_likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references episodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index episode_likes_episode_idx on episode_likes (episode_id);
alter table episode_likes enable row level security;

-- ผู้ใช้อ่าน/เพิ่ม/ลบได้เฉพาะแถวของตัวเอง และเพิ่มได้เฉพาะตอนที่มองเห็น
create policy episode_likes_own_read on episode_likes for select using (user_id = auth.uid());
create policy episode_likes_own_delete on episode_likes for delete using (user_id = auth.uid());
create policy episode_likes_own_insert on episode_likes for insert
  with check (user_id = auth.uid() and episode_is_visible(episode_id));

-- จำนวนไลก์ต่อตอนของเรื่องหนึ่ง (เฉพาะตอนที่เผยแพร่แล้วและมีไลก์) — คืนแค่จำนวน ไม่บอกว่าใครกด
create function episode_like_counts(p_slug text)
returns table (number integer, likes bigint)
language sql stable security definer set search_path = public as $$
  select e.number, count(l.user_id)::bigint
  from titles t
  join episodes e on e.title_id = t.id
  join episode_likes l on l.episode_id = e.id
  where t.slug = p_slug and t.published and episode_is_visible(e.id)
  group by e.number
$$;
grant execute on function episode_like_counts(text) to anon, authenticated;
