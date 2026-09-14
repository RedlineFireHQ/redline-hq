"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type QualificationTypeRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type MemberQualificationRow = {
  id: string;
  member_id: string;
  qualification_id: string;
  earned_at: string;
  certificate_number: string | null;
  notes: string | null;
  supporting_document_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type RoleRequiredQualificationRow = {
  id: string;
  department_id: string;
  department_role_id: string;
  qualification_id: string;
  created_at: string;
  updated_at: string;
};

type DepartmentDocumentRow = {
  id: string;
  title: string;
  category: string;
  document_number: string | null;
  status: string | null;
};

interface PersonnelQualificationsSectionProps {
  departmentId: string;
  memberId: string;
  editorMemberId: string;
  canManageQualifications: boolean;
  memberDepartmentRoleId: string | null;
  memberRoleName: string | null;
  qualificationTypes: QualificationTypeRow[];
  memberQualifications: MemberQualificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  departmentDocuments: DepartmentDocumentRow[];
}

type MemberQualificationInsertResult = {
  id: string;
  member_id: string;
  qualification_id: string;
  earned_at: string;
  certificate_number: string | null;
  notes: string | null;
  supporting_document_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeFileName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentCategorySlug(category: string | null | undefined) {
  const normalized = typeof category === "string" ? category.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  if (normalized === "sops") {
    return "sops";
  }

  if (normalized === "ems protocols") {
    return "ems-protocols";
  }

  if (normalized === "city / department policies") {
    return "city-department-policies";
  }

  if (normalized === "mutual aid agreements") {
    return "mutual-aid-agreements";
  }

  if (normalized === "department documents") {
    return "department-documents";
  }

  return null;
}

export default function PersonnelQualificationsSection({
  departmentId,
  memberId,
  editorMemberId,
  canManageQualifications,
  memberDepartmentRoleId,
  memberRoleName,
  qualificationTypes,
  memberQualifications,
  roleRequiredQualifications,
  departmentDocuments,
}: PersonnelQualificationsSectionProps) {
  const router = useRouter();

  const [rows, setRows] = useState(memberQualifications);
  const [documents, setDocuments] = useState(departmentDocuments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedQualificationId, setSelectedQualificationId] = useState("");
  const [earnedAt, setEarnedAt] = useState(getLocalDateString());
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const qualificationTypeById = useMemo(
    () => new Map(qualificationTypes.map((row) => [row.id, row])),
    [qualificationTypes],
  );

  const availableQualificationTypes = useMemo(
    () => qualificationTypes.filter((row) => row.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [qualificationTypes],
  );

  const documentLookup = useMemo(() => new Map(documents.map((row) => [row.id, row])), [documents]);

  const requiredQualificationIds = useMemo(() => {
    if (!memberDepartmentRoleId) {
      return new Set<string>();
    }

    return new Set(
      roleRequiredQualifications
        .filter((row) => row.department_role_id === memberDepartmentRoleId)
        .map((row) => row.qualification_id),
    );
  }, [memberDepartmentRoleId, roleRequiredQualifications]);

  const heldQualificationById = useMemo(() => {
    const map = new Map<string, MemberQualificationRow>();

    for (const row of rows) {
      if (!row.qualification_id || map.has(row.qualification_id)) {
        continue;
      }

      map.set(row.qualification_id, row);
    }

    return map;
  }, [rows]);

  const heldItems = useMemo(() => {
    return Array.from(heldQualificationById.values())
      .map((row) => ({
        rowId: row.id,
        qualificationId: row.qualification_id,
        qualificationName: qualificationTypeById.get(row.qualification_id)?.name ?? "Unknown Qualification",
        earnedAt: row.earned_at,
        isRequiredForRole: requiredQualificationIds.has(row.qualification_id),
        supportingDocumentId: row.supporting_document_id,
      }))
      .sort((a, b) => a.qualificationName.localeCompare(b.qualificationName));
  }, [heldQualificationById, qualificationTypeById, requiredQualificationIds]);

  const missingRequiredItems = useMemo(() => {
    const items: Array<{ qualificationId: string; qualificationName: string }> = [];

    for (const qualificationId of requiredQualificationIds) {
      if (heldQualificationById.has(qualificationId)) {
        continue;
      }

      items.push({
        qualificationId,
        qualificationName: qualificationTypeById.get(qualificationId)?.name ?? "Unknown Qualification",
      });
    }

    return items.sort((a, b) => a.qualificationName.localeCompare(b.qualificationName));
  }, [heldQualificationById, qualificationTypeById, requiredQualificationIds]);

  function openAddModal() {
    setSaveError(null);
    setSaveSuccess(null);
    setSelectedQualificationId("");
    setEarnedAt(getLocalDateString());
    setSelectedDocumentFile(null);
    setIsModalOpen(true);
  }

  function closeAddModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
  }

  async function handleAddQualification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!canManageQualifications) {
      setSaveError("Only department administrators can modify qualifications.");
      return;
    }

    if (!selectedQualificationId) {
      setSaveError("Select a qualification.");
      return;
    }

    if (!earnedAt) {
      setSaveError("Earned date is required.");
      return;
    }

    const alreadyExists = rows.some((row) => row.qualification_id === selectedQualificationId);
    if (alreadyExists) {
      setSaveError("This member already has that qualification.");
      return;
    }

    setIsSaving(true);

    let uploadedStoragePath: string | null = null;
    let createdDocumentId: string | null = null;
    let supportingDocumentId: string | null = null;

    try {
      if (selectedDocumentFile) {
        const formData = new FormData();
        formData.set("memberId", memberId);
        formData.set("qualificationId", selectedQualificationId);
        formData.set("earnedAt", earnedAt);
        formData.set("file", selectedDocumentFile);

        const response = await fetch("/api/personnel/qualifications/supporting-document", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          document?: DepartmentDocumentRow;
          qualification?: MemberQualificationInsertResult;
        } | null;

        if (!response.ok || !result?.ok || !result.qualification || !result.document) {
          setSaveError(result?.error || "Unable to add qualification.");
          return;
        }

        setDocuments((current) => [result.document!, ...current.filter((row) => row.id !== result.document!.id)]);
        setRows((current) => [result.qualification!, ...current]);
        setSaveSuccess("Qualification added.");
        setIsModalOpen(false);
        setSelectedDocumentFile(null);
        router.refresh();
        return;
      }

      if (selectedDocumentFile) {
        const legacyDocumentFile = selectedDocumentFile as File;
        const selectedQualificationName = qualificationTypeById.get(selectedQualificationId)?.name ?? "Qualification";
        const documentTitle = `${selectedQualificationName} Qualification Document`;
        const today = getLocalDateString();
        const sanitizedName = sanitizeFileName(legacyDocumentFile.name || "qualification-document");
        uploadedStoragePath = `${departmentId}/qualifications/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("department-documents")
          .upload(uploadedStoragePath, legacyDocumentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setSaveError(uploadError.message || "Unable to upload qualification document.");
          return;
        }

        const { data: documentData, error: documentInsertError } = await supabase
          .from("documents")
          .insert({
            department_id: departmentId,
            category: "Department Documents",
            source_kind: "personnel_qualification",
            title: documentTitle,
            description: null,
            document_number: null,
            effective_date: today,
            status: "Active",
            uploaded_by: editorMemberId,
            current_revision_id: null,
          })
          .select("id, category, title, document_number, status")
          .single();

        if (documentInsertError || !documentData) {
          if (uploadedStoragePath) {
            await supabase.storage.from("department-documents").remove([uploadedStoragePath]);
          }
          setSaveError(documentInsertError?.message || "Unable to create qualification document record.");
          return;
        }

        createdDocumentId = String(documentData.id);
        supportingDocumentId = createdDocumentId;

        const { data: revisionData, error: revisionInsertError } = await supabase
          .from("document_revisions")
          .insert({
            department_id: departmentId,
            document_id: createdDocumentId,
            revision_number: 1,
            file_name: legacyDocumentFile.name,
            file_path: uploadedStoragePath,
            file_size_bytes: legacyDocumentFile.size,
            mime_type: legacyDocumentFile.type || null,
            uploaded_by: editorMemberId,
            effective_date: today,
            revision_date: today,
            notes: `Uploaded from member qualification entry.`,
            status: "Active",
            content_text: null,
          })
          .select("id")
          .single();

        if (revisionInsertError || !revisionData) {
          await supabase.from("documents").delete().eq("id", createdDocumentId).eq("department_id", departmentId);
          if (uploadedStoragePath) {
            await supabase.storage.from("department-documents").remove([uploadedStoragePath]);
          }
          setSaveError(revisionInsertError?.message || "Unable to create qualification document revision.");
          return;
        }

        const { error: updateDocumentError } = await supabase
          .from("documents")
          .update({ current_revision_id: revisionData.id })
          .eq("id", createdDocumentId)
          .eq("department_id", departmentId);

        if (updateDocumentError) {
          await supabase.from("documents").delete().eq("id", createdDocumentId).eq("department_id", departmentId);
          if (uploadedStoragePath) {
            await supabase.storage.from("department-documents").remove([uploadedStoragePath]);
          }
          setSaveError(updateDocumentError.message || "Unable to attach qualification document revision.");
          return;
        }

        setDocuments((current) => {
          const exists = current.some((row) => row.id === createdDocumentId);
          if (exists) {
            return current;
          }

          return [
            {
                id: createdDocumentId ?? "",
              title: typeof documentData.title === "string" ? documentData.title : "Qualification Document",
              category: typeof documentData.category === "string" ? documentData.category : "Department Documents",
              document_number: typeof documentData.document_number === "string" ? documentData.document_number : null,
              status: typeof documentData.status === "string" ? documentData.status : "Active",
            },
            ...current,
          ];
        });
      }

      const { data, error } = await supabase
        .from("member_qualifications")
        .insert({
          department_id: departmentId,
          member_id: memberId,
          qualification_id: selectedQualificationId,
          earned_at: earnedAt,
          supporting_document_id: supportingDocumentId,
          created_by: editorMemberId,
          updated_by: editorMemberId,
        })
        .select("id, member_id, qualification_id, earned_at, certificate_number, notes, supporting_document_id, created_by, updated_by, created_at, updated_at")
        .single();

      if (error || !data) {
        if (createdDocumentId) {
          await supabase.from("documents").delete().eq("id", createdDocumentId).eq("department_id", departmentId);
        }
        if (uploadedStoragePath) {
          await supabase.storage.from("department-documents").remove([uploadedStoragePath]);
        }
        if (error?.code === "23505") {
          setSaveError("This member already has that qualification.");
        } else {
          setSaveError(error?.message || "Unable to add qualification.");
        }
        return;
      }

      const inserted: MemberQualificationInsertResult = {
        id: String(data.id),
        member_id: typeof data.member_id === "string" ? data.member_id : memberId,
        qualification_id: typeof data.qualification_id === "string" ? data.qualification_id : selectedQualificationId,
        earned_at: typeof data.earned_at === "string" ? data.earned_at : earnedAt,
        certificate_number: typeof data.certificate_number === "string" ? data.certificate_number : null,
        notes: typeof data.notes === "string" ? data.notes : null,
        supporting_document_id: typeof data.supporting_document_id === "string" ? data.supporting_document_id : null,
        created_by: typeof data.created_by === "string" ? data.created_by : null,
        updated_by: typeof data.updated_by === "string" ? data.updated_by : null,
        created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
        updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
      };

      setRows((current) => [inserted, ...current]);
      setSaveSuccess("Qualification added.");
      setIsModalOpen(false);
      setSelectedDocumentFile(null);
      router.refresh();
    } catch (error) {
      if (createdDocumentId) {
        await supabase.from("documents").delete().eq("id", createdDocumentId).eq("department_id", departmentId);
      }
      if (uploadedStoragePath) {
        await supabase.storage.from("department-documents").remove([uploadedStoragePath]);
      }
      setSaveError(error instanceof Error ? error.message : "Unable to add qualification.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveQualification(rowId: string) {
    setSaveError(null);
    setSaveSuccess(null);

    if (!canManageQualifications) {
      setSaveError("Only department administrators can modify qualifications.");
      return;
    }

    const confirmed = window.confirm("Remove this qualification from the member record?");
    if (!confirmed) {
      return;
    }

    setRemovingId(rowId);

    try {
      const { error } = await supabase
        .from("member_qualifications")
        .delete()
        .eq("id", rowId)
        .eq("department_id", departmentId)
        .eq("member_id", memberId);

      if (error) {
        setSaveError(error.message || "Unable to remove qualification.");
        return;
      }

      setRows((current) => current.filter((row) => row.id !== rowId));
      setSaveSuccess("Qualification removed.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to remove qualification.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Qualifications</h2>
        {canManageQualifications ? (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-green-200 transition hover:border-green-400/60 hover:bg-green-500/20"
          >
            Add Qualification
          </button>
        ) : null}
      </div>

      {saveError ? (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {saveError}
        </div>
      ) : null}

      {saveSuccess ? (
        <div className="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-100">
          {saveSuccess}
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Required For Assigned Role</p>
          {memberDepartmentRoleId ? (
            <>
              <p className="mt-1 text-sm text-neutral-300">
                {memberRoleName ? `${memberRoleName} role` : "Assigned role"}
              </p>
              {requiredQualificationIds.size === 0 ? (
                <p className="mt-3 text-sm text-neutral-400">No required qualifications configured for this role.</p>
              ) : missingRequiredItems.length === 0 ? (
                <p className="mt-3 text-sm text-green-300">All required qualifications are currently held.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {missingRequiredItems.map((item) => (
                    <div
                      key={`missing-${item.qualificationId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2"
                    >
                      <p className="text-sm text-red-100">{item.qualificationName}</p>
                      <span className="inline-flex rounded-full border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200">
                        Missing
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No department role assigned.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Held Qualifications</p>
          {heldItems.length === 0 ? (
            <p className="mt-3 text-neutral-400">No qualifications on file.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {heldItems.map((item) => {
                const linkedDocument = item.supportingDocumentId
                  ? documentLookup.get(item.supportingDocumentId)
                  : null;
                const linkedDocumentSlug = getDocumentCategorySlug(linkedDocument?.category);
                const linkedDocumentHref = linkedDocument && linkedDocumentSlug
                  ? `/documents/${linkedDocumentSlug}/${linkedDocument.id}`
                  : null;

                return (
                <div
                  key={`held-${item.qualificationId}`}
                  className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{item.qualificationName}</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Earned: {item.earnedAt ? formatDateOnly(item.earnedAt) : "-"}
                    </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          Qualification Document:{" "}
                          {linkedDocumentHref ? (
                            <Link
                              href={linkedDocumentHref}
                              className="text-green-300 underline underline-offset-2 hover:text-green-200"
                            >
                              {linkedDocument?.title || "View document"}
                            </Link>
                          ) : linkedDocument ? (
                            linkedDocument.title
                          ) : (
                            "None attached"
                          )}
                        </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-green-300">
                      Held
                    </span>
                    {item.isRequiredForRole ? (
                      <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-200">
                        Required
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        Additional
                      </span>
                    )}
                    {canManageQualifications ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveQualification(item.rowId)}
                        disabled={removingId === item.rowId}
                        className="inline-flex rounded-full border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200 transition hover:border-red-400/50 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingId === item.rowId ? "Removing" : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <h3 className="text-lg font-semibold text-white">Add Qualification</h3>
            <p className="mt-1 text-sm text-neutral-400">Select a qualification from your department catalog and record the earned date.</p>

            <form className="mt-4 space-y-4" onSubmit={handleAddQualification}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Qualification</span>
                <select
                  value={selectedQualificationId}
                  onChange={(event) => setSelectedQualificationId(event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-green-400 focus:outline-none"
                  required
                >
                  <option value="">Select qualification...</option>
                  {availableQualificationTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Earned Date</span>
                <input
                  type="date"
                  value={earnedAt}
                  onChange={(event) => setEarnedAt(event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-green-400 focus:outline-none"
                  required
                />
              </label>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Attach Document</p>
                <p className="mt-1 text-xs text-neutral-500">Qualification Document (PDF, JPG, PNG, and other supported department document formats).</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-200 transition hover:border-neutral-500">
                    {selectedDocumentFile ? "Replace Document" : "Attach Document"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedDocumentFile(file);
                      }}
                    />
                  </label>
                  {selectedDocumentFile ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentFile(null)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-200 transition hover:border-red-400/60 hover:bg-red-500/10"
                    >
                      Remove Selected File
                    </button>
                  ) : null}
                </div>

                {selectedDocumentFile ? (
                  <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-100">
                    <p className="font-semibold">Selected: {selectedDocumentFile.name}</p>
                    <p className="mt-1 text-green-200/90">{formatFileSize(selectedDocumentFile.size)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">No document selected.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={isSaving}
                  className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-100 transition hover:border-green-400/60 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Qualification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
