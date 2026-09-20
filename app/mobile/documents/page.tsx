import { redirect } from "next/navigation";

import MobileDocuments from "@/components/mobile/MobileDocuments";
import { getCurrentMember } from "@/lib/current-member";
import {
  DEPARTMENT_DOCUMENTS_CATEGORY,
  MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME,
  MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG,
  type DocumentReferenceCategoryRow,
} from "@/lib/document-reference-categories";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const primaryCategories = [
  { slug: "sops", title: "SOPs", dbCategory: "SOPs" },
  { slug: "ems-protocols", title: "EMS Protocols", dbCategory: "EMS Protocols" },
  { slug: "city-department-policies", title: "City / Department Policies", dbCategory: "City / Department Policies" },
  { slug: "mutual-aid-agreements", title: "Mutual Aid Agreements", dbCategory: "Mutual Aid Agreements" },
];

type DocumentRow = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  document_number: string | null;
  effective_date: string | null;
  status: string;
  current_revision_id: string | null;
  reference_category_id: string | null;
  updated_at: string | null;
};

type RevisionRow = {
  id: string;
  document_id: string;
  revision_number: number | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  notes: string | null;
  content_text: string | null;
  updated_at: string | null;
};

function referenceCategoryTitle(row: DocumentReferenceCategoryRow | null | undefined) {
  if (!row) return MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME;
  if (row.is_default && row.name.trim().toLowerCase() === MISCELLANEOUS_DOCUMENTS_CATEGORY_NAME.toLowerCase()) {
    return "Miscellaneous";
  }
  return row.name;
}

export default async function MobileDocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [documentsResult, referenceCategoriesResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, category, title, description, document_number, effective_date, status, current_revision_id, reference_category_id, updated_at")
      .eq("department_id", departmentId)
      .eq("source_kind", "library")
      .eq("status", "Active")
      .order("effective_date", { ascending: false }),
    supabase
      .from("document_reference_categories")
      .select("id, department_id, name, slug, description, status, is_default, created_by, updated_by, created_at, updated_at")
      .eq("department_id", departmentId)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),
  ]);

  const documentRows = (documentsResult.data ?? []) as DocumentRow[];
  const documentIds = documentRows.map((row) => row.id).filter(Boolean);
  const { data: revisionRowsData, error: revisionsError } = documentIds.length > 0
    ? await supabase
        .from("document_revisions")
        .select("id, document_id, revision_number, file_name, file_path, mime_type, notes, content_text, updated_at")
        .eq("department_id", departmentId)
        .eq("status", "Active")
        .in("document_id", documentIds)
        .order("revision_number", { ascending: false })
    : { data: [] as RevisionRow[], error: null };

  const referenceCategories = (referenceCategoriesResult.data ?? []) as DocumentReferenceCategoryRow[];
  const referenceCategoryById = new Map(referenceCategories.map((row) => [row.id, row]));
  const defaultReferenceCategory = referenceCategories.find((row) => row.is_default) ?? referenceCategories[0] ?? null;
  const latestRevisionByDocumentId = new Map<string, RevisionRow>();
  for (const revision of (revisionRowsData ?? []) as RevisionRow[]) {
    if (!latestRevisionByDocumentId.has(revision.document_id)) {
      latestRevisionByDocumentId.set(revision.document_id, revision);
    }
  }

  const signedUrlByRevisionId = new Map<string, string>();
  for (const revision of latestRevisionByDocumentId.values()) {
    const { data } = await supabase.storage.from("department-documents").createSignedUrl(revision.file_path, 60 * 60);
    if (data?.signedUrl) signedUrlByRevisionId.set(revision.id, data.signedUrl);
  }

  const documents = documentRows.map((document) => {
    const revision = document.current_revision_id
      ? ((revisionRowsData ?? []) as RevisionRow[]).find((row) => row.id === document.current_revision_id) ?? latestRevisionByDocumentId.get(document.id) ?? null
      : latestRevisionByDocumentId.get(document.id) ?? null;
    const referenceCategory = document.reference_category_id ? referenceCategoryById.get(document.reference_category_id) ?? null : defaultReferenceCategory;
    const isDepartmentDocument = document.category === DEPARTMENT_DOCUMENTS_CATEGORY;
    const categoryLabel = isDepartmentDocument ? referenceCategoryTitle(referenceCategory) : document.category;
    const categoryFilter = isDepartmentDocument
      ? `folder:${referenceCategory?.id ?? MISCELLANEOUS_DOCUMENTS_CATEGORY_SLUG}`
      : `category:${document.category}`;

    return {
      id: document.id,
      title: document.title,
      description: document.description,
      documentNumber: document.document_number,
      effectiveDate: document.effective_date,
      category: document.category,
      categoryLabel,
      categoryFilter,
      revisionNumber: revision?.revision_number ?? null,
      fileName: revision?.file_name ?? null,
      mimeType: revision?.mime_type ?? null,
      revisionNotes: revision?.notes ?? null,
      contentText: revision?.content_text ?? null,
      signedUrl: revision ? signedUrlByRevisionId.get(revision.id) ?? null : null,
    };
  });

  const categories = [
    ...primaryCategories.map((category) => ({
      id: `category:${category.dbCategory}`,
      label: category.title,
      count: documents.filter((document) => document.category === category.dbCategory).length,
    })),
    {
      id: "department-documents",
      label: DEPARTMENT_DOCUMENTS_CATEGORY,
      count: documents.filter((document) => document.category === DEPARTMENT_DOCUMENTS_CATEGORY).length,
    },
  ];

  const folders = referenceCategories.map((folder) => ({
    id: `folder:${folder.id}`,
    label: referenceCategoryTitle(folder),
    description: folder.description,
    count: documents.filter((document) => document.categoryFilter === `folder:${folder.id}`).length,
  }));

  return (
    <MobileDocuments
      documents={documents}
      categories={categories}
      folders={folders}
      initialError={documentsResult.error?.message ?? referenceCategoriesResult.error?.message ?? revisionsError?.message ?? null}
    />
  );
}