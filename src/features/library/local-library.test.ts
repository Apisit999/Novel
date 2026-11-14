import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discardPending,
  readLibrary,
  saveProgress,
  setRemote,
  toggleFavorite,
  type RemoteHooks,
} from "./local-library";

/** localStorage/window จำลองอย่างง่าย (vitest รันใน node) */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, String(v));
  removeItem = (k: string) => void this.m.delete(k);
}

function hooks(): RemoteHooks & {
  favorite: ReturnType<typeof vi.fn>;
  progress: ReturnType<typeof vi.fn>;
} {
  const favorite = vi.fn(async () => {});
  const progress = vi.fn();
  return { setFavorite: favorite, recordProgress: progress, favorite, progress };
}

beforeEach(async () => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", new EventTarget());
  await setRemote(null);
  discardPending();
});
afterEach(() => vi.unstubAllGlobals());

describe("คิวการกดก่อนซิงก์พร้อม (กันการกดหายเงียบ ๆ)", () => {
  it("กดหัวใจก่อนมีจุดเชื่อมบัญชี → บันทึกในเครื่องทันที และส่งขึ้นบัญชีเมื่อจุดเชื่อมพร้อม", async () => {
    toggleFavorite("moonlit-garden");
    expect(readLibrary().favorites).toEqual(["moonlit-garden"]);

    const h = hooks();
    await setRemote(h);
    expect(h.favorite).toHaveBeenCalledTimes(1);
    expect(h.favorite).toHaveBeenCalledWith("moonlit-garden", true);
  });

  it("กดชอบแล้วเลิกชอบก่อนซิงก์ → ส่งทั้งสองครั้งตามลำดับ (สถานะสุดท้ายถูกต้อง)", async () => {
    toggleFavorite("a");
    toggleFavorite("a");
    const h = hooks();
    await setRemote(h);
    expect(h.favorite.mock.calls).toEqual([
      ["a", true],
      ["a", false],
    ]);
  });

  it("Promise ของ setRemote เสร็จหลังการส่งที่ค้างคิวเสร็จครบ (ตัวซิงก์รอได้ก่อนดึงข้อมูล)", async () => {
    toggleFavorite("a");
    let release!: () => void;
    const h = hooks();
    h.favorite.mockImplementation(() => new Promise<void>((r) => (release = r)));

    let done = false;
    const flushed = setRemote(h).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false); // ยังส่งไม่เสร็จ
    release();
    await flushed;
    expect(done).toBe(true);
  });

  it("ความคืบหน้าที่ค้างคิวเก็บเฉพาะค่าล่าสุดของแต่ละเรื่อง", async () => {
    saveProgress("x", 1, 10);
    saveProgress("x", 1, 55);
    saveProgress("y", 2, 20);
    const h = hooks();
    await setRemote(h);
    expect(h.progress.mock.calls).toEqual([
      ["x", 1, 55],
      ["y", 2, 20],
    ]);
  });

  it("ไม่ได้ล็อกอิน (discardPending) → ไม่ส่งอะไร และไม่ค้างไปส่งให้คนที่ล็อกอินทีหลัง", async () => {
    toggleFavorite("a");
    discardPending();
    const h = hooks();
    await setRemote(h);
    expect(h.favorite).not.toHaveBeenCalled();
    expect(readLibrary().favorites).toEqual(["a"]); // ของในเครื่องยังอยู่ (ผู้ใช้ไม่ล็อกอินก็ใช้ได้)
  });

  it("เมื่อจุดเชื่อมพร้อมแล้ว การกดถัดไปส่งตรงทันที ไม่เข้าคิว", async () => {
    const h = hooks();
    await setRemote(h);
    toggleFavorite("b");
    expect(h.favorite).toHaveBeenCalledWith("b", true);
  });

  it("คิวไม่โตไม่จำกัด (กันหน่วยความจำบวมสำหรับผู้เยี่ยมชมที่กดเยอะ)", async () => {
    for (let i = 0; i < 500; i++) toggleFavorite(`t${i}`);
    const h = hooks();
    await setRemote(h);
    expect(h.favorite.mock.calls.length).toBeLessThanOrEqual(200);
  });
});
