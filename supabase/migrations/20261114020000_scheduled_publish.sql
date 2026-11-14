-- ตั้งเวลาเผยแพร่ตอน: status = 'scheduled' + publish_at ถึงเวลาแล้ว → ผู้อ่านมองเห็นเอง
-- (ตัดสินที่ฐานข้อมูลตอนอ่าน ไม่ต้องมีงานตั้งเวลามาพลิกสถานะ จึงไม่มีทางพลาดเวลา/ไม่ต้องมี cron)

alter table episodes
  add constraint episodes_scheduled_needs_time
  check (status <> 'scheduled' or publish_at is not null);

create or replace function episode_is_visible(p_episode_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from episodes e
    join titles t on t.id = e.title_id
    where e.id = p_episode_id
      and t.published
      and (
        e.status = 'published'
        or (e.status = 'scheduled' and e.publish_at <= now())
      )
  );
$$;
