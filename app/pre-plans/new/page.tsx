import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import PrePlanForm, { type DocumentRevisionOption } from "@/components/pre-plans/PrePlanForm";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type DocumentRow = {
  id: string;
  title: string;
  category: string;
};

type RevisionRow = {
  id: string;
  document_id: string;
  file_name: string;
  mime_type: string | null;
  file_path: string | null;
};

export default async function NewPrePlanPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;

  if (!departmentId) {
    notFound();
  }

  const [{ data: documentRows }, { data: revisionRows }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, category")
      .eq("department_id", departmentId)
      .order("title", { ascending: true })
      .limit(500),
    supabase
      .from("document_revisions")
      .select("id, document_id, file_name, mime_type, file_path")
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const documents = (documentRows ?? []) as DocumentRow[];
  const revisions = (revisionRows ?? []) as RevisionRow[];
  const documentById = new Map(documents.map((row) => [row.id, row]));

  const documentRevisionOptions: DocumentRevisionOption[] = revisions
    .map((revision) => {
      const document = documentById.get(revision.document_id);
      if (!document) {
        return null;
      }

      return {
        revisionId: revision.id,
        documentId: revision.document_id,
        title: document.title,
        category: document.category,
        fileName: revision.file_name,
        mimeType: revision.mime_type,
        filePath: revision.file_path,
      };
    })
    .filter(Boolean) as DocumentRevisionOption[];

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/redlinepreplanpage.png"
      environmentBackgroundPosition="center center"
    >
      <PrePlanForm mode="create" documentRevisionOptions={documentRevisionOptions} />
    </PageLayout>
  );
}
