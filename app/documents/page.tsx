import Link from "next/link";
import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const primaryCategories = [
  {
    slug: "sops",
    title: "SOPs",
    href: "/documents/sops",
    description: "Standard operating procedures and field reference material.",
  },
  {
    slug: "ems-protocols",
    title: "EMS Protocols",
    href: "/documents/ems-protocols",
    description: "Clinical guidance and operational treatment reference documents.",
  },
  {
    slug: "city-department-policies",
    title: "City / Department Policies",
    href: "/documents/city-department-policies",
    description: "City policy, department policy, and administrative direction.",
  },
  {
    slug: "mutual-aid-agreements",
    title: "Mutual Aid Agreements",
    href: "/documents/mutual-aid-agreements",
    description: "Regional coordination, assisting agency, and mutual aid references.",
  },
];

const departmentLibraryLink = {
  slug: "department-documents",
  title: "Department Documents",
  href: "/documents/department-documents",
  description:
    "Department-created reference material such as grant information, hose evolutions, engineering procedures, and station procedures.",
};

function resolveCategorySlug(category: string | null | undefined) {
  if (!category) {
    return null;
  }

  const normalizedCategory = category.trim();

  const match = Object.entries({
    SOPs: "sops",
    "EMS Protocols": "ems-protocols",
    "City / Department Policies": "city-department-policies",
    "Mutual Aid Agreements": "mutual-aid-agreements",
    "Department Documents": "department-documents",
  }).find(([label]) => label === normalizedCategory);

  return match ? match[1] : null;
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

  let searchResults: Array<{
    id: string;
    category: string;
    title: string;
    description: string | null;
    document_number: string | null;
    updated_at: string | null;
    current_revision_id: string | null;
    revision_number: number | null;
    updated_by: string | null;
    matchText: string | null;
  }> = [];

  const { data: allDocuments } = await supabase
    .from("documents")
    .select(
      "id, category, title, description, document_number, updated_at, current_revision_id, uploaded_by",
    )
    .eq("department_id", currentMember.departmentId)
    .order("title");

  const countsByCategory: Record<string, number> = {};

  for (const document of allDocuments ?? []) {
    const key = document.category ?? "";
    countsByCategory[key] = (countsByCategory[key] ?? 0) + 1;
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
          title: document.title ?? "Untitled document",
          description: document.description ?? null,
          document_number: document.document_number ?? null,
          updated_at: updatedAt,
          current_revision_id: document.current_revision_id ?? null,
          revision_number: revisionNumber,
          updated_by: updatedBy,
          matchText,
        };
      })
      .sort((left, right) => {
        const leftTitle = left.title.toLowerCase();
        const rightTitle = right.title.toLowerCase();
        return leftTitle.localeCompare(rightTitle);
      });
  }

  return (
    <PageLayout>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">
            Reference Library
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white lg:text-5xl">
            Documents
          </h1>
          <p className="mt-3 max-w-3xl text-base text-neutral-400 lg:text-lg">
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
                  const categorySlug = resolveCategorySlug(document.category) ?? "department-documents";
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
                            <span>{document.category}</span>
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
                          href={`/documents/${categorySlug}/${document.id}`}
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
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {primaryCategories.map((category) => {
              const count = countsByCategory[category.title] ?? 0;

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
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-[#1b1b1b] p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                Department Library
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Department Documents
              </h2>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href={departmentLibraryLink.href}
              className="block rounded-2xl border border-white/10 bg-[#111111] p-5 transition hover:border-red-500/40 hover:bg-[#171717]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                    Department Created
                  </p>
                  <h3 className="mt-3 text-xl font-bold text-white">
                    {departmentLibraryLink.title}
                  </h3>
                </div>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-200">
                  {countsByCategory[departmentLibraryLink.title] ?? 0}
                </span>
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-400">
                {departmentLibraryLink.description}
              </p>

              <div className="mt-5 text-sm font-semibold text-red-300">
                {countsByCategory[departmentLibraryLink.title]
                  ? "Open department documents"
                  : "No department documents have been added yet."}
              </div>
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
