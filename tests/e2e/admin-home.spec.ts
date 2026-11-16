import { expect, test, type Page } from "@playwright/test";
import {
  admin,
  callbackUrl,
  createTestUser,
  deleteTitleBySlug,
  deleteUser,
  hasAdmin,
  makeAdmin,
  revalidateCatalog,
  type TestUser,
} from "./helpers/supabase";

// ต่อ Supabase จริง → desktop เท่านั้น และเก็บกวาดทุกแถวที่เทสต์สร้าง (ไม่แตะผังที่แอดมินจัดไว้จริง)
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "หลังบ้านทดสอบบนจอคอมอย่างเดียว");
});

test.describe("จัดหน้าแรก (ต้องมี SUPABASE_SERVICE_ROLE_KEY)", () => {
  test.skip(!hasAdmin, "ไม่มี service role key");

  // ผังหน้าแรกเป็นของส่วนกลาง: ทดสอบทีละข้อ (ไม่ขนาน) ไม่งั้นตัวล้างข้อมูลของข้อหนึ่งจะลบแถวของอีกข้อ
  test.describe.configure({ mode: "serial" });
  const stamp = Date.now().toString(36);
  const slug = `e2e-home-${stamp}`;
  let user: TestUser;
  let created = false;
  let sectionsBefore = new Set<string>();

  test.beforeEach(async () => {
    user = await createTestUser();
    await makeAdmin(user.id);
    const rows = await admin().from("home_sections").select("id");
    sectionsBefore = new Set((rows.data ?? []).map((r) => r.id));
    created = true;
  });
  test.afterEach(async () => {
    if (!created) return;
    created = false;
    const rows = await admin().from("home_sections").select("id");
    const mine = (rows.data ?? []).map((r) => r.id).filter((id) => !sectionsBefore.has(id));
    if (mine.length) await admin().from("home_sections").delete().in("id", mine);
    await admin().from("collections").delete().eq("slug", `col-${stamp}`); // รายการในชุดถูกลบตาม cascade
    await deleteTitleBySlug(slug); // ปักโปรโมทถูกลบตามเรื่องด้วย cascade
    await revalidateCatalog(); // ลบตรงด้วย service role ไม่ผ่านหลังบ้าน → ล้างแคชเอง
    await deleteUser(user.id);
  });

  async function addBanner(page: Page, marker: string, text: string) {
    await page.getByText("+ แถบประกาศ/โปรโมชัน").click();
    const form = page.locator("details[open] form");
    await form.getByLabel("หัวข้อ (ว่าง = ใช้ชื่อเริ่มต้น)").fill(marker);
    await form.getByLabel("ข้อความประกาศ").fill(text);
    await form.getByLabel("ข้อความบนปุ่ม (ว่าง = ไม่มีปุ่ม)").fill("ไปดู");
    await form.getByLabel("ลิงก์ปลายทาง").fill("/browse/novel");
    await form.getByRole("button", { name: "เพิ่มส่วนนี้" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
  }

  test("เพิ่มแถบประกาศ → เห็นบนหน้าแรกพร้อมผังเดิมครบ → สลับลำดับ → ปิด → หาย", async ({ page }) => {
    test.setTimeout(120_000);
    const a = `${stamp}-a`;
    const b = `${stamp}-b`;
    await page.goto(callbackUrl(user, "/admin/home"));
    await expect(page.getByRole("heading", { name: "จัดหน้าแรก" })).toBeVisible();

    await addBanner(page, a, `ประกาศ A ${stamp}`);
    await page.goto("/admin/home");
    await addBanner(page, b, `ประกาศ B ${stamp}`);

    // หน้าแรก: ผังเดิมยังอยู่ (ไม่ถูกแทนที่ด้วยแถบประกาศ) และประกาศขึ้นตามลำดับที่เพิ่ม
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "10 อันดับยอดฮิต" })).toBeVisible();
    await expect(page.getByText(`ประกาศ A ${stamp}`)).toBeVisible();
    const order = async () =>
      page
        .locator("section[aria-label='ประกาศ'] p")
        .evaluateAll(
          (ps, s) => ps.map((p) => p.textContent ?? "").filter((t) => t.includes(s as string)),
          stamp,
        );
    expect(await order()).toEqual([`ประกาศ A ${stamp}`, `ประกาศ B ${stamp}`]);

    // สลับ: เลื่อน B ขึ้น
    await page.goto("/admin/home");
    await page.getByRole("button", { name: new RegExp(`เลื่อน ${b} ขึ้น`) }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await page.goto("/");
    expect(await order()).toEqual([`ประกาศ B ${stamp}`, `ประกาศ A ${stamp}`]);

    // ปิด B → หายจากหน้าแรก
    await page.goto("/admin/home");
    await page
      .locator("li")
      .filter({ hasText: b })
      .getByRole("button", { name: "ปิด", exact: true })
      .click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(`ประกาศ B ${stamp}`)).toHaveCount(0);
    await expect(page.getByText(`ประกาศ A ${stamp}`)).toBeVisible();
  });

  test("ลิงก์อันตรายในแถบประกาศถูกปฏิเสธ", async ({ page }) => {
    await page.goto(callbackUrl(user, "/admin/home"));
    await page.getByText("+ แถบประกาศ/โปรโมชัน").click();
    const form = page.locator("details[open] form");
    await form.getByLabel("ข้อความประกาศ").fill("ทดสอบ");
    await form.getByLabel("ลิงก์ปลายทาง").fill("javascript:alert(1)");
    await form.getByRole("button", { name: "เพิ่มส่วนนี้" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("ลิงก์ต้องขึ้นต้นด้วย");
  });

  test("ปักเรื่องขึ้นแบนเนอร์ → เรื่องนั้นเป็นเรื่องเด่น; สั่งซ่อน → หายจากหน้าแรก", async ({ page }) => {
    test.setTimeout(120_000);
    const name = `เรื่องปักทดสอบ ${stamp}`;
    const ins = await admin()
      .from("titles")
      .insert({ slug, name, type: "novel", published: true })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    await revalidateCatalog(); // เขียนตรงด้วย service role → ล้างแคชให้หน้าเว็บเห็นเรื่องใหม่

    await page.goto(callbackUrl(user, "/admin/home/promotions"));
    await page.getByLabel("เรื่อง", { exact: true }).selectOption(slug);
    await page.getByLabel("ทำอะไร").selectOption("spotlight");
    await page.getByRole("button", { name: "ปักเรื่องนี้" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await expect(page.getByText("ใช้งานอยู่")).toBeVisible();

    await page.goto("/");
    const hero = page.getByRole("region", { name: "เรื่องเด่น" });
    await expect(hero.getByRole("heading", { name })).toBeVisible();

    // ยกเลิกปัก แล้วสั่งซ่อน
    await page.goto("/admin/home/promotions");
    await page.getByRole("button", { name: "ยกเลิกการปัก" }).click();
    // รอจนการยกเลิกบันทึกจริงก่อนไปขั้นต่อไป (อย่าพึ่งแบนเนอร์ "บันทึกแล้ว" ที่อาจค้างจากขั้นก่อน)
    await expect
      .poll(
        async () =>
          (await admin().from("home_pins").select("title_id").eq("title_id", ins.data!.id)).data
            ?.length,
        {
          timeout: 15_000,
        },
      )
      .toBe(0);
    await page.getByLabel("เรื่อง", { exact: true }).selectOption(slug);
    await page.getByLabel("ทำอะไร").selectOption("hidden");
    await page.getByRole("button", { name: "ปักเรื่องนี้" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(name)).toHaveCount(0);
    // ซ่อนจากหน้าแรกเท่านั้น — หน้าเรื่องยังเปิดได้ตามปกติ
    await page.goto(`/title/${slug}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("ปักที่หมดเวลาแล้วไม่มีผล", async ({ page }) => {
    const name = `เรื่องหมดเวลา ${stamp}`;
    const ins = await admin()
      .from("titles")
      .insert({ slug, name, type: "novel", published: true })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    await revalidateCatalog(); // เขียนตรงด้วย service role → ล้างแคชให้หน้าเว็บเห็นเรื่องใหม่
    const pin = await admin()
      .from("home_pins")
      .insert({
        title_id: ins.data!.id,
        placement: "hidden",
        ends_at: new Date(Date.now() - 3600_000).toISOString(),
      });
    expect(pin.error).toBeNull();
    await revalidateCatalog();

    // ซ่อนไว้แต่หมดเวลาแล้ว → ต้องมองเห็นได้ตามปกติ (ในโซนนิยาย)
    await page.goto(callbackUrl(user, "/"));
    await page.goto("/browse/novel");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });

  test("ชุดคัดสรร: สร้างชุด → เลือกเรื่องจากรายชื่อ → เพิ่มเป็นส่วนในหน้าแรก → เห็นเรื่องในชุด", async ({ page }) => {
    test.setTimeout(120_000);
    const name = `เรื่องในชุด ${stamp}`;
    const colTitle = `ชุดทดสอบ ${stamp}`;
    const ins = await admin()
      .from("titles")
      .insert({ slug, name, type: "novel", published: true })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    await revalidateCatalog();

    // 1) สร้างชุด
    await page.goto(callbackUrl(user, "/admin/home/collections"));
    await page.getByLabel("ชื่อชุด").first().fill(colTitle);
    await page.getByLabel("slug", { exact: true }).first().fill(`col-${stamp}`);
    await page.getByRole("button", { name: "สร้างชุด" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();

    // 2) เลือกเรื่องจากรายชื่อ (ไม่ต้องพิมพ์ slug)
    await page
      .locator("li")
      .filter({ hasText: colTitle })
      .getByText(/แก้ไขชุดนี้/)
      .click();
    const picker = page.getByRole("group", { name: `เรื่องในชุด ${colTitle}` });
    await picker.getByRole("combobox").selectOption({ label: `${name} (นิยาย)` });
    await picker.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(picker.getByText(`1. ${name}`)).toBeVisible();
    await page.getByRole("button", { name: "บันทึกรายการเรื่อง" }).click();
    // ข้อความ "บันทึกแล้ว" อาจเป็นแบนเนอร์ค้างจากขั้นสร้างชุด (หน้าเดิม) → ผ่านทันทีทั้งที่ยังไม่ได้บันทึก
    // แล้ว page.goto ถัดไปจะตัดคำขอที่ค้างอยู่ (เคยทำให้ชุดไม่มีเรื่อง ล้มสุ่ม ~50%) → รอจนฐานข้อมูลมีรายการจริง
    await expect
      .poll(
        async () => {
          const col = await admin()
            .from("collections")
            .select("id")
            .eq("slug", `col-${stamp}`)
            .maybeSingle();
          if (!col.data) return 0;
          const items = await admin()
            .from("collection_items")
            .select("title_id")
            .eq("collection_id", col.data.id);
          return items.data?.length ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(1);

    // 3) เพิ่มเป็นส่วนของหน้าแรก (เลือกชุดจากรายการ)
    await page.goto("/admin/home");
    await page.getByText("+ ชุดคัดสรร", { exact: true }).click();
    const form = page.locator("details[open] form");
    await form.getByLabel("ชุดคัดสรร", { exact: true }).selectOption({ label: colTitle });
    await form.getByRole("button", { name: "เพิ่มส่วนนี้" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();

    // 4) หน้าแรกแสดงชุดและเรื่องในชุด + ปุ่มลัด
    await page.goto("/");
    const section = page.locator(`section#zone-c-col-${stamp}`);
    // แคชหลายชั้นถูกล้างพร้อมกัน → หน้าแรกอาจเห็นผลช้ากว่าปกติไม่กี่วินาที: โหลดซ้ำจนเห็น
    await expect(async () => {
      await page.goto("/");
      await expect(section.getByRole("heading", { name: colTitle })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 40_000 });
    await expect(section.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole("link", { name: `เลื่อนไปโซน${colTitle}` })).toBeVisible();
  });
});
