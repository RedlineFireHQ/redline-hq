import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import PrePlanForm, {
  type DocumentReferenceInitialValue,
  type DocumentRevisionOption,
  type HazardInitialValue,
  type HydrantInitialValue,
  type PhotoReferenceInitialValue,
} from "@/components/pre-plans/PrePlanForm";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PrePlanEditRecord = {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  business_phone: string | null;
  occupancy_id_number: string | null;
  property_owner_name: string | null;
  property_owner_phone: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  secondary_contact_name: string | null;
  secondary_contact_phone: string | null;
  additional_comments: string | null;
  normal_occupant_load: number | null;
  special_needs_occupants: string | null;
  primary_apparatus_access: string | null;
  knox_box_details: string | null;
  knox_box_location: string | null;
  fdc_details: string | null;
  fdc_location: string | null;
  fdc_notes: string | null;
  other_water_supply_info: string | null;
  fire_alarm_details: string | null;
  fire_alarm_panel_location: string | null;
  sprinkler_system_details: string | null;
  riser_location: string | null;
  fire_pump_details: string | null;
  fire_pump_location: string | null;
  standpipe_details: string | null;
  standpipe_location: string | null;
  electrical_shutoff: string | null;
  electrical_shutoff_location: string | null;
  electrical_comments: string | null;
  water_shutoff: string | null;
  water_shutoff_location: string | null;
  water_comments: string | null;
  gas_shutoff: string | null;
  gas_shutoff_location: string | null;
  gas_comments: string | null;
  critical_information: string | null;
  site_plan_document_revision_id: string | null;
};

type HydrantRow = {
  id: string;
  hydrant_identifier: string | null;
  location_description: string | null;
  hydrant_notes: string | null;
  photo_document_revision_id: string | null;
};

type HazardRow = {
  id: string;
  hazard_type: string;
  location_description: string | null;
  quantity: string | null;
  description: string | null;
  attachment_document_revision_id: string | null;
  sds_document_revision_id: string | null;
};

type DocumentLinkRow = {
  id: string;
  link_type: string;
  document_revision_id: string;
  notes: string | null;
  related_component: string | null;
  related_hazard_id: string | null;
  related_hydrant_id: string | null;
};

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

interface EditPrePlanPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPrePlanPage({ params }: EditPrePlanPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;

  if (!departmentId) {
    notFound();
  }

  const { data, error } = await supabase
    .from("pre_plans")
    .select(
      "id, business_name, address, city, state, zip, business_phone, occupancy_id_number, property_owner_name, property_owner_phone, primary_contact_name, primary_contact_phone, secondary_contact_name, secondary_contact_phone, additional_comments, normal_occupant_load, special_needs_occupants, primary_apparatus_access, knox_box_details, knox_box_location, fdc_details, fdc_location, fdc_notes, other_water_supply_info, fire_alarm_details, fire_alarm_panel_location, sprinkler_system_details, riser_location, fire_pump_details, fire_pump_location, standpipe_details, standpipe_location, electrical_shutoff, electrical_shutoff_location, electrical_comments, water_shutoff, water_shutoff_location, water_comments, gas_shutoff, gas_shutoff_location, gas_comments, critical_information, site_plan_document_revision_id",
    )
    .eq("id", id)
    .eq("department_id", departmentId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const record = data as PrePlanEditRecord;

  const [hydrantsResult, hazardsResult, linksResult, documentsResult, revisionsResult] = await Promise.all([
    supabase
      .from("pre_plan_hydrants")
      .select("id, hydrant_identifier, location_description, hydrant_notes, photo_document_revision_id")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("pre_plan_hazards")
      .select("id, hazard_type, location_description, quantity, description, attachment_document_revision_id, sds_document_revision_id")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("pre_plan_document_links")
      .select("id, link_type, document_revision_id, notes, related_component, related_hazard_id, related_hydrant_id")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
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

  const hydrants = (hydrantsResult.data ?? []) as HydrantRow[];
  const hazards = (hazardsResult.data ?? []) as HazardRow[];
  const links = (linksResult.data ?? []) as DocumentLinkRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const revisions = (revisionsResult.data ?? []) as RevisionRow[];

  const initialHydrants: HydrantInitialValue[] = hydrants.map((row) => ({
    id: row.id,
    hydrantIdentifier: row.hydrant_identifier,
    locationDescription: row.location_description,
    hydrantNotes: row.hydrant_notes,
    photoDocumentRevisionId: row.photo_document_revision_id,
  }));

  const initialHazards: HazardInitialValue[] = hazards.map((row) => ({
    id: row.id,
    hazardType: row.hazard_type,
    locationDescription: row.location_description,
    quantity: row.quantity,
    description: row.description,
    attachmentDocumentRevisionId: row.attachment_document_revision_id,
    sdsDocumentRevisionId: row.sds_document_revision_id,
  }));

  const initialPhotoReferences: PhotoReferenceInitialValue[] = links
    .filter((row) => row.link_type === "photo" && !row.related_hazard_id && !row.related_hydrant_id && row.related_component !== "building_front")
    .map((row) => ({
      id: row.id,
      documentRevisionId: row.document_revision_id,
      notes: row.notes,
      relatedComponent: row.related_component,
    }));

  const initialBuildingFrontPhoto: PhotoReferenceInitialValue | null = (() => {
    const row = links.find(
      (item) => item.link_type === "photo"
        && !item.related_hazard_id
        && !item.related_hydrant_id
        && item.related_component === "building_front",
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      documentRevisionId: row.document_revision_id,
      notes: row.notes,
      relatedComponent: row.related_component,
    };
  })();

  const initialDocumentReferences: DocumentReferenceInitialValue[] = links
    .filter((row) => row.link_type !== "photo" && row.link_type !== "site_plan" && !row.related_hazard_id && !row.related_hydrant_id)
    .map((row) => ({
      id: row.id,
      linkType: row.link_type as DocumentReferenceInitialValue["linkType"],
      documentRevisionId: row.document_revision_id,
      notes: row.notes,
      relatedComponent: row.related_component,
    }));

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
    <PageLayout>
      <PrePlanForm
        mode="edit"
        prePlanId={record.id}
        initialHydrants={initialHydrants}
        initialHazards={initialHazards}
        initialPhotoReferences={initialPhotoReferences}
        initialBuildingFrontPhoto={initialBuildingFrontPhoto}
        initialDocumentReferences={initialDocumentReferences}
        initialSitePlanDocumentRevisionId={record.site_plan_document_revision_id}
        documentRevisionOptions={documentRevisionOptions}
        initialValues={{
          businessName: record.business_name,
          address: record.address,
          city: record.city,
          state: record.state,
          zip: record.zip,
          businessPhone: record.business_phone ?? "",
          occupancyIdNumber: record.occupancy_id_number ?? "",
          propertyOwnerName: record.property_owner_name ?? "",
          propertyOwnerPhone: record.property_owner_phone ?? "",
          primaryContactName: record.primary_contact_name ?? "",
          primaryContactPhone: record.primary_contact_phone ?? "",
          secondaryContactName: record.secondary_contact_name ?? "",
          secondaryContactPhone: record.secondary_contact_phone ?? "",
          additionalComments: record.additional_comments ?? "",
          normalOccupantLoad: record.normal_occupant_load !== null ? String(record.normal_occupant_load) : "",
          specialNeedsOccupants: record.special_needs_occupants ?? "",
          primaryApparatusAccess: record.primary_apparatus_access ?? "",
          knoxBoxDetails: record.knox_box_details ?? "",
          knoxBoxLocation: record.knox_box_location ?? "",
          fdcDetails: record.fdc_details ?? "",
          fdcLocation: record.fdc_location ?? "",
          fdcNotes: record.fdc_notes ?? "",
          otherWaterSupplyInfo: record.other_water_supply_info ?? "",
          fireAlarmDetails: record.fire_alarm_details ?? "",
          fireAlarmPanelLocation: record.fire_alarm_panel_location ?? "",
          sprinklerSystemDetails: record.sprinkler_system_details ?? "",
          riserLocation: record.riser_location ?? "",
          firePumpDetails: record.fire_pump_details ?? "",
          firePumpLocation: record.fire_pump_location ?? "",
          standpipeDetails: record.standpipe_details ?? "",
          standpipeLocation: record.standpipe_location ?? "",
          electricalShutoff: record.electrical_shutoff ?? "",
          electricalShutoffLocation: record.electrical_shutoff_location ?? "",
          electricalComments: record.electrical_comments ?? "",
          waterShutoff: record.water_shutoff ?? "",
          waterShutoffLocation: record.water_shutoff_location ?? "",
          waterComments: record.water_comments ?? "",
          gasShutoff: record.gas_shutoff ?? "",
          gasShutoffLocation: record.gas_shutoff_location ?? "",
          gasComments: record.gas_comments ?? "",
          criticalInformation: record.critical_information ?? "",
        }}
      />
    </PageLayout>
  );
}
