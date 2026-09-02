import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const categoryMap: Record<string, string> = {
  sops: "SOPs",
  "ems-protocols": "EMS Protocols",
  "city-department-policies": "City / Department Policies",
  "mutual-aid-agreements": "Mutual Aid Agreements",
  "department-documents": "Department Documents",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "Active";
  }

  return value;
}

function formatVersion(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "1";
  }

  if (typeof value === "number") {
    return String(value);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return String(parsed);
  }

  return value;
}

async function resolveSignedUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filePath: string | null | undefined,
) {
  if (!filePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("department-documents")
    .createSignedUrl(filePath, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export default async function DocumentCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { category } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const normalizedCategory = category?.trim().toLowerCase();
  const categoryName = categoryMap[normalizedCategory ?? ""];
  const categoryQuery = typeof resolvedSearchParams.q === "string"
    ? resolvedSearchParams.q.trim()
    : Array.isArray(resolvedSearchParams.q)
      ? resolvedSearchParams.q.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? ""
      : "";

  if (!categoryName) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const canManageDocuments =
    currentMember.role === "administrator" || currentMember.role === "officer";

  const { data: documents, error } = await supabase
    .from("documents")
    .select(
      "id, category, title, description, document_number, effective_date, status, updated_at, uploaded_by, current_revision_id",
    )
    .eq("department_id", currentMember.departmentId)
    .eq("category", categoryName)
    .order("effective_date", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load documents for this category.");
  }

  const documentIds = (documents ?? [])
    .map((document) => document.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let revisionRows: Array<Record<string, unknown>> = [];
  if (documentIds.length > 0) {
    const { data: revisionData, error: revisionError } = await supabase
      .from("document_revisions")
      .select(
        "document_id, revision_number, revision_date, effective_date, uploaded_by, file_path, file_name",
      )
      .in("document_id", documentIds)
      .order("revision_number", { ascending: false });

    if (revisionError) {
      throw new Error(
        revisionError.message || "Unable to load document revision metadata.",
      );
    }

    revisionRows = revisionData ?? [];
  }

  const memberIds = new Set<string>();

  for (const document of documents ?? []) {
    if (typeof document.uploaded_by === "string") {
      memberIds.add(document.uploaded_by);
    }
  }

  for (const revision of revisionRows) {
    if (typeof revision.uploaded_by === "string") {
      memberIds.add(revision.uploaded_by);
    }
  }

  const memberLookup = new Map<string, string>();

  if (memberIds.size > 0) {
    const { data: memberData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", Array.from(memberIds));

    for (const member of memberData ?? []) {
      const id = typeof member.id === "string" ? member.id : "";
      const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
      const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
      const name = `${firstName} ${lastName}`.trim();

      if (id) {
        memberLookup.set(id, name || "Unknown user");
      }
    }
  }

  const revisionLookup = new Map<string, Record<string, unknown>>();
  for (const revision of revisionRows) {
    const documentId = typeof revision.document_id === "string" ? revision.document_id : "";
    if (!documentId) {
      continue;
    }

    if (!revisionLookup.has(documentId)) {
      revisionLookup.set(documentId, revision);
    }
  }

  const contentMatchLookup = new Map<string, Record<string, unknown>>();
  if (categoryQuery) {
    const { data: contentRevisionRows } = await supabase
      .from("document_revisions")
      .select(
        "document_id, revision_number, revision_date, effective_date, uploaded_by, file_path, file_name, content_text",
      )
      .eq("department_id", currentMember.departmentId)
      .ilike("content_text", `%${categoryQuery}%`);

    for (const revision of contentRevisionRows ?? []) {
      const documentId = typeof revision.document_id === "string" ? revision.document_id : "";
      if (!documentId || contentMatchLookup.has(documentId)) {
        continue;
      }

      contentMatchLookup.set(documentId, revision);
    }
  }

  const filteredDocuments = categoryQuery
    ? (documents ?? []).filter((document) => {
        const revision = revisionLookup.get(document.id) ?? null;
        const contentRevision = contentMatchLookup.get(document.id) ?? null;
        const searchableText = [
          document.title ?? "",
          document.category ?? "",
          document.document_number ?? "",
          document.description ?? "",
          typeof revision?.file_name === "string" ? revision.file_name : "",
          typeof revision?.notes === "string" ? revision.notes : "",
          typeof contentRevision?.content_text === "string" ? contentRevision.content_text : "",
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(categoryQuery.toLowerCase());
      })
    : documents ?? [];

  const signedUrls = new Map<string, string | null>();

  for (const document of filteredDocuments) {
    const currentRevision = document.current_revision_id
      ? revisionLookup.get(document.current_revision_id)
      : null;
    const filePath =
      typeof currentRevision?.file_path === "string" ? currentRevision.file_path : null;

    signedUrls.set(document.id, await resolveSignedUrl(supabase, filePath));
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
              Documents
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              {categoryName}
            </h1>
          </div>

          {canManageDocuments ? (
            <Link
              href={`/documents/${normalizedCategory}/new`}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
            >
              + Add Document
            </Link>
          ) : null}
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#1f1f1f] p-5">
          <form action={`/documents/${normalizedCategory}`} method="get" className="flex gap-3">
            <label htmlFor="category-document-search" className="sr-only">
              Search this category
            </label>
            <input
              id="category-document-search"
              type="text"
              name="q"
              defaultValue={categoryQuery}
              placeholder="Search this category..."
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

        {(!filteredDocuments || filteredDocuments.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#111111] p-10 text-center">
            <p className="text-xl font-semibold text-white">No matching documents found.</p>
            {canManageDocuments ? (
              <div className="mt-4">
                <Link
                  href={`/documents/${normalizedCategory}/new`}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
                >
                  Add Document
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((document) => {
              const currentRevision = document.current_revision_id
                ? revisionLookup.get(document.current_revision_id)
                : undefined;
              const revisionNumber = formatVersion(
                typeof currentRevision?.revision_number === "number"
                  ? currentRevision.revision_number
                  : typeof currentRevision?.revision_number === "string"
                    ? currentRevision.revision_number
                    : null,
              );

              const lastUpdatedBy =
                (typeof currentRevision?.uploaded_by === "string"
                  ? memberLookup.get(currentRevision.uploaded_by)
                  : "") ||
                (typeof document.uploaded_by === "string"
                  ? memberLookup.get(document.uploaded_by)
                  : "") ||
                "-";

              const openUrl = signedUrls.get(document.id) ?? null;

              return (
                <div
                  key={document.id}
                  className="rounded-2xl border border-white/10 bg-[#111111] p-4 md:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-white">{document.title}</h2>
                        <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
                          {formatStatus(document.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-neutral-400 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Document number
                          </p>
                          <p className="mt-1 text-white">
                            {document.document_number?.trim() || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Category
                          </p>
                          <p className="mt-1 text-white">{document.category}</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Current version
                          </p>
                          <p className="mt-1 text-white">V{revisionNumber}</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Effective date
                          </p>
                          <p className="mt-1 text-white">
                            {formatDate(document.effective_date ?? undefined)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Last updated
                          </p>
                          <p className="mt-1 text-white">
                            {formatDate(document.updated_at ?? undefined)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                            Updated by
                          </p>
                          <p className="mt-1 text-white">{lastUpdatedBy}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end lg:w-[180px]">
                      <Link
                        href={`/documents/${normalizedCategory}/${document.id}`}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20"
                      >
                        Open Document
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
