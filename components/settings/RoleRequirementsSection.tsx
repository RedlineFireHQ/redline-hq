"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DepartmentRoleRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sort_order: number;
};

type CatalogItemRow = {
  id: string;
  name: string;
  active: boolean;
};

type RoleRequiredCertificationRow = {
  id: string;
  department_id: string;
  department_role_id: string;
  certification_id: string;
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

interface RoleRequirementsSectionProps {
  departmentId: string;
  currentMemberId: string;
  departmentRoles: DepartmentRoleRow[];
  certifications: CatalogItemRow[];
  qualifications: CatalogItemRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
}

function sortRoles(roles: DepartmentRoleRow[]) {
  return [...roles].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortCatalogItems(items: CatalogItemRow[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

export default function RoleRequirementsSection({
  departmentId,
  currentMemberId,
  departmentRoles,
  certifications,
  qualifications,
  roleRequiredCertifications,
  roleRequiredQualifications,
}: RoleRequirementsSectionProps) {
  const router = useRouter();
  const orderedRoles = useMemo(() => sortRoles(departmentRoles), [departmentRoles]);
  const activeCertifications = useMemo(
    () => sortCatalogItems(certifications.filter((item) => item.active !== false)),
    [certifications],
  );
  const activeQualifications = useMemo(
    () => sortCatalogItems(qualifications.filter((item) => item.active !== false)),
    [qualifications],
  );

  const certificationLookup = useMemo(
    () => new Map(certifications.map((item) => [item.id, item])),
    [certifications],
  );
  const qualificationLookup = useMemo(
    () => new Map(qualifications.map((item) => [item.id, item])),
    [qualifications],
  );
  const roleLookup = useMemo(() => new Map(orderedRoles.map((role) => [role.id, role])), [orderedRoles]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedCertificationId, setSelectedCertificationId] = useState<string>("");
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>("");

  const [certRequirements, setCertRequirements] = useState(roleRequiredCertifications);
  const [qualRequirements, setQualRequirements] = useState(roleRequiredQualifications);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [qualSaving, setQualSaving] = useState(false);
  const [removingCertificationId, setRemovingCertificationId] = useState<string | null>(null);
  const [removingQualificationId, setRemovingQualificationId] = useState<string | null>(null);

  const selectedRoleIdValue = orderedRoles.some((role) => role.id === selectedRoleId)
    ? selectedRoleId
    : (orderedRoles[0]?.id ?? "");
  const selectedRole = selectedRoleIdValue ? roleLookup.get(selectedRoleIdValue) ?? null : null;

  const visibleCertRequirements = useMemo(() => {
    return certRequirements
      .filter((row) => row.department_role_id === selectedRoleIdValue)
      .map((row) => ({
        ...row,
        certification: certificationLookup.get(row.certification_id) ?? null,
      }))
      .sort((left, right) => {
        const leftName = left.certification?.name ?? left.certification_id;
        const rightName = right.certification?.name ?? right.certification_id;
        return leftName.localeCompare(rightName);
      });
  }, [certRequirements, certificationLookup, selectedRoleIdValue]);

  const visibleQualRequirements = useMemo(() => {
    return qualRequirements
      .filter((row) => row.department_role_id === selectedRoleIdValue)
      .map((row) => ({
        ...row,
        qualification: qualificationLookup.get(row.qualification_id) ?? null,
      }))
      .sort((left, right) => {
        const leftName = left.qualification?.name ?? left.qualification_id;
        const rightName = right.qualification?.name ?? right.qualification_id;
        return leftName.localeCompare(rightName);
      });
  }, [qualRequirements, qualificationLookup, selectedRoleIdValue]);

  async function handleAddCertification() {
    setSaveError(null);
    setSaveSuccess(null);

    if (!selectedRoleIdValue) {
      setSaveError("Select a department role first.");
      return;
    }

    if (!selectedCertificationId) {
      setSaveError("Select a certification to require.");
      return;
    }

    const duplicateExists = certRequirements.some(
      (row) => row.department_role_id === selectedRoleIdValue && row.certification_id === selectedCertificationId,
    );

    if (duplicateExists) {
      setSaveError("That certification is already required for this role.");
      return;
    }

    setCertSaving(true);
    try {
      const { data, error } = await supabase
        .from("role_required_certifications")
        .insert({
          department_id: departmentId,
          department_role_id: selectedRoleIdValue,
          certification_id: selectedCertificationId,
          created_by: currentMemberId,
          updated_by: currentMemberId,
        })
        .select("id, department_id, department_role_id, certification_id, created_at, updated_at")
        .single();

      if (error || !data) {
        if (error?.code === "23505") {
          setSaveError("That certification is already required for this role.");
        } else {
          setSaveError(error?.message || "Unable to add required certification.");
        }
        return;
      }

      setCertRequirements((current) => [
        ...current,
        {
          id: String(data.id),
          department_id: typeof data.department_id === "string" ? data.department_id : departmentId,
          department_role_id: typeof data.department_role_id === "string" ? data.department_role_id : selectedRoleIdValue,
          certification_id: typeof data.certification_id === "string" ? data.certification_id : selectedCertificationId,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        },
      ]);
      setSelectedCertificationId("");
      setSaveSuccess("Required certification added.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to add required certification.");
    } finally {
      setCertSaving(false);
    }
  }

  async function handleRemoveCertification(rowId: string) {
    setSaveError(null);
    setSaveSuccess(null);
    setRemovingCertificationId(rowId);

    try {
      const { error } = await supabase
        .from("role_required_certifications")
        .delete()
        .eq("id", rowId)
        .eq("department_id", departmentId);

      if (error) {
        setSaveError(error.message || "Unable to remove required certification.");
        return;
      }

      setCertRequirements((current) => current.filter((row) => row.id !== rowId));
      setSaveSuccess("Required certification removed.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to remove required certification.");
    } finally {
      setRemovingCertificationId(null);
    }
  }

  async function handleAddQualification() {
    setSaveError(null);
    setSaveSuccess(null);

    if (!selectedRoleIdValue) {
      setSaveError("Select a department role first.");
      return;
    }

    if (!selectedQualificationId) {
      setSaveError("Select a qualification to require.");
      return;
    }

    const duplicateExists = qualRequirements.some(
      (row) => row.department_role_id === selectedRoleIdValue && row.qualification_id === selectedQualificationId,
    );

    if (duplicateExists) {
      setSaveError("That qualification is already required for this role.");
      return;
    }

    setQualSaving(true);
    try {
      const { data, error } = await supabase
        .from("role_required_qualifications")
        .insert({
          department_id: departmentId,
          department_role_id: selectedRoleIdValue,
          qualification_id: selectedQualificationId,
          created_by: currentMemberId,
          updated_by: currentMemberId,
        })
        .select("id, department_id, department_role_id, qualification_id, created_at, updated_at")
        .single();

      if (error || !data) {
        if (error?.code === "23505") {
          setSaveError("That qualification is already required for this role.");
        } else {
          setSaveError(error?.message || "Unable to add required qualification.");
        }
        return;
      }

      setQualRequirements((current) => [
        ...current,
        {
          id: String(data.id),
          department_id: typeof data.department_id === "string" ? data.department_id : departmentId,
          department_role_id: typeof data.department_role_id === "string" ? data.department_role_id : selectedRoleIdValue,
          qualification_id: typeof data.qualification_id === "string" ? data.qualification_id : selectedQualificationId,
          created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
          updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
        },
      ]);
      setSelectedQualificationId("");
      setSaveSuccess("Required qualification added.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to add required qualification.");
    } finally {
      setQualSaving(false);
    }
  }

  async function handleRemoveQualification(rowId: string) {
    setSaveError(null);
    setSaveSuccess(null);
    setRemovingQualificationId(rowId);

    try {
      const { error } = await supabase
        .from("role_required_qualifications")
        .delete()
        .eq("id", rowId)
        .eq("department_id", departmentId);

      if (error) {
        setSaveError(error.message || "Unable to remove required qualification.");
        return;
      }

      setQualRequirements((current) => current.filter((row) => row.id !== rowId));
      setSaveSuccess("Required qualification removed.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to remove required qualification.");
    } finally {
      setRemovingQualificationId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Role Requirements</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Define which certifications and qualifications are required for each department role.
          </p>
        </div>
      </div>

      {saveError ? (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {saveError}
        </div>
      ) : null}

      {saveSuccess ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {saveSuccess}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-neutral-800 bg-[#111111] p-5">
        <label className="block max-w-xl">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Department Role
          </span>
          <select
            value={selectedRoleIdValue}
            onChange={(event) => setSelectedRoleId(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
          >
            <option value="">Select a department role</option>
            {orderedRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}{role.active ? "" : " (Inactive)"}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-3 text-xs text-neutral-500">
          {selectedRole ? `${selectedRole.name} is selected.` : "Choose a role to manage its required certifications and qualifications."}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
          <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4">
            <h3 className="text-xl font-semibold text-white">Required Certifications</h3>
            <p className="text-sm text-neutral-400">Pick active certification catalog items required for the selected role.</p>
          </div>

          {visibleCertRequirements.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
              No required certifications for this role.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleCertRequirements.map((row) => {
                const certification = row.certification;

                return (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{certification?.name ?? row.certification_id}</p>
                        {certification && certification.active === false ? (
                          <p className="mt-1 text-xs text-amber-300">Inactive catalog item</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveCertification(row.id)}
                        disabled={removingCertificationId === row.id}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingCertificationId === row.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-neutral-950 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Add Required Certification
              </span>
              <select
                value={selectedCertificationId}
                onChange={(event) => setSelectedCertificationId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">Select a certification</option>
                {activeCertifications.map((certification) => (
                  <option key={certification.id} value={certification.id}>
                    {certification.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleAddCertification()}
              disabled={certSaving}
              className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {certSaving ? "Saving..." : "+ Add Required Certification"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
          <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4">
            <h3 className="text-xl font-semibold text-white">Required Qualifications</h3>
            <p className="text-sm text-neutral-400">Pick active qualification catalog items required for the selected role.</p>
          </div>

          {visibleQualRequirements.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
              No required qualifications for this role.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleQualRequirements.map((row) => {
                const qualification = row.qualification;

                return (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{qualification?.name ?? row.qualification_id}</p>
                        {qualification && qualification.active === false ? (
                          <p className="mt-1 text-xs text-amber-300">Inactive catalog item</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveQualification(row.id)}
                        disabled={removingQualificationId === row.id}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingQualificationId === row.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-neutral-950 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Add Required Qualification
              </span>
              <select
                value={selectedQualificationId}
                onChange={(event) => setSelectedQualificationId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">Select a qualification</option>
                {activeQualifications.map((qualification) => (
                  <option key={qualification.id} value={qualification.id}>
                    {qualification.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleAddQualification()}
              disabled={qualSaving}
              className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {qualSaving ? "Saving..." : "+ Add Required Qualification"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
