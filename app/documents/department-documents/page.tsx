import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import {
  DEPARTMENT_DOCUMENTS_CATEGORY,
  MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME,
  MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG,
  type DocumentReferenceCategoryRow,
} from "@/lib/document-reference-categories";
import { canManageDocuments as hasDocumentsManagementPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function normalizeSearchQuery(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }

  if (Array.isArray(input)) {
    return input.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
  }

  return "";
}

function getSnippet(text: string | null | undefined, term: string) {
  const value = text?.trim();
  if (!value || !term.trim()) {
    return null;
  }

  const haystack = value.toLowerCase();
  const needle = term.trim().toLowerCase();
  const index = haystack.indexOf(needle);

  if (index === -1) {
    return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(value.length, index + needle.length + 120);
  return value.slice(start, end).trim();
}

export default async function DepartmentDocumentsLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; success?: string; error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = normalizeSearchQuery(resolvedSearchParams.q);

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

  const [{ data: referenceCategoryRows, error: referenceCategoriesError }, { data: departmentDocumentRows, error: departmentDocumentsError }] = await Promise.all([
    supabase
      .from("document_reference_categories")
      .select("id, department_id, name, slug, description, status, is_default, created_by, updated_by, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title, description, document_number, updated_at, uploaded_by, current_revision_id, reference_category_id")
      .eq("department_id", currentMember.departmentId)
      .eq("category", DEPARTMENT_DOCUMENTS_CATEGORY)
      .eq("source_kind", "library")
      .order("effective_date", { ascending: false }),
  ]);

  if (referenceCategoriesError) {
    throw new Error(referenceCategoriesError.message || "Unable to load Department Documents categories.");
  }

  if (departmentDocumentsError) {
    throw new Error(departmentDocumentsError.message || "Unable to load Department Documents.");
  }

  const referenceCategories = (referenceCategoryRows ?? []) as DocumentReferenceCategoryRow[];
  const referenceCategoryById = new Map(referenceCategories.map((row) => [row.id, row]));
  const countsByCategoryId = (departmentDocumentRows ?? []).reduce<Record<string, number>>((accumulator, row) => {
    const key = typeof row.reference_category_id === "string" && row.reference_category_id
      ? row.reference_category_id
      : referenceCategories.find((categoryRow) => categoryRow.is_default)?.id ?? MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG;
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  let searchResults: Array<{
    id: string;
    title: string;
    document_number: string | null;
    updated_at: string | null;
    uploaded_by: string | null;
    referenceCategoryName: string;
    referenceCategorySlug: string;
    revision_number: number | null;
    matchText: string | null;
  }> = [];

  if (query) {
    const documentIds = (departmentDocumentRows ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string");
    const { data: revisionRows } = documentIds.length > 0
      ? await supabase
          .from("document_revisions")
          .select("document_id, revision_number, content_text, uploaded_by, updated_at, file_name, notes")
          .eq("department_id", currentMember.departmentId)
          .in("document_id", documentIds)
          .order("revision_number", { ascending: false })
      : { data: [] };

    const revisionLookup = new Map<string, Record<string, unknown>>();
    for (const revision of revisionRows ?? []) {
      const documentId = typeof revision.document_id === "string" ? revision.document_id : "";
      if (!documentId || revisionLookup.has(documentId)) {
        continue;
      }
      revisionLookup.set(documentId, revision);
    }

    const memberIds = new Set<string>();
    for (const row of departmentDocumentRows ?? []) {
      if (typeof row.uploaded_by === "string") {
        memberIds.add(row.uploaded_by);
      }
    }
    for (const revision of revisionRows ?? []) {
      if (typeof revision.uploaded_by === "string") {
        memberIds.add(revision.uploaded_by);
      }
    }

    const memberLookup = new Map<string, string>();
    if (memberIds.size > 0) {
      const { data: memberRows } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", Array.from(memberIds));

      for (const member of memberRows ?? []) {
        const id = typeof member.id === "string" ? member.id : "";
        const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
        if (id) {
          memberLookup.set(id, fullName || "Unknown user");
        }
      }
    }

    const filteredRows = (departmentDocumentRows ?? []).filter((row) => {
      const revision = revisionLookup.get(row.id) ?? null;
      const searchableText = [
        row.title ?? "",
        row.document_number ?? "",
        row.description ?? "",
        typeof revision?.file_name === "string" ? revision.file_name : "",
        typeof revision?.notes === "string" ? revision.notes : "",
        typeof revision?.content_text === "string" ? revision.content_text : "",
      ].join(" ").toLowerCase();

      return searchableText.includes(query.toLowerCase());
    });

    searchResults = filteredRows.map((row) => {
      const revision = revisionLookup.get(row.id) ?? null;
      const referenceCategory =
        (typeof row.reference_category_id === "string" ? referenceCategoryById.get(row.reference_category_id) : null)
        || referenceCategories.find((categoryRow) => categoryRow.is_default)
        || null;
      return {
        id: row.id,
        title: row.title ?? "Untitled document",
        document_number: row.document_number ?? null,
        updated_at:
          typeof revision?.updated_at === "string"
            ? revision.updated_at
            : typeof row.updated_at === "string"
              ? row.updated_at
              : null,
        uploaded_by:
          typeof revision?.uploaded_by === "string"
            ? memberLookup.get(revision.uploaded_by) ?? revision.uploaded_by
            : typeof row.uploaded_by === "string"
              ? memberLookup.get(row.uploaded_by) ?? row.uploaded_by
              : null,
        referenceCategoryName: referenceCategory?.name ?? MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME,
        referenceCategorySlug: referenceCategory?.slug ?? MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG,
        revision_number:
          typeof revision?.revision_number === "number"
            ? revision.revision_number
            : null,
        matchText:
          getSnippet(row.description ?? null, query)
          || getSnippet(typeof revision?.content_text === "string" ? revision.content_text : null, query)
          || null,
      };
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Documents
          </p>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Department Documents
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-neutral-400">
            Organize department reference material into folders that work like a digital filing cabinet.
          </p>
        </div>

        {canManageDocuments ? (
          <div className="flex flex-wrap gap-3">
            <Link
              href="/documents/department-documents/categories/new"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Add Reference Category
            </Link>
            <Link
              href="/documents/department-documents/new"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Add Department Document
            </Link>
          </div>
        ) : null}
      </div>

      {resolvedSearchParams.success ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {resolvedSearchParams.success}
        </div>
      ) : null}

      {resolvedSearchParams.error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#111111] px-5 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.25)]">
        <form action="/documents/department-documents" method="get" className="flex gap-3">
          <label htmlFor="department-document-search" className="sr-only">
            Search Department Documents
          </label>
          <input
            id="department-document-search"
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search all Department Documents folders..."
            className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
          >
            Search
          </button>
        </form>
      </section>

      {query ? (
        <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Search Results</p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {searchResults.length > 0 ? `${searchResults.length} results` : "No results"}
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-400">No matching Department Documents were found.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {searchResults.map((result) => (
                <div key={result.id} className="rounded-2xl border border-white/10 bg-[#151515] p-4 md:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">{result.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-neutral-500">
                        <span>{result.referenceCategoryName}</span>
                        <span className="text-neutral-600">•</span>
                        <span>{result.revision_number ? `Version ${result.revision_number}` : "Version 1"}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        <span>Document #: {result.document_number || "-"}</span>
                        <span className="text-neutral-600">•</span>
                        <span>Updated by: {result.uploaded_by || "Unknown user"}</span>
                      </div>
                      {result.matchText ? (
                        <p className="mt-3 text-sm leading-6 text-neutral-300">“{result.matchText}”</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={`/documents/department-documents/folders/${result.referenceCategorySlug}`}
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                      >
                        Open Folder
                      </Link>
                      <Link
                        href={`/documents/department-documents/${result.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
                      >
                        Open Document
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Folders</p>
          <h2 className="mt-2 text-2xl font-black text-white">Department Reference Categories</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {referenceCategories.map((referenceCategory) => {
            const count = countsByCategoryId[referenceCategory.id] ?? 0;
            return (
              <div key={referenceCategory.id} className="rounded-2xl border border-white/10 bg-[#151515] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                      {referenceCategory.is_default ? "Default Folder" : "Reference Folder"}
                    </p>
                    <h3 className="mt-3 text-xl font-bold text-white">{referenceCategory.name}</h3>
                  </div>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-200">
                    {count}
                  </span>
                </div>

                <p className="mt-4 min-h-[3rem] text-sm leading-6 text-neutral-400">
                  {referenceCategory.description?.trim() || "No description provided."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/documents/department-documents/folders/${referenceCategory.slug}`}
                    className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
                  >
                    Open Folder
                  </Link>

                  {canManageDocuments ? (
                    <Link
                      href={`/documents/department-documents/categories/${referenceCategory.id}/edit`}
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                      Manage Folder
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}