"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppPermissionOption } from "@/lib/app-permissions";
import DepartmentRoleSelector from "@/components/personnel/DepartmentRoleSelector";
import SpecialPermissionsManager from "@/components/personnel/SpecialPermissionsManager";
import {
  applyCredentialRequirementStatus,
  buildMemberCredentials,
  buildRequiredCredentials,
  type CertificationCatalogRow,
  type MemberCertificationRow,
  type MemberQualificationRow,
  type QualificationCatalogRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
  type SupportingDocumentRow,
} from "@/lib/credentials/facade";
import { isSelectableCertification } from "@/lib/credentials/canonical-certifications";
import { getRoleRequirementStatus } from "@/lib/role-requirements";
import { supabase } from "@/lib/supabase";
import EmsCertificationFields from "@/components/ems/EmsCertificationFields";
import { assertEmsTrackLevelMatchesCredential, resolveCertificationCatalogEntry, selectionFromCertification, type EmsCertificationSelection } from "@/lib/ems/certification-selection";
import { buildCertificationTypeMetaById, resolveAuthoritativeEmsCertificationsForMember } from "@/lib/ems/authoritative-certifications";
import { getEmsCertificationLevels } from "@/lib/ems/requirements";

type WizardStep = "basic" | "credentials" | "ems" | "account" | "review";

type AddMemberButtonProps = {
  permissionOptions: AppPermissionOption[];
  departmentId: string;
  currentMemberId: string;
};

type CreateMemberFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  active: boolean;
  hireStartDate: string;
  inactiveDate: string;
  specialPermissionsEnabled: boolean;
  permissionKeys: string[];
};

type PendingMemberSubmission = {
  requestId: string;
  form: CreateMemberFormState;
  departmentRoleId: string;
};

function readPendingSubmission(key: string): PendingMemberSubmission | null {
  const saved = sessionStorage.getItem(key);
  if (!saved) return null;
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== "object" || !("requestId" in value) ||
    typeof value.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestId) ||
    !("departmentRoleId" in value) || typeof value.departmentRoleId !== "string" ||
    !("form" in value) || !value.form || typeof value.form !== "object") {
    throw new Error("The pending Add Member submission cannot be restored. Do not start another submission until Personnel has been checked.");
  }
  const form = value.form;
  if (!("firstName" in form) || typeof form.firstName !== "string" ||
    !("lastName" in form) || typeof form.lastName !== "string" ||
    !("email" in form) || typeof form.email !== "string" ||
    !("phone" in form) || typeof form.phone !== "string" ||
    !("hireStartDate" in form) || typeof form.hireStartDate !== "string" ||
    !("inactiveDate" in form) || typeof form.inactiveDate !== "string") {
    throw new Error("Invalid pending member information. Review Personnel before retrying.");
  }
  if (!("active" in form) || typeof form.active !== "boolean" ||
    !("specialPermissionsEnabled" in form) || typeof form.specialPermissionsEnabled !== "boolean" ||
    !("permissionKeys" in form) || !Array.isArray(form.permissionKeys) ||
    !form.permissionKeys.every((key: unknown) => typeof key === "string")) {
    throw new Error("Invalid pending member permissions. Review Personnel before retrying.");
  }
  return {
    requestId: value.requestId, departmentRoleId: value.departmentRoleId,
    form: {
      firstName: form.firstName, lastName: form.lastName,
      email: form.email, phone: form.phone,
      hireStartDate: form.hireStartDate, inactiveDate: form.inactiveDate,
      active: form.active, specialPermissionsEnabled: form.specialPermissionsEnabled,
      permissionKeys: form.permissionKeys,
    },
  };
}

type DepartmentRoleRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sort_order: number;
};

type CredentialFormState = EmsCertificationSelection & {
  editionDetails: string;
  certificationSource: "existing" | "new";
  certificationId: string;
  newCertificationName: string;
  expirationChoice: "yes" | "no";
  achievedAt: string;
  expiresAt: string;
  certificateNumber: string;
  supportingDocumentId: string;
  notes: string;
};

type EmsTrack = "iowa" | "nremt";
type EmsLevel = "emr" | "emt" | "aemt" | "paramedic" | "ccp";
type TrackStatus = "active" | "inactive" | "expired" | "not_maintained" | "needs_review";

type EmsTrackFormState = {
  level: EmsLevel;
  status: TrackStatus;
  maintainTrack: boolean;
  notes: string;
};

type EmsTrackRow = {
  id: string;
  track: EmsTrack;
};

type CreateMemberResponse = {
  ok?: boolean;
  error?: string;
  memberId?: string;
};

type ApiError = {
  message?: string;
  code?: string;
};

const initialState: CreateMemberFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  active: true,
  hireStartDate: "",
  inactiveDate: "",
  specialPermissionsEnabled: false,
  permissionKeys: [],
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyCredentialState(defaultCredentialId = ""): CredentialFormState {
  return {
    editionDetails: "",
    certificationSource: "existing",
    certificationId: defaultCredentialId,
    newCertificationName: "",
    emsAuthority: "",
    emsLevel: "",
    expirationChoice: "yes",
    achievedAt: getLocalDateString(),
    expiresAt: "",
    certificateNumber: "",
    supportingDocumentId: "",
    notes: "",
  };
}

function initialIowaForm(): EmsTrackFormState {
  return {
    level: "emt",
    status: "active",
    maintainTrack: true,
    notes: "",
  };
}

function initialNremtForm(): EmsTrackFormState {
  return {
    level: "emt",
    status: "not_maintained",
    maintainTrack: false,
    notes: "",
  };
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

function stepTitle(step: WizardStep) {
  if (step === "basic") {
    return "1. Basic Member Information";
  }

  if (step === "credentials") {
    return "2. Credentials";
  }

  if (step === "ems") {
    return "3. EMS Setup";
  }

  if (step === "account") {
    return "4. Account Setup";
  }

  return "5. Review & Finish";
}

export default function AddMemberButton({
  permissionOptions,
  departmentId,
  currentMemberId,
}: AddMemberButtonProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [createdMemberId, setCreatedMemberId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [accountLinked, setAccountLinked] = useState(false);

  const [formState, setFormState] = useState<CreateMemberFormState>(initialState);
  const [activeStep, setActiveStep] = useState<WizardStep>("basic");

  const [departmentRoles, setDepartmentRoles] = useState<DepartmentRoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const [certificationTypes, setCertificationTypes] = useState<CertificationCatalogRow[]>([]);
  const [qualificationTypes, setQualificationTypes] = useState<QualificationCatalogRow[]>([]);
  const [roleRequiredCertifications, setRoleRequiredCertifications] = useState<RoleRequiredCertificationRow[]>([]);
  const [roleRequiredQualifications, setRoleRequiredQualifications] = useState<RoleRequiredQualificationRow[]>([]);
  const [supportingDocuments, setSupportingDocuments] = useState<SupportingDocumentRow[]>([]);

  const [memberCertificationRows, setMemberCertificationRows] = useState<MemberCertificationRow[]>([]);
  const [memberQualificationRows, setMemberQualificationRows] = useState<MemberQualificationRow[]>([]);

  const [credentialForm, setCredentialForm] = useState<CredentialFormState>(emptyCredentialState());
  const [credentialDraftDirty, setCredentialDraftDirty] = useState(false);

  const [iowaForm, setIowaForm] = useState<EmsTrackFormState>(initialIowaForm());
  const [nremtForm, setNremtForm] = useState<EmsTrackFormState>(initialNremtForm());
  const [emsRows, setEmsRows] = useState<EmsTrackRow[]>([]);

  const [createAccountNow, setCreateAccountNow] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [accountResult, setAccountResult] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const orderedRoles = useMemo(() => sortRoles(departmentRoles), [departmentRoles]);
  const activeCertificationOptions = useMemo(
    () => certificationTypes.filter(isSelectableCertification).sort((left, right) => left.name.localeCompare(right.name)),
    [certificationTypes],
  );

  const requiredCredentials = useMemo(
    () =>
      buildRequiredCredentials({
        roleRequiredCertifications,
        roleRequiredQualifications,
        certificationTypes,
        qualificationTypes,
        departmentRoleId: selectedRoleId || null,
      }),
    [roleRequiredCertifications, roleRequiredQualifications, certificationTypes, qualificationTypes, selectedRoleId],
  );

  const normalizedMemberCredentials = useMemo(() => {
    const normalized = buildMemberCredentials({
      memberCertifications: memberCertificationRows,
      memberQualifications: memberQualificationRows,
      certificationTypes,
      qualificationTypes,
      supportingDocuments,
    });

    const withStatus = applyCredentialRequirementStatus({
      memberCredentials: normalized,
      requiredCredentials,
    });

    return [...withStatus].sort((left, right) => {
      if (left.requirementStatus !== right.requirementStatus) {
        return left.requirementStatus === "required" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [
    memberCertificationRows,
    memberQualificationRows,
    certificationTypes,
    qualificationTypes,
    supportingDocuments,
    requiredCredentials,
  ]);

  const emsApplicable = useMemo(
    () => normalizedMemberCredentials.some((row) => row.emsAuthority !== null),
    [normalizedMemberCredentials],
  );

  const hasMissingRequiredCredentials = useMemo(
    () => getRoleRequirementStatus({
      memberDepartmentRoleId: selectedRoleId || null,
      certificationTypes: certificationTypes.map((row) => ({
        canonical_certification_id: typeof row.canonical_certification_id === "string" ? row.canonical_certification_id : null, department_id: typeof row.department_id === "string" ? row.department_id : undefined, id: row.id, name: row.name, active: row.active
      })),
      qualificationTypes: qualificationTypes.map((row) => ({ id: row.id, name: row.name, active: row.active })),
      roleRequiredCertifications,
      roleRequiredQualifications,
      memberCertifications: memberCertificationRows.map((row) => ({
        certification_id: row.certification_id,
        expires_at: row.expires_at,
      })),
      memberQualifications: memberQualificationRows.map((row) => ({
        qualification_id: row.qualification_id,
      })),
    }).kind === "missing",
    [
      selectedRoleId,
      certificationTypes,
      qualificationTypes,
      roleRequiredCertifications,
      roleRequiredQualifications,
      memberCertificationRows,
      memberQualificationRows,
    ],
  );

  const canCreateAccount = formState.email.trim().length > 0;
  const pendingStorageKey = `redline:add-member:${departmentId}:${currentMemberId}`;

  function resetWizardState() {
    setIsSaving(false);
    setErrorMessage(null);
    setConfigError(null);
    setFormState(initialState);
    setCreatedMemberId(null);
    setAccountLinked(false);
    setActiveStep("basic");

    setSelectedRoleId("");

    setDepartmentRoles([]);
    setCertificationTypes([]);
    setQualificationTypes([]);
    setRoleRequiredCertifications([]);
    setRoleRequiredQualifications([]);
    setSupportingDocuments([]);

    setMemberCertificationRows([]);
    setMemberQualificationRows([]);
    setCredentialForm(emptyCredentialState());
    setCredentialDraftDirty(false);

    setIowaForm(initialIowaForm());
    setNremtForm(initialNremtForm());
    setEmsRows([]);

    setCreateAccountNow(false);
    setTemporaryPassword("");
    setAccountResult(null);
  }

  function closeModal() {
    const didCreateMember = createdMemberId !== null;
    setIsOpen(false);
    resetWizardState();
    if (didCreateMember) {
      router.refresh();
    }
  }

  async function loadOnboardingConfig(preserveSelectedRole = false) {
    if (!departmentId) {
      setConfigError("Department context is unavailable.");
      return;
    }

    setIsLoadingConfig(true);
    setConfigError(null);

    const [
      rolesResult,
      certificationsResult,
      qualificationsResult,
      requiredCertificationsResult,
      requiredQualificationsResult,
      documentsResult,
    ] = await Promise.all([
      supabase
        .from("department_roles")
        .select("id, name, code, active, sort_order")
        .eq("department_id", departmentId)
        .order("active", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("certifications")
        .select("id, name, active, ems_authority, ems_certification_level, canonical_certification_id, department_id")
        .eq("department_id", departmentId)
        .order("name", { ascending: true }),
      supabase
        .from("qualifications")
        .select("id, name, active")
        .eq("department_id", departmentId)
        .order("name", { ascending: true }),
      supabase
        .from("role_required_certifications")
        .select("id, department_role_id, certification_id")
        .eq("department_id", departmentId),
      supabase
        .from("role_required_qualifications")
        .select("id, department_role_id, qualification_id")
        .eq("department_id", departmentId),
      supabase
        .from("documents")
        .select("id, title, document_number")
        .eq("department_id", departmentId)
        .order("title", { ascending: true }),
    ]);

    if (
      rolesResult.error ||
      certificationsResult.error ||
      qualificationsResult.error ||
      requiredCertificationsResult.error ||
      requiredQualificationsResult.error ||
      documentsResult.error
    ) {
      setConfigError(
        rolesResult.error?.message ||
          certificationsResult.error?.message ||
          qualificationsResult.error?.message ||
          requiredCertificationsResult.error?.message ||
          requiredQualificationsResult.error?.message ||
          documentsResult.error?.message ||
          "Unable to load onboarding configuration.",
      );
      setIsLoadingConfig(false);
      return;
    }

    const roles: DepartmentRoleRow[] = (rolesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "",
      code: typeof row.code === "string" ? row.code : "",
      active: row.active !== false,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    }));

    const certifications: CertificationCatalogRow[] = (certificationsResult.data ?? []).map((row) => ({
      canonical_certification_id: typeof row.canonical_certification_id === "string" ? row.canonical_certification_id : null,
      department_id: departmentId,
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "",
      active: row.active !== false,
      ems_authority: row.ems_authority === "iowa" || row.ems_authority === "nremt" ? row.ems_authority : null,
      ems_certification_level: row.ems_certification_level === "emr" ||
        row.ems_certification_level === "emt" ||
        row.ems_certification_level === "aemt" ||
        row.ems_certification_level === "paramedic" ||
        row.ems_certification_level === "ccp"
        ? row.ems_certification_level
        : null,
    }));

    const qualifications: QualificationCatalogRow[] = (qualificationsResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "",
      active: row.active !== false,
    }));

    const requiredCertifications: RoleRequiredCertificationRow[] =
      (requiredCertificationsResult.data ?? []).map((row) => ({
        id: String(row.id),
        department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
        certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
      }));

    const requiredQualifications: RoleRequiredQualificationRow[] =
      (requiredQualificationsResult.data ?? []).map((row) => ({
        id: String(row.id),
        department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
        qualification_id: typeof row.qualification_id === "string" ? row.qualification_id : "",
      }));

    const documents: SupportingDocumentRow[] = (documentsResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : null,
      document_number: typeof row.document_number === "string" ? row.document_number : null,
    }));

    setDepartmentRoles(roles);
    setCertificationTypes(certifications);
    setQualificationTypes(qualifications);
    setRoleRequiredCertifications(requiredCertifications);
    setRoleRequiredQualifications(requiredQualifications);
    setSupportingDocuments(documents);

    const firstActiveRole = sortRoles(roles).find((role) => role.active);
    if (firstActiveRole) {
      if (!preserveSelectedRole) setSelectedRoleId(firstActiveRole.id);
    }

    const firstActiveCredentialId = certifications.find((item) => item.active)?.id;

    setCredentialForm({
      ...emptyCredentialState(firstActiveCredentialId ?? ""),
      ...selectionFromCertification(certifications.find((row) => row.id === firstActiveCredentialId)),
    });
    setCredentialDraftDirty(false);
    setIsLoadingConfig(false);
  }

  async function persistCredentialDraft() {
    if (!createdMemberId) {
      throw new Error("Create the member first.");
    }

    if (!credentialForm.achievedAt) {
      throw new Error("Issue/Earned date is required.");
    }

    const selectedCertification = await findOrCreateCertificationFromForm();

    const expiresForMember = credentialForm.expirationChoice === "yes";
    if (selectedCertification.ems_authority && !expiresForMember) {
      throw new Error("EMS certifications must use an expiration date.");
    }

    if (expiresForMember && !credentialForm.expiresAt) {
      throw new Error("Expiration date is required when certification expires.");
    }

    if (expiresForMember && credentialForm.expiresAt < credentialForm.achievedAt) {
      throw new Error("Expiration date cannot be earlier than the issue/earned date.");
    }

    const duplicateCertification = memberCertificationRows.some(
      (row) => row.certification_id === selectedCertification.id,
    );

    if (duplicateCertification) {
      throw new Error("This member already has that certification.");
    }

    const { data, error } = await supabase.rpc("save_member_certification_with_details", {
      p_department_id: departmentId,
      p_member_id: createdMemberId,
      p_record_id: null,
      p_certification_id: selectedCertification.id,
      p_certificate_number: credentialForm.certificateNumber.trim() || null,
      p_issued_at: credentialForm.achievedAt,
      p_expires_at: expiresForMember ? credentialForm.expiresAt : null,
      p_supporting_document_id: credentialForm.supportingDocumentId || null,
      p_notes: credentialForm.notes.trim() || null,
      p_editor_member_id: currentMemberId,
      p_edition_details: credentialForm.editionDetails,
    });

    if (error || !data) {
      const typedError = error as ApiError | null;
      if (typedError?.code === "23505") {
        throw new Error("This member already has that certification.");
      }

      throw new Error(typedError?.message || "Unable to add credential.");
    }

    const inserted: MemberCertificationRow = {
      id: String(data.id),
      member_id: typeof data.member_id === "string" ? data.member_id : createdMemberId,
      certification_id: typeof data.certification_id === "string" ? data.certification_id : selectedCertification.id,
      issued_at: typeof data.issued_at === "string" ? data.issued_at : credentialForm.achievedAt,
      expires_at: typeof data.expires_at === "string" ? data.expires_at : null,
      supporting_document_id:
        typeof data.supporting_document_id === "string" ? data.supporting_document_id : null,
    };

    setMemberCertificationRows((current) => [inserted, ...current]);

    if (selectedCertification.ems_certification_level) {
      const level = selectedCertification.ems_certification_level;
      if (selectedCertification.ems_authority === "iowa") {
        setIowaForm((current) => ({ ...current, level }));
      } else if (selectedCertification.ems_authority === "nremt") {
        setNremtForm((current) => ({ ...current, level }));
      }
    }

    setCredentialForm((current) => ({
      ...emptyCredentialState(current.certificationId),
      certificationSource: "existing",
      certificationId: current.certificationSource === "new" ? "" : current.certificationId,
      achievedAt: current.achievedAt,
      ...selectionFromCertification(current.certificationSource === "existing" ? selectedCertification : undefined),
    }));
    setCredentialDraftDirty(false);

    return selectedCertification;
  }

  async function findOrCreateCertificationFromForm() {
    const certification = await resolveCertificationCatalogEntry({
      supabase, departmentId, editorMemberId: currentMemberId, catalog: certificationTypes,
      selectedId: credentialForm.certificationSource === "existing" ? credentialForm.certificationId || null : null,
      name: credentialForm.certificationSource === "new" ? credentialForm.newCertificationName : "",
      selection: credentialForm,
    });
    setCertificationTypes((current) => current.some((row) => row.id === certification.id) ? current : [...current, certification]);
    return certification;
  }

  function openModal() {
    resetWizardState();
    setIsOpen(true);
    try {
      const pending = readPendingSubmission(pendingStorageKey);
      setRequestId(pending?.requestId ?? crypto.randomUUID());
      if (pending) {
        setFormState(pending.form);
        setSelectedRoleId(pending.departmentRoleId);
      }
      void loadOnboardingConfig(pending !== null);
    } catch (error) {
      setRequestId(null);
      setConfigError(error instanceof Error ? error.message : "Unable to restore pending submission. Browser session storage is required.");
    }
  }

  function togglePermission(permissionKey: string) {
    setFormState((current) => {
      const exists = current.permissionKeys.includes(permissionKey);
      return {
        ...current,
        permissionKeys: exists
          ? current.permissionKeys.filter((key) => key !== permissionKey)
          : [...current.permissionKeys, permissionKey],
      };
    });
  }

  async function handleCreateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (isLoadingConfig || configError) {
      setErrorMessage(configError || "Wait for department roles to finish loading.");
      return;
    }
    if (selectedRoleId && !departmentRoles.some((role) => role.id === selectedRoleId && role.active)) {
      setErrorMessage("Select an active department role.");
      return;
    }
    if (createdMemberId) {
      setErrorMessage("This member has already been created. Continue onboarding or open the profile to change Department Role.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (!requestId) throw new Error("Unable to identify the pending submission. Reopen Add Member.");
      const pending = readPendingSubmission(pendingStorageKey);
      const submission: PendingMemberSubmission = { requestId, form: formState, departmentRoleId: selectedRoleId };
      if (pending && (pending.requestId !== requestId || pending.departmentRoleId !== selectedRoleId ||
        Object.keys(formState).some((key) => {
          const field = key as keyof CreateMemberFormState;
          return JSON.stringify(pending.form[field]) !== JSON.stringify(formState[field]);
        }))) {
        setErrorMessage("A pending submission already exists with different information. Close and reopen Add Member to restore it, then retry unchanged. No new request was sent.");
        return;
      }
      sessionStorage.setItem(pendingStorageKey, JSON.stringify(submission));
      const response = await fetch("/api/personnel/members", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...formState, rank: null, departmentRoleId: selectedRoleId || null, requestId }),
      });

      const payload = (await response.json()) as CreateMemberResponse;
      if (!response.ok || !payload.ok || !payload.memberId) {
        setErrorMessage(payload.error || "Unable to add member.");
        return;
      }

      setCreatedMemberId(payload.memberId);
      setActiveStep("credentials");
      sessionStorage.removeItem(pendingStorageKey);
    } catch (error) {
      setErrorMessage(`The save outcome could not be confirmed: ${error instanceof Error ? error.message : "Unable to add member."} Review Personnel before retrying.`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await persistCredentialDraft();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add credential.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveCredential(id: string, sourceType: "certification" | "qualification") {
    if (!createdMemberId) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      if (sourceType === "certification") {
        const { error } = await supabase
          .from("member_certifications")
          .delete()
          .eq("id", id)
          .eq("member_id", createdMemberId)
          .eq("department_id", departmentId);

        if (error) {
          setErrorMessage(error.message || "Unable to remove credential.");
          return;
        }

        setMemberCertificationRows((current) => current.filter((row) => row.id !== id));
      } else {
        const { error } = await supabase
          .from("member_qualifications")
          .delete()
          .eq("id", id)
          .eq("member_id", createdMemberId)
          .eq("department_id", departmentId);

        if (error) {
          setErrorMessage(error.message || "Unable to remove credential.");
          return;
        }

        setMemberQualificationRows((current) => current.filter((row) => row.id !== id));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove credential.");
    } finally {
      setIsSaving(false);
    }
  }

  async function goFromCredentialsToNext() {
    setErrorMessage(null);

    let hasEmsCredential = emsApplicable;
    if (credentialDraftDirty) {
      setIsSaving(true);

      try {
        const savedCertification = await persistCredentialDraft();
        hasEmsCredential = hasEmsCredential || savedCertification.ems_authority !== null;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to add credential.");
        return;
      } finally {
        setIsSaving(false);
      }
    }

    if (hasEmsCredential) {
      setActiveStep("ems");
      return;
    }

    setActiveStep("account");
  }

  async function upsertEmsTrack(track: EmsTrack, form: EmsTrackFormState) {
    if (!createdMemberId) {
      throw new Error("Create the member first.");
    }

    const existing = emsRows.find((row) => row.track === track) ?? null;
    const normalizedStatus = track === "nremt" && !form.maintainTrack ? "not_maintained" : form.status;

    const payload = {
      department_id: departmentId,
      member_id: createdMemberId,
      track,
      certification_level: form.level,
      track_status: normalizedStatus,
      maintain_track: track === "iowa" ? true : form.maintainTrack,
      notes: form.notes.trim() || null,
      updated_by: currentMemberId,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("ems_member_track_profiles")
        .update(payload)
        .eq("id", existing.id)
        .eq("department_id", departmentId)
        .select("id, track")
        .single();

      if (error || !data) {
        throw new Error(error?.message || `Unable to update ${track.toUpperCase()} setup.`);
      }

      const updated: EmsTrackRow = { id: String(data.id), track: data.track === "nremt" ? "nremt" : "iowa" };
      setEmsRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      return;
    }

    const { data, error } = await supabase
      .from("ems_member_track_profiles")
      .insert({
        ...payload,
        created_by: currentMemberId,
        effective_start_date: getLocalDateString(),
      })
      .select("id, track")
      .single();

    if (error || !data) {
      throw new Error(error?.message || `Unable to create ${track.toUpperCase()} setup.`);
    }

    const inserted: EmsTrackRow = { id: String(data.id), track: data.track === "nremt" ? "nremt" : "iowa" };
    setEmsRows((current) => [inserted, ...current]);
  }

  async function handleSaveEmsAndContinue() {
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const authoritative = resolveAuthoritativeEmsCertificationsForMember({
        certificationTypeById: buildCertificationTypeMetaById(certificationTypes),
        memberCertifications: memberCertificationRows.map((row) => ({ ...row, certificate_number: null })),
      });
      assertEmsTrackLevelMatchesCredential("iowa", iowaForm.level, authoritative.iowa?.level ?? null);
      assertEmsTrackLevelMatchesCredential("nremt", nremtForm.level, authoritative.nremt?.level ?? null);
      await upsertEmsTrack("iowa", iowaForm);
      await upsertEmsTrack("nremt", nremtForm);
      setActiveStep("account");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save EMS setup.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleContinueFromAccount() {
    setErrorMessage(null);
    setAccountResult(null);

    if (!createAccountNow) {
      setActiveStep("review");
      return;
    }

    if (!createdMemberId) {
      setErrorMessage("Create the member first.");
      return;
    }

    if (!canCreateAccount) {
      setErrorMessage("Add an email address before creating an account.");
      return;
    }

    if (temporaryPassword.length < 8) {
      setErrorMessage("Temporary password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/personnel/members/${createdMemberId}/auth-account`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ temporaryPassword }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        authUserId?: string;
      };

      if (!response.ok || !payload.ok) {
        const extra = payload.authUserId ? ` (Auth UUID: ${payload.authUserId})` : "";
        setAccountResult({
          kind: "error",
          message: `${payload.error || "Unable to create account."}${extra}`,
        });
        return;
      }

      setTemporaryPassword("");
      setAccountLinked(true);
      setAccountResult({
        kind: "success",
        message: "Authentication account created and linked.",
      });
      setActiveStep("review");
    } catch (error) {
      setAccountResult({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to create account.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function finishOnboarding() {
    closeModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700"
      >
        + Add Member
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-white">Add Personnel Onboarding</h2>
                <p className="mt-1 text-sm text-neutral-400">{stepTitle(activeStep)}</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                {createdMemberId ? "Finish Later" : "Cancel"}
              </button>
            </div>

            {isLoadingConfig ? (
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-300">
                Loading onboarding options...
              </div>
            ) : null}

            {configError ? (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {configError}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}

            {activeStep === "basic" ? (
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-neutral-300">
                    First name
                    <input
                      value={formState.firstName}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, firstName: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                      required
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Last name
                    <input
                      value={formState.lastName}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, lastName: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                      required
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Email
                    <input
                      value={formState.email}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, email: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Phone
                    <input
                      value={formState.phone}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, phone: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </label>

                  <DepartmentRoleSelector
                    selectedRoleId={selectedRoleId}
                    departmentRoles={departmentRoles}
                    onChange={setSelectedRoleId}
                    disabled={isSaving || isLoadingConfig || Boolean(configError)}
                  />

                  <label className="text-sm text-neutral-300">
                    Hire / Start Date
                    <input
                      type="date"
                      value={formState.hireStartDate}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, hireStartDate: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Exit / Inactive Date
                    {formState.active ? (
                      <input
                        type="text"
                        value=""
                        readOnly
                        disabled
                        placeholder="Set when member is inactive"
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-500"
                      />
                    ) : (
                      <input
                        type="date"
                        value={formState.inactiveDate}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, inactiveDate: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                        required
                      />
                    )}
                  </label>

                  <label className="flex items-center gap-3 text-sm text-neutral-300 md:mt-7">
                    <input
                      type="checkbox"
                      checked={formState.active}
                      onChange={(event) => {
                        const nextActive = event.target.checked;
                        setFormState((current) => ({
                          ...current,
                          active: nextActive,
                          inactiveDate: nextActive ? "" : current.inactiveDate,
                        }));
                      }}
                    />
                    Active member
                  </label>
                </div>

                {!formState.active ? (
                  <p className="text-xs text-amber-300">
                    Inactive members require an Exit / Inactive Date and remain as historical personnel records.
                  </p>
                ) : null}

                <SpecialPermissionsManager
                  memberName={`${formState.firstName} ${formState.lastName}`.trim() || "New Member"}
                  permissionOptions={permissionOptions}
                  specialPermissionsEnabled={formState.specialPermissionsEnabled}
                  selectedPermissionKeys={formState.permissionKeys}
                  onSpecialPermissionsEnabledChange={(enabled) =>
                    setFormState((current) => ({
                      ...current,
                      specialPermissionsEnabled: enabled,
                      permissionKeys: enabled ? current.permissionKeys : [],
                    }))
                  }
                  onTogglePermission={togglePermission}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isLoadingConfig || Boolean(configError)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Add Member"}
                  </button>
                </div>
              </form>
            ) : null}

            {activeStep === "credentials" ? (
              <div className="space-y-5">
                <p className="text-sm text-neutral-300">
                  Add certifications for this member. Expiration is chosen per member record.
                </p>

                <form onSubmit={handleAddCredential} className="grid gap-4 rounded-lg border border-neutral-700 bg-neutral-950 p-4 md:grid-cols-2">
                  <label className="text-sm text-neutral-300 md:col-span-2">
                    Certification
                    {credentialForm.certificationSource === "existing" ? (
                      <select
                        value={credentialForm.certificationId}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          setCredentialDraftDirty(true);
                          setCredentialForm((current) => ({
                            ...current,
                            certificationId: nextId,
                            ...selectionFromCertification(certificationTypes.find((row) => row.id === nextId)),
                          }));
                        }}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      >
                        <option value="">Select certification</option>
                        {activeCertificationOptions.map((certification) => (
                          <option key={certification.id} value={certification.id}>
                            {certification.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={credentialForm.newCertificationName}
                        onChange={(event) => {
                          setCredentialDraftDirty(true);
                          setCredentialForm((current) => ({ ...current, newCertificationName: event.target.value }));
                        }}
                        placeholder={credentialForm.emsAuthority ? "Optional name; defaults to selected EMS authority and level" : "Enter new certification name"}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      />
                    )}
                  </label>

                  <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                    {credentialForm.certificationSource === "existing" ? (
                      <button
                        type="button"
                        onClick={() =>
                          {
                            setCredentialDraftDirty(true);
                            setCredentialForm((current) => ({
                              ...current,
                              certificationSource: "new",
                              certificationId: "",
                              emsAuthority: "",
                              emsLevel: "",
                            }));
                          }
                        }
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        + Add New Certification
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          {
                            setCredentialDraftDirty(true);
                            setCredentialForm((current) => ({
                              ...current,
                              certificationSource: "existing",
                              newCertificationName: "",
                              ...selectionFromCertification(certificationTypes.find((row) => row.id === current.certificationId)),
                            }));
                          }
                        }
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                      >
                        Use Existing Certification
                      </button>
                    )}
                  </div>

                  <label className="text-sm text-neutral-300 md:col-span-2">
                    <span className="mb-2 block">Edition / Standard Details (optional)</span>
                    <input type="text" value={credentialForm.editionDetails}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm(current => ({ ...current, editionDetails: event.target.value }));
                      }}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white" />
                  </label>
                  <EmsCertificationFields value={credentialForm} onChange={(selection) => {
                    setCredentialDraftDirty(true);
                    setCredentialForm((current) => ({
                      ...current, ...selection, certificationSource: "new", certificationId: "",
                      newCertificationName: current.certificationSource === "new" ? current.newCertificationName : "",
                    }));
                  }} />

                  <fieldset className="text-sm text-neutral-300 md:col-span-2">
                    <legend className="mb-2">Does this certification expire?</legend>
                    <div className="flex items-center gap-5">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="expirationChoice"
                          checked={credentialForm.expirationChoice === "yes"}
                          onChange={() => {
                            setCredentialDraftDirty(true);
                            setCredentialForm((current) => ({ ...current, expirationChoice: "yes" }));
                          }}
                        />
                        Yes
                      </label>

                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="expirationChoice"
                          checked={credentialForm.expirationChoice === "no"}
                          onChange={() => {
                            setCredentialDraftDirty(true);
                            setCredentialForm((current) => ({ ...current, expirationChoice: "no", expiresAt: "" }));
                          }}
                        />
                        No
                      </label>
                    </div>
                  </fieldset>

                  <label className="text-sm text-neutral-300">
                    Issue / Earned Date
                    <input
                      type="date"
                      value={credentialForm.achievedAt}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm((current) => ({ ...current, achievedAt: event.target.value }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Expiration Date
                    <input
                      type="date"
                      value={credentialForm.expiresAt}
                      disabled={credentialForm.expirationChoice !== "yes"}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm((current) => ({ ...current, expiresAt: event.target.value }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Certificate Number
                    <input
                      value={credentialForm.certificateNumber}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm((current) => ({ ...current, certificateNumber: event.target.value }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Supporting Document
                    <select
                      value={credentialForm.supportingDocumentId}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm((current) => ({ ...current, supportingDocumentId: event.target.value }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                    >
                      <option value="">No document attached</option>
                      {supportingDocuments.map((document) => (
                        <option key={document.id} value={document.id}>
                          {document.title || "Document"}
                          {document.document_number ? ` • ${document.document_number}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-neutral-300 md:col-span-2">
                    Notes
                    <textarea
                      rows={3}
                      value={credentialForm.notes}
                      onChange={(event) => {
                        setCredentialDraftDirty(true);
                        setCredentialForm((current) => ({ ...current, notes: event.target.value }));
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                    />
                  </label>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Add Credential"}
                    </button>
                  </div>
                </form>

                <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Onboarding Credentials</p>
                    <p className="text-xs text-neutral-400">
                      {normalizedMemberCredentials.length} added
                    </p>
                  </div>

                  {normalizedMemberCredentials.length === 0 ? (
                    <p className="text-sm text-neutral-400">No credentials added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {normalizedMemberCredentials.map((credential) => (
                        <div
                          key={`${credential.sourceType}-${credential.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{credential.name}</p>
                            <p className="text-xs text-neutral-400">
                              {credential.expires ? "Expires" : "Does not expire"}
                              {credential.requirementStatus === "required" ? " • Required" : " • Additional"}
                              {credential.emsAuthority ? ` • EMS ${credential.emsAuthority.toUpperCase()}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCredential(credential.id, credential.sourceType)}
                            className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasMissingRequiredCredentials ? (
                    <p className="mt-3 text-xs text-amber-300">
                      This role has required credentials that are still missing.
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    Finish Later
                  </button>
                  <button
                    type="button"
                    onClick={goFromCredentialsToNext}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "ems" ? (
              <div className="space-y-5">
                <p className="text-sm text-neutral-300">
                  EMS setup is shown because one or more onboarding credentials are EMS-mapped.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                    <h3 className="text-base font-semibold text-white">Iowa EMS</h3>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Level
                      <select
                        value={iowaForm.level}
                        onChange={(event) =>
                          setIowaForm((current) => ({ ...current, level: event.target.value as EmsLevel }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      >
                        {getEmsCertificationLevels("iowa").map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}
                      </select>
                    </label>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Status
                      <select
                        value={iowaForm.status}
                        onChange={(event) =>
                          setIowaForm((current) => ({ ...current, status: event.target.value as TrackStatus }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="expired">Expired</option>
                        <option value="needs_review">Needs Review</option>
                      </select>
                    </label>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Notes
                      <textarea
                        rows={3}
                        value={iowaForm.notes}
                        onChange={(event) =>
                          setIowaForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                    <h3 className="text-base font-semibold text-white">National Registry</h3>

                    <label className="mt-3 flex items-center gap-3 text-sm text-neutral-300">
                      <input
                        type="checkbox"
                        checked={nremtForm.maintainTrack}
                        onChange={(event) =>
                          setNremtForm((current) => ({
                            ...current,
                            maintainTrack: event.target.checked,
                            status: event.target.checked
                              ? current.status === "not_maintained"
                                ? "active"
                                : current.status
                              : "not_maintained",
                          }))
                        }
                      />
                      Actively maintain National Registry
                    </label>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Level
                      <select
                        value={nremtForm.level}
                        onChange={(event) =>
                          setNremtForm((current) => ({ ...current, level: event.target.value as EmsLevel }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      >
                        {getEmsCertificationLevels("nremt").map((level) => <option key={level.code} value={level.code}>{level.label}</option>)}
                      </select>
                    </label>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Status
                      <select
                        value={nremtForm.status}
                        onChange={(event) =>
                          setNremtForm((current) => ({ ...current, status: event.target.value as TrackStatus }))
                        }
                        disabled={!nremtForm.maintainTrack}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white disabled:opacity-60"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="expired">Expired</option>
                        <option value="not_maintained">Not Maintained</option>
                        <option value="needs_review">Needs Review</option>
                      </select>
                    </label>

                    <label className="mt-3 block text-sm text-neutral-300">
                      Notes
                      <textarea
                        rows={3}
                        value={nremtForm.notes}
                        onChange={(event) =>
                          setNremtForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveStep("credentials")}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEmsAndContinue}
                    disabled={isSaving}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save EMS & Continue"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "account" ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">Create an authentication account now, or skip and do it later.</p>

                <label className="flex items-center gap-3 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    checked={createAccountNow}
                    onChange={(event) => {
                      setCreateAccountNow(event.target.checked);
                      setAccountResult(null);
                    }}
                  />
                  Create login account during onboarding
                </label>

                {!canCreateAccount && createAccountNow ? (
                  <p className="text-xs text-amber-300">This member needs an email address before an account can be created.</p>
                ) : null}

                {createAccountNow ? (
                  <label className="block text-sm text-neutral-300 max-w-md">
                    Temporary password
                    <input
                      type="password"
                      minLength={8}
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </label>
                ) : null}

                {accountResult ? (
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      accountResult.kind === "success"
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border border-red-500/30 bg-red-500/10 text-red-100"
                    }`}
                  >
                    {accountResult.message}
                  </div>
                ) : null}

                <div className="flex justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveStep(emsApplicable ? "ems" : "credentials")}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueFromAccount}
                    disabled={isSaving}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "review" ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">Review onboarding setup before finishing.</p>

                <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-300">
                    Member: <span className="font-semibold text-white">{formState.firstName} {formState.lastName}</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">
                    Role: <span className="font-semibold text-white">{orderedRoles.find((row) => row.id === selectedRoleId)?.name || "Unassigned"}</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">
                    Credentials added: <span className="font-semibold text-white">{normalizedMemberCredentials.length}</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">
                    EMS setup: <span className="font-semibold text-white">{emsApplicable ? "Configured" : "Not applicable"}</span>
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">
                    Account linked: <span className="font-semibold text-white">{accountLinked ? "Yes" : "No"}</span>
                  </p>
                  {hasMissingRequiredCredentials ? (
                    <p className="mt-2 text-xs text-amber-300">Some role-required credentials are still missing.</p>
                  ) : null}
                </div>

                <div className="flex justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveStep("account")}
                    className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={finishOnboarding}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Finish Onboarding
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
