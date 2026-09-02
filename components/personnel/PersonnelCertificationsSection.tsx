"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CertificationTypeRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
};

type MemberCertificationRow = {
  id: string;
  member_id: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
  supporting_document_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
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

type CertificationFormState = {
  certificationSource: "catalog" | "custom";
  certificationId: string;
  certificationSearch: string;
  customCertificationName: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string;
  expirationMode: "has-expiration" | "no-expiration";
  supportingDocumentId: string;
  notes: string;
};

type CertificationRecord = MemberCertificationRow & {
  certificationName: string;
  certificationDescription: string | null;
  certificationActive: boolean;
  supportingDocumentTitle: string | null;
  supportingDocumentNumber: string | null;
};

type StatusTone = "current" | "warning" | "expired" | "none";

interface PersonnelCertificationsSectionProps {
  editorMemberId: string;
  departmentId: string | null;
  memberId: string;
  warningDays: number;
  certificationTypes: CertificationTypeRow[];
  memberCertifications: MemberCertificationRow[];
  departmentDocuments: DepartmentDocumentRow[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusDetails(expiresAt: string | null, warningDays: number) {
  if (!expiresAt) {
    return {
      label: "No Expiration",
      tone: "current" as StatusTone,
      detail: "This certification does not expire.",
    };
  }

  const expirationDate = parseLocalDate(expiresAt);
  if (Number.isNaN(expirationDate.getTime())) {
    return {
      label: "No Expiration",
      tone: "current" as StatusTone,
      detail: "Expiration date is not valid.",
    };
  }

  const today = parseLocalDate(getLocalDateString());
  const daysRemaining = Math.floor((expirationDate.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysRemaining < 0) {
    return {
      label: "Expired",
      tone: "expired" as StatusTone,
      detail: `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago.`,
    };
  }

  if (daysRemaining <= warningDays) {
    return {
      label: "Expiring Soon",
      tone: "warning" as StatusTone,
      detail: daysRemaining === 0
        ? "Expires today."
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`,
    };
  }

  return {
    label: "Current",
    tone: "current" as StatusTone,
    detail: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`,
  };
}

function getToneClasses(tone: StatusTone) {
  if (tone === "current") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (tone === "expired") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

function getBadgeClasses(tone: StatusTone) {
  if (tone === "current") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (tone === "expired") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

function getCertificationSortRank(expiresAt: string | null) {
  if (!expiresAt) {
    return Number.POSITIVE_INFINITY;
  }

  const expirationDate = parseLocalDate(expiresAt);
  if (Number.isNaN(expirationDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const today = parseLocalDate(getLocalDateString());
  return expirationDate.getTime() < today.getTime()
    ? expirationDate.getTime() - 1_000_000_000_000
    : expirationDate.getTime();
}

function emptyFormState(): CertificationFormState {
  return {
    certificationSource: "catalog",
    certificationId: "",
    certificationSearch: "",
    customCertificationName: "",
    certificateNumber: "",
    issuedAt: getLocalDateString(),
    expiresAt: "",
    expirationMode: "has-expiration",
    supportingDocumentId: "",
    notes: "",
  };
}

export default function PersonnelCertificationsSection({
  editorMemberId,
  departmentId,
  memberId,
  warningDays,
  certificationTypes,
  memberCertifications,
  departmentDocuments,
}: PersonnelCertificationsSectionProps) {
  const router = useRouter();
  const [records, setRecords] = useState(memberCertifications);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CertificationFormState>(emptyFormState());

  const certificationTypeLookup = useMemo(() => {
    return new Map(certificationTypes.map((certificationType) => [certificationType.id, certificationType]));
  }, [certificationTypes]);

  const documentLookup = useMemo(() => {
    return new Map(departmentDocuments.map((document) => [document.id, document]));
  }, [departmentDocuments]);

  const activeCertificationTypes = useMemo(() => {
    return certificationTypes.filter((certificationType) => certificationType.active !== false);
  }, [certificationTypes]);

  const addableCertificationTypes = useMemo(() => {
    return activeCertificationTypes.filter((certificationType) => certificationType.name.trim().toLowerCase() !== "emt");
  }, [activeCertificationTypes]);

  const filteredAddableCertificationTypes = useMemo(() => {
    const search = formState.certificationSearch.trim().toLowerCase();
    if (!search) {
      return addableCertificationTypes;
    }

    return addableCertificationTypes.filter((certificationType) =>
      certificationType.name.toLowerCase().includes(search),
    );
  }, [addableCertificationTypes, formState.certificationSearch]);

  const editedCertification = editingRecordId
    ? records.find((record) => record.id === editingRecordId) ?? null
    : null;

  const formTypeOptions = useMemo(() => {
    if (!editedCertification) {
      return activeCertificationTypes;
    }

    const selectedType = certificationTypeLookup.get(editedCertification.certification_id);
    if (!selectedType) {
      return activeCertificationTypes;
    }

    if (activeCertificationTypes.some((option) => option.id === selectedType.id)) {
      return activeCertificationTypes;
    }

    return [selectedType, ...activeCertificationTypes];
  }, [activeCertificationTypes, certificationTypeLookup, editedCertification]);

  const normalizedRecords: CertificationRecord[] = useMemo(() => {
    return records.map((record) => {
      const certificationType = certificationTypeLookup.get(record.certification_id);
      const supportingDocument = record.supporting_document_id
        ? documentLookup.get(record.supporting_document_id)
        : null;

      return {
        ...record,
        certificationName: certificationType?.name?.trim() || "Unknown Certification",
        certificationDescription: certificationType?.description ?? null,
        certificationActive: certificationType?.active !== false,
        supportingDocumentTitle: supportingDocument?.title ?? null,
        supportingDocumentNumber: supportingDocument?.document_number ?? null,
      };
    });
  }, [certificationTypeLookup, documentLookup, records]);

  const sortedRecords = useMemo(() => {
    return [...normalizedRecords].sort((left, right) => {
      const leftRank = getCertificationSortRank(left.expires_at);
      const rightRank = getCertificationSortRank(right.expires_at);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (!left.expires_at && !right.expires_at) {
        return left.certificationName.localeCompare(right.certificationName);
      }

      if (!left.expires_at) {
        return 1;
      }

      if (!right.expires_at) {
        return -1;
      }

      return 0;
    });
  }, [normalizedRecords]);

  function openAddModal() {
    setSaveError(null);
    setEditingRecordId(null);
    setFormState({
      ...emptyFormState(),
      certificationSource: addableCertificationTypes.length > 0 ? "catalog" : "custom",
      certificationId: addableCertificationTypes[0]?.id ?? "",
    });
    setIsModalOpen(true);
  }

  function openEditModal(record: CertificationRecord) {
    setSaveError(null);
    setEditingRecordId(record.id);
    setFormState({
      certificationSource: "catalog",
      certificationId: record.certification_id,
      certificationSearch: "",
      customCertificationName: "",
      certificateNumber: record.certificate_number ?? "",
      issuedAt: record.issued_at || getLocalDateString(),
      expiresAt: record.expires_at ?? "",
      expirationMode: record.expires_at ? "has-expiration" : "no-expiration",
      supportingDocumentId: record.supporting_document_id ?? "",
      notes: record.notes ?? "",
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingRecordId(null);
    setSaveError(null);
    setFormState(emptyFormState());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!departmentId) {
      setSaveError("Your department profile is unavailable.");
      return;
    }

    if (!editorMemberId) {
      setSaveError("Your member profile is unavailable.");
      return;
    }

    if (!memberId) {
      setSaveError("The firefighter profile is unavailable.");
      return;
    }

    const customCertificationName = formState.customCertificationName.trim();

    if (editingRecordId) {
      if (!formState.certificationId) {
        setSaveError("Select a certification type before saving.");
        return;
      }
    } else if (formState.certificationSource === "catalog") {
      if (!formState.certificationId) {
        setSaveError("Select a certification type before saving.");
        return;
      }

      const selectedType = certificationTypeLookup.get(formState.certificationId);
      if (selectedType && selectedType.name.trim().toLowerCase() === "emt") {
        setSaveError("Use Iowa EMT or NREMT EMT for new EMS certifications. Standalone EMT is not available for new entries.");
        return;
      }
    } else {
      if (!customCertificationName) {
        setSaveError("Enter a custom certification name.");
        return;
      }

      if (customCertificationName.toLowerCase() === "emt") {
        setSaveError("Standalone EMT is not available for new entries. Use Iowa EMT or NREMT EMT.");
        return;
      }
    }

    if (!formState.issuedAt) {
      setSaveError("Issue date is required.");
      return;
    }

    if (formState.expirationMode === "has-expiration" && !formState.expiresAt) {
      setSaveError("Expiration date is required when the certification has an expiration.");
      return;
    }

    if (formState.expiresAt && formState.expiresAt < formState.issuedAt) {
      setSaveError("Expiration date cannot be earlier than the issue date.");
      return;
    }

    const documentId = formState.supportingDocumentId || null;
    if (documentId && !documentLookup.has(documentId)) {
      setSaveError("Select a supporting document from this department.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    let resolvedCertificationId = formState.certificationId;

    if (!editingRecordId && formState.certificationSource === "custom") {
      const existingType = certificationTypes.find(
        (certificationType) => certificationType.name.trim().toLowerCase() === customCertificationName.toLowerCase(),
      );

      if (existingType) {
        if (existingType.name.trim().toLowerCase() === "emt") {
          setSaveError("Standalone EMT is not available for new entries. Use Iowa EMT or NREMT EMT.");
          setIsSaving(false);
          return;
        }

        resolvedCertificationId = existingType.id;
      } else {
        const { data: newCertificationType, error: newCertificationTypeError } = await supabase
          .from("certifications")
          .insert({
            department_id: departmentId,
            name: customCertificationName,
            description: null,
            active: true,
            created_by: editorMemberId,
            updated_by: editorMemberId,
          })
          .select("id")
          .single();

        if (newCertificationTypeError || !newCertificationType) {
          setSaveError(newCertificationTypeError?.message || "Unable to create custom certification type.");
          setIsSaving(false);
          return;
        }

        resolvedCertificationId = String(newCertificationType.id);
      }
    }

    if (!resolvedCertificationId) {
      setSaveError("Select a certification type before saving.");
      setIsSaving(false);
      return;
    }

    const payload = {
      certification_id: resolvedCertificationId,
      certificate_number: formState.certificateNumber.trim() || null,
      issued_at: formState.issuedAt,
      expires_at: formState.expirationMode === "has-expiration" ? formState.expiresAt || null : null,
      supporting_document_id: documentId,
      notes: formState.notes.trim() || null,
      created_by: editingRecordId ? undefined : editorMemberId,
      updated_by: editorMemberId,
      department_id: departmentId,
    };

    try {
      if (editingRecordId) {
        const { error } = await supabase
          .from("member_certifications")
          .update({
            certification_id: payload.certification_id,
            certificate_number: payload.certificate_number,
            issued_at: payload.issued_at,
            expires_at: payload.expires_at,
            supporting_document_id: payload.supporting_document_id,
            notes: payload.notes,
            updated_by: payload.updated_by,
          })
          .eq("id", editingRecordId)
          .eq("department_id", departmentId);

        if (error) {
          setSaveError(error.message || "Unable to update certification.");
          setIsSaving(false);
          return;
        }

        setRecords((current) =>
          current.map((record) =>
            record.id === editingRecordId
              ? {
                  ...record,
                  certification_id: payload.certification_id,
                  certificate_number: payload.certificate_number,
                  issued_at: payload.issued_at,
                  expires_at: payload.expires_at,
                  supporting_document_id: payload.supporting_document_id,
                  notes: payload.notes,
                  updated_by: payload.updated_by,
                  updated_at: new Date().toISOString(),
                }
              : record,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("member_certifications")
          .insert({
            department_id: departmentId,
            member_id: memberId,
            certification_id: payload.certification_id,
            certificate_number: payload.certificate_number,
            issued_at: payload.issued_at,
            expires_at: payload.expires_at,
            supporting_document_id: payload.supporting_document_id,
            notes: payload.notes,
            created_by: payload.created_by,
            updated_by: payload.updated_by,
          })
          .select("id, member_id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, notes, created_by, updated_by, created_at, updated_at")
          .single();

        if (error || !data) {
          setSaveError(error?.message || "Unable to create certification.");
          setIsSaving(false);
          return;
        }

        const insertedRecord: MemberCertificationRow = {
          id: String(data.id),
          member_id: typeof data.member_id === "string" ? data.member_id : memberId,
          certification_id: String(data.certification_id),
          certificate_number: typeof data.certificate_number === "string" ? data.certificate_number : null,
          issued_at: typeof data.issued_at === "string" ? data.issued_at : payload.issued_at,
          expires_at: typeof data.expires_at === "string" ? data.expires_at : null,
          supporting_document_id: typeof data.supporting_document_id === "string" ? data.supporting_document_id : null,
          notes: typeof data.notes === "string" ? data.notes : null,
          created_by: typeof data.created_by === "string" ? data.created_by : editorMemberId,
          updated_by: typeof data.updated_by === "string" ? data.updated_by : editorMemberId,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        };

        setRecords((current) => [insertedRecord, ...current]);
      }

      setIsModalOpen(false);
      setEditingRecordId(null);
      setFormState(emptyFormState());
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save certification.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Certifications</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Manage firefighter certification records for this member. Status is calculated from the expiration date using the department warning window.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Certification
        </button>
      </div>

      {activeCertificationTypes.length === 0 ? (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          No active certification types are configured for this department yet. You can still use Other / Custom Certification when adding a record.
        </div>
      ) : null}

      {records.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          No certifications on file for this firefighter.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {sortedRecords.map((record) => {
            const status = getStatusDetails(record.expires_at, warningDays);

            return (
              <article key={record.id} className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-white">
                        {record.certificationName}
                      </h3>

                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getBadgeClasses(status.tone)}`}>
                        {status.label}
                      </span>
                    </div>

                    {record.certificationDescription ? (
                      <p className="mt-2 text-sm text-neutral-400">
                        {record.certificationDescription}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Certificate Number</p>
                        <p className="mt-1 text-sm text-white">
                          {record.certificate_number?.trim() || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Issue Date</p>
                        <p className="mt-1 text-sm text-white">{formatDate(record.issued_at)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Expiration Date</p>
                        <p className="mt-1 text-sm text-white">{record.expires_at ? formatDate(record.expires_at) : "No Expiration"}</p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Supporting Document</p>
                        <p className="mt-1 text-sm text-white">
                          {record.supportingDocumentTitle
                            ? `${record.supportingDocumentTitle}${record.supportingDocumentNumber ? ` • ${record.supportingDocumentNumber}` : ""}`
                            : "None attached"}
                        </p>
                      </div>
                    </div>

                    {record.notes?.trim() ? (
                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                        {record.notes}
                      </div>
                    ) : null}

                    <p className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getToneClasses(status.tone)}`}>
                      {status.detail}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(record)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-2xl font-black tracking-tight text-white">
                {editingRecordId ? "Edit Certification" : "Add Certification"}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Record a firefighter certification using the department catalog and optional supporting document.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {saveError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {saveError}
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Certification Type *</span>
                  {editingRecordId ? (
                    <select
                      value={formState.certificationId}
                      onChange={(event) => setFormState((current) => ({ ...current, certificationId: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                    >
                      <option value="">Select certification type</option>
                      {formTypeOptions.map((certificationType) => (
                        <option key={certificationType.id} value={certificationType.id}>
                          {certificationType.name}{certificationType.active === false ? " (Inactive)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,
                              certificationSource: "catalog",
                              customCertificationName: "",
                              certificationId: current.certificationId || addableCertificationTypes[0]?.id || "",
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${formState.certificationSource === "catalog" ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-white/10 bg-[#1b1b1b] text-neutral-300 hover:border-white/20"}`}
                        >
                          Select Existing Certification
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,
                              certificationSource: "custom",
                              certificationId: "",
                              certificationSearch: "",
                            }))
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${formState.certificationSource === "custom" ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-white/10 bg-[#1b1b1b] text-neutral-300 hover:border-white/20"}`}
                        >
                          Other / Custom Certification
                        </button>
                      </div>

                      {formState.certificationSource === "catalog" ? (
                        <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <input
                            value={formState.certificationSearch}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                certificationSearch: event.target.value,
                              }))
                            }
                            placeholder="Search department certifications"
                            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                          />
                          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                            {filteredAddableCertificationTypes.length === 0 ? (
                              <p className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-neutral-400">
                                No matching certifications found.
                              </p>
                            ) : (
                              filteredAddableCertificationTypes.map((certificationType) => (
                                <button
                                  key={certificationType.id}
                                  type="button"
                                  onClick={() =>
                                    setFormState((current) => ({
                                      ...current,
                                      certificationId: certificationType.id,
                                    }))
                                  }
                                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${formState.certificationId === certificationType.id ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-white/10 bg-[#1b1b1b] text-white hover:border-white/20"}`}
                                >
                                  <span>{certificationType.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-[#151515] p-3">
                          <input
                            value={formState.customCertificationName}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                customCertificationName: event.target.value,
                              }))
                            }
                            placeholder="Enter custom certification name"
                            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                          />
                          <p className="mt-1 text-[11px] text-neutral-500">
                            Custom certifications are created in the department catalog without EMS authority metadata.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </label>

                <div className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Expiration</span>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                      <input
                        type="radio"
                        name="expirationMode"
                        value="has-expiration"
                        checked={formState.expirationMode === "has-expiration"}
                        onChange={() =>
                          setFormState((current) => ({
                            ...current,
                            expirationMode: "has-expiration",
                          }))
                        }
                        className="h-4 w-4 border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">Has expiration</p>
                        <p className="text-xs text-neutral-400">Require an expiration date for this certification.</p>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                      <input
                        type="radio"
                        name="expirationMode"
                        value="no-expiration"
                        checked={formState.expirationMode === "no-expiration"}
                        onChange={() =>
                          setFormState((current) => ({
                            ...current,
                            expirationMode: "no-expiration",
                            expiresAt: "",
                          }))
                        }
                        className="h-4 w-4 border-white/10 bg-[#111111] text-red-500 focus:ring-red-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">Does not expire</p>
                        <p className="text-xs text-neutral-400">Save this record without an expiration date.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Certificate Number</span>
                  <input
                    value={formState.certificateNumber}
                    onChange={(event) => setFormState((current) => ({ ...current, certificateNumber: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Issue Date</span>
                  <input
                    type="date"
                    value={formState.issuedAt}
                    onChange={(event) => setFormState((current) => ({ ...current, issuedAt: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">Defaults to today if left blank.</p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Expiration Date</span>
                  <input
                    type="date"
                    value={formState.expiresAt}
                    disabled={formState.expirationMode === "no-expiration"}
                    onChange={(event) => setFormState((current) => ({ ...current, expiresAt: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {formState.expirationMode === "no-expiration" ? (
                    <p className="mt-1 text-[11px] text-neutral-500">Expiration date is not used when this certification does not expire.</p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Supporting Certificate Document</span>
                  <select
                    value={formState.supportingDocumentId}
                    onChange={(event) => setFormState((current) => ({ ...current, supportingDocumentId: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="">No document attached</option>
                    {departmentDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}{document.document_number ? ` • ${document.document_number}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-neutral-500">Attach an existing department document. Upload new files in Documents first.</p>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
                  <textarea
                    rows={4}
                    value={formState.notes}
                    onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d1d1d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingRecordId ? "Save Changes" : "Add Certification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}