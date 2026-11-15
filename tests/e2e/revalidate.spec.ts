import { expect, test } from "@playwright/test";
import { REVALIDATE_SECRET } from "./helpers/supabase";

test.describe("POST /api/revalidate (เคลียร์แคช)", () => {
  test.skip(!REVALIDATE_SECRET, "ไม่มี REVALIDATE_SECRET");

  test("ไม่ส่งรหัส หรือรหัสผิด → 401 (ไม่เคลียร์แคช)", async ({ request }) => {
    expect((await request.post("/api/revalidate")).status()).toBe(401);
    const wrong = await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": "x".repeat(REVALIDATE_SECRET!.length) },
    });
    expect(wrong.status()).toBe(401);
    // ความยาวต่างกันก็ต้องปฏิเสธโดยไม่ error
    const short = await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": "a" },
    });
    expect(short.status()).toBe(401);
  });

  test("รหัสถูก → เคลียร์ทุกแท็ก หรือเฉพาะแท็กที่ระบุ", async ({ request }) => {
    const headers = { "x-revalidate-secret": REVALIDATE_SECRET! };
    const all = await request.post("/api/revalidate", { headers });
    expect(all.status()).toBe(200);
    expect((await all.json()).revalidated).toEqual(["catalog", "settings", "home"]);

    const one = await request.post("/api/revalidate", { headers, data: { tags: ["catalog"] } });
    expect((await one.json()).revalidated).toEqual(["catalog"]);
  });

  test("แท็กนอกรายการที่อนุญาต → 400", async ({ request }) => {
    const res = await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": REVALIDATE_SECRET! },
      data: { tags: ["something-else"] },
    });
    expect(res.status()).toBe(400);
  });

  test("GET ไม่ได้ (รับเฉพาะ POST)", async ({ request }) => {
    expect((await request.get("/api/revalidate")).status()).toBe(405);
  });
});
