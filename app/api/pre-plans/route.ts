import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CreatePrePlanPayload = {
  businessName?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  businessPhone?: unknown;
  occupancyIdNumber?: unknown;
  propertyOwnerName?: unknown;
  propertyOwnerPhone?: unknown;
  primaryContactName?: unknown;
  primaryContactPhone?: unknown;
  secondaryContactName?: unknown;
  secondaryContactPhone?: unknown;
  additionalComments?: unknown;
  normalOccupantLoad?: unknown;
  specialNeedsOccupants?: unknown;
  primaryApparatusAccess?: unknown;
  knoxBoxDetails?: unknown;
  knoxBoxLocation?: unknown;
  fdcDetails?: unknown;
  fdcLocation?: unknown;
  fdcNotes?: unknown;
  otherWaterSupplyInfo?: unknown;
  fireAlarmDetails?: unknown;
  fireAlarmPanelLocation?: unknown;
  sprinklerSystemDetails?: unknown;
  riserLocation?: unknown;
  firePumpDetails?: unknown;
  firePumpLocation?: unknown;
  standpipeDetails?: unknown;
  standpipeLocation?: unknown;
  electricalShutoff?: unknown;
  electricalShutoffLocation?: unknown;
  electricalComments?: unknown;
  waterShutoff?: unknown;
  waterShutoffLocation?: unknown;
  waterComments?: unknown;
  gasShutoff?: unknown;
  gasShutoffLocation?: unknown;
  gasComments?: unknown;
  criticalInformation?: unknown;
  sitePlanDocumentRevisionId?: unknown;
  sitePlanUpload?: unknown;
  hydrants?: unknown;
  hazards?: unknown;
  photoReferences?: unknown;
  documentReferences?: unknown;
};

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type HydrantInput = {
  id: string | null;
  hydrantIdentifier: string | null;
  locationDescription: string | null;
  hydrantNotes: string | null;
  photoDocumentRevisionId: string | null;
  photoUpload: UploadPayload | null;
};

type HazardInput = {
  id: string | null;
  hazardType: string | null;
  locationDescription: string | null;
  quantity: string | null;
  description: string | null;
  attachmentDocumentRevisionId: string | null;
  sdsDocumentRevisionId: string | null;
  supportingDocumentUpload: UploadPayload | null;
};

type PhotoReferenceInput = {
  id: string | null;
  documentRevisionId: string | null;
  notes: string | null;
  relatedComponent: string | null;
  photoUpload: UploadPayload | null;
};

type DocumentReferenceInput = {
  id: string | null;
  linkType: string | null;
  documentRevisionId: string | null;
  notes: string | null;
  relatedComponent: string | null;
  documentUpload: UploadPayload | null;
};

const MANAGED_DOCUMENT_LINK_TYPES = new Set([
  "document",
  "other",
  "floor_plan",
  "building_plan",
  "sds_msds",
]);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }

  return null;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseUpload(value: unknown): UploadPayload | null {
  const item = asObject(value);
  if (!item) {
    return null;
  }

  const fileName = normalizeRequiredString(item.fileName);
  const mimeType = normalizeRequiredString(item.mimeType) || "application/octet-stream";
  const base64Data = normalizeRequiredString(item.base64Data);

  if (!fileName || !base64Data) {
    return null;
  }

  return {
    fileName,
    mimeType,
    base64Data,
  };
}

async function createRevisionFromUpload({
  upload,
  title,
  category,
  supabase,
  departmentId,
  memberId,
}: {
  upload: UploadPayload;
  title: string;
  category: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  departmentId: string;
  memberId: string;
}) {
  const sanitizedFileName = upload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${departmentId}/pre-plans/${Date.now()}-${sanitizedFileName}`;
  const binary = Buffer.from(upload.base64Data, "base64");

  const { error: uploadError } = await supabase.storage
    .from("department-documents")
    .upload(storagePath, binary, {
      contentType: upload.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload file.");
  }

  const effectiveDate = new Date().toISOString().slice(0, 10);

  const { data: documentRecord, error: documentInsertError } = await supabase
    .from("documents")
    .insert({
      department_id: departmentId,
      category,
      title,
      description: null,
      document_number: null,
      effective_date: effectiveDate,
      status: "Active",
      uploaded_by: memberId,
      current_revision_id: null,
    })
    .select("id")
    .single();

  if (documentInsertError || !documentRecord) {
    throw new Error(documentInsertError?.message || "Unable to create document record.");
  }

  const { data: revisionRecord, error: revisionInsertError } = await supabase
    .from("document_revisions")
    .insert({
      department_id: departmentId,
      document_id: documentRecord.id,
      revision_number: 1,
      file_name: upload.fileName,
      file_path: storagePath,
      file_size_bytes: binary.length,
      mime_type: upload.mimeType,
      uploaded_by: memberId,
      effective_date: effectiveDate,
      revision_date: effectiveDate,
      notes: null,
      status: "Active",
      content_text: null,
    })
    .select("id")
    .single();

  if (revisionInsertError || !revisionRecord) {
    throw new Error(revisionInsertError?.message || "Unable to create document revision.");
  }

  const { error: attachRevisionError } = await supabase
    .from("documents")
    .update({ current_revision_id: revisionRecord.id })
    .eq("id", documentRecord.id);

  if (attachRevisionError) {
    throw new Error(attachRevisionError.message || "Unable to attach document revision.");
  }

  return revisionRecord.id;
}

function parseHydrants(value: unknown): HydrantInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw) => {
      const item = asObject(raw);
      if (!item) {
        return null;
      }

      return {
        id: normalizeOptionalString(item.id),
        hydrantIdentifier: normalizeOptionalString(item.hydrantIdentifier),
        locationDescription: normalizeOptionalString(item.locationDescription),
        hydrantNotes: normalizeOptionalString(item.hydrantNotes),
        photoDocumentRevisionId: normalizeOptionalString(item.photoDocumentRevisionId),
        photoUpload: parseUpload(item.photoUpload),
      };
    })
    .filter(Boolean) as HydrantInput[];
}

function parseHazards(value: unknown): HazardInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw) => {
      const item = asObject(raw);
      if (!item) {
        return null;
      }

      return {
        id: normalizeOptionalString(item.id),
        hazardType: normalizeOptionalString(item.hazardType),
        locationDescription: normalizeOptionalString(item.locationDescription),
        quantity: normalizeOptionalString(item.quantity),
        description: normalizeOptionalString(item.description),
        attachmentDocumentRevisionId: normalizeOptionalString(item.attachmentDocumentRevisionId),
        sdsDocumentRevisionId: normalizeOptionalString(item.sdsDocumentRevisionId),
        supportingDocumentUpload: parseUpload(item.supportingDocumentUpload),
      };
    })
    .filter(Boolean) as HazardInput[];
}

function parsePhotoReferences(value: unknown): PhotoReferenceInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw) => {
      const item = asObject(raw);
      if (!item) {
        return null;
      }

      return {
        id: normalizeOptionalString(item.id),
        documentRevisionId: normalizeOptionalString(item.documentRevisionId),
        notes: normalizeOptionalString(item.notes),
        relatedComponent: normalizeOptionalString(item.relatedComponent),
        photoUpload: parseUpload(item.photoUpload),
      };
    })
    .filter(Boolean) as PhotoReferenceInput[];
}

function parseDocumentReferences(value: unknown): DocumentReferenceInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw) => {
      const item = asObject(raw);
      if (!item) {
        return null;
      }

      const normalizedType = normalizeOptionalString(item.linkType);

      return {
        id: normalizeOptionalString(item.id),
        linkType: normalizedType && MANAGED_DOCUMENT_LINK_TYPES.has(normalizedType) ? normalizedType : "document",
        documentRevisionId: normalizeOptionalString(item.documentRevisionId),
        notes: normalizeOptionalString(item.notes),
        relatedComponent: normalizeOptionalString(item.relatedComponent),
        documentUpload: parseUpload(item.documentUpload),
      };
    })
    .filter(Boolean) as DocumentReferenceInput[];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreatePrePlanPayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const businessName = normalizeRequiredString(payload.businessName);
    const address = normalizeRequiredString(payload.address);
    const city = normalizeRequiredString(payload.city);
    const state = normalizeRequiredString(payload.state);
    const zip = normalizeRequiredString(payload.zip);
    const hydrants = parseHydrants(payload.hydrants);
    const hazards = parseHazards(payload.hazards);
    const photoReferences = parsePhotoReferences(payload.photoReferences);
    const documentReferences = parseDocumentReferences(payload.documentReferences);
    const sitePlanUpload = parseUpload(payload.sitePlanUpload);

    const sitePlanDocumentRevisionId = sitePlanUpload
      ? await createRevisionFromUpload({
        upload: sitePlanUpload,
        title: `${businessName || "Pre-Plan"} Site Plan`,
        category: "Department Documents",
        supabase,
        departmentId: currentMember.departmentId,
        memberId: currentMember.id,
      })
      : normalizeOptionalString(payload.sitePlanDocumentRevisionId);

    if (!businessName || !address || !city || !state || !zip) {
      return jsonResponse(
        {
          ok: false,
          error: "Business name, address, city, state, and ZIP are required.",
        },
        400,
      );
    }

    const { data, error } = await supabase
      .from("pre_plans")
      .insert({
        department_id: currentMember.departmentId,
        business_name: businessName,
        address,
        city,
        state,
        zip,
        business_phone: normalizeOptionalString(payload.businessPhone),
        occupancy_id_number: normalizeOptionalString(payload.occupancyIdNumber),
        property_owner_name: normalizeOptionalString(payload.propertyOwnerName),
        property_owner_phone: normalizeOptionalString(payload.propertyOwnerPhone),
        primary_contact_name: normalizeOptionalString(payload.primaryContactName),
        primary_contact_phone: normalizeOptionalString(payload.primaryContactPhone),
        secondary_contact_name: normalizeOptionalString(payload.secondaryContactName),
        secondary_contact_phone: normalizeOptionalString(payload.secondaryContactPhone),
        additional_comments: normalizeOptionalString(payload.additionalComments),
        normal_occupant_load: normalizeOptionalInteger(payload.normalOccupantLoad),
        special_needs_occupants: normalizeOptionalString(payload.specialNeedsOccupants),
        primary_apparatus_access: normalizeOptionalString(payload.primaryApparatusAccess),
        knox_box_details: normalizeOptionalString(payload.knoxBoxDetails),
        knox_box_location: normalizeOptionalString(payload.knoxBoxLocation),
        fdc_details: normalizeOptionalString(payload.fdcDetails),
        fdc_location: normalizeOptionalString(payload.fdcLocation),
        fdc_notes: normalizeOptionalString(payload.fdcNotes),
        other_water_supply_info: normalizeOptionalString(payload.otherWaterSupplyInfo),
        fire_alarm_details: normalizeOptionalString(payload.fireAlarmDetails),
        fire_alarm_panel_location: normalizeOptionalString(payload.fireAlarmPanelLocation),
        sprinkler_system_details: normalizeOptionalString(payload.sprinklerSystemDetails),
        riser_location: normalizeOptionalString(payload.riserLocation),
        fire_pump_details: normalizeOptionalString(payload.firePumpDetails),
        fire_pump_location: normalizeOptionalString(payload.firePumpLocation),
        standpipe_details: normalizeOptionalString(payload.standpipeDetails),
        standpipe_location: normalizeOptionalString(payload.standpipeLocation),
        electrical_shutoff: normalizeOptionalString(payload.electricalShutoff),
        electrical_shutoff_location: normalizeOptionalString(payload.electricalShutoffLocation),
        electrical_comments: normalizeOptionalString(payload.electricalComments),
        water_shutoff: normalizeOptionalString(payload.waterShutoff),
        water_shutoff_location: normalizeOptionalString(payload.waterShutoffLocation),
        water_comments: normalizeOptionalString(payload.waterComments),
        gas_shutoff: normalizeOptionalString(payload.gasShutoff),
        gas_shutoff_location: normalizeOptionalString(payload.gasShutoffLocation),
        gas_comments: normalizeOptionalString(payload.gasComments),
        critical_information: normalizeOptionalString(payload.criticalInformation),
        site_plan_document_revision_id: sitePlanDocumentRevisionId,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return jsonResponse({ ok: false, error: error?.message || "Unable to create pre-plan." }, 400);
    }

    const prePlanId = data.id;

    const hydrantRows = [] as Array<Record<string, unknown>>;
    for (const row of hydrants) {
      const hasContent = row.hydrantIdentifier || row.locationDescription || row.hydrantNotes || row.photoDocumentRevisionId || row.photoUpload;
      if (!hasContent) {
        continue;
      }

      const hydrantPhotoRevisionId = row.photoUpload
        ? await createRevisionFromUpload({
          upload: row.photoUpload,
          title: `${businessName || "Pre-Plan"} Hydrant Photo`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : row.photoDocumentRevisionId;

      hydrantRows.push({
        department_id: currentMember.departmentId,
        pre_plan_id: prePlanId,
        hydrant_identifier: row.hydrantIdentifier,
        location_description: row.locationDescription,
        hydrant_notes: row.hydrantNotes,
        photo_document_revision_id: hydrantPhotoRevisionId,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      });
    }

    if (hydrantRows.length > 0) {
      const { error: hydrantError } = await supabase
        .from("pre_plan_hydrants")
        .insert(hydrantRows);

      if (hydrantError) {
        return jsonResponse({ ok: false, error: hydrantError.message || "Unable to save hydrants." }, 400);
      }
    }

    const hazardRows = hazards
      .filter((row) => row.hazardType)
      .map((row) => row);

    const resolvedHazardRows = [] as Array<Record<string, unknown>>;
    for (const row of hazardRows) {
      const supportingRevisionId = row.supportingDocumentUpload
        ? await createRevisionFromUpload({
          upload: row.supportingDocumentUpload,
          title: `${businessName || "Pre-Plan"} Hazard Support`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : (row.sdsDocumentRevisionId || row.attachmentDocumentRevisionId);

      resolvedHazardRows.push({
        department_id: currentMember.departmentId,
        pre_plan_id: prePlanId,
        hazard_type: row.hazardType,
        location_description: row.locationDescription,
        quantity: row.quantity,
        description: row.description,
        attachment_document_revision_id: null,
        sds_document_revision_id: supportingRevisionId,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      });
    }

    if (resolvedHazardRows.length > 0) {
      const { error: hazardError } = await supabase
        .from("pre_plan_hazards")
        .insert(resolvedHazardRows);

      if (hazardError) {
        return jsonResponse({ ok: false, error: hazardError.message || "Unable to save hazards." }, 400);
      }
    }

    const photoRows = [] as Array<Record<string, unknown>>;
    for (const row of photoReferences) {
      if (!row.documentRevisionId && !row.photoUpload) {
        continue;
      }

      const photoRevisionId = row.photoUpload
        ? await createRevisionFromUpload({
          upload: row.photoUpload,
          title: `${businessName || "Pre-Plan"} Photo`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : row.documentRevisionId;

      photoRows.push({
        department_id: currentMember.departmentId,
        pre_plan_id: prePlanId,
        document_revision_id: photoRevisionId,
        link_type: "photo",
        notes: row.notes,
        related_component: row.relatedComponent,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      });
    }

    const documentRows = [] as Array<Record<string, unknown>>;
    for (const row of documentReferences) {
      if (!row.documentRevisionId && !row.documentUpload) {
        continue;
      }

      const documentRevisionId = row.documentUpload
        ? await createRevisionFromUpload({
          upload: row.documentUpload,
          title: `${businessName || "Pre-Plan"} Supporting Document`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : row.documentRevisionId;

      documentRows.push({
        department_id: currentMember.departmentId,
        pre_plan_id: prePlanId,
        document_revision_id: documentRevisionId,
        link_type: row.linkType,
        notes: row.notes,
        related_component: row.relatedComponent,
        created_by: currentMember.id,
        updated_by: currentMember.id,
      });
    }

    const linkRows = [...photoRows, ...documentRows];
    if (linkRows.length > 0) {
      const { error: linkError } = await supabase
        .from("pre_plan_document_links")
        .insert(linkRows);

      if (linkError) {
        return jsonResponse({ ok: false, error: linkError.message || "Unable to save reference materials." }, 400);
      }
    }

    return jsonResponse({ ok: true, prePlanId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create pre-plan.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
