import type { SupabaseClient } from "@supabase/supabase-js";
import type { CertificationCatalogRow } from "@/lib/credentials/facade";
import { EMS_CERTIFICATION_LEVELS, assertEmsLevelForTrack, isEmsCertificationLevel, type EmsCertificationLevel, type EmsTrack } from "@/lib/ems/requirements";

export type EmsCertificationSelection = {
  emsAuthority: EmsTrack | "";
  emsLevel: EmsCertificationLevel | "";
};

export function selectionFromCertification(
  certification: Pick<CertificationCatalogRow, "ems_authority" | "ems_certification_level"> | undefined,
): EmsCertificationSelection {
  return {
    emsAuthority: certification?.ems_authority ?? "",
    emsLevel: certification?.ems_certification_level ?? "",
  };
}

export function certificationMetadata(selection: EmsCertificationSelection) {
  if (!selection.emsAuthority && !selection.emsLevel) {
    return { ems_authority: null, ems_certification_level: null };
  }
  if (
    (selection.emsAuthority !== "iowa" && selection.emsAuthority !== "nremt") ||
    !isEmsCertificationLevel(selection.emsLevel)
  ) {
    throw new Error("Select both an EMS authority and certification level.");
  }
  assertEmsLevelForTrack(selection.emsAuthority, selection.emsLevel);
  return { ems_authority: selection.emsAuthority, ems_certification_level: selection.emsLevel };
}

export function defaultEmsCertificationName(selection: EmsCertificationSelection) {
  const metadata = certificationMetadata(selection);
  if (!metadata.ems_authority) return "";
  const level = EMS_CERTIFICATION_LEVELS.find((item) => item.code === metadata.ems_certification_level);
  if (!level) throw new Error("Select a valid EMS certification level.");
  return `${metadata.ems_authority === "iowa" ? "Iowa EMS" : "National Registry"} ${level.label}`;
}

export function assertEmsTrackLevelMatchesCredential(
  track: EmsTrack,
  level: EmsCertificationLevel,
  credentialLevel: EmsCertificationLevel | null,
) {
  assertEmsLevelForTrack(track, level);
  if (credentialLevel && level !== credentialLevel) {
    throw new Error(`The ${track === "iowa" ? "Iowa EMS" : "National Registry"} level must match the assigned certification. Change the authority and level in Personnel Certifications first.`);
  }
}

// Member edits select/reuse a catalog entry; they never reclassify a shared entry.
export async function resolveCertificationCatalogEntry(input: {
  supabase: SupabaseClient;
  departmentId: string;
  editorMemberId: string;
  catalog: CertificationCatalogRow[];
  selectedId: string | null;
  name: string;
  selection: EmsCertificationSelection;
}): Promise<CertificationCatalogRow> {
  const metadata = certificationMetadata(input.selection);
  const matchesMetadata = (row: CertificationCatalogRow) =>
    row.ems_authority === metadata.ems_authority && row.ems_certification_level === metadata.ems_certification_level;
  if (input.selectedId) {
    const selected = input.catalog.find((row) => row.id === input.selectedId);
    if (!selected) throw new Error("Selected certification is no longer available.");
    if (matchesMetadata(selected)) return selected;
  }

  const name = input.name.trim() || defaultEmsCertificationName(input.selection);
  if (!name) throw new Error("Enter a certification name or select a certification.");
  const existing = input.catalog.find((row) => row.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!matchesMetadata(existing)) {
      throw new Error("That certification name has different EMS authority/level metadata. Choose another name or correct the catalog entry in Settings.");
    }
    if (existing.active === false) throw new Error("This certification is inactive. Activate it in Settings before assigning it.");
    return existing;
  }
  if (!input.name.trim() && metadata.ems_authority) {
    const matching = input.catalog.find((row) => row.active !== false && matchesMetadata(row));
    if (matching) return matching;
  }

  const { data, error } = await input.supabase.from("certifications").insert({
    department_id: input.departmentId,
    name,
    active: true,
    ...metadata,
    created_by: input.editorMemberId,
    updated_by: input.editorMemberId,
  }).select("id, name, active, ems_authority, ems_certification_level").single();
  if (error || !data) throw new Error(error?.message || "Unable to create certification.");
  if (
    typeof data.id !== "string" ||
    data.ems_authority !== metadata.ems_authority ||
    data.ems_certification_level !== metadata.ems_certification_level
  ) {
    throw new Error("The saved certification did not retain the selected EMS authority and level.");
  }
  return { id: data.id, name, active: true, ...metadata };
}
