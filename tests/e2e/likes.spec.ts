import { expect, test } from "@playwright/test";
import {
  admin,
  anon,
  callbackUrl,
  createTestUser,
  deleteUser,
  hasAdmin,
  type TestUser,
} from "./helpers/supabase";

// ต่อ Supabase จริง (ต้อง push migration episode_likes ก่อน) + ใช้โควตายืนยันลิงก์ 1 ครั้ง → desktop เท่านั้น
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "ไลก์ทดสอบบนจอคอมอย่างเดียว");
});

test("ยังไม่ล็อกอิน: กดถูกใจแล้วพาไปหน้าล็อกอินพร้อมกลับมาที่ตอนเดิม", async ({ page }) => {
  await page.goto("/read/sample-novel/1");
  const like = page.getByRole("button", { name: /ถูกใจตอนนี้/ });
  // ปุ่มพร้อมกดเมื่อโหลดสถานะเสร็จ (ไม่ disabled)
  await expect(like).toBeEnabled();
  await like.click();
  await expect(page).toHaveURL(/\/login\?next=%2Fread%2Fsample-novel%2F1/);
});

test.describe("ไลก์รายตอน (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");
  // สองข้อนี้ไลก์ตอนเดียวกัน (sample-novel ตอนที่ 1) → รันทีละข้อ ไม่งั้นยอดที่ข้อหนึ่งคาดไว้จะเพี้ยนจากอีกข้อ
  test.describe.configure({ mode: "serial" });
  let user: TestUser;
  let created = false;

  test.beforeEach(async () => {
    user = await createTestUser();
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    await deleteUser(user.id); // ไลก์ถูกลบตามผู้ใช้ด้วย cascade
  });

  test("กดถูกใจ → ค้างหลังรีโหลด → ขึ้นในรายการตอน → ยกเลิกได้", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(callbackUrl(user, "/read/sample-novel/1"));
    const like = page.getByRole("button", { name: /ถูกใจตอนนี้/ });
    await expect(like).toBeEnabled();
    const before = Number(((await like.innerText()).match(/\d+/) ?? ["0"])[0]);

    await like.click();
    await expect(page.getByRole("button", { name: "ยกเลิกถูกใจตอนนี้" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // รอจนบันทึกลงฐานข้อมูลจริง (อย่าพึ่งแค่ UI ที่อัปเดตก่อน) แล้วค่อยรีโหลด
    await expect
      .poll(
        async () =>
          (await admin().from("episode_likes").select("user_id").eq("user_id", user.id)).data
            ?.length,
      )
      .toBe(1);

    await page.reload();
    const unlike = page.getByRole("button", { name: "ยกเลิกถูกใจตอนนี้" });
    await expect(unlike).toBeVisible();
    await expect(unlike).toContainText(String(before + 1));

    // หน้าเรื่องแสดงยอดถูกใจของตอนนั้น (ป้ายมีคำว่า "ถูกใจ" กำกับตัวเลข)
    await page.goto("/title/sample-novel");
    await expect(page.getByText(/ถูกใจ \d+/).first()).toBeVisible();

    // ยกเลิก
    await page.goto("/read/sample-novel/1");
    await page.getByRole("button", { name: "ยกเลิกถูกใจตอนนี้" }).click();
    await expect
      .poll(
        async () =>
          (await admin().from("episode_likes").select("user_id").eq("user_id", user.id)).data
            ?.length,
      )
      .toBe(0);
  });

  test("RLS: คนอื่น/ผู้เยี่ยมชมอ่านแถวไลก์ไม่ได้ และเพิ่มไลก์ให้ตอนฉบับร่างไม่ได้", async () => {
    const db = admin();
    const ep = await db
      .from("episodes")
      .select("id, titles!inner(slug)")
      .eq("titles.slug", "sample-novel")
      .eq("number", 1)
      .single();
    expect(ep.error).toBeNull();
    await db.from("episode_likes").insert({ user_id: user.id, episode_id: ep.data!.id });

    // ผู้เยี่ยมชม (anon): ตารางอ่านไม่ได้เลย แต่ฟังก์ชันนับคืนได้เฉพาะจำนวน (ไม่มี user_id)
    const visitor = anon();
    const rows = await visitor.from("episode_likes").select("*");
    expect(rows.data ?? []).toHaveLength(0);
    const counts = await visitor.rpc("episode_like_counts", { p_slug: "sample-novel" });
    expect(counts.error).toBeNull();
    expect(Object.keys(counts.data?.[0] ?? {}).sort()).toEqual(["likes", "number"]);

    // ตอนฉบับร่างของเรื่องที่เผยแพร่: ผู้ใช้ทั่วไปไลก์ไม่ได้ (policy ตรวจ episode_is_visible)
    const t = await db
      .from("titles")
      .insert({
        slug: `e2e-like-${Date.now().toString(36)}`,
        name: "ทดสอบไลก์",
        type: "novel",
        published: true,
      })
      .select("id, slug")
      .single();
    expect(t.error).toBeNull();
    try {
      const draft = await db
        .from("episodes")
        .insert({ title_id: t.data!.id, number: 1, name: "ร่าง", status: "draft" })
        .select("id")
        .single();
      expect(draft.error).toBeNull();
      const userDb = anon();
      const { error: signErr } = await userDb.auth.verifyOtp({
        token_hash: user.tokenHash,
        type: user.linkType as "magiclink",
      });
      expect(signErr).toBeNull();
      const ins = await userDb
        .from("episode_likes")
        .insert({ user_id: user.id, episode_id: draft.data!.id });
      expect(ins.error).not.toBeNull(); // ถูก RLS ปฏิเสธ
    } finally {
      await db.from("titles").delete().eq("id", t.data!.id);
    }
  });
});
