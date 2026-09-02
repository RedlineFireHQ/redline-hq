import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UpdatePrePlanPayload = {
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

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return jsonResponse({ ok: false, error: "Pre-plan id is required." }, 400);
    }

    const payload = (await request.json()) as UpdatePrePlanPayload;
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
      .update({
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
        updated_by: currentMember.id,
      })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .select("id")
      .single();

    if (error || !data?.id) {
      return jsonResponse({ ok: false, error: error?.message || "Unable to update pre-plan." }, 400);
    }

    const prePlanId = data.id;

    const { data: existingHydrantRows, error: existingHydrantsError } = await supabase
      .from("pre_plan_hydrants")
      .select("id")
      .eq("department_id", currentMember.departmentId)
      .eq("pre_plan_id", prePlanId);

    if (existingHydrantsError) {
      return jsonResponse({ ok: false, error: existingHydrantsError.message || "Unable to load hydrants." }, 400);
    }

    const existingHydrantIds = new Set((existingHydrantRows ?? []).map((row) => row.id));
    const incomingHydrantIds = new Set(hydrants.map((row) => row.id).filter((row): row is string => Boolean(row)));
    const hydrantIdsToDelete = Array.from(existingHydrantIds).filter((row) => !incomingHydrantIds.has(row));

    if (hydrantIdsToDelete.length > 0) {
      const { error: deleteHydrantError } = await supabase
        .from("pre_plan_hydrants")
        .delete()
        .eq("department_id", currentMember.departmentId)
        .eq("pre_plan_id", prePlanId)
        .in("id", hydrantIdsToDelete);

      if (deleteHydrantError) {
        return jsonResponse({ ok: false, error: deleteHydrantError.message || "Unable to delete hydrants." }, 400);
      }
    }

    for (const hydrant of hydrants) {
      const hasContent = Boolean(
        hydrant.hydrantIdentifier || hydrant.locationDescription || hydrant.hydrantNotes || hydrant.photoDocumentRevisionId || hydrant.photoUpload,
      );

      if (!hasContent) {
        continue;
      }

      const hydrantPhotoRevisionId = hydrant.photoUpload
        ? await createRevisionFromUpload({
          upload: hydrant.photoUpload,
          title: `${businessName || "Pre-Plan"} Hydrant Photo`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : hydrant.photoDocumentRevisionId;

      if (hydrant.id && existingHydrantIds.has(hydrant.id)) {
        const { error: updateHydrantError } = await supabase
          .from("pre_plan_hydrants")
          .update({
            hydrant_identifier: hydrant.hydrantIdentifier,
            location_description: hydrant.locationDescription,
            hydrant_notes: hydrant.hydrantNotes,
            photo_document_revision_id: hydrantPhotoRevisionId,
            updated_by: currentMember.id,
          })
          .eq("department_id", currentMember.departmentId)
          .eq("pre_plan_id", prePlanId)
          .eq("id", hydrant.id);

        if (updateHydrantError) {
          return jsonResponse({ ok: false, error: updateHydrantError.message || "Unable to update hydrant." }, 400);
        }
      } else {
        const { error: insertHydrantError } = await supabase
          .from("pre_plan_hydrants")
          .insert({
            department_id: currentMember.departmentId,
            pre_plan_id: prePlanId,
            hydrant_identifier: hydrant.hydrantIdentifier,
            location_description: hydrant.locationDescription,
            hydrant_notes: hydrant.hydrantNotes,
            photo_document_revision_id: hydrantPhotoRevisionId,
            created_by: currentMember.id,
            updated_by: currentMember.id,
          });

        if (insertHydrantError) {
          return jsonResponse({ ok: false, error: insertHydrantError.message || "Unable to insert hydrant." }, 400);
        }
      }
    }

    const { data: existingHazardRows, error: existingHazardsError } = await supabase
      .from("pre_plan_hazards")
      .select("id")
      .eq("department_id", currentMember.departmentId)
      .eq("pre_plan_id", prePlanId);

    if (existingHazardsError) {
      return jsonResponse({ ok: false, error: existingHazardsError.message || "Unable to load hazards." }, 400);
    }

    const existingHazardIds = new Set((existingHazardRows ?? []).map((row) => row.id));
    const incomingHazardIds = new Set(hazards.map((row) => row.id).filter((row): row is string => Boolean(row)));
    const hazardIdsToDelete = Array.from(existingHazardIds).filter((row) => !incomingHazardIds.has(row));

    if (hazardIdsToDelete.length > 0) {
      const { error: deleteHazardError } = await supabase
        .from("pre_plan_hazards")
        .delete()
        .eq("department_id", currentMember.departmentId)
        .eq("pre_plan_id", prePlanId)
        .in("id", hazardIdsToDelete);

      if (deleteHazardError) {
        return jsonResponse({ ok: false, error: deleteHazardError.message || "Unable to delete hazards." }, 400);
      }
    }

    for (const hazard of hazards) {
      if (!hazard.hazardType) {
        continue;
      }

      const supportingRevisionId = hazard.supportingDocumentUpload
        ? await createRevisionFromUpload({
          upload: hazard.supportingDocumentUpload,
          title: `${businessName || "Pre-Plan"} Hazard Support`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : (hazard.sdsDocumentRevisionId || hazard.attachmentDocumentRevisionId);

      if (hazard.id && existingHazardIds.has(hazard.id)) {
        const { error: updateHazardError } = await supabase
          .from("pre_plan_hazards")
          .update({
            hazard_type: hazard.hazardType,
            location_description: hazard.locationDescription,
            quantity: hazard.quantity,
            description: hazard.description,
            attachment_document_revision_id: null,
            sds_document_revision_id: supportingRevisionId,
            updated_by: currentMember.id,
          })
          .eq("department_id", currentMember.departmentId)
          .eq("pre_plan_id", prePlanId)
          .eq("id", hazard.id);

        if (updateHazardError) {
          return jsonResponse({ ok: false, error: updateHazardError.message || "Unable to update hazard." }, 400);
        }
      } else {
        const { error: insertHazardError } = await supabase
          .from("pre_plan_hazards")
          .insert({
            department_id: currentMember.departmentId,
            pre_plan_id: prePlanId,
            hazard_type: hazard.hazardType,
            location_description: hazard.locationDescription,
            quantity: hazard.quantity,
            description: hazard.description,
            attachment_document_revision_id: null,
            sds_document_revision_id: supportingRevisionId,
            created_by: currentMember.id,
            updated_by: currentMember.id,
          });

        if (insertHazardError) {
          return jsonResponse({ ok: false, error: insertHazardError.message || "Unable to insert hazard." }, 400);
        }
      }
    }

    const { data: existingLinkRows, error: existingLinksError } = await supabase
      .from("pre_plan_document_links")
      .select("id, link_type")
      .eq("department_id", currentMember.departmentId)
      .eq("pre_plan_id", prePlanId)
      .is("related_hazard_id", null)
      .is("related_hydrant_id", null)
      .or("link_type.eq.photo,link_type.eq.document,link_type.eq.other,link_type.eq.floor_plan,link_type.eq.building_plan,link_type.eq.sds_msds");

    if (existingLinksError) {
      return jsonResponse({ ok: false, error: existingLinksError.message || "Unable to load reference links." }, 400);
    }

    const existingLinkIds = new Set((existingLinkRows ?? []).map((row) => row.id));
    const incomingLinkIds = new Set([
      ...photoReferences.map((row) => row.id),
      ...documentReferences.map((row) => row.id),
    ].filter((row): row is string => Boolean(row)));

    const linkIdsToDelete = Array.from(existingLinkIds).filter((row) => !incomingLinkIds.has(row));

    if (linkIdsToDelete.length > 0) {
      const { error: deleteLinksError } = await supabase
        .from("pre_plan_document_links")
        .delete()
        .eq("department_id", currentMember.departmentId)
        .eq("pre_plan_id", prePlanId)
        .in("id", linkIdsToDelete);

      if (deleteLinksError) {
        return jsonResponse({ ok: false, error: deleteLinksError.message || "Unable to delete reference links." }, 400);
      }
    }

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

      if (row.id && existingLinkIds.has(row.id)) {
        const { error: updatePhotoLinkError } = await supabase
          .from("pre_plan_document_links")
          .update({
            document_revision_id: photoRevisionId,
            link_type: "photo",
            notes: row.notes,
            related_component: row.relatedComponent,
            updated_by: currentMember.id,
          })
          .eq("department_id", currentMember.departmentId)
          .eq("pre_plan_id", prePlanId)
          .eq("id", row.id);

        if (updatePhotoLinkError) {
          return jsonResponse({ ok: false, error: updatePhotoLinkError.message || "Unable to update photo link." }, 400);
        }
      } else {
        const { error: insertPhotoLinkError } = await supabase
          .from("pre_plan_document_links")
          .insert({
            department_id: currentMember.departmentId,
            pre_plan_id: prePlanId,
            document_revision_id: photoRevisionId,
            link_type: "photo",
            notes: row.notes,
            related_component: row.relatedComponent,
            created_by: currentMember.id,
            updated_by: currentMember.id,
          });

        if (insertPhotoLinkError) {
          return jsonResponse({ ok: false, error: insertPhotoLinkError.message || "Unable to insert photo link." }, 400);
        }
      }
    }

    for (const row of documentReferences) {
      if (!row.documentRevisionId && !row.documentUpload) {
        continue;
      }

      const uploadedDocumentRevisionId = row.documentUpload
        ? await createRevisionFromUpload({
          upload: row.documentUpload,
          title: `${businessName || "Pre-Plan"} Supporting Document`,
          category: "Department Documents",
          supabase,
          departmentId: currentMember.departmentId,
          memberId: currentMember.id,
        })
        : row.documentRevisionId;

      const normalizedType = row.linkType && MANAGED_DOCUMENT_LINK_TYPES.has(row.linkType)
        ? row.linkType
        : "document";

      if (row.id && existingLinkIds.has(row.id)) {
        const { error: updateDocumentLinkError } = await supabase
          .from("pre_plan_document_links")
          .update({
            document_revision_id: uploadedDocumentRevisionId,
            link_type: normalizedType,
            notes: row.notes,
            related_component: row.relatedComponent,
            updated_by: currentMember.id,
          })
          .eq("department_id", currentMember.departmentId)
          .eq("pre_plan_id", prePlanId)
          .eq("id", row.id);

        if (updateDocumentLinkError) {
          return jsonResponse({ ok: false, error: updateDocumentLinkError.message || "Unable to update document link." }, 400);
        }
      } else {
        const { error: insertDocumentLinkError } = await supabase
          .from("pre_plan_document_links")
          .insert({
            department_id: currentMember.departmentId,
            pre_plan_id: prePlanId,
            document_revision_id: uploadedDocumentRevisionId,
            link_type: normalizedType,
            notes: row.notes,
            related_component: row.relatedComponent,
            created_by: currentMember.id,
            updated_by: currentMember.id,
          });

        if (insertDocumentLinkError) {
          return jsonResponse({ ok: false, error: insertDocumentLinkError.message || "Unable to insert document link." }, 400);
        }
      }
    }

    return jsonResponse({ ok: true, prePlanId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update pre-plan.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
