import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

export default async function DocumentViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; documentId: string }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const { category, documentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const insideDocumentQuery = (resolvedSearchParams.q ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, department_id, category, title, description, document_number, effective_date, status, uploaded_by, current_revision_id, updated_at",
    )
    .eq("id", documentId)
    .eq("department_id", currentMember.departmentId)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message || "Unable to load the document.");
  }

  if (!document) {
    notFound();
  }

  const { data: currentRevision, error: revisionError } = await supabase
    .from("document_revisions")
    .select(
      "id, document_id, revision_number, uploaded_by, revision_date, effective_date, file_name, file_path, mime_type, notes, content_text, status, created_at, updated_at",
    )
    .eq("id", document.current_revision_id)
    .eq("department_id", currentMember.departmentId)
    .maybeSingle();

  if (revisionError) {
    throw new Error(revisionError.message || "Unable to load the document revision.");
  }

  const memberIds = new Set<string>();
  if (typeof document.uploaded_by === "string") memberIds.add(document.uploaded_by);
  if (typeof currentRevision?.uploaded_by === "string") memberIds.add(currentRevision.uploaded_by);

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

  const updatedByDisplay =
    (currentRevision && typeof currentRevision.uploaded_by === "string"
      ? memberLookup.get(currentRevision.uploaded_by)
      : undefined) ||
    (typeof document.uploaded_by === "string" ? memberLookup.get(document.uploaded_by) : undefined) ||
    "-";

  const signedUrl = await resolveSignedUrl(supabase, currentRevision?.file_path ?? null);

  const normalizedQuery = insideDocumentQuery.toLowerCase();
  const hasSearchableContent = typeof currentRevision?.content_text === "string" && currentRevision.content_text.trim().length > 0;
  const insideDocumentMatches =
    insideDocumentQuery && hasSearchableContent
      ? currentRevision.content_text
          .toLowerCase()
          .includes(normalizedQuery)
      : false;

  const documentPreviewText =
    hasSearchableContent && currentRevision?.content_text
      ? currentRevision.content_text
      : "Searchable document content is not yet available for this file.";

  const matchSnippets = (() => {
    if (!insideDocumentQuery || !hasSearchableContent || !currentRevision?.content_text) {
      return [] as string[];
    }

    const haystack = currentRevision.content_text;
    const needle = normalizedQuery;
    const matches: string[] = [];
    let index = haystack.toLowerCase().indexOf(needle);

    while (index !== -1) {
      const start = Math.max(0, index - 95);
      const end = Math.min(haystack.length, index + needle.length + 140);
      const snippet = haystack.slice(start, end).replace(/\s+/g, " ").trim();
      if (snippet) matches.push(snippet);
      index = haystack.toLowerCase().indexOf(needle, index + needle.length);
    }

    return matches.slice(0, 6);
  })();

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
              Documents
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              {document.title}
            </h1>
          </div>

          <Link
            href={`/documents/${category}`}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-red-500/40 hover:bg-[#171717]"
          >
            Back to category
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Document preview</p>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100"
                >
                  Open file
                </a>
              ) : null}
            </div>

            {signedUrl && currentRevision?.mime_type?.toLowerCase() === "application/pdf" ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <iframe src={signedUrl} title={document.title} className="h-[760px] w-full" />
              </div>
            ) : signedUrl ? (
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-8 text-center">
                <p className="text-lg font-semibold text-white">Preview available</p>
                <p className="mt-2 text-sm text-neutral-400">
                  This document is stored in the department library and can be opened from the file link above.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#0c0c0c] p-8 text-center text-sm text-neutral-400">
                A file preview is not available for this document.
              </div>
            )}
          </div>

          <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#111111] p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Document Number</p>
              <p className="mt-2 text-base font-semibold text-white">{document.document_number || "-"}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Category</p>
              <p className="mt-2 text-base font-semibold text-white">{document.category}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Version</p>
              <p className="mt-2 text-base font-semibold text-white">
                {currentRevision?.revision_number ? `V${currentRevision.revision_number}` : "V1"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Effective date</p>
              <p className="mt-2 text-base font-semibold text-white">
                {formatDate(document.effective_date ?? currentRevision?.effective_date ?? undefined)}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Last updated</p>
              <p className="mt-2 text-base font-semibold text-white">
                {formatDate(document.updated_at ?? currentRevision?.updated_at ?? undefined)}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Updated by</p>
              <p className="mt-2 text-base font-semibold text-white">{updatedByDisplay}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Status</p>
              <p className="mt-2 text-base font-semibold text-white">{document.status}</p>
            </div>

            {document.description ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-neutral-300">{document.description}</p>
              </div>
            ) : null}
          </aside>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#1b1b1b] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Search this document</p>
              <h2 className="mt-2 text-xl font-black text-white">Document content search</h2>
            </div>
          </div>

          <form action={`/documents/${category}/${documentId}`} method="get" className="mt-4 flex gap-3">
            <input
              type="text"
              name="q"
              defaultValue={insideDocumentQuery}
              placeholder="Search this document..."
              className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100"
            >
              Search
            </button>
          </form>

          {insideDocumentQuery ? (
            hasSearchableContent ? (
              insideDocumentMatches ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                    Matching content was found in the document’s stored searchable text.
                  </div>
                  {matchSnippets.length > 0 ? (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {matchSnippets.length} match{matchSnippets.length === 1 ? "" : "es"} found
                      </p>
                      {matchSnippets.map((snippet, index) => (
                        <div key={`${snippet}-${index}`} className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3 text-sm leading-6 text-neutral-300">
                          “{snippet}”
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-yellow-900 bg-yellow-950/20 p-4 text-sm text-yellow-200">
                  No matching content found in the document’s available searchable text.
                </div>
              )
            ) : (
              <div className="mt-4 rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm text-amber-200">
                Searchable document content is not yet available for this file.
              </div>
            )
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-[#111111] p-4 text-sm text-neutral-400">
              {hasSearchableContent
                ? "Use the search field above to look for matching content within the stored document text."
                : "This document does not currently have searchable content available for inside-document search."}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
