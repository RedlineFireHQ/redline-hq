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

const primaryCategories = [
  {
    slug: "sops",
    title: "SOPs",
    dbCategory: "SOPs",
    href: "/documents/sops",
    description: "Standard operating procedures and field reference material.",
  },
  {
    slug: "ems-protocols",
    title: "EMS Protocols",
    dbCategory: "EMS Protocols",
    href: "/documents/ems-protocols",
    description: "Clinical guidance and operational treatment reference documents.",
  },
  {
    slug: "city-department-policies",
    title: "City Department Policies",
    dbCategory: "City / Department Policies",
    href: "/documents/city-department-policies",
    description: "City policy, department policy, and administrative direction.",
  },
  {
    slug: "mutual-aid-agreements",
    title: "Mutual Aid Agreements",
    dbCategory: "Mutual Aid Agreements",
    href: "/documents/mutual-aid-agreements",
    description: "Regional coordination, assisting agency, and mutual aid references.",
  },
];

function resolveCategorySlug(
  category: string | null | undefined,
  referenceCategoryId: string | null | undefined,
  referenceCategoryById: Map<string, DocumentReferenceCategoryRow>,
  defaultReferenceCategorySlug: string,
) {
  if (!category) {
    return null;
  }

  const normalizedCategory = category.trim();

  if (normalizedCategory === DEPARTMENT_DOCUMENTS_CATEGORY) {
    if (typeof referenceCategoryId === "string" && referenceCategoryId) {
      const mappedReferenceCategory = referenceCategoryById.get(referenceCategoryId);
      if (mappedReferenceCategory?.slug) {
        return mappedReferenceCategory.slug;
      }
    }

    return defaultReferenceCategorySlug;
  }

  const match = Object.entries({
    SOPs: "sops",
    "EMS Protocols": "ems-protocols",
    "City / Department Policies": "city-department-policies",
    "Mutual Aid Agreements": "mutual-aid-agreements",
  }).find(([label]) => label === normalizedCategory);

  return match ? match[1] : null;
}

function getReferenceCategoryTitle(row: DocumentReferenceCategoryRow) {
  const trimmed = row.name.trim().toLowerCase();
  if (row.is_default && trimmed === MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME.toLowerCase()) {
    return "Miscellaneous";
  }

  return row.name;
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
  const slice = value.slice(start, end).trim();

  return slice;
}

function normalizeSearchQuery(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }

  if (Array.isArray(input)) {
    return input.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
  }

  return "";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
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

  const { data: referenceCategoryRows, error: referenceCategoriesError } = await supabase
    .from("document_reference_categories")
    .select("id, department_id, name, slug, description, status, is_default, created_by, updated_by, created_at, updated_at")
    .eq("department_id", currentMember.departmentId)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (referenceCategoriesError) {
    throw new Error(referenceCategoriesError.message || "Unable to load Department Reference Categories.");
  }

  const referenceCategories = (referenceCategoryRows ?? []) as DocumentReferenceCategoryRow[];
  const referenceCategoryById = new Map(referenceCategories.map((row) => [row.id, row]));
  const defaultReferenceCategory =
    referenceCategories.find((row) => row.is_default) ?? referenceCategories[0] ?? null;
  const fallbackReferenceCategorySlug =
    defaultReferenceCategory?.slug || MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG;

  let searchResults: Array<{
    id: string;
    category: string;
    categoryLabel: string;
    categorySlug: string;
    title: string;
    description: string | null;
    document_number: string | null;
    updated_at: string | null;
    current_revision_id: string | null;
    revision_number: number | null;
    updated_by: string | null;
    matchText: string | null;
    reference_category_id: string | null;
  }> = [];

  const { data: allDocuments } = await supabase
    .from("documents")
    .select(
      "id, category, title, description, document_number, updated_at, current_revision_id, uploaded_by, reference_category_id",
    )
    .eq("department_id", currentMember.departmentId)
    .eq("source_kind", "library")
    .order("title");

  const countsByCategory: Record<string, number> = {};
  const countsByReferenceCategoryId: Record<string, number> = {};

  for (const document of allDocuments ?? []) {
    const category = document.category ?? "";

    if (category === DEPARTMENT_DOCUMENTS_CATEGORY) {
      const categoryId =
        (typeof document.reference_category_id === "string" && document.reference_category_id) ||
        defaultReferenceCategory?.id ||
        "";

      if (categoryId) {
        countsByReferenceCategoryId[categoryId] = (countsByReferenceCategoryId[categoryId] ?? 0) + 1;
      }

      continue;
    }

    countsByCategory[category] = (countsByCategory[category] ?? 0) + 1;
  }

  if (query) {
    const searchTerm = query.toLowerCase();
    const documentIds = (allDocuments ?? []).map((document) => document.id).filter((id): id is string => typeof id === "string");

    const { data: revisionRows } = documentIds.length > 0
      ? await supabase
          .from("document_revisions")
          .select("document_id, revision_number, content_text, uploaded_by, updated_at")
          .eq("department_id", currentMember.departmentId)
          .in("document_id", documentIds)
          .order("revision_number", { ascending: false })
      : { data: [] };

    const { data: contentRevisionRows } = query
      ? await supabase
          .from("document_revisions")
          .select("document_id, revision_number, content_text, uploaded_by, updated_at")
          .eq("department_id", currentMember.departmentId)
          .ilike("content_text", `%${query}%`)
      : { data: [] };

    const revisionLookup = new Map<string, Record<string, unknown>>();
    const contentRevisionLookup = new Map<string, Record<string, unknown>>();

    for (const revision of revisionRows ?? []) {
      const documentId = typeof revision.document_id === "string" ? revision.document_id : "";
      if (!documentId || revisionLookup.has(documentId)) {
        continue;
      }

      revisionLookup.set(documentId, revision);
    }

    for (const revision of contentRevisionRows ?? []) {
      const documentId = typeof revision.document_id === "string" ? revision.document_id : "";
      if (!documentId || contentRevisionLookup.has(documentId)) {
        continue;
      }

      contentRevisionLookup.set(documentId, revision);
    }

    const matchedDocuments = (allDocuments ?? []).filter((document) => {
      const currentRevision = revisionLookup.get(document.id) ?? null;
      const contentRevision = contentRevisionLookup.get(document.id) ?? null;
      const searchableText = [
        document.title ?? "",
        document.category ?? "",
        document.document_number ?? "",
        document.description ?? "",
        typeof currentRevision?.content_text === "string" ? currentRevision.content_text : "",
        typeof contentRevision?.content_text === "string" ? contentRevision.content_text : "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });

    const memberIds = new Set<string>();
    for (const document of matchedDocuments) {
      if (typeof document.uploaded_by === "string") {
        memberIds.add(document.uploaded_by);
      }
    }
    for (const revision of revisionRows ?? []) {
      if (typeof revision.uploaded_by === "string") {
        memberIds.add(revision.uploaded_by);
      }
    }

    const memberLookup = new Map<string, string>();
    if (memberIds.size > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", Array.from(memberIds));

      for (const member of members ?? []) {
        const id = typeof member.id === "string" ? member.id : "";
        const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
        if (id) {
          memberLookup.set(id, fullName || "Unknown user");
        }
      }
    }

    searchResults = matchedDocuments
      .map((document) => {
        const currentRevision = revisionLookup.get(document.id) ?? null;
        const contentRevision = contentRevisionLookup.get(document.id) ?? null;
        const revisionNumber =
          typeof currentRevision?.revision_number === "number"
            ? currentRevision.revision_number
            : null;
        const updatedAt =
          typeof currentRevision?.updated_at === "string"
            ? currentRevision.updated_at
            : typeof document.updated_at === "string"
              ? document.updated_at
              : null;
        const updatedBy =
          typeof currentRevision?.uploaded_by === "string"
            ? currentRevision.uploaded_by
            : typeof document.uploaded_by === "string"
              ? document.uploaded_by
              : null;
        const matchText =
          getSnippet(document.description ?? null, query) ||
          getSnippet(typeof currentRevision?.content_text === "string" ? currentRevision.content_text : null, query) ||
          getSnippet(typeof contentRevision?.content_text === "string" ? contentRevision.content_text : null, query) ||
          null;

        return {
          id: document.id,
          category: document.category ?? "",
          categoryLabel:
            document.category === DEPARTMENT_DOCUMENTS_CATEGORY
              ? getReferenceCategoryTitle(
                  (typeof document.reference_category_id === "string"
                    ? referenceCategoryById.get(document.reference_category_id)
                    : undefined) ||
                    defaultReferenceCategory || {
                      id: "",
                      department_id: "",
                      name: MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME,
                      slug: fallbackReferenceCategorySlug,
                      description: null,
                      status: "active",
                      is_default: true,
                      created_by: null,
                      updated_by: null,
                      created_at: "",
                      updated_at: "",
                    },
                )
              : document.category ?? "",
          categorySlug:
            resolveCategorySlug(
              document.category,
              document.reference_category_id,
              referenceCategoryById,
              fallbackReferenceCategorySlug,
            ) ?? fallbackReferenceCategorySlug,
          title: document.title ?? "Untitled document",
          description: document.description ?? null,
          document_number: document.document_number ?? null,
          updated_at: updatedAt,
          current_revision_id: document.current_revision_id ?? null,
          revision_number: revisionNumber,
          updated_by: updatedBy,
          matchText,
          reference_category_id: document.reference_category_id ?? null,
        };
      })
      .sort((left, right) => {
        const leftTitle = left.title.toLowerCase();
        const rightTitle = right.title.toLowerCase();
        return leftTitle.localeCompare(rightTitle);
      });
  }

  return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Reference Library
          </p>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Documents
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-neutral-400">
            This is the department&apos;s digital reference library for the policies,
            procedures, and operational guidance firefighters and command staff need
            to access quickly.
          </p>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#1f1f1f] p-5">
          <form action="/documents" method="get" className="flex gap-3">
            <label htmlFor="document-search" className="sr-only">
              Search documents
            </label>
            <input
              id="document-search"
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search documents..."
              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
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
          <section className="rounded-2xl border border-neutral-800 bg-[#1b1b1b] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                  Search Results
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {searchResults.length > 0 ? `${searchResults.length} results` : "No results"}
                </h2>
              </div>
            </div>

            {searchResults.length === 0 ? (
              <p className="mt-6 text-neutral-400">No matching documents found.</p>
            ) : (
              <div className="mt-6 space-y-3">
                {searchResults.map((document) => {
                  const revisionLabel = document.revision_number ? `Version ${document.revision_number}` : "Version 1";
                  const updatedDate = document.updated_at
                    ? new Date(document.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "-";
                  const updatedBy = document.updated_by || "Unknown user";

                  return (
                    <div
                      key={document.id}
                      className="rounded-2xl border border-white/10 bg-[#111111] p-4 transition hover:border-red-500/40 hover:bg-[#171717]"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-lg font-bold text-white">{document.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-neutral-500">
                            <span>{document.categoryLabel}</span>
                            <span className="text-neutral-600">•</span>
                            <span>{revisionLabel}</span>
                            <span className="text-neutral-600">•</span>
                            <span>Updated {updatedDate}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                            <span>Document #: {document.document_number || "-"}</span>
                            <span className="text-neutral-600">•</span>
                            <span>Updated by: {updatedBy}</span>
                          </div>
                        </div>

                        <Link
                          href={`/documents/${document.categorySlug}/${document.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
                        >
                          Open Document
                        </Link>
                      </div>

                      {document.matchText ? (
                        <p className="mt-3 text-sm leading-6 text-neutral-300">“{document.matchText}”</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-neutral-800 bg-[#1b1b1b] p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                Categories
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Department Reference Categories
              </h2>
            </div>

            {canManageDocuments ? (
              <Link
                href="/documents/department-documents/categories/new"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Create a New Category
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {primaryCategories.map((category) => {
              const count = countsByCategory[category.dbCategory] ?? 0;

              return (
                <Link
                  key={category.title}
                  href={category.href}
                  className="group block rounded-2xl border border-white/10 bg-[#111111] p-5 transition hover:border-red-500/40 hover:bg-[#171717]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                        Category
                      </p>
                      <h3 className="mt-3 text-xl font-bold text-white">{category.title}</h3>
                    </div>
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-200">
                      {count}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-neutral-400">
                    {category.description}
                  </p>

                  <div className="mt-5 text-sm font-semibold text-red-300 transition group-hover:text-red-200">
                    {count === 0 ? "No documents yet" : `Open ${category.title}`}
                  </div>
                </Link>
              );
            })}

            {referenceCategories.map((categoryRow) => {
              const count = countsByReferenceCategoryId[categoryRow.id] ?? 0;
              const title = getReferenceCategoryTitle(categoryRow);

              return (
                <Link
                  key={categoryRow.id}
                  href={`/documents/${categoryRow.slug}`}
                  className="group block rounded-2xl border border-white/10 bg-[#111111] p-5 transition hover:border-red-500/40 hover:bg-[#171717]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                        Category
                      </p>
                      <h3 className="mt-3 text-xl font-bold text-white">{title}</h3>
                    </div>
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-200">
                      {count}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-neutral-400">
                    {categoryRow.description?.trim() || "Department reference material stored in this category."}
                  </p>

                  <div className="mt-5 text-sm font-semibold text-red-300 transition group-hover:text-red-200">
                    {count === 0 ? "No documents yet" : `Open ${title}`}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
  );
}
