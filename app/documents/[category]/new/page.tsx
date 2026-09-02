"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

const categoryMap: Record<string, string> = {
  sops: "SOPs",
  "ems-protocols": "EMS Protocols",
  "city-department-policies": "City / Department Policies",
  "mutual-aid-agreements": "Mutual Aid Agreements",
  "department-documents": "Department Documents",
};

type ExtractedPdfMetadata = {
  title: string;
  documentNumber: string;
  effectiveDate: string;
  revisionNumber: string;
  revisionDate: string;
  contentText: string;
};

type FormState = {
  title: string;
  effectiveDate: string;
  status: "Active" | "Archived";
  file: File | null;
};

type CurrentMember = {
  id: string;
  departmentId: string | null;
  role: "firefighter" | "officer" | "administrator";
};

const initialFormState: FormState = {
  title: "",
  effectiveDate: "",
  status: "Active",
  file: null,
};

async function extractPdfText(file: File): Promise<ExtractedPdfMetadata> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents/extract-pdf", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as
    | { ok: true; data: ExtractedPdfMetadata }
    | { ok: false; error: string };

  if (!payload.ok) {
    throw new Error(payload.error || "Unable to extract text from this PDF.");
  }

  return payload.data;
}

export default function AddDocumentPage() {
  const params = useParams<{ category?: string }>();
  const router = useRouter();
  const categorySlug = typeof params?.category === "string" ? params.category.trim().toLowerCase() : "";
  const categoryName = categoryMap[categorySlug] ?? "Document";

  const [currentMember, setCurrentMember] = useState<CurrentMember | null>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [detectedMetadata, setDetectedMetadata] = useState<ExtractedPdfMetadata | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMember() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const email = user?.email?.trim();
      if (!email) {
        if (isMounted) {
          setCurrentMember(null);
          setIsLoadingMember(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("members")
        .select("id, department_id, role")
        .eq("email", email)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setCurrentMember(null);
        setIsLoadingMember(false);
        return;
      }

      const row = data as Record<string, unknown>;
      const roleValue = typeof row.role === "string" ? row.role.trim().toLowerCase() : "firefighter";

      setCurrentMember({
        id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
        departmentId:
          typeof row.department_id === "string" ? row.department_id : null,
        role:
          roleValue === "administrator"
            ? "administrator"
            : roleValue === "officer"
              ? "officer"
              : "firefighter",
      });
      setIsLoadingMember(false);
    }

    void loadMember();

    return () => {
      isMounted = false;
    };
  }, []);

  const canManageDocuments =
    currentMember?.role === "administrator" || currentMember?.role === "officer";

  if (!categoryMap[categorySlug]) {
    return (
      <PageLayout>
        <div className="rounded-2xl border border-red-900 bg-[#1a1a1a] p-8">
          <h1 className="text-2xl font-black text-white">Category not found</h1>
          <p className="mt-3 text-neutral-400">
            The requested document category does not exist.
          </p>
          <Link href="/documents" className="mt-5 inline-flex text-sm font-semibold text-red-300">
            Back to documents
          </Link>
        </div>
      </PageLayout>
    );
  }

  if (!isLoadingMember && !canManageDocuments) {
    return (
      <PageLayout>
        <div className="rounded-2xl border border-red-900 bg-[#1a1a1a] p-8">
          <h1 className="text-2xl font-black text-white">Access restricted</h1>
          <p className="mt-3 text-neutral-400">
            You do not have permission to add documents for this department.
          </p>
          <Link
            href={`/documents/${categorySlug}`}
            className="mt-5 inline-flex rounded-xl border border-white/10 bg-[#111111] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to category
          </Link>
        </div>
      </PageLayout>
    );
  }

  const handleFieldChange = (
    field: keyof FormState,
    value: string | File | null,
  ) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleFileSelection = async (file: File | null) => {
    if (!file) {
      setDetectedMetadata(null);
      setWarningMessage(null);
      setFormState((previous) => ({ ...previous, file: null, title: "" }));
      return;
    }

    if (file.type && !file.type.toLowerCase().includes("pdf")) {
      setErrorMessage("Please upload a PDF document for the best metadata and text extraction workflow.");
      setDetectedMetadata(null);
      setWarningMessage(null);
      setFormState((previous) => ({ ...previous, file: null, title: "" }));
      return;
    }

    setIsExtractingText(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const extracted = await extractPdfText(file);
      setDetectedMetadata(extracted);
      setFormState((previous) => ({
        ...previous,
        file,
        title: previous.title?.trim() ? previous.title : extracted.title || previous.title,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to extract text from this PDF.";
      setDetectedMetadata(null);
      setWarningMessage(`PDF text extraction is unavailable for this file. Upload can continue. ${message}`);
    } finally {
      setIsExtractingText(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentMember?.departmentId) {
      setErrorMessage("Your department profile is not available.");
      return;
    }

    if (!formState.file) {
      setErrorMessage("A PDF document file is required.");
      return;
    }

    if (!formState.title.trim()) {
      setErrorMessage("Document title is required.");
      return;
    }

    if (!formState.effectiveDate) {
      setErrorMessage("Effective date is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      let extractedMetadata: ExtractedPdfMetadata = detectedMetadata ?? {
        title: "",
        documentNumber: "",
        effectiveDate: "",
        revisionNumber: "",
        revisionDate: "",
        contentText: "",
      };

      if (!detectedMetadata) {
        try {
          extractedMetadata = await extractPdfText(formState.file);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown extraction error.";
          setWarningMessage(`PDF text extraction failed, but upload will continue. ${message}`);
        }
      }

      const title = formState.title.trim() || extractedMetadata.title || formState.file.name;
      const effectiveDate = formState.effectiveDate || extractedMetadata.effectiveDate || new Date().toISOString().slice(0, 10);
      const sanitizedFileName = formState.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${currentMember.departmentId}/${categorySlug}/${Date.now()}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("department-documents")
        .upload(storagePath, formState.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Unable to upload the document file.");
      }

      const { data: documentRecord, error: documentInsertError } = await supabase
        .from("documents")
        .insert({
          department_id: currentMember.departmentId,
          category: categoryName,
          title,
          description: null,
          document_number: extractedMetadata.documentNumber || null,
          effective_date: effectiveDate,
          status: formState.status,
          uploaded_by: currentMember.id,
          current_revision_id: null,
        })
        .select("id")
        .single();

      if (documentInsertError || !documentRecord) {
        throw new Error(
          documentInsertError?.message || "Unable to create the document record.",
        );
      }

      const { data: revisionRecord, error: revisionInsertError } = await supabase
        .from("document_revisions")
        .insert({
          department_id: currentMember.departmentId,
          document_id: documentRecord.id,
          revision_number: 1,
          file_name: formState.file.name,
          file_path: storagePath,
          file_size_bytes: formState.file.size,
          mime_type: formState.file.type || "application/pdf",
          uploaded_by: currentMember.id,
          effective_date: effectiveDate,
          revision_date: new Date().toISOString().slice(0, 10),
          notes: null,
          status: formState.status,
          content_text: extractedMetadata.contentText || null,
        })
        .select("id")
        .single();

      if (revisionInsertError || !revisionRecord) {
        throw new Error(
          revisionInsertError?.message || "Unable to create the initial document revision.",
        );
      }

      const { error: attachRevisionError } = await supabase
        .from("documents")
        .update({ current_revision_id: revisionRecord.id })
        .eq("id", documentRecord.id);

      if (attachRevisionError) {
        throw new Error(
          attachRevisionError.message || "Unable to attach the current revision.",
        );
      }

      router.push(`/documents/${categorySlug}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to upload the document.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
              Documents
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
              Add Document
            </h1>
          </div>

          <Link
            href={`/documents/${categorySlug}`}
            className="inline-flex items-center rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm font-semibold text-white"
          >
            Back to {categoryName}
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="document-file" className="mb-2 block text-sm font-medium text-neutral-200">
                  Document File
                </label>
                <input
                  id="document-file"
                  type="file"
                  accept=".pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleFileSelection(file);
                    handleFieldChange("file", file);
                  }}
                  className="block w-full rounded-xl border border-dashed border-white/10 bg-[#0c0c0c] px-3 py-3 text-sm text-neutral-200 file:mr-3 file:rounded-lg file:border-0 file:bg-red-500/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-red-100"
                  required
                />
                {isExtractingText ? (
                  <p className="mt-2 text-xs text-neutral-400">Reading the PDF and extracting available document details…</p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="document-title" className="mb-2 block text-sm font-medium text-neutral-200">
                  Document Title
                </label>
                <input
                  id="document-title"
                  type="text"
                  value={formState.title}
                  onChange={(event) => handleFieldChange("title", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white placeholder:text-neutral-500 focus:border-red-500/60 focus:outline-none"
                  placeholder="Document title"
                  required
                />
              </div>

              <div>
                <label htmlFor="effective-date" className="mb-2 block text-sm font-medium text-neutral-200">
                  Effective Date
                </label>
                <input
                  id="effective-date"
                  type="date"
                  value={formState.effectiveDate}
                  onChange={(event) => handleFieldChange("effectiveDate", event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white focus:border-red-500/60 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="document-status" className="mb-2 block text-sm font-medium text-neutral-200">
                  Status
                </label>
                <select
                  id="document-status"
                  value={formState.status}
                  onChange={(event) =>
                    handleFieldChange("status", event.target.value as "Active" | "Archived")
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-white focus:border-red-500/60 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              {detectedMetadata ? (
                <div className="md:col-span-2 rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Detected from PDF</p>
                  <div className="mt-3 grid gap-3 text-sm text-neutral-300 md:grid-cols-3">
                    <div>
                      <span className="text-neutral-500">Document Number:</span>
                      <p className="mt-1 font-medium text-white">{detectedMetadata.documentNumber || "Not detected"}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Effective Date:</span>
                      <p className="mt-1 font-medium text-white">{detectedMetadata.effectiveDate || "Not detected"}</p>
                    </div>
                    <div>
                      <span className="text-neutral-500">Revision:</span>
                      <p className="mt-1 font-medium text-white">{detectedMetadata.revisionNumber || "Not detected"}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {warningMessage ? (
              <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                {warningMessage}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="text-sm text-neutral-400">
                Category: <span className="font-medium text-white">{categoryName}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoadingMember || !canManageDocuments}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
