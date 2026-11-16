import { requireAdmin } from "@/features/admin/guard";
import { TitleForm } from "@/features/admin/title-form";

export default async function NewTitlePage() {
  await requireAdmin();
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">เรื่องใหม่</h1>
      <TitleForm
        values={{
          type: "novel",
          slug: "",
          name: "",
          synopsis: "",
          author: "",
          status: "ongoing",
          rating: "all",
          updateDay: "",
          access: "free",
          published: false,
          featured: false,
          tags: "",
        }}
      />
    </section>
  );
}
