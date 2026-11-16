-- ชื่อผู้แต่ง/ผู้สร้างของเรื่อง (ข้อความอิสระ; null = ไม่ระบุ) — ไว้ทำหน้าผู้สร้างรวมผลงาน
-- ยังไม่ผูกกับบัญชีผู้ใช้ (นักเขียนล็อกอินเองมาพร้อม Studio ในเฟส B)
alter table titles add column author text check (author is null or char_length(author) between 1 and 100);
