"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MAINTENANCE_ATTACHMENTS_BUCKET,
  MAINTENANCE_PHOTOS_BUCKET,
  MAINTENANCE_TYPE_OPTIONS,
} from "@/lib/maintenance";
import { supabase } from "@/lib/supabase";

type SelectOption = {
  id: string;
  label: string;
};

type MaintenanceFormState = {
  apparatusId: string;
  deficiencyId: string;
  maintenanceType: string;
  completedBy: string;
  serviceDate: string;
  description: string;
  partsUsed: string;
  laborHours: string;
  mileage: string;
  engineHours: string;
  cost: string;
  notes: string;
};

type ServiceSpecificationReference = {
  oil_type: string | null;
  oil_capacity: string | null;
  oil_filter_part_number: string | null;
  fuel_filter_part_number: string | null;
  air_filter_part_number: string | null;
  hydraulic_fluid: string | null;
  transmission_fluid: string | null;
  coolant_type: string | null;
  pump_oil: string | null;
  generator_oil: string | null;
  belt_numbers: string | null;
  battery_type: string | null;
  tire_size: string | null;
  other_common_parts: string | null;
};

export type MaintenanceRecordEdit = {
  id: string;
  apparatus_id: string | null;
  deficiency_id: string | null;
  maintenance_type: string | null;
  completed_by: string | null;
  service_date: string | null;
  description: string | null;
  parts_used: string | null;
  labor_hours: number | null;
  mileage: number | null;
  engine_hours: number | null;
  cost: number | null;
  notes: string | null;
  photos: string[] | null;
  attachments: string[] | null;
};

type MaintenanceFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  presentation?: "modal" | "inline";
  showCancelButton?: boolean;
  defaultDeficiencyId?: string | null;
  defaultApparatusId?: string | null;
  lockApparatusSelection?: boolean;
  initialRecord?: MaintenanceRecordEdit | null;
  onClose: () => void;
  onSaved: (recordId: string) => void;
};

const photosAcceptValue = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const attachmentsAcceptValue = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt";
const serviceSpecificationFields: Array<{ key: keyof ServiceSpecificationReference; label: string }> = [
  { key: "oil_type", label: "Oil Type" },
  { key: "oil_capacity", label: "Oil Capacity" },
  { key: "oil_filter_part_number", label: "Oil Filter Part Number" },
  { key: "fuel_filter_part_number", label: "Fuel Filter Part Number" },
  { key: "air_filter_part_number", label: "Air Filter Part Number" },
  { key: "hydraulic_fluid", label: "Hydraulic Fluid" },
  { key: "transmission_fluid", label: "Transmission Fluid" },
  { key: "coolant_type", label: "Coolant Type" },
  { key: "pump_oil", label: "Pump Oil" },
  { key: "generator_oil", label: "Generator Oil" },
  { key: "belt_numbers", label: "Belt Part Numbers" },
  { key: "battery_type", label: "Battery Type" },
  { key: "tire_size", label: "Tire Size" },
  { key: "other_common_parts", label: "Other Common Replacement Parts" },
];

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

async function uploadFilesToBucket({
  bucketName,
  maintenanceRecordId,
  files,
  folder,
}: {
  bucketName: string;
  maintenanceRecordId: string;
  files: File[];
  folder: "photos" | "attachments";
}): Promise<string[]> {
  const uploadedPaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const originalName = file.name || `${folder}-${index + 1}`;
    const sanitizedName = sanitizeFileName(originalName);
    const storagePath = `${maintenanceRecordId}/${folder}/${Date.now()}-${index}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message || `Unable to upload ${originalName}.`);
    }

    uploadedPaths.push(storagePath);
  }

  return uploadedPaths;
}

export default function MaintenanceFormModal({
  isOpen,
  mode,
  title,
  submitLabel,
  presentation = "modal",
  showCancelButton = true,
  defaultDeficiencyId,
  defaultApparatusId,
  lockApparatusSelection = false,
  initialRecord,
  onClose,
  onSaved,
}: MaintenanceFormModalProps) {
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apparatusOptions, setApparatusOptions] = useState<SelectOption[]>([]);
  const [memberOptions, setMemberOptions] = useState<SelectOption[]>([]);
  const [serviceSpecifications, setServiceSpecifications] = useState<ServiceSpecificationReference | null>(null);
  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [existingAttachmentPaths, setExistingAttachmentPaths] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [formState, setFormState] = useState<MaintenanceFormState>({
    apparatusId: "",
    deficiencyId: "",
    maintenanceType: "Repair",
    completedBy: "",
    serviceDate: "",
    description: "",
    partsUsed: "",
    laborHours: "",
    mileage: "",
    engineHours: "",
    cost: "",
    notes: "",
  });

  const canSubmit = useMemo(() => {
    return (
      Boolean(formState.apparatusId) &&
      Boolean(formState.maintenanceType.trim()) &&
      Boolean(formState.serviceDate) &&
      Boolean(formState.description.trim())
    );
  }, [formState]);

  const selectedApparatusName = useMemo(() => {
    if (!formState.apparatusId) {
      return "";
    }

    const match = apparatusOptions.find((option) => option.id === formState.apparatusId);
    return match?.label ?? "";
  }, [apparatusOptions, formState.apparatusId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    async function loadContext() {
      setIsLoadingOptions(true);
      setErrorMessage(null);

      const [apparatusResult, membersResult] = await Promise.all([
        supabase.from("apparatus").select("id, name").order("name"),
        supabase.from("members").select("id, first_name, last_name"),
      ]);

      if (!isMounted) {
        return;
      }

      if (apparatusResult.error || membersResult.error) {
        setErrorMessage(
          apparatusResult.error?.message ||
            membersResult.error?.message ||
            "Unable to load maintenance form options."
        );
        setIsLoadingOptions(false);
        return;
      }

      const normalizedApparatus = (apparatusResult.data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : String(record.id ?? "");
        const name = typeof record.name === "string" && record.name.trim() ? record.name : id;

        return {
          id,
          label: name,
        };
      });

      if (lockApparatusSelection && defaultApparatusId) {
        const hasDefaultApparatus = normalizedApparatus.some(
          (apparatus) => apparatus.id === defaultApparatusId
        );

        if (!hasDefaultApparatus) {
          const { data: defaultApparatusData } = await supabase
            .from("apparatus")
            .select("id, name")
            .eq("id", defaultApparatusId)
            .maybeSingle();

          if (defaultApparatusData) {
            const defaultRow = defaultApparatusData as Record<string, unknown>;
            const defaultId =
              typeof defaultRow.id === "string" ? defaultRow.id : defaultApparatusId;
            const defaultName =
              typeof defaultRow.name === "string" && defaultRow.name.trim()
                ? defaultRow.name
                : defaultId;

            normalizedApparatus.unshift({
              id: defaultId,
              label: defaultName,
            });
          }
        }
      }

      const normalizedMembers = (membersResult.data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : String(record.id ?? "");
        const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
        const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
        const label = `${firstName} ${lastName}`.trim() || id;

        return {
          id,
          label,
        };
      });

      setApparatusOptions(normalizedApparatus);
      setMemberOptions(normalizedMembers);

      const now = new Date();
      const defaultServiceDate = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}T${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;

      if (mode === "edit" && initialRecord) {
        setExistingPhotoPaths(initialRecord.photos ?? []);
        setExistingAttachmentPaths(initialRecord.attachments ?? []);
        setPhotoFiles([]);
        setAttachmentFiles([]);

        setFormState({
          apparatusId: initialRecord.apparatus_id ?? "",
          deficiencyId: initialRecord.deficiency_id ?? "",
          maintenanceType: initialRecord.maintenance_type ?? "Repair",
          completedBy: initialRecord.completed_by ?? "",
          serviceDate: toDateTimeLocalValue(initialRecord.service_date) || defaultServiceDate,
          description: initialRecord.description ?? "",
          partsUsed: initialRecord.parts_used ?? "",
          laborHours:
            typeof initialRecord.labor_hours === "number"
              ? String(initialRecord.labor_hours)
              : "",
          mileage:
            typeof initialRecord.mileage === "number" ? String(initialRecord.mileage) : "",
          engineHours:
            typeof initialRecord.engine_hours === "number"
              ? String(initialRecord.engine_hours)
              : "",
          cost: typeof initialRecord.cost === "number" ? String(initialRecord.cost) : "",
          notes: initialRecord.notes ?? "",
        });
      } else {
        setExistingPhotoPaths([]);
        setExistingAttachmentPaths([]);
        setPhotoFiles([]);
        setAttachmentFiles([]);

        let apparatusId = defaultApparatusId ?? "";
        let deficiencyId = defaultDeficiencyId ?? "";

        if (defaultDeficiencyId) {
          const { data: deficiencyData } = await supabase
            .from("deficiencies")
            .select("id, apparatus_id, description")
            .eq("id", defaultDeficiencyId)
            .maybeSingle();

          const record = (deficiencyData ?? {}) as Record<string, unknown>;
          apparatusId =
            typeof record.apparatus_id === "string" && record.apparatus_id
              ? record.apparatus_id
              : defaultApparatusId ?? "";
          deficiencyId = typeof record.id === "string" ? record.id : defaultDeficiencyId;
          const description = typeof record.description === "string" ? record.description.trim() : "";

          setFormState((current) => ({
            ...current,
            apparatusId,
            deficiencyId,
            description: current.description || description,
            serviceDate: current.serviceDate || defaultServiceDate,
          }));
        } else {
          setFormState({
            apparatusId: defaultApparatusId ?? "",
            deficiencyId: "",
            maintenanceType: "Repair",
            completedBy: "",
            serviceDate: defaultServiceDate,
            description: "",
            partsUsed: "",
            laborHours: "",
            mileage: "",
            engineHours: "",
            cost: "",
            notes: "",
          });
        }

        if (lockApparatusSelection && defaultApparatusId) {
          setFormState((current) => ({
            ...current,
            apparatusId: defaultApparatusId,
          }));
        }
      }

      setIsLoadingOptions(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, initialRecord, defaultDeficiencyId, defaultApparatusId]);

  useEffect(() => {
    if (!isOpen || !formState.apparatusId) {
      setServiceSpecifications(null);
      return;
    }

    let isMounted = true;

    async function loadServiceSpecifications() {
      const { data, error } = await supabase
        .from("apparatus")
        .select("oil_type, oil_capacity, oil_filter_part_number, fuel_filter_part_number, air_filter_part_number, hydraulic_fluid, transmission_fluid, coolant_type, pump_oil, generator_oil, belt_numbers, battery_type, tire_size, other_common_parts")
        .eq("id", formState.apparatusId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setServiceSpecifications(null);
        return;
      }

      const row = data as Record<string, unknown>;

      setServiceSpecifications({
        oil_type: typeof row.oil_type === "string" ? row.oil_type : null,
        oil_capacity: typeof row.oil_capacity === "string" ? row.oil_capacity : null,
        oil_filter_part_number:
          typeof row.oil_filter_part_number === "string" ? row.oil_filter_part_number : null,
        fuel_filter_part_number:
          typeof row.fuel_filter_part_number === "string" ? row.fuel_filter_part_number : null,
        air_filter_part_number:
          typeof row.air_filter_part_number === "string" ? row.air_filter_part_number : null,
        hydraulic_fluid:
          typeof row.hydraulic_fluid === "string" ? row.hydraulic_fluid : null,
        transmission_fluid:
          typeof row.transmission_fluid === "string" ? row.transmission_fluid : null,
        coolant_type: typeof row.coolant_type === "string" ? row.coolant_type : null,
        pump_oil: typeof row.pump_oil === "string" ? row.pump_oil : null,
        generator_oil:
          typeof row.generator_oil === "string" ? row.generator_oil : null,
        belt_numbers: typeof row.belt_numbers === "string" ? row.belt_numbers : null,
        battery_type: typeof row.battery_type === "string" ? row.battery_type : null,
        tire_size: typeof row.tire_size === "string" ? row.tire_size : null,
        other_common_parts:
          typeof row.other_common_parts === "string" ? row.other_common_parts : null,
      });
    }

    loadServiceSpecifications();

    return () => {
      isMounted = false;
    };
  }, [isOpen, formState.apparatusId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setErrorMessage("Complete all required fields before saving.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const maintenanceRecordId = mode === "create" ? crypto.randomUUID() : initialRecord?.id;

    if (!maintenanceRecordId) {
      setErrorMessage("Maintenance record id is missing.");
      setIsSubmitting(false);
      return;
    }

    let uploadedPhotoPaths: string[] = [];
    let uploadedAttachmentPaths: string[] = [];

    try {
      uploadedPhotoPaths = await uploadFilesToBucket({
        bucketName: MAINTENANCE_PHOTOS_BUCKET,
        maintenanceRecordId,
        files: photoFiles,
        folder: "photos",
      });

      uploadedAttachmentPaths = await uploadFilesToBucket({
        bucketName: MAINTENANCE_ATTACHMENTS_BUCKET,
        maintenanceRecordId,
        files: attachmentFiles,
        folder: "attachments",
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Unable to upload files.";
      setErrorMessage(message);
      setIsSubmitting(false);
      return;
    }

    const payload = {
      apparatus_id: lockApparatusSelection && defaultApparatusId
        ? defaultApparatusId
        : formState.apparatusId,
      deficiency_id: formState.deficiencyId || null,
      maintenance_type: formState.maintenanceType.trim(),
      completed_by: formState.completedBy || null,
      service_date: new Date(formState.serviceDate).toISOString(),
      description: formState.description.trim(),
      parts_used: formState.partsUsed.trim() || null,
      labor_hours: formState.laborHours ? Number(formState.laborHours) : null,
      mileage: formState.mileage ? Number(formState.mileage) : null,
      engine_hours: formState.engineHours ? Number(formState.engineHours) : null,
      cost: formState.cost ? Number(formState.cost) : null,
      notes: formState.notes.trim() || null,
      photos: [...existingPhotoPaths, ...uploadedPhotoPaths],
      attachments: [...existingAttachmentPaths, ...uploadedAttachmentPaths],
    };

    if (mode === "create") {
      const { data, error } = await supabase
        .from("maintenance_records")
        .insert({
          id: maintenanceRecordId,
          ...payload,
        })
        .select("id, maintenance_number, deficiency_id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      if (data?.deficiency_id && data.maintenance_number) {
        const { error: historyError } = await supabase
          .from("deficiency_history")
          .insert({
            deficiency_id: data.deficiency_id,
            event_type: "Maintenance",
            event_description: `Linked Maintenance Record created (${data.maintenance_number}).`,
            member_id: payload.completed_by,
          });

        if (historyError) {
          console.error("maintenance history link insert failed", historyError);
        }
      }

      setIsSubmitting(false);
      onSaved(data.id as string);
      return;
    }

    const { error } = await supabase
      .from("maintenance_records")
      .update(payload)
      .eq("id", maintenanceRecordId);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSaved(maintenanceRecordId);
  }

  if (!isOpen) {
    return null;
  }

  const isModalPresentation = presentation === "modal";

  const containerClassName = isModalPresentation
    ? "my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
    : "mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

  const formBodyClassName = isModalPresentation
    ? "min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6"
    : "space-y-6 px-6 py-6";

  const shellClassName = isModalPresentation
    ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8"
    : "w-full";

  return (
    <div className={shellClassName}>
      <div
        role={isModalPresentation ? "dialog" : undefined}
        aria-modal={isModalPresentation ? "true" : undefined}
        className={containerClassName}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Record maintenance completion details and preserve service history.
          </p>
          {lockApparatusSelection && formState.apparatusId ? (
            <div className="mt-3 inline-flex rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <p className="text-sm font-semibold text-zinc-200">
                Apparatus: {selectedApparatusName || formState.apparatusId}
              </p>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={formBodyClassName}>
            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {isLoadingOptions ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
                Loading maintenance form options...
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
            {lockApparatusSelection ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Apparatus</span>
                <div className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white">
                  {selectedApparatusName || formState.apparatusId || "Loading apparatus..."}
                </div>
                <span className="mt-2 block text-xs text-zinc-500">
                  Apparatus is locked to this record context.
                </span>
              </label>
            ) : (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Apparatus</span>
                <select
                  value={formState.apparatusId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      apparatusId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
                >
                  {isLoadingOptions ? (
                    <option value="">Loading apparatus...</option>
                  ) : apparatusOptions.length === 0 ? (
                    <option value="">No apparatus available</option>
                  ) : (
                    <>
                      <option value="">Select apparatus</option>
                      {apparatusOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Maintenance Type</span>
              <select
                value={formState.maintenanceType}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    maintenanceType: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              >
                {MAINTENANCE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-white/10 bg-[#111111] p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                Service Specifications Reference
              </p>

              {serviceSpecifications ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {serviceSpecificationFields.map((field) => {
                    const value = serviceSpecifications[field.key];

                    return (
                      <div
                        key={field.key}
                        className="rounded-lg border border-white/10 bg-[#171717] px-3 py-2"
                      >
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                          {field.label}
                        </p>
                        <p className="mt-1 text-sm text-zinc-200">{value?.trim() ? value : "Not set"}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Select an apparatus to view service specification references.
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Service Date</span>
              <input
                type="datetime-local"
                value={formState.serviceDate}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    serviceDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Completed By</span>
              <select
                value={formState.completedBy}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    completedBy: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              >
                <option value="">Select member</option>
                {memberOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Linked Deficiency ID</span>
              <input
                type="text"
                value={formState.deficiencyId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    deficiencyId: event.target.value,
                  }))
                }
                placeholder="Optional"
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Description</span>
              <textarea
                rows={4}
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Parts Used</span>
              <textarea
                rows={3}
                value={formState.partsUsed}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    partsUsed: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Labor Hours</span>
              <input
                type="number"
                step="0.25"
                value={formState.laborHours}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    laborHours: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Mileage</span>
              <input
                type="number"
                value={formState.mileage}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    mileage: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Engine Hours</span>
              <input
                type="number"
                step="0.1"
                value={formState.engineHours}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    engineHours: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Cost</span>
              <input
                type="number"
                step="0.01"
                value={formState.cost}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    cost: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Notes</span>
              <textarea
                rows={3}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Photos</span>
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
                <input
                  type="file"
                  multiple
                  accept={photosAcceptValue}
                  onChange={(event) => {
                    setPhotoFiles(Array.from(event.target.files ?? []));
                  }}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-red-500"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Upload JPG, PNG, WEBP, or HEIC image files.
                </p>

                {existingPhotoPaths.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Current photos</p>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {existingPhotoPaths.map((path, index) => (
                        <li key={`${path}-${index}`} className="flex items-center justify-between gap-3">
                          <span className="truncate">{path}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setExistingPhotoPaths((current) =>
                                current.filter((_, currentIndex) => currentIndex !== index)
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {photoFiles.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Files ready to upload</p>
                    <ul className="space-y-1 text-sm text-zinc-300">
                      {photoFiles.map((file) => (
                        <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zinc-200">Attachments</span>
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
                <input
                  type="file"
                  multiple
                  accept={attachmentsAcceptValue}
                  onChange={(event) => {
                    setAttachmentFiles(Array.from(event.target.files ?? []));
                  }}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-red-500"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Upload PDFs, invoices, manuals, receipts, and related documents.
                </p>

                {existingAttachmentPaths.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Current attachments</p>
                    <ul className="space-y-2 text-sm text-zinc-300">
                      {existingAttachmentPaths.map((path, index) => (
                        <li key={`${path}-${index}`} className="flex items-center justify-between gap-3">
                          <span className="truncate">{path}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setExistingAttachmentPaths((current) =>
                                current.filter((_, currentIndex) => currentIndex !== index)
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {attachmentFiles.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Files ready to upload</p>
                    <ul className="space-y-1 text-sm text-zinc-300">
                      {attachmentFiles.map((file) => (
                        <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </label>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-[#0f0f0f] px-6 py-4">
            {showCancelButton ? (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting || isLoadingOptions || !canSubmit}
              className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
