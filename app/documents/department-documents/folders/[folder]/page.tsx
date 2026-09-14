import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import { DEPARTMENT_DOCUMENTS_CATEGORY, type DocumentReferenceCategoryRow } from "@/lib/document-reference-categories";
import { canManageDocuments as hasDocumentsManagementPermission } from "@/lib/member-permissions";
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

function formatVersion(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "1";
  }

  if (typeof value === "number") {
    return String(value);
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : value;
}

export default async function DepartmentDocumentFolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folder: string }>;
  searchParams?: Promise<{ q?: string | string[]; success?: string; error?: string }>;
}) {
  const { folder } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = typeof resolvedSearchParams.q === "string"
    ? resolvedSearchParams.q.trim()
    : Array.isArray(resolvedSearchParams.q)
      ? resolvedSearchParams.q.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? ""
      : "";

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

  const { data: folderRow, error: folderError } = await supabase
    .from("document_reference_categories")
    .select("id, department_id, name, slug, description, status, is_default, created_by, updated_by, created_at, updated_at")
    .eq("department_id", currentMember.departmentId)
    .eq("slug", folder)
    .maybeSingle();

  if (folderError) {
    throw new Error(folderError.message || "Unable to load Department Documents folder.");
  }

  const referenceFolder = folderRow as DocumentReferenceCategoryRow | null;

  if (!referenceFolder || referenceFolder.status !== "active") {
    notFound();
  }

  const { data: documentRows, error: documentsError } = await supabase
    .from("documents")
    .select("id, category, title, description, document_number, effective_date, status, updated_at, uploaded_by, current_revision_id")
    .eq("department_id", currentMember.departmentId)
    .eq("category", DEPARTMENT_DOCUMENTS_CATEGORY)
    .eq("source_kind", "library")
    .eq("reference_category_id", referenceFolder.id)
    .order("effective_date", { ascending: false });

  if (documentsError) {
    throw new Error(documentsError.message || "Unable to load documents for this folder.");
  }

  const filteredDocuments = query
    ? (documentRows ?? []).filter((row) => {
        const searchableText = [row.title ?? "", row.document_number ?? "", row.description ?? ""].join(" ").toLowerCase();
        return searchableText.includes(query.toLowerCase());
      })
    : documentRows ?? [];

  const documentIds = filteredDocuments.map((row) => row.id).filter((id): id is string => typeof id === "string");
  const { data: revisionRows } = documentIds.length > 0
    ? await supabase
        .from("document_revisions")
        .select("document_id, revision_number, uploaded_by")
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
  for (const row of filteredDocuments) {
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
            Department Documents
          </p>
          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            {referenceFolder.name}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-neutral-400">
            {referenceFolder.description?.trim() || "Browse the documents stored in this department reference folder."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/documents/department-documents"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Back to Folders
          </Link>
          {canManageDocuments ? (
            <>
              <Link
                href={`/documents/department-documents/categories/${referenceFolder.id}/edit`}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Manage Folder
              </Link>
              <Link
                  href={`/documents/department-documents/new?folder=${referenceFolder.slug}`}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Add Document
              </Link>
            </>
          ) : null}
        </div>
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
        <form action={`/documents/department-documents/folders/${referenceFolder.slug}`} method="get" className="flex gap-3">
          <label htmlFor="folder-document-search" className="sr-only">
            Search folder documents
          </label>
          <input
            id="folder-document-search"
            type="text"
            name="q"
            defaultValue={query}
            placeholder={`Search ${referenceFolder.name}...`}
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

      {filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#111111] p-10 text-center">
          <p className="text-xl font-semibold text-white">No documents found.</p>
          <p className="mt-3 text-sm text-neutral-400">
            {query ? "No documents in this folder matched your search." : "No documents have been added to this folder yet."}
          </p>
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
            const updatedBy =
              (typeof currentRevision?.uploaded_by === "string"
                ? memberLookup.get(currentRevision.uploaded_by)
                : "") ||
              (typeof document.uploaded_by === "string"
                ? memberLookup.get(document.uploaded_by)
                : "") ||
              "-";

            return (
              <div key={document.id} className="rounded-2xl border border-white/10 bg-[#111111] p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{document.title}</h2>
                      <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
                        {document.status || "Active"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-neutral-400 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Document number</p>
                        <p className="mt-1 text-white">{document.document_number?.trim() || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Current version</p>
                        <p className="mt-1 text-white">V{revisionNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Effective date</p>
                        <p className="mt-1 text-white">{formatDate(document.effective_date ?? undefined)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Updated by</p>
                        <p className="mt-1 text-white">{updatedBy}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end lg:w-[180px]">
                    <Link
                      href={`/documents/department-documents/${document.id}`}
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
  );
}