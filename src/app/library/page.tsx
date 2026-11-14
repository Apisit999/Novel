import { listAllTitles } from "@/features/catalog/catalog";
import { LibraryView } from "@/features/library/library-view";

export const metadata = { title: "เรื่องที่ชอบ", robots: { index: false } };

export default async function LibraryPage() {
  const titles = await listAllTitles();
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">เรื่องที่ชอบ และอ่านต่อ</h1>
      <LibraryView titles={titles} />
    </section>
  );
}
