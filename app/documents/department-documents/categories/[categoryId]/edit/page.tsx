import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import { slugifyDocumentReferenceCategoryName } from "@/lib/document-reference-categories";
import { canManageDocuments as hasDocumentsManagementPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function messageValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function EditDepartmentDocumentCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const { categoryId } = await params;
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

  const { data: categoryRow, error: categoryError } = await supabase
    .from("document_reference_categories")
    .select("id, name, slug, description, status, is_default")
    .eq("department_id", currentMember.departmentId)
    .eq("id", categoryId)
    .maybeSingle();

  if (categoryError) {
    throw new Error(categoryError.message || "Unable to load reference category.");
  }

  if (!categoryRow) {
    notFound();
  }

  const { count: documentCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("department_id", currentMember.departmentId)
    .eq("category", "Department Documents")
    .eq("source_kind", "library")
    .eq("reference_category_id", categoryRow.id);

  async function updateReferenceCategory(formData: FormData) {
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
    const status = String(formData.get("status") ?? "active").trim() === "archived" ? "archived" : "active";

    if (!name) {
      redirect(`/documents/department-documents/categories/${categoryId}/edit?error=Category%20name%20is%20required.`);
    }

    const { data: existingCategory } = await supabase
      .from("document_reference_categories")
      .select("id, is_default")
      .eq("department_id", currentMember.departmentId)
      .eq("id", categoryId)
      .maybeSingle();

    if (!existingCategory) {
      redirect("/documents/department-documents?error=Reference%20category%20not%20found.");
    }

    const { count: currentDocumentCount } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("department_id", currentMember.departmentId)
      .eq("category", "Department Documents")
      .eq("source_kind", "library")
      .eq("reference_category_id", categoryId);

    if (existingCategory.is_default && status !== "active") {
      redirect(`/documents/department-documents/categories/${categoryId}/edit?error=The%20default%20Miscellaneous%20Documents%20folder%20cannot%20be%20archived.`);
    }

    if ((currentDocumentCount ?? 0) > 0 && status === "archived") {
      redirect(`/documents/department-documents/categories/${categoryId}/edit?error=Move%20documents%20out%20of%20this%20folder%20before%20archiving%20it.`);
    }

    const slug = slugifyDocumentReferenceCategoryName(name);
    const { error } = await supabase
      .from("document_reference_categories")
      .update({
        name,
        slug,
        description: description || null,
        status,
        updated_by: currentMember.id,
      })
      .eq("department_id", currentMember.departmentId)
      .eq("id", categoryId);

    if (error) {
      redirect(`/documents/department-documents/categories/${categoryId}/edit?error=${encodeURIComponent(error.message || "Unable to update reference category.")}`);
    }

    revalidatePath("/documents");
    revalidatePath("/documents/department-documents");
    revalidatePath(`/documents/department-documents/folders/${slug}`);
    redirect(`/documents/department-documents/folders/${slug}?success=Folder%20updated.`);
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
            Manage Reference Category
          </h1>
        </div>

        <Link
          href={`/documents/department-documents/folders/${categoryRow.slug}`}
          className="inline-flex items-center rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm font-semibold text-white"
        >
          Back to Folder
        </Link>
      </div>

      {messageValue(resolvedSearchParams.error) ? (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
          {messageValue(resolvedSearchParams.error)}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
        <form action={updateReferenceCategory} className="space-y-5">
          <div>
            <label htmlFor="reference-category-name" className="mb-2 block text-sm font-medium text-neutral-200">
              Category Name
            </label>
            <input
              id="reference-category-name"
              type="text"
              name="name"
              defaultValue={categoryRow.name}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
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
              defaultValue={categoryRow.description ?? ""}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 block text-sm font-medium text-neutral-200">Documents in Folder</p>
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-sm text-white">
                {documentCount ?? 0}
              </div>
            </div>

            <div>
              <label htmlFor="reference-category-status" className="mb-2 block text-sm font-medium text-neutral-200">
                Status
              </label>
              <select
                id="reference-category-status"
                name="status"
                defaultValue={categoryRow.status}
                disabled={categoryRow.is_default}
                className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white focus:border-red-500/60 focus:outline-none disabled:opacity-60"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-neutral-400">
            Deleting folders is intentionally disabled for safety. Move documents to another folder first, then archive unused folders when needed.
          </div>

          <div className="flex items-center justify-end border-t border-white/10 pt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}