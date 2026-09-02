"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type BuilderDocumentLinkType = "document" | "other" | "floor_plan" | "building_plan" | "sds_msds";

export type DocumentRevisionOption = {
  revisionId: string;
  documentId: string;
  title: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  filePath: string | null;
};

export type HydrantInitialValue = {
  id: string;
  hydrantIdentifier: string | null;
  locationDescription: string | null;
  hydrantNotes: string | null;
  photoDocumentRevisionId: string | null;
};

export type HazardInitialValue = {
  id: string;
  hazardType: string;
  locationDescription: string | null;
  quantity: string | null;
  description: string | null;
  attachmentDocumentRevisionId: string | null;
  sdsDocumentRevisionId: string | null;
};

export type PhotoReferenceInitialValue = {
  id: string;
  documentRevisionId: string;
  notes: string | null;
  relatedComponent?: string | null;
};

export type DocumentReferenceInitialValue = {
  id: string;
  linkType: BuilderDocumentLinkType;
  documentRevisionId: string;
  notes: string | null;
  relatedComponent: string | null;
};

type PrePlanFormValues = {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  businessPhone: string;
  occupancyIdNumber: string;
  propertyOwnerName: string;
  propertyOwnerPhone: string;
  primaryContactName: string;
  primaryContactPhone: string;
  secondaryContactName: string;
  secondaryContactPhone: string;

  normalOccupantLoad: string;
  specialNeedsOccupants: string;

  primaryApparatusAccess: string;
  knoxBoxDetails: string;
  knoxBoxLocation: string;

  fdcDetails: string;
  fdcLocation: string;
  fdcNotes: string;
  otherWaterSupplyInfo: string;

  fireAlarmDetails: string;
  fireAlarmPanelLocation: string;
  fireAlarmEnunciatorPanelLocation: string;
  sprinklerSystemDetails: string;
  riserLocation: string;
  firePumpDetails: string;
  firePumpLocation: string;
  standpipeDetails: string;
  standpipeLocation: string;

  electricalShutoff: string;
  electricalShutoffLocation: string;
  electricalComments: string;
  waterShutoff: string;
  waterShutoffLocation: string;
  waterComments: string;
  gasShutoff: string;
  gasShutoffLocation: string;
  gasComments: string;

  criticalInformation: string;
  additionalComments: string;
};

type HydrantDraft = {
  clientId: string;
  id: string | null;
  hydrantIdentifier: string;
  locationDescription: string;
  hydrantNotes: string;
  photoDocumentRevisionId: string;
  photoFile: File | null;
};

type HazardDraft = {
  clientId: string;
  id: string | null;
  hazardType: string;
  locationDescription: string;
  quantity: string;
  description: string;
  attachmentDocumentRevisionId: string;
  sdsDocumentRevisionId: string;
  supportingDocumentFile: File | null;
};

type PhotoReferenceDraft = {
  clientId: string;
  id: string | null;
  documentRevisionId: string;
  notes: string;
  relatedComponent: string;
  photoFile: File | null;
};

type DocumentReferenceDraft = {
  clientId: string;
  id: string | null;
  linkType: BuilderDocumentLinkType;
  documentRevisionId: string;
  notes: string;
  relatedComponent: string;
  documentFile: File | null;
};

type PrePlanFormProps = {
  mode: "create" | "edit";
  prePlanId?: string;
  initialValues?: Partial<PrePlanFormValues>;
  initialHydrants?: HydrantInitialValue[];
  initialHazards?: HazardInitialValue[];
  initialPhotoReferences?: PhotoReferenceInitialValue[];
  initialBuildingFrontPhoto?: PhotoReferenceInitialValue | null;
  initialDocumentReferences?: DocumentReferenceInitialValue[];
  initialSitePlanDocumentRevisionId?: string | null;
  documentRevisionOptions?: DocumentRevisionOption[];
};

const EMPTY_VALUES: PrePlanFormValues = {
  businessName: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  businessPhone: "",
  occupancyIdNumber: "",
  propertyOwnerName: "",
  propertyOwnerPhone: "",
  primaryContactName: "",
  primaryContactPhone: "",
  secondaryContactName: "",
  secondaryContactPhone: "",

  normalOccupantLoad: "",
  specialNeedsOccupants: "",

  primaryApparatusAccess: "",
  knoxBoxDetails: "",
  knoxBoxLocation: "",

  fdcDetails: "",
  fdcLocation: "",
  fdcNotes: "",
  otherWaterSupplyInfo: "",

  fireAlarmDetails: "",
  fireAlarmPanelLocation: "",
  fireAlarmEnunciatorPanelLocation: "",
  sprinklerSystemDetails: "",
  riserLocation: "",
  firePumpDetails: "",
  firePumpLocation: "",
  standpipeDetails: "",
  standpipeLocation: "",

  electricalShutoff: "",
  electricalShutoffLocation: "",
  electricalComments: "",
  waterShutoff: "",
  waterShutoffLocation: "",
  waterComments: "",
  gasShutoff: "",
  gasShutoffLocation: "",
  gasComments: "",

  criticalInformation: "",
  additionalComments: "",
};

const DOCUMENT_LINK_TYPES: Array<{ value: BuilderDocumentLinkType; label: string }> = [
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
  { value: "floor_plan", label: "Floor Plan" },
  { value: "building_plan", label: "Building Plan" },
  { value: "sds_msds", label: "SDS / MSDS" },
];

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeOptionalText(value: string) {
  return value.trim();
}

function isImageMime(mimeType: string | null | undefined) {
  return typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/");
}

function normalizeBinaryChoice(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") {
    return "yes";
  }
  if (normalized === "no") {
    return "no";
  }
  return "";
}

function hasHydrantContent(row: HydrantDraft) {
  return Boolean(
    normalizeOptionalText(row.hydrantIdentifier)
      || normalizeOptionalText(row.locationDescription)
      || normalizeOptionalText(row.hydrantNotes)
      || normalizeOptionalText(row.photoDocumentRevisionId)
      || row.photoFile,
  );
}

function hasHazardContent(row: HazardDraft) {
  return Boolean(
    normalizeOptionalText(row.hazardType)
      || normalizeOptionalText(row.locationDescription)
      || normalizeOptionalText(row.quantity)
      || normalizeOptionalText(row.description)
      || normalizeOptionalText(row.attachmentDocumentRevisionId)
      || normalizeOptionalText(row.sdsDocumentRevisionId)
      || row.supportingDocumentFile,
  );
}

function hasPhotoReferenceContent(row: PhotoReferenceDraft) {
  return Boolean(normalizeOptionalText(row.documentRevisionId) || normalizeOptionalText(row.notes) || row.photoFile);
}

function hasDocumentReferenceContent(row: DocumentReferenceDraft) {
  return Boolean(
    normalizeOptionalText(row.documentRevisionId)
      || normalizeOptionalText(row.notes)
      || normalizeOptionalText(row.relatedComponent)
      || row.documentFile,
  );
}

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

function createEmptyPhotoReferenceDraft(): PhotoReferenceDraft {
  return {
    clientId: createClientId(),
    id: null,
    documentRevisionId: "",
    notes: "",
    relatedComponent: "",
    photoFile: null,
  };
}

function createBuildingFrontPhotoDraft(initial?: PhotoReferenceInitialValue | null): PhotoReferenceDraft {
  return {
    clientId: createClientId(),
    id: initial?.id ?? null,
    documentRevisionId: initial?.documentRevisionId ?? "",
    notes: initial?.notes ?? "Building Front Photo",
    relatedComponent: "building_front",
    photoFile: null,
  };
}

async function fileToUploadPayload(file: File | null): Promise<UploadPayload | null> {
  if (!file) {
    return null;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }

  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64Data: dataUrl.slice(commaIndex + 1),
  };
}

function parseFireAlarmPanelValue(value: string | undefined) {
  if (!value) {
    return {
      alarmPanelLocation: "",
      enunciatorPanelLocation: "",
    };
  }

  const alarmPanelPrefix = "Alarm Panel: ";
  const enunciatorPrefix = "Enunciator Panel: ";
  const lines = value.split("\n").map((line) => line.trim());

  const alarmLine = lines.find((line) => line.startsWith(alarmPanelPrefix));
  const enunciatorLine = lines.find((line) => line.startsWith(enunciatorPrefix));

  if (alarmLine || enunciatorLine) {
    return {
      alarmPanelLocation: alarmLine ? alarmLine.slice(alarmPanelPrefix.length).trim() : "",
      enunciatorPanelLocation: enunciatorLine ? enunciatorLine.slice(enunciatorPrefix.length).trim() : "",
    };
  }

  return {
    alarmPanelLocation: value,
    enunciatorPanelLocation: "",
  };
}

export default function PrePlanForm({
  mode,
  prePlanId,
  initialValues,
  initialHydrants,
  initialHazards,
  initialPhotoReferences,
  initialBuildingFrontPhoto,
  initialDocumentReferences,
  initialSitePlanDocumentRevisionId,
  documentRevisionOptions,
}: PrePlanFormProps) {
  const router = useRouter();
  const parsedAlarmLocations = parseFireAlarmPanelValue(initialValues?.fireAlarmPanelLocation);
  const [formValues, setFormValues] = useState<PrePlanFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
    fireAlarmPanelLocation: parsedAlarmLocations.alarmPanelLocation,
    fireAlarmEnunciatorPanelLocation: parsedAlarmLocations.enunciatorPanelLocation,
  });
  const [sitePlanDocumentRevisionId, setSitePlanDocumentRevisionId] = useState(initialSitePlanDocumentRevisionId ?? "");
  const [sitePlanFile, setSitePlanFile] = useState<File | null>(null);
  const [hydrants, setHydrants] = useState<HydrantDraft[]>(
    (initialHydrants ?? []).map((row) => ({
      clientId: createClientId(),
      id: row.id,
      hydrantIdentifier: row.hydrantIdentifier ?? "",
      locationDescription: row.locationDescription ?? "",
      hydrantNotes: row.hydrantNotes ?? "",
      photoDocumentRevisionId: row.photoDocumentRevisionId ?? "",
      photoFile: null,
    })),
  );
  const [hazards, setHazards] = useState<HazardDraft[]>(
    (initialHazards ?? []).map((row) => ({
      clientId: createClientId(),
      id: row.id,
      hazardType: row.hazardType,
      locationDescription: row.locationDescription ?? "",
      quantity: row.quantity ?? "",
      description: row.description ?? "",
      attachmentDocumentRevisionId: row.attachmentDocumentRevisionId ?? "",
      sdsDocumentRevisionId: row.sdsDocumentRevisionId ?? "",
      supportingDocumentFile: null,
    })),
  );
  const [photoReferences, setPhotoReferences] = useState<PhotoReferenceDraft[]>(
    (initialPhotoReferences ?? []).map((row) => ({
      clientId: createClientId(),
      id: row.id,
      documentRevisionId: row.documentRevisionId,
      notes: row.notes ?? "",
      relatedComponent: row.relatedComponent ?? "",
      photoFile: null,
    })),
  );
  const [buildingFrontPhoto, setBuildingFrontPhoto] = useState<PhotoReferenceDraft>(() =>
    createBuildingFrontPhotoDraft(initialBuildingFrontPhoto),
  );
  const [buildingFrontPhotoObjectUrl, setBuildingFrontPhotoObjectUrl] = useState<string | null>(null);
  const [documentReferences, setDocumentReferences] = useState<DocumentReferenceDraft[]>(
    (initialDocumentReferences ?? []).map((row) => ({
      clientId: createClientId(),
      id: row.id,
      linkType: row.linkType,
      documentRevisionId: row.documentRevisionId,
      notes: row.notes ?? "",
      relatedComponent: row.relatedComponent ?? "",
      documentFile: null,
    })),
  );
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const revisionOptions = useMemo(
    () => documentRevisionOptions ?? [],
    [documentRevisionOptions],
  );
  const revisionById = useMemo(
    () => new Map(revisionOptions.map((option) => [option.revisionId, option])),
    [revisionOptions],
  );

  useEffect(() => {
    let active = true;

    async function loadPhotoPreviews() {
      const updates: Record<string, string> = {};

      for (const row of [...photoReferences, buildingFrontPhoto]) {
        const selectedId = normalizeOptionalText(row.documentRevisionId);
        if (!selectedId) {
          continue;
        }

        const revision = revisionById.get(selectedId);
        if (!revision || !isImageMime(revision.mimeType) || !revision.filePath) {
          continue;
        }

        const { data } = await supabase.storage
          .from("department-documents")
          .createSignedUrl(revision.filePath, 60 * 60);

        if (data?.signedUrl) {
          updates[row.clientId] = data.signedUrl;
        }
      }

      if (active && Object.keys(updates).length > 0) {
        setPhotoPreviewUrls((previous) => ({ ...previous, ...updates }));
      }
    }

    void loadPhotoPreviews();

    return () => {
      active = false;
    };
  }, [buildingFrontPhoto, photoReferences, revisionById]);

  useEffect(() => {
    return () => {
      if (buildingFrontPhotoObjectUrl) {
        URL.revokeObjectURL(buildingFrontPhotoObjectUrl);
      }
    };
  }, [buildingFrontPhotoObjectUrl]);

  const cancelHref = useMemo(() => {
    if (mode === "edit" && prePlanId) {
      return `/pre-plans/${prePlanId}`;
    }

    return "/pre-plans";
  }, [mode, prePlanId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizeOptionalText(formValues.businessName)) {
      setErrorMessage("Business name is required.");
      return;
    }

    if (!normalizeOptionalText(formValues.address)) {
      setErrorMessage("Address is required.");
      return;
    }

    if (!normalizeOptionalText(formValues.city)) {
      setErrorMessage("City is required.");
      return;
    }

    if (!normalizeOptionalText(formValues.state)) {
      setErrorMessage("State is required.");
      return;
    }

    if (!normalizeOptionalText(formValues.zip)) {
      setErrorMessage("ZIP is required.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const endpoint = mode === "create" ? "/api/pre-plans" : `/api/pre-plans/${prePlanId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const alarmPanelPayload =
      normalizeBinaryChoice(formValues.fireAlarmDetails) === "yes"
        ? [
            normalizeOptionalText(formValues.fireAlarmPanelLocation)
              ? `Alarm Panel: ${normalizeOptionalText(formValues.fireAlarmPanelLocation)}`
              : "",
            normalizeOptionalText(formValues.fireAlarmEnunciatorPanelLocation)
              ? `Enunciator Panel: ${normalizeOptionalText(formValues.fireAlarmEnunciatorPanelLocation)}`
              : "",
          ]
          .filter(Boolean)
          .join("\n") || null
        : null;

    const requestPayload = {
      ...formValues,
      fireAlarmPanelLocation: alarmPanelPayload,
      fdcDetails: normalizeBinaryChoice(formValues.fdcDetails) || null,
      fdcLocation:
        normalizeBinaryChoice(formValues.fdcDetails) === "yes"
          ? normalizeOptionalText(formValues.fdcLocation) || null
          : null,
      sitePlanDocumentRevisionId: normalizeOptionalText(sitePlanDocumentRevisionId) || null,
      sitePlanUpload: await fileToUploadPayload(sitePlanFile),
      hydrants: await Promise.all(
        hydrants
          .filter(hasHydrantContent)
          .map(async (row) => ({
            id: row.id,
            hydrantIdentifier: normalizeOptionalText(row.hydrantIdentifier) || null,
            locationDescription: normalizeOptionalText(row.locationDescription) || null,
            hydrantNotes: normalizeOptionalText(row.hydrantNotes) || null,
            photoDocumentRevisionId: normalizeOptionalText(row.photoDocumentRevisionId) || null,
            photoUpload: await fileToUploadPayload(row.photoFile),
          })),
      ),
      hazards: await Promise.all(
        hazards
          .filter(hasHazardContent)
          .map(async (row) => ({
            id: row.id,
            hazardType: normalizeOptionalText(row.hazardType) || null,
            locationDescription: normalizeOptionalText(row.locationDescription) || null,
            quantity: normalizeOptionalText(row.quantity) || null,
            description: normalizeOptionalText(row.description) || null,
            attachmentDocumentRevisionId: normalizeOptionalText(row.attachmentDocumentRevisionId) || null,
            sdsDocumentRevisionId: normalizeOptionalText(row.sdsDocumentRevisionId) || null,
            supportingDocumentUpload: await fileToUploadPayload(row.supportingDocumentFile),
          })),
      ),
      photoReferences: await Promise.all(
        [...photoReferences, buildingFrontPhoto]
          .filter(hasPhotoReferenceContent)
          .map(async (row) => ({
            id: row.id,
            documentRevisionId: normalizeOptionalText(row.documentRevisionId) || null,
            notes: normalizeOptionalText(row.notes) || null,
            relatedComponent: normalizeOptionalText(row.relatedComponent) || null,
            photoUpload: await fileToUploadPayload(row.photoFile),
          })),
      ),
      documentReferences: await Promise.all(
        documentReferences
          .filter(hasDocumentReferenceContent)
          .map(async (row) => ({
            id: row.id,
            linkType: row.linkType,
            documentRevisionId: normalizeOptionalText(row.documentRevisionId) || null,
            notes: normalizeOptionalText(row.notes) || null,
            relatedComponent: normalizeOptionalText(row.relatedComponent) || null,
            documentUpload: await fileToUploadPayload(row.documentFile),
          })),
      ),
    };

    const response = await fetch(endpoint, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const responsePayload = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          error?: string;
          prePlanId?: string;
        }
      | null;

    if (!response.ok || !responsePayload?.ok || !responsePayload.prePlanId) {
      setIsSaving(false);
      setErrorMessage(responsePayload?.error || "Unable to save pre-plan.");
      return;
    }

    setIsSaving(false);
    router.push(`/pre-plans/${responsePayload.prePlanId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-[#111111]/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Pre-Plans</p>
        <h1
          className="text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
          style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
        >
          {mode === "create" ? "Create Pre-Plan" : "Edit Pre-Plan"}
        </h1>
        <p className="text-sm text-neutral-400">
          Capture occupancy details and contacts for faster on-scene decisions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <nav className="sticky top-2 z-20 rounded-xl border border-white/10 bg-[#151515]/95 p-3 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {[
              ["building-information", "Building"],
              ["contacts", "Contacts"],
              ["life-safety", "Life Safety"],
              ["access", "Access"],
              ["water-supply", "Water Supply"],
              ["fire-protection", "Fire Protection"],
              ["utilities", "Utilities"],
              ["critical-information", "Critical"],
              ["hazards", "Hazards"],
              ["reference-materials", "References"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md border border-white/10 bg-[#1b1b1b] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-200 transition hover:border-red-500/40 hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <FormSection
          id="building-information"
          title="Building Information"
          description="Core building identity used throughout pre-plan operations."
        >
          <FormField label="Business Name" required>
            <input
              value={formValues.businessName}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, businessName: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Occupancy ID Number">
            <input
              value={formValues.occupancyIdNumber}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, occupancyIdNumber: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Address" required fullWidth>
            <input
              value={formValues.address}
              onChange={(event) => setFormValues((current) => ({ ...current, address: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="City" required>
            <input
              value={formValues.city}
              onChange={(event) => setFormValues((current) => ({ ...current, city: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="State" required>
            <input
              value={formValues.state}
              onChange={(event) => setFormValues((current) => ({ ...current, state: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="ZIP" required>
            <input
              value={formValues.zip}
              onChange={(event) => setFormValues((current) => ({ ...current, zip: event.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Building Front Photo" fullWidth>
            <div className="space-y-2 rounded-lg border border-white/10 bg-[#151515] p-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;

                  if (buildingFrontPhotoObjectUrl) {
                    URL.revokeObjectURL(buildingFrontPhotoObjectUrl);
                  }

                  const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
                  setBuildingFrontPhotoObjectUrl(nextPreviewUrl);

                  setBuildingFrontPhoto((current) => ({
                    ...current,
                    photoFile: file,
                    documentRevisionId: file ? "" : current.documentRevisionId,
                    relatedComponent: "building_front",
                    notes: current.notes || "Building Front Photo",
                  }));
                }}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (buildingFrontPhotoObjectUrl) {
                      URL.revokeObjectURL(buildingFrontPhotoObjectUrl);
                    }
                    setBuildingFrontPhotoObjectUrl(null);
                    setBuildingFrontPhoto(createBuildingFrontPhotoDraft(null));
                  }}
                  className="rounded-md border border-white/15 bg-[#1b1b1b] px-2.5 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-[#242424]"
                >
                  Remove
                </button>
              </div>

              {buildingFrontPhotoObjectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildingFrontPhotoObjectUrl}
                  alt="Building front photo preview"
                  className="h-28 w-full max-w-sm rounded-lg border border-white/10 object-cover"
                />
              ) : photoPreviewUrls[buildingFrontPhoto.clientId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrls[buildingFrontPhoto.clientId]}
                  alt="Building front photo preview"
                  className="h-28 w-full max-w-sm rounded-lg border border-white/10 object-cover"
                />
              ) : null}
            </div>
          </FormField>

          <FormField label="Business Phone">
            <input
              value={formValues.businessPhone}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, businessPhone: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Property Owner Name">
            <input
              value={formValues.propertyOwnerName}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, propertyOwnerName: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Property Owner Phone">
            <input
              value={formValues.propertyOwnerPhone}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, propertyOwnerPhone: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>
        </FormSection>

        <FormSection
          id="contacts"
          title="Contacts"
          description="People and phone numbers crews may need to reach quickly."
        >
          <FormField label="Primary Contact Name">
            <input
              value={formValues.primaryContactName}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, primaryContactName: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Primary Contact Phone">
            <input
              value={formValues.primaryContactPhone}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, primaryContactPhone: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Secondary Contact Name">
            <input
              value={formValues.secondaryContactName}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, secondaryContactName: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Secondary Contact Phone">
            <input
              value={formValues.secondaryContactPhone}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, secondaryContactPhone: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>
        </FormSection>

        <FormSection
          id="life-safety"
          title="Life Safety"
          description="Occupancy conditions that can directly impact tactical decisions."
        >
          <FormField label="Normal Occupant Load">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={formValues.normalOccupantLoad}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, normalOccupantLoad: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Special-Needs Occupants">
            <input
              value={formValues.specialNeedsOccupants}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, specialNeedsOccupants: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>
        </FormSection>

        <FormSection
          id="access"
          title="Access"
          description="How responding apparatus and crews should gain entry."
        >
          <FormField label="Primary Apparatus Access" fullWidth>
            <textarea
              rows={3}
              value={formValues.primaryApparatusAccess}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, primaryApparatusAccess: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>

          <FormField label="Knox Box On Site?">
            <select
              value={normalizeBinaryChoice(formValues.knoxBoxDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  knoxBoxDetails: value,
                  knoxBoxLocation: value === "yes" ? current.knoxBoxLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.knoxBoxDetails) === "yes" ? (
            <FormField label="Knox Box Location">
              <input
                value={formValues.knoxBoxLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, knoxBoxLocation: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}
        </FormSection>

        <FormSection
          id="water-supply"
          title="Water Supply"
          description="Hydrants and water connections needed for fireground supply operations."
        >
          <FormField label="Fire Department Connection">
            <select
              value={normalizeBinaryChoice(formValues.fdcDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  fdcDetails: value,
                  fdcLocation: value === "yes" ? current.fdcLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.fdcDetails) === "yes" ? (
            <FormField label="Fire Department Connection Location">
              <input
                value={formValues.fdcLocation}
                onChange={(event) => setFormValues((current) => ({ ...current, fdcLocation: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}

          <div className="md:col-span-2 rounded-lg border border-white/10 bg-[#111111] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">Hydrants</p>
                <p className="text-xs text-neutral-500">Add each hydrant as an individual record.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setHydrants((current) => [
                    ...current,
                    {
                      clientId: createClientId(),
                      id: null,
                      hydrantIdentifier: "Public",
                      locationDescription: "",
                      hydrantNotes: "",
                      photoDocumentRevisionId: "",
                      photoFile: null,
                    },
                  ])
                }
                className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                + Add Hydrant
              </button>
            </div>

            {hydrants.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 bg-[#151515] px-3 py-3 text-sm text-neutral-400">
                No hydrants added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {hydrants.map((row, index) => (
                  <div key={row.clientId} className="rounded-lg border border-white/10 bg-[#171717] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Hydrant {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => setHydrants((current) => current.filter((item) => item.clientId !== row.clientId))}
                        className="text-xs font-semibold text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField label="Hydrant Type">
                        <select
                          value={row.hydrantIdentifier}
                          onChange={(event) =>
                            setHydrants((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, hydrantIdentifier: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        >
                          <option value="Public">Public</option>
                          <option value="Private">Private</option>
                        </select>
                      </FormField>

                      <FormField label="Hydrant Location">
                        <input
                          value={row.locationDescription}
                          onChange={(event) =>
                            setHydrants((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, locationDescription: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </FormField>

                      <FormField label="Hydrant GPM">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={row.hydrantNotes}
                          onChange={(event) =>
                            setHydrants((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, hydrantNotes: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </FormField>

                      <FormField label="Hydrant Photo" fullWidth>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) =>
                            setHydrants((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? {
                                    ...item,
                                    photoFile: event.target.files?.[0] ?? null,
                                    photoDocumentRevisionId: event.target.files?.[0] ? "" : item.photoDocumentRevisionId,
                                  }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                        {row.photoFile ? (
                          <p className="mt-1 text-xs text-neutral-400">Selected: {row.photoFile.name}</p>
                        ) : row.photoDocumentRevisionId ? (
                          <p className="mt-1 text-xs text-neutral-400">
                            Attached: {revisionById.get(row.photoDocumentRevisionId)?.fileName ?? "Photo attached"}
                          </p>
                        ) : null}
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection
          id="fire-protection"
          title="Fire Protection"
          description="Built-in systems that affect suppression tactics and building operations."
        >
          <FormField label="Fire Alarm Present">
            <select
              value={normalizeBinaryChoice(formValues.fireAlarmDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  fireAlarmDetails: value,
                  fireAlarmPanelLocation: value === "yes" ? current.fireAlarmPanelLocation : "",
                  fireAlarmEnunciatorPanelLocation: value === "yes" ? current.fireAlarmEnunciatorPanelLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.fireAlarmDetails) === "yes" ? (
            <FormField label="Alarm Panel Location">
              <input
                value={formValues.fireAlarmPanelLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, fireAlarmPanelLocation: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}

          {normalizeBinaryChoice(formValues.fireAlarmDetails) === "yes" ? (
            <FormField label="Annunciator Panel Location">
              <input
                value={formValues.fireAlarmEnunciatorPanelLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, fireAlarmEnunciatorPanelLocation: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}

          <FormField label="Sprinkler System Present">
            <select
              value={normalizeBinaryChoice(formValues.sprinklerSystemDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  sprinklerSystemDetails: value,
                  riserLocation: value === "yes" ? current.riserLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.sprinklerSystemDetails) === "yes" ? (
            <FormField label="Sprinkler Riser Location">
              <input
                value={formValues.riserLocation}
                onChange={(event) => setFormValues((current) => ({ ...current, riserLocation: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}

          <FormField label="Fire Pump Present">
            <select
              value={normalizeBinaryChoice(formValues.firePumpDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  firePumpDetails: value,
                  firePumpLocation: value === "yes" ? current.firePumpLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.firePumpDetails) === "yes" ? (
            <FormField label="Fire Pump Location">
              <input
                value={formValues.firePumpLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, firePumpLocation: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}

          <FormField label="Standpipe Present">
            <select
              value={normalizeBinaryChoice(formValues.standpipeDetails)}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  standpipeDetails: value,
                  standpipeLocation: value === "yes" ? current.standpipeLocation : "",
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>

          {normalizeBinaryChoice(formValues.standpipeDetails) === "yes" ? (
            <FormField label="Standpipe Location">
              <input
                value={formValues.standpipeLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, standpipeLocation: event.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </FormField>
          ) : null}
        </FormSection>

        <FormSection
          id="utilities"
          title="Utilities"
          description="Critical utility shutoff locations for scene control."
        >
          <div className="md:col-span-2 grid gap-3 rounded-lg border border-white/10 bg-[#171717] p-3 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Electrical</p>
              <input
                value={formValues.electricalShutoffLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, electricalShutoffLocation: event.target.value }))
                }
                placeholder="Electrical shutoff location"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Water</p>
              <input
                value={formValues.waterShutoffLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, waterShutoffLocation: event.target.value }))
                }
                placeholder="Water shutoff location"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Gas</p>
              <input
                value={formValues.gasShutoffLocation}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, gasShutoffLocation: event.target.value }))
                }
                placeholder="Gas shutoff location"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          id="critical-information"
          title="Critical Information"
          description="Information crews must know before committing to interior or tactical operations."
        >
          <FormField label="Critical Information" fullWidth>
            <textarea
              rows={4}
              value={formValues.criticalInformation}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, criticalInformation: event.target.value }))
              }
              className="w-full rounded-lg border border-red-500/30 bg-[#1b1212] px-3 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
            />
          </FormField>

          <FormField label="Additional Comments" fullWidth>
            <textarea
              rows={3}
              value={formValues.additionalComments}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, additionalComments: event.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </FormField>
        </FormSection>

        <FormSection
          id="hazards"
          title="Hazards"
          description="Manage hazards individually with location, tactical notes, and SDS/reference attachments."
        >
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-400">Each hazard is saved as its own record.</p>
              <button
                type="button"
                onClick={() =>
                  setHazards((current) => [
                    ...current,
                    {
                      clientId: createClientId(),
                      id: null,
                      hazardType: "",
                      locationDescription: "",
                      quantity: "",
                      description: "",
                      attachmentDocumentRevisionId: "",
                      sdsDocumentRevisionId: "",
                      supportingDocumentFile: null,
                    },
                  ])
                }
                className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Add Hazard
              </button>
            </div>

            {hazards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 bg-[#151515] px-3 py-3 text-sm text-neutral-400">
                No hazards added yet.
              </p>
            ) : (
              hazards.map((row, index) => (
                <div key={row.clientId} className="rounded-lg border border-white/10 bg-[#171717] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Hazard {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => setHazards((current) => current.filter((item) => item.clientId !== row.clientId))}
                      className="text-xs font-semibold text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField label="Hazard Type">
                      <input
                        value={row.hazardType}
                        onChange={(event) =>
                          setHazards((current) => current.map((item) => (
                            item.clientId === row.clientId
                              ? { ...item, hazardType: event.target.value }
                              : item
                          )))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </FormField>

                    <FormField label="Location">
                      <input
                        value={row.locationDescription}
                        onChange={(event) =>
                          setHazards((current) => current.map((item) => (
                            item.clientId === row.clientId
                              ? { ...item, locationDescription: event.target.value }
                              : item
                          )))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </FormField>

                    <FormField label="Quantity">
                      <input
                        value={row.quantity}
                        onChange={(event) =>
                          setHazards((current) => current.map((item) => (
                            item.clientId === row.clientId
                              ? { ...item, quantity: event.target.value }
                              : item
                          )))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </FormField>

                    <FormField label="Tactics / Notes" fullWidth>
                      <textarea
                        rows={3}
                        value={row.description}
                        onChange={(event) =>
                          setHazards((current) => current.map((item) => (
                            item.clientId === row.clientId
                              ? { ...item, description: event.target.value }
                              : item
                          )))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                    </FormField>

                    <FormField label="SDS / Supporting Document" fullWidth>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.webp"
                        onChange={(event) =>
                          setHazards((current) => current.map((item) => (
                            item.clientId === row.clientId
                              ? {
                                  ...item,
                                  supportingDocumentFile: event.target.files?.[0] ?? null,
                                  sdsDocumentRevisionId: event.target.files?.[0] ? "" : item.sdsDocumentRevisionId,
                                }
                              : item
                          )))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                      />
                      {row.supportingDocumentFile ? (
                        <p className="mt-1 text-xs text-neutral-400">Selected: {row.supportingDocumentFile.name}</p>
                      ) : row.sdsDocumentRevisionId ? (
                        <p className="mt-1 text-xs text-neutral-400">
                          Attached: {revisionById.get(row.sdsDocumentRevisionId)?.fileName ?? "Document attached"}
                        </p>
                      ) : null}
                    </FormField>
                  </div>
                </div>
              ))
            )}
          </div>
        </FormSection>

        <FormSection
          id="reference-materials"
          title="Reference Materials"
          description="Attach the site plan, pre-plan photos, and supporting documents crews need on scene."
        >
          <div className="md:col-span-2 rounded-lg border border-white/10 bg-[#171717] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Site Plan</p>
            <p className="mt-1 text-xs text-neutral-400">
              Attach the building or site plan firefighters would use for this occupancy.
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-red-500/40 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">
              Upload Site Plan
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSitePlanFile(file);
                  if (file) {
                    setSitePlanDocumentRevisionId("");
                  }
                }}
              />
            </label>
            {sitePlanFile ? (
              <p className="mt-2 text-xs text-neutral-400">Selected: {sitePlanFile.name}</p>
            ) : sitePlanDocumentRevisionId ? (
              <p className="mt-2 text-xs text-neutral-400">
                Attached: {revisionById.get(sitePlanDocumentRevisionId)?.fileName ?? "Site plan attached"}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2 rounded-lg border border-white/10 bg-[#111111] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">Pre-Plan Photos</p>
                <p className="text-xs text-neutral-500">Add response-relevant photos of the building and property.</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setPhotoReferences((current) => [...current, createEmptyPhotoReferenceDraft()]);
                }}
                className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Add Photo
              </button>
            </div>

            {photoReferences.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 bg-[#151515] px-3 py-3 text-sm text-neutral-400">
                No photos attached yet.
              </p>
            ) : (
              <div className="space-y-3">
                {photoReferences.map((row, index) => (
                  <div key={row.clientId} className="rounded-lg border border-white/10 bg-[#171717] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Photo {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => setPhotoReferences((current) => current.filter((item) => item.clientId !== row.clientId))}
                        className="text-xs font-semibold text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField label="Add Photo" fullWidth>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) =>
                            setPhotoReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? {
                                    ...item,
                                    photoFile: event.target.files?.[0] ?? null,
                                    documentRevisionId: event.target.files?.[0] ? "" : item.documentRevisionId,
                                  }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                        {row.photoFile ? (
                          <p className="mt-1 text-xs text-neutral-400">Selected: {row.photoFile.name}</p>
                        ) : row.documentRevisionId ? (
                          <p className="mt-1 text-xs text-neutral-400">
                            Attached: {revisionById.get(row.documentRevisionId)?.fileName ?? "Photo attached"}
                          </p>
                        ) : null}
                      </FormField>

                      <FormField label="Photo Notes" fullWidth>
                        <input
                          value={row.notes}
                          onChange={(event) =>
                            setPhotoReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, notes: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </FormField>

                      {photoPreviewUrls[row.clientId] ? (
                        <div className="md:col-span-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoPreviewUrls[row.clientId]}
                            alt="Photo preview"
                            className="h-28 w-full rounded-lg border border-white/10 object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 rounded-lg border border-white/10 bg-[#111111] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300">Supporting Documents</p>
                <p className="text-xs text-neutral-500">Attach floor plans, hazmat documents, and other supporting files.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDocumentReferences((current) => [
                    ...current,
                    {
                      clientId: createClientId(),
                      id: null,
                      linkType: "document",
                      documentRevisionId: "",
                      notes: "",
                      relatedComponent: "",
                      documentFile: null,
                    },
                  ])
                }
                className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Add Document
              </button>
            </div>

            {documentReferences.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 bg-[#151515] px-3 py-3 text-sm text-neutral-400">
                No documents attached yet.
              </p>
            ) : (
              <div className="space-y-3">
                {documentReferences.map((row, index) => (
                  <div key={row.clientId} className="rounded-lg border border-white/10 bg-[#171717] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Document {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => setDocumentReferences((current) => current.filter((item) => item.clientId !== row.clientId))}
                        className="text-xs font-semibold text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <FormField label="Document Type">
                        <select
                          value={row.linkType}
                          onChange={(event) =>
                            setDocumentReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, linkType: event.target.value as BuilderDocumentLinkType }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        >
                          {DOCUMENT_LINK_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </FormField>

                      <FormField label="Add Document">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.webp"
                          onChange={(event) =>
                            setDocumentReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? {
                                    ...item,
                                    documentFile: event.target.files?.[0] ?? null,
                                    documentRevisionId: event.target.files?.[0] ? "" : item.documentRevisionId,
                                  }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                        {row.documentFile ? (
                          <p className="mt-1 text-xs text-neutral-400">Selected: {row.documentFile.name}</p>
                        ) : row.documentRevisionId ? (
                          <p className="mt-1 text-xs text-neutral-400">
                            Attached: {revisionById.get(row.documentRevisionId)?.fileName ?? "Document attached"}
                          </p>
                        ) : null}
                      </FormField>

                      <FormField label="Related Component">
                        <input
                          value={row.relatedComponent}
                          onChange={(event) =>
                            setDocumentReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, relatedComponent: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </FormField>

                      <FormField label="Document Notes" fullWidth>
                        <textarea
                          rows={2}
                          value={row.notes}
                          onChange={(event) =>
                            setDocumentReferences((current) => current.map((item) => (
                              item.clientId === row.clientId
                                ? { ...item, notes: event.target.value }
                                : item
                            )))
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : mode === "create" ? "Create Pre-Plan" : "Save Changes"}
          </button>

          <Link
            href={cancelHref}
            className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

function FormField({ label, required = false, fullWidth = false, children }: FormFieldProps) {
  return (
    <label className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-semibold text-zinc-200">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

type FormSectionProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

function FormSection({ id, title, description, children }: FormSectionProps) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-white/10 bg-[#141414] p-4 md:p-5">
      <div className="mb-4 border-b border-white/10 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">{title}</p>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}
