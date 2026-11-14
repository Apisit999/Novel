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
          status: "ongoing",
          rating: "all",
          access: "free",
          published: false,
          tags: "",
        }}
      />
    </section>
  );
}
