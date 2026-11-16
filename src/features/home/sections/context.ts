import "server-only";
import { isPaywallEnabled } from "@/features/access/paywall";
import {
  listActivePins,
  listAllTitles,
  listFeatured,
  listLatestUpdated,
  listPopular,
  listTrending,
  listTrendingMovement,
  type TitleSummary,
} from "@/features/catalog/catalog";
import type { RankMove } from "@/features/catalog/ranking";
import { boostRanking, withoutHidden, type Pin } from "../pins";

/** ข้อมูลที่ทุกส่วนของหน้าแรกใช้ร่วมกัน — โหลดครั้งเดียวต่อคำขอ (แต่ละฟังก์ชันแคชอยู่แล้ว) */
export interface HomeContext {
  showPremium: boolean;
  /** เรื่องทั้งหมดที่แสดงบนหน้าแรกได้ (ตัดเรื่องที่แอดมินสั่งซ่อนแล้ว) */
  titles: TitleSummary[];
  /** อันดับฮิต: ฮิตช่วงนี้ → ยอดสะสม → อัปเดตล่าสุด (เว็บใหม่ยังไม่มียอดก็ไม่ว่าง) พร้อมเรื่องที่ถูกดันขึ้น */
  ranking: TitleSummary[];
  /** การขยับอันดับเทียบเมื่อวาน (เฉพาะอันดับที่มาจากยอดฮิตช่วงนี้) */
  movement: Record<string, RankMove>;
  latest: TitleSummary[];
  /** เรื่องเด่นตามค่าเริ่มต้น (ที่แอดมินติ๊ก + เติมด้วยล่าสุด) ยังไม่รวมการปัก */
  featuredBase: TitleSummary[];
  pins: Pin[];
}

export async function loadHomeContext(): Promise<HomeContext> {
  const [showPremium, all, pins, trending, popular, latest, featured, movement] = await Promise.all(
    [
      isPaywallEnabled(),
      listAllTitles(),
      listActivePins(),
      listTrending(60),
      listPopular(60),
      listLatestUpdated(60),
      listFeatured(24),
      listTrendingMovement(),
    ],
  );

  const titles = withoutHidden(all, pins);
  const baseRanking = trending.length > 0 ? trending : popular.length > 0 ? popular : latest;
  const ranking = boostRanking(withoutHidden(baseRanking, pins), titles, pins);

  return {
    showPremium,
    titles,
    ranking,
    movement: trending.length > 0 ? movement : {},
    latest: withoutHidden(latest, pins),
    featuredBase: withoutHidden(featured, pins),
    pins,
  };
}
