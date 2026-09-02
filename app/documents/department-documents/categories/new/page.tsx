import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import { slugifyDocumentReferenceCategoryName } from "@/lib/document-reference-categories";
import { canManageDocuments as hasDocumentsManagementPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function normalizeMessage(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function NewDepartmentDocumentCategoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const canManageDocuments = await hasDocumentsManagementPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
  );

  if (!canManageDocuments) {
    redirect("/documents/department-documents");
  }

  async function createReferenceCategory(formData: FormData) {
    "use server";

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      redirect("/login");
    }

    const canManageDocuments = await hasDocumentsManagementPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
    );

    if (!canManageDocuments) {
      redirect("/documents/department-documents");
    }

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name) {
      redirect("/documents/department-documents/categories/new?error=Category%20name%20is%20required.");
    }

    const slug = slugifyDocumentReferenceCategoryName(name);
    const { error } = await supabase
      .from("document_reference_categories")
      .insert({
        department_id: currentMember.departmentId,
        name,
        slug,
        description: description || null,
        status: "active",
        is_default: false,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      });

    if (error) {
      redirect(`/documents/department-documents/categories/new?error=${encodeURIComponent(error.message || "Unable to create reference category.")}`);
    }

    revalidatePath("/documents");
    revalidatePath("/documents/department-documents");
    redirect("/documents/department-documents?success=Reference%20category%20created.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Department Documents
          </p>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Add Reference Category
          </h1>
        </div>

        <Link
          href="/documents/department-documents"
          className="inline-flex items-center rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm font-semibold text-white"
        >
          Back to Department Documents
        </Link>
      </div>

      {normalizeMessage(resolvedSearchParams.error) ? (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
          {normalizeMessage(resolvedSearchParams.error)}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
        <form action={createReferenceCategory} className="space-y-5">
          <div>
            <label htmlFor="reference-category-name" className="mb-2 block text-sm font-medium text-neutral-200">
              Category Name
            </label>
            <input
              id="reference-category-name"
              type="text"
              name="name"
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
              placeholder="Example: Apparatus Manuals"
              required
            />
          </div>

          <div>
            <label htmlFor="reference-category-description" className="mb-2 block text-sm font-medium text-neutral-200">
              Description
            </label>
            <textarea
              id="reference-category-description"
              name="description"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
              placeholder="Optional description for this folder"
            />
          </div>

          <div className="flex items-center justify-end border-t border-white/10 pt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
            >
              Create Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}