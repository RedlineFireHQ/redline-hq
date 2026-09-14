import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Camera,
  Droplets,
  Flame,
  Gauge,
  MapPinned,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import PageLayout from "@/components/layout/PageLayout";
import QuickViewBuildingIdentity from "@/components/pre-plans/QuickViewBuildingIdentity";
import QuickViewFindBar from "@/components/pre-plans/QuickViewFindBar";
import ArchivePrePlanControls from "@/components/pre-plans/ArchivePrePlanControls";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePrePlans } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PrePlanRecord = {
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
  fire_alarm_details: string | null;
  fire_alarm_panel_location: string | null;
  sprinkler_system_details: string | null;
  riser_location: string | null;
  fire_pump_details: string | null;
  fire_pump_location: string | null;
  standpipe_details: string | null;
  standpipe_location: string | null;
  fdc_details: string | null;
  fdc_location: string | null;
  fdc_notes: string | null;
  knox_box_details: string | null;
  knox_box_location: string | null;
  electrical_shutoff: string | null;
  electrical_shutoff_location: string | null;
  electrical_comments: string | null;
  water_shutoff: string | null;
  water_shutoff_location: string | null;
  water_comments: string | null;
  gas_shutoff: string | null;
  gas_shutoff_location: string | null;
  gas_comments: string | null;
  other_water_supply_info: string | null;
  critical_information: string | null;
  site_plan_document_revision_id: string | null;
  last_verified_at: string | null;
  last_verified_by: string | null;
  created_at: string;
  updated_at: string;
};

type HydrantRecord = {
  id: string;
  hydrant_identifier: string | null;
  location_description: string | null;
  hydrant_notes: string | null;
  photo_document_revision_id: string | null;
};

type HazardRecord = {
  id: string;
  hazard_type: string;
  location_description: string | null;
  quantity: string | null;
  description: string | null;
  attachment_document_revision_id: string | null;
  sds_document_revision_id: string | null;
};

type PrePlanDocumentLinkRecord = {
  id: string;
  link_type: string;
  related_hazard_id: string | null;
  related_hydrant_id: string | null;
  related_component: string | null;
  notes: string | null;
  document_revision_id: string;
};

type DocumentRevisionRecord = {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
};

type DocumentRecord = {
  id: string;
  title: string;
  category: string;
};

type MemberRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

interface PrePlanDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function asText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function categoryToSlug(category: string | null | undefined) {
  const normalized = asText(category);
  if (!normalized) {
    return null;
  }

  const map: Record<string, string> = {
    SOPs: "sops",
    "EMS Protocols": "ems-protocols",
    "City / Department Policies": "city-department-policies",
    "Mutual Aid Agreements": "mutual-aid-agreements",
    "Department Documents": "department-documents",
  };

  return map[normalized] ?? null;
}

function isImageFile(mimeType: string | null, fileName: string | null) {
  if (typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/")) {
    return true;
  }

  const normalizedName = typeof fileName === "string" ? fileName.trim().toLowerCase() : "";
  return normalizedName.endsWith(".jpg")
    || normalizedName.endsWith(".jpeg")
    || normalizedName.endsWith(".png")
    || normalizedName.endsWith(".webp")
    || normalizedName.endsWith(".gif");
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" - ");
}

function buildingFrontPhotoPriority(notes: string | null | undefined, relatedComponent: string | null | undefined) {
  const joined = `${asText(relatedComponent) ?? ""} ${asText(notes) ?? ""}`.toLowerCase();
  if (!joined) {
    return 0;
  }

  if (joined.includes("building front") || joined.includes("front exterior") || joined.includes("primary building")) {
    return 4;
  }
  if (joined.includes("front") || joined.includes("exterior") || joined.includes("alpha")) {
    return 3;
  }
  if (joined.includes("building") || joined.includes("occupancy") || joined.includes("main entrance")) {
    return 2;
  }
  if (joined.includes("photo")) {
    return 1;
  }

  return 0;
}

function TacticalZone({
  title,
  icon,
  accent,
  children,
  searchId,
  searchPriority,
  searchTerms,
  searchKind = "card",
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
  searchId?: string;
  searchPriority?: number;
  searchTerms?: string;
  searchKind?: "section" | "card" | "detail";
}) {
  return (
    <section
      id={searchId}
      data-quick-view-search-target="true"
      data-quick-view-search-priority={searchPriority}
      data-quick-view-search-kind={searchKind}
      data-quick-view-search-text={searchTerms}
      className="rounded-2xl border border-white/10 bg-[#101010] p-4 transition-[box-shadow,background-color] duration-300 md:p-5"
    >
      <div className={`mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] ${accent}`}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function BriefLine({
  title,
  detail,
  searchId,
  searchPriority,
}: {
  title: string;
  detail: string;
  searchId?: string;
  searchPriority?: number;
}) {
  return (
    <div
      id={searchId}
      data-quick-view-search-target="true"
      data-quick-view-search-priority={searchPriority}
      data-quick-view-search-kind="detail"
      data-quick-view-search-text={`${title} ${detail}`}
      className="border-b border-white/10 pb-2 transition-[box-shadow,background-color] duration-300 last:border-b-0 last:pb-0"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{title}</p>
      <p className="mt-1.5 text-[15px] leading-6 text-white md:text-base">{detail}</p>
    </div>
  );
}

export default async function PrePlanDetailPage({ params }: PrePlanDetailPageProps) {
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
      "id, business_name, address, city, state, zip, business_phone, occupancy_id_number, property_owner_name, property_owner_phone, primary_contact_name, primary_contact_phone, secondary_contact_name, secondary_contact_phone, additional_comments, normal_occupant_load, special_needs_occupants, primary_apparatus_access, fire_alarm_details, fire_alarm_panel_location, sprinkler_system_details, riser_location, fire_pump_details, fire_pump_location, standpipe_details, standpipe_location, fdc_details, fdc_location, fdc_notes, knox_box_details, knox_box_location, electrical_shutoff, electrical_shutoff_location, electrical_comments, water_shutoff, water_shutoff_location, water_comments, gas_shutoff, gas_shutoff_location, gas_comments, other_water_supply_info, critical_information, site_plan_document_revision_id, last_verified_at, last_verified_by, created_at, updated_at",
    )
    .eq("id", id)
    .eq("department_id", departmentId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const record = data as PrePlanRecord;
  const canManagePrePlansForDepartment = await canManagePrePlans(
    supabase,
    departmentId,
    currentMember?.role,
  );

  const [hydrantResult, hazardResult, documentLinkResult] = await Promise.all([
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
      .select("id, link_type, related_hazard_id, related_hydrant_id, related_component, notes, document_revision_id")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
  ]);

  const hydrants = (hydrantResult.data ?? []) as HydrantRecord[];
  const hazards = ((hazardResult.data ?? []) as HazardRecord[]).filter((hazard) => asText(hazard.hazard_type));
  const documentLinks = (documentLinkResult.data ?? []) as PrePlanDocumentLinkRecord[];

  const revisionIdSet = new Set<string>();

  if (record.site_plan_document_revision_id) {
    revisionIdSet.add(record.site_plan_document_revision_id);
  }

  for (const row of hydrants) {
    if (row.photo_document_revision_id) {
      revisionIdSet.add(row.photo_document_revision_id);
    }
  }

  for (const row of hazards) {
    if (row.attachment_document_revision_id) {
      revisionIdSet.add(row.attachment_document_revision_id);
    }
    if (row.sds_document_revision_id) {
      revisionIdSet.add(row.sds_document_revision_id);
    }
  }

  for (const row of documentLinks) {
    revisionIdSet.add(row.document_revision_id);
  }

  const revisionIds = Array.from(revisionIdSet);
  let revisions: DocumentRevisionRecord[] = [];

  if (revisionIds.length > 0) {
    const { data: revisionRows } = await supabase
      .from("document_revisions")
      .select("id, document_id, file_name, file_path, mime_type")
      .eq("department_id", departmentId)
      .in("id", revisionIds);

    revisions = (revisionRows ?? []) as DocumentRevisionRecord[];
  }

  const documentIds = Array.from(
    new Set(
      revisions
        .map((row) => row.document_id)
        .filter((row): row is string => typeof row === "string" && row.length > 0),
    ),
  );

  let documents: DocumentRecord[] = [];
  if (documentIds.length > 0) {
    const { data: documentRows } = await supabase
      .from("documents")
      .select("id, title, category")
      .eq("department_id", departmentId)
      .in("id", documentIds);

    documents = (documentRows ?? []) as DocumentRecord[];
  }

  let verifiedByMember: MemberRecord | null = null;
  if (record.last_verified_by) {
    const { data: memberRow } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("department_id", departmentId)
      .eq("id", record.last_verified_by)
      .maybeSingle();

    verifiedByMember = (memberRow as MemberRecord | null) ?? null;
  }

  const revisionById = new Map(revisions.map((row) => [row.id, row]));
  const documentById = new Map(documents.map((row) => [row.id, row]));
  const signedUrlByRevisionId = new Map<string, string>();

  await Promise.all(
    revisions.map(async (revision) => {
      const filePath = asText(revision.file_path);
      if (!filePath) {
        return;
      }

      const { data: signedData } = await supabase.storage
        .from("department-documents")
        .createSignedUrl(filePath, 60 * 60);

      if (signedData?.signedUrl) {
        signedUrlByRevisionId.set(revision.id, signedData.signedUrl);
      }
    }),
  );

  const resolveDocumentRouteHref = (revisionId: string | null) => {
    if (!revisionId) {
      return null;
    }

    const revision = revisionById.get(revisionId);
    if (!revision) {
      return null;
    }

    const document = documentById.get(revision.document_id);
    if (!document) {
      return null;
    }

    const slug = categoryToSlug(document.category);
    if (!slug) {
      return null;
    }

    return `/documents/${slug}/${document.id}`;
  };

  const resolveAttachmentHref = (revisionId: string | null) => {
    if (!revisionId) {
      return null;
    }

    return resolveDocumentRouteHref(revisionId) ?? signedUrlByRevisionId.get(revisionId) ?? null;
  };

  const resolveImageHref = (revisionId: string | null) => {
    if (!revisionId) {
      return null;
    }

    return signedUrlByRevisionId.get(revisionId) ?? null;
  };

  const fullAddress = [asText(record.address), asText(record.city), asText(record.state), asText(record.zip)]
    .filter(Boolean)
    .join(", ");

  const lastVerifiedDate = formatDate(record.last_verified_at);
  const verifiedByName = verifiedByMember
    ? [asText(verifiedByMember.first_name), asText(verifiedByMember.last_name)].filter(Boolean).join(" ")
    : null;

  const criticalInformation = asText(record.critical_information);

  const accessRows = [
    asText(record.primary_apparatus_access)
      ? { label: "Primary Access", value: asText(record.primary_apparatus_access) as string }
      : null,
    asText(record.knox_box_details) || asText(record.knox_box_location)
      ? {
        label: "Knox Box",
        value: joinParts([asText(record.knox_box_details), asText(record.knox_box_location)]),
      }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const waterRows = [
    asText(record.fdc_details) || asText(record.fdc_location) || asText(record.fdc_notes)
      ? {
        label: "FDC",
        value: joinParts([asText(record.fdc_details), asText(record.fdc_location), asText(record.fdc_notes)]),
      }
      : null,
    asText(record.other_water_supply_info)
      ? { label: "Other Water", value: asText(record.other_water_supply_info) as string }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const hydrantRows = hydrants
    .map((hydrant, index) => {
      const parts = [
        asText(hydrant.hydrant_identifier) ? `ID ${asText(hydrant.hydrant_identifier)}` : null,
        asText(hydrant.location_description),
      ].filter(Boolean);

      if (parts.length === 0) {
        return null;
      }

      return {
        id: hydrant.id,
        label: `Hydrant ${index + 1}`,
        value: parts.join(" - "),
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; value: string }>;

  const fireProtectionRows = [
    asText(record.sprinkler_system_details)
      ? { label: "Sprinkler", value: asText(record.sprinkler_system_details) as string }
      : null,
    asText(record.riser_location) ? { label: "Riser", value: asText(record.riser_location) as string } : null,
    asText(record.fire_alarm_details)
      ? { label: "Fire Alarm", value: asText(record.fire_alarm_details) as string }
      : null,
    asText(record.fire_alarm_panel_location)
      ? { label: "Panel / Annunciator", value: asText(record.fire_alarm_panel_location) as string }
      : null,
    asText(record.standpipe_details)
      ? { label: "Standpipe", value: asText(record.standpipe_details) as string }
      : null,
    asText(record.fire_pump_details) || asText(record.fire_pump_location)
      ? {
        label: "Fire Pump",
        value: joinParts([asText(record.fire_pump_details), asText(record.fire_pump_location)]),
      }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const utilities = [
    {
      title: "Electrical",
      values: [
        asText(record.electrical_shutoff),
        asText(record.electrical_shutoff_location),
        asText(record.electrical_comments),
      ].filter(Boolean) as string[],
    },
    {
      title: "Water",
      values: [
        asText(record.water_shutoff),
        asText(record.water_shutoff_location),
        asText(record.water_comments),
      ].filter(Boolean) as string[],
    },
    {
      title: "Gas",
      values: [
        asText(record.gas_shutoff),
        asText(record.gas_shutoff_location),
        asText(record.gas_comments),
      ].filter(Boolean) as string[],
    },
  ].filter((group) => group.values.length > 0);

  const lifeSafetyRows = [
    typeof record.normal_occupant_load === "number"
      ? { label: "Occupant Load", value: String(record.normal_occupant_load) }
      : null,
    asText(record.special_needs_occupants)
      ? { label: "Special Needs", value: asText(record.special_needs_occupants) as string }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const photoRevisionIdSet = new Set<string>();
  for (const row of documentLinks) {
    if (row.link_type === "photo") {
      photoRevisionIdSet.add(row.document_revision_id);
    }
  }
  for (const row of hydrants) {
    if (row.photo_document_revision_id) {
      photoRevisionIdSet.add(row.photo_document_revision_id);
    }
  }
  for (const row of hazards) {
    if (row.attachment_document_revision_id) {
      const revision = revisionById.get(row.attachment_document_revision_id);
      if (revision && isImageFile(revision.mime_type, revision.file_name)) {
        photoRevisionIdSet.add(row.attachment_document_revision_id);
      }
    }
  }

  const photoRevisionIds = Array.from(photoRevisionIdSet);
  const photoCount = photoRevisionIds.length;
  const firstPhotoHref = photoRevisionIds.length > 0 ? resolveAttachmentHref(photoRevisionIds[0]) : null;
  const firstPhotoPreviewHref = photoRevisionIds.length > 0 ? resolveImageHref(photoRevisionIds[0]) : null;

  const prePlanPhotoLinks = documentLinks.filter(
    (row) => row.link_type === "photo" && !row.related_hazard_id && !row.related_hydrant_id,
  );

  const buildingFrontPhotoRevisionId = (() => {
    const explicit = prePlanPhotoLinks.find((row) => {
      const revision = revisionById.get(row.document_revision_id);
      return row.related_component === "building_front"
        && Boolean(revision)
        && Boolean(revision && isImageFile(revision.mime_type, revision.file_name));
    });

    if (explicit) {
      return explicit.document_revision_id;
    }

    const candidates = prePlanPhotoLinks
      .map((row, index) => {
        const revision = revisionById.get(row.document_revision_id);
        if (!revision || !isImageFile(revision.mime_type, revision.file_name)) {
          return null;
        }

        return {
          revisionId: row.document_revision_id,
          priority: buildingFrontPhotoPriority(row.notes, row.related_component),
          index,
        };
      })
      .filter(Boolean) as Array<{ revisionId: string; priority: number; index: number }>;

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.index - b.index;
    });

    return candidates[0]?.revisionId ?? null;
  })();

  const buildingFrontPhotoHref = resolveImageHref(buildingFrontPhotoRevisionId);

  const sitePlanRevisionId = record.site_plan_document_revision_id
    ?? documentLinks.find((row) => row.link_type === "site_plan")?.document_revision_id
    ?? null;
  const sitePlanHref = resolveAttachmentHref(sitePlanRevisionId);

  const hasAccess = accessRows.length > 0;
  const hasWater = waterRows.length > 0 || hydrantRows.length > 0;
  const hasFireProtection = fireProtectionRows.length > 0;
  const hasUtilities = utilities.length > 0;
  const hasLifeSafety = lifeSafetyRows.length > 0;
  const hasPhotos = Boolean(firstPhotoHref) && photoCount > 0;
  const criticalHazard = hazards[0]
    ? {
      title: hazards[0].hazard_type,
      summary: joinParts([asText(hazards[0].location_description), asText(hazards[0].quantity)]),
      description: asText(hazards[0].description),
    }
    : null;
  const hasCriticalSection = Boolean(criticalInformation || criticalHazard);

  return (
    <PageLayout>
      <div className="mx-auto max-w-7xl space-y-4" data-quick-view-root="true">
        <section className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/pre-plans"
                className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:bg-neutral-800"
              >
                Back
              </Link>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-neutral-300">
                Pre-Plan <span className="text-red-400">Quick View</span>
              </p>
            </div>

              <ArchivePrePlanControls
                prePlanId={record.id}
                prePlanName={record.business_name}
                canManage={canManagePrePlansForDepartment}
              />
            <QuickViewFindBar />
          </div>
        </section>

        <QuickViewBuildingIdentity
          prePlanId={record.id}
          businessName={record.business_name}
          fullAddress={fullAddress || null}
          occupancyId={asText(record.occupancy_id_number)}
          buildingFrontPhotoHref={buildingFrontPhotoHref}
          lastVerifiedDate={lastVerifiedDate}
          verifiedByName={verifiedByName}
        />

        {hasCriticalSection ? (
          <section
            id="critical-information"
            data-quick-view-search-target="true"
            data-quick-view-search-priority={100}
            data-quick-view-search-kind="section"
            className="rounded-2xl border border-red-500/50 bg-[linear-gradient(180deg,rgba(120,15,15,0.35)_0%,rgba(34,8,8,0.8)_100%)] p-4 transition-[box-shadow,background-color] duration-300 md:p-5"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-300" />
              <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-red-200">Critical Information</h2>
            </div>
            {criticalInformation ? <p className="mt-2 text-base leading-7 text-red-100 md:text-lg">{criticalInformation}</p> : null}
            {criticalHazard ? (
              <div
                id="hazards"
                data-quick-view-search-target="true"
                data-quick-view-search-priority={95}
                data-quick-view-search-kind="detail"
                data-quick-view-search-text={joinParts([criticalHazard.title, criticalHazard.summary, criticalHazard.description])}
                className="mt-4 rounded-xl border border-red-400/30 bg-[#2a1212] px-4 py-3 transition-[box-shadow,background-color] duration-300"
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-red-200 md:text-sm">Hazards</p>
                <p className="mt-1.5 text-[15px] leading-6 text-red-100 md:text-base">
                  {joinParts([criticalHazard.title, criticalHazard.summary])}
                </p>
                {criticalHazard.description ? <p className="mt-1 text-[15px] leading-6 text-red-100 md:text-base">{criticalHazard.description}</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-red-400" />
            <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-neutral-200">Primary Tactical Brief</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {hasAccess ? (
              <TacticalZone title="Access" icon={<Gauge className="h-4 w-4 text-red-400" />} accent="text-red-300" searchId="access" searchPriority={80}>
                <div className="space-y-2.5">
                  {accessRows.map((row) => (
                    <BriefLine key={row.label} title={row.label} detail={row.value} searchId={`access-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} searchPriority={81} />
                  ))}
                </div>
              </TacticalZone>
            ) : null}

            {hasWater ? (
              <TacticalZone title="Water Supply" icon={<Droplets className="h-4 w-4 text-sky-400" />} accent="text-sky-300" searchId="water-supply" searchPriority={70}>
                <div className="space-y-2.5">
                  {waterRows.map((row) => (
                    <BriefLine key={row.label} title={row.label} detail={row.value} searchId={`water-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} searchPriority={71} />
                  ))}
                  {hydrantRows.slice(0, 4).map((row) => (
                    <BriefLine key={row.id} title={row.label} detail={row.value} searchId={`hydrant-${row.id}`} searchPriority={71} />
                  ))}
                </div>
              </TacticalZone>
            ) : null}

            {hasFireProtection ? (
              <TacticalZone title="Fire Protection" icon={<Flame className="h-4 w-4 text-red-400" />} accent="text-red-300" searchId="fire-protection" searchPriority={60}>
                <div className="space-y-2.5">
                  {fireProtectionRows.map((row) => (
                    <BriefLine key={row.label} title={row.label} detail={row.value} searchId={`fire-protection-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} searchPriority={61} />
                  ))}
                </div>
              </TacticalZone>
            ) : null}

            {(hasUtilities || hasLifeSafety) ? (
              <div className="space-y-4">
                {hasUtilities ? (
                  <TacticalZone title="Utilities" icon={<Wrench className="h-4 w-4 text-amber-300" />} accent="text-amber-300" searchId="utilities" searchPriority={50}>
                    <div className="space-y-2.5">
                      {utilities.map((group) => (
                        <BriefLine key={group.title} title={`${group.title} Shutoff`} detail={group.values.join(" - ")} searchId={`utilities-${group.title.toLowerCase()}`} searchPriority={51} />
                      ))}
                    </div>
                  </TacticalZone>
                ) : null}

                {hasLifeSafety ? (
                  <TacticalZone title="Life Safety" icon={<Users className="h-4 w-4 text-violet-300" />} accent="text-violet-300" searchId="life-safety" searchPriority={40}>
                    <div className="space-y-2.5">
                      {lifeSafetyRows.map((row) => (
                        <BriefLine key={row.label} title={row.label} detail={row.value} searchId={`life-safety-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} searchPriority={41} />
                      ))}
                    </div>
                  </TacticalZone>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="site-reference-materials"
          data-quick-view-search-target="true"
          data-quick-view-search-priority={30}
          data-quick-view-search-kind="section"
          className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4 transition-[box-shadow,background-color] duration-300 md:p-5"
        >
            <div className="mb-4 flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-emerald-300" />
              <h2 className="text-base font-semibold uppercase tracking-[0.16em] text-neutral-200">Site &amp; Reference Materials</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <TacticalZone title="Site Maps & Diagrams" icon={<MapPinned className="h-4 w-4 text-emerald-400" />} accent="text-emerald-300" searchId="site-maps-diagrams" searchPriority={29}>
                {sitePlanHref ? (
                  <a
                    href={sitePlanHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-between rounded-lg border border-white/15 bg-[#171717] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#202020]"
                  >
                    <span>View Site Plan</span>
                    <span className="text-neutral-400">Open</span>
                  </a>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 bg-[#171717] px-3 py-3 text-[15px] leading-6 text-neutral-400 md:text-base">
                    No Site Map Attached
                  </div>
                )}
              </TacticalZone>

              {hasPhotos ? (
                <TacticalZone title="Photos" icon={<Camera className="h-4 w-4 text-indigo-300" />} accent="text-indigo-300" searchId="photos" searchPriority={28}>
                  <div className="space-y-3">
                    {firstPhotoPreviewHref && firstPhotoHref ? (
                      <a href={firstPhotoHref} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={firstPhotoPreviewHref}
                          alt="Pre-plan photo preview"
                          className="h-24 w-full rounded-lg border border-white/10 object-cover"
                        />
                      </a>
                    ) : null}
                    <a
                      href={firstPhotoHref as string}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-between rounded-lg border border-white/15 bg-[#171717] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#202020]"
                    >
                      <span>View Photos</span>
                      <span className="text-neutral-400">({photoCount})</span>
                    </a>
                  </div>
                </TacticalZone>
              ) : (
                <TacticalZone title="Photos" icon={<Camera className="h-4 w-4 text-indigo-300" />} accent="text-indigo-300" searchId="photos" searchPriority={28}>
                  <div className="rounded-lg border border-dashed border-white/10 bg-[#171717] px-3 py-3 text-[15px] leading-6 text-neutral-400 md:text-base">
                    No Photos Attached
                  </div>
                </TacticalZone>
              )}
            </div>
          </section>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Need more detail?</p>
              <p className="text-sm text-neutral-400">Open the complete pre-plan with all notes and detailed information.</p>
            </div>

            <Link
              href={`/pre-plans/${record.id}/full`}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/50 bg-red-600 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-red-700"
            >
              View Full Pre-Plan
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
