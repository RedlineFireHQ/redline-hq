"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type SelectOption = {
  id: string;
  label: string;
};

type ReportFormState = {
  categoryId: string;
  priorityId: string;
  apparatusId: string;
  description: string;
  photo: File | null;
};

const initialFormState: ReportFormState = {
  categoryId: "",
  priorityId: "",
  apparatusId: "",
  description: "",
  photo: null,
};

const STATION_SUPPLY_OPTION: SelectOption = {
  id: "station-supply",
  label: "Station Supply",
};

const FIRE_HOSE_CATEGORY_TOKEN = "fire hose";
const SCBA_CATEGORY_TOKEN = "scba";
const HOSE_CATEGORY_TOKEN = "hose";
const INVENTORY_CATEGORY_TOKEN = "inventory";
const PIE_CATEGORY_TOKEN = "pie";
const PIE_INDUSTRIAL_CATEGORY_TOKEN = "power & industrial equipment";
const GAS_MONITOR_CATEGORY_TOKEN = "gas monitor";
const BATTERY_CATEGORY_TOKEN = "battery";
const THERMAL_IMAGING_CAMERA_CATEGORY_TOKEN = "thermal imaging camera";
const EMS_EQUIPMENT_CATEGORY_TOKEN = "ems equipment";
const PPE_CATEGORY_TOKEN = "personal protective equipment";
const ROPE_CATEGORY_TOKEN = "rope";
const FIRE_EXTINGUISHER_CATEGORY_TOKEN = "fire extinguisher";
const MISC_FIRE_EQUIPMENT_CATEGORY_TOKEN = "miscellaneous fire equipment";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getInventoryEquipmentTypeLabel(normalizedInventoryCategory: string) {
  if (normalizedInventoryCategory === "fire-hose") {
    return "Fire Hose";
  }

  if (normalizedInventoryCategory === "scba-cylinders") {
    return "SCBA Cylinder";
  }

  if (normalizedInventoryCategory === "scba-packs") {
    return "SCBA Pack";
  }

  if (normalizedInventoryCategory === "pie") {
    return "PIE Equipment";
  }

  if (normalizedInventoryCategory === "gas-monitors") {
    return "Gas Monitor";
  }

  if (normalizedInventoryCategory === "battery") {
    return "Battery";
  }

  if (normalizedInventoryCategory === "thermal-cameras") {
    return "Thermal Imaging Camera (TIC)";
  }

  if (normalizedInventoryCategory === "ground-ladders") {
    return "Ground Ladder";
  }

  if (normalizedInventoryCategory === "ems-equipment") {
    return "EMS Equipment";
  }

  if (normalizedInventoryCategory === "ppe") {
    return "Personal Protective Equipment (PPE)";
  }

  if (normalizedInventoryCategory === "rope") {
    return "Rope";
  }

  if (normalizedInventoryCategory === "fire-extinguishers" || normalizedInventoryCategory === "fire-extinguisher") {
    return "Fire Extinguisher";
  }

  if (normalizedInventoryCategory === "misc-fire-equipment") {
    return "Miscellaneous Fire Equipment";
  }

  return "";
}

function resolveInventoryCategoryOption(
  options: SelectOption[],
  normalizedInventoryCategory: string,
) {
  const normalizedOptions = options.map((option) => ({
    option,
    normalizedLabel: option.label.trim().toLowerCase(),
  }));

  if (normalizedInventoryCategory === "fire-hose") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(FIRE_HOSE_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(HOSE_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "scba-cylinders" || normalizedInventoryCategory === "scba-packs") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("scba cylinder"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("scba pack"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(SCBA_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "pie") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(PIE_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(PIE_INDUSTRIAL_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("industrial equipment"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "gas-monitors") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(GAS_MONITOR_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("gas monitor"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "battery") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(BATTERY_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "thermal-cameras") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(THERMAL_IMAGING_CAMERA_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("thermal imaging camera"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("tic"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "ground-ladders") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("ground ladder"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("ladder"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "ems-equipment") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(EMS_EQUIPMENT_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("ems inventory"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "ppe") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(PPE_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("ppe"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "rope") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(ROPE_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "fire-extinguishers" || normalizedInventoryCategory === "fire-extinguisher") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(FIRE_EXTINGUISHER_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("extinguisher"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  if (normalizedInventoryCategory === "misc-fire-equipment") {
    return (
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(MISC_FIRE_EQUIPMENT_CATEGORY_TOKEN))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("misc fire"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes("fire equipment"))?.option ??
      normalizedOptions.find((entry) => entry.normalizedLabel.includes(INVENTORY_CATEGORY_TOKEN))?.option ??
      null
    );
  }

  return null;
}

function getRecordString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeOption(record: Record<string, unknown>): SelectOption {
  const idValue = record.id;
  const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
  const label =
    getRecordString(record, ["name", "label", "title", "value", "category_name", "priority_name"]) || id;

  return { id, label };
}

async function resolveCurrentInventoryApparatusDefault(
  inventoryCategory: string,
  inventoryItemId: string,
): Promise<string | null> {
  if (
    !inventoryItemId ||
    (inventoryCategory !== "pie" && inventoryCategory !== "gas-monitors" && inventoryCategory !== "battery" && inventoryCategory !== "thermal-cameras" && inventoryCategory !== "ground-ladders" && inventoryCategory !== "fire-extinguishers" && inventoryCategory !== "misc-fire-equipment")
  ) {
    return null;
  }

  const isPie = inventoryCategory === "pie";
  const isGasMonitor = inventoryCategory === "gas-monitors";
  const isBattery = inventoryCategory === "battery";
  const isGroundLadder = inventoryCategory === "ground-ladders";
  const isFireExtinguisher = inventoryCategory === "fire-extinguishers";
  const isMiscFireEquipment = inventoryCategory === "misc-fire-equipment";
  const tableName = isPie
    ? "pie_equipment_assignments"
    : isGasMonitor
      ? "gas_monitor_assignments"
      : isBattery
        ? "battery_assignments"
        : isGroundLadder
          ? "ground_ladder_assignments"
          : isFireExtinguisher
            ? "fire_extinguishers"
            : isMiscFireEquipment
              ? "misc_fire_equipment"
              : "thermal_imaging_camera_assignments";
  const foreignKeyName = isPie
    ? "pie_equipment_id"
    : isGasMonitor
      ? "gas_monitor_id"
      : isBattery
        ? "battery_id"
        : isGroundLadder
          ? "ground_ladder_id"
          : isFireExtinguisher
            ? "id"
            : isMiscFireEquipment
              ? "id"
              : "thermal_imaging_camera_id";

  if (isFireExtinguisher) {
    const { data, error } = await supabase
      .from("fire_extinguishers")
      .select("location_type, apparatus_id")
      .eq("id", inventoryItemId)
      .maybeSingle();

    if (error) {
      console.error("[deficiency-report] failed to resolve current fire extinguisher location", error);
      return null;
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    const row = data as Record<string, unknown>;
    const locationType = typeof row.location_type === "string" ? row.location_type : "";
    const apparatusIdValue = typeof row.apparatus_id === "string" ? row.apparatus_id : "";

    if (locationType === "Apparatus") {
      return apparatusIdValue || null;
    }

    return STATION_SUPPLY_OPTION.id;
  }

  if (isMiscFireEquipment) {
    const { data, error } = await supabase
      .from("misc_fire_equipment")
      .select("location_type, apparatus_id")
      .eq("id", inventoryItemId)
      .maybeSingle();

    if (error) {
      console.error("[deficiency-report] failed to resolve current misc fire equipment location", error);
      return null;
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    const row = data as Record<string, unknown>;
    const locationType = typeof row.location_type === "string" ? row.location_type : "";
    const apparatusIdValue = typeof row.apparatus_id === "string" ? row.apparatus_id : "";

    if (locationType === "Apparatus") {
      return apparatusIdValue || null;
    }

    return STATION_SUPPLY_OPTION.id;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("assignment_type, apparatus_id")
    .eq(foreignKeyName, inventoryItemId)
    .is("ended_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
    `[deficiency-report] failed to resolve current ${isPie ? "PIE" : isGasMonitor ? "gas monitor" : isBattery ? "battery" : isGroundLadder ? "ground ladder" : "thermal imaging camera"} assignment`,
    error,
  );
    return null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  const assignmentType = typeof row.assignment_type === "string" ? row.assignment_type : "";
  const apparatusIdValue = typeof row.apparatus_id === "string" ? row.apparatus_id : "";

  if (assignmentType === "Apparatus") {
    return apparatusIdValue || null;
  }

  if (assignmentType === "Station" || assignmentType === "Member") {
    return STATION_SUPPLY_OPTION.id;
  }

  return "";
}

async function resolveCurrentReporter() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim();
  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as Record<string, unknown>;
  const memberId = typeof row.id === "string" ? row.id : "";

  return memberId ? { memberId } : null;
}

export default function ReportDeficiencyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnToParam = searchParams.get("returnTo");
  const apparatusIdParam = searchParams.get("apparatusId");
  const checkSessionIdParam = searchParams.get("checkSessionId");
  const inventoryCategoryParam = searchParams.get("inventoryCategory");
  const inventoryItemIdParam = searchParams.get("inventoryItemId");
  const inventoryItemLabelParam = searchParams.get("inventoryItemLabel");
  const failedHoseIdsParam = searchParams.get("failedHoseIds");
  const failedIndexParam = searchParams.get("failedIndex");
  const safeReturnTo =
    typeof returnToParam === "string" && returnToParam.startsWith("/") ? returnToParam : null;
  const activeCheckSessionId =
    typeof checkSessionIdParam === "string" && UUID_REGEX.test(checkSessionIdParam)
      ? checkSessionIdParam
      : "";
  const isSessionScopedDeficiency = activeCheckSessionId.length > 0;

  const inventoryCategory = typeof inventoryCategoryParam === "string" ? inventoryCategoryParam : "";
  const inventoryItemId = typeof inventoryItemIdParam === "string" ? inventoryItemIdParam : "";
  const inventoryItemLabel = typeof inventoryItemLabelParam === "string" ? inventoryItemLabelParam : "";
  const normalizedInventoryCategory = inventoryCategory.trim().toLowerCase() as string;
  const inventoryEquipmentTypeLabel = getInventoryEquipmentTypeLabel(normalizedInventoryCategory);
  const isInventoryDeficiencyLaunch =
    normalizedInventoryCategory === "fire-hose" ||
    normalizedInventoryCategory === "scba-cylinders" ||
    normalizedInventoryCategory === "scba-packs" ||
    normalizedInventoryCategory === "pie" ||
    normalizedInventoryCategory === "gas-monitors" ||
    normalizedInventoryCategory === "battery" ||
    normalizedInventoryCategory === "thermal-cameras" ||
    normalizedInventoryCategory === "ground-ladders" ||
    normalizedInventoryCategory === "ems-equipment" ||
    normalizedInventoryCategory === "ppe" ||
    normalizedInventoryCategory === "rope" ||
    normalizedInventoryCategory === "fire-extinguishers" ||
    normalizedInventoryCategory === "misc-fire-equipment";
  const failedHoseIds =
    typeof failedHoseIdsParam === "string" && failedHoseIdsParam.trim().length > 0
      ? failedHoseIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
  const failedIndexCandidate = Number.parseInt(failedIndexParam ?? "0", 10);
  const failedIndex = Number.isFinite(failedIndexCandidate) ? Math.max(0, failedIndexCandidate) : 0;

  const [formState, setFormState] = useState<ReportFormState>({
    ...initialFormState,
    apparatusId: apparatusIdParam ?? "",
  });
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [priorities, setPriorities] = useState<SelectOption[]>([]);
  const [apparatusOptions, setApparatusOptions] = useState<SelectOption[]>([]);
  const [openStatusId, setOpenStatusId] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedInventoryItemLabel, setResolvedInventoryItemLabel] = useState(inventoryItemLabel);

  const backHref = safeReturnTo ?? "/deficiencies";

  useEffect(() => {
    setResolvedInventoryItemLabel(inventoryItemLabel);
  }, [inventoryItemLabel]);

  useEffect(() => {
    if (
      normalizedInventoryCategory !== "fire-hose" &&
      normalizedInventoryCategory !== "scba-cylinders" &&
      normalizedInventoryCategory !== "scba-packs" &&
      normalizedInventoryCategory !== "pie" &&
      normalizedInventoryCategory !== "gas-monitors" &&
      normalizedInventoryCategory !== "battery" &&
      normalizedInventoryCategory !== "thermal-cameras" &&
      normalizedInventoryCategory !== "ground-ladders" &&
      normalizedInventoryCategory !== "ems-equipment" &&
      normalizedInventoryCategory !== "ppe" &&
      normalizedInventoryCategory !== "rope" &&
      normalizedInventoryCategory !== "misc-fire-equipment"
    ) {
      return;
    }

    if (!inventoryItemId || inventoryItemLabel) {
      return;
    }

    let isMounted = true;

    async function loadInventoryLabel() {
      let inventoryTable = "fire_hose";
      let selectColumn = "inventory_number";

      if (normalizedInventoryCategory === "scba-cylinders") {
        inventoryTable = "scba_cylinders";
        selectColumn = "cylinder_number";
      }

      if (normalizedInventoryCategory === "scba-packs") {
        inventoryTable = "scba_packs";
        selectColumn = "pack_number";
      }

      if (normalizedInventoryCategory === "pie") {
        inventoryTable = "pie_equipment";
        selectColumn = "equipment_number";
      }

      if (normalizedInventoryCategory === "gas-monitors") {
        inventoryTable = "gas_monitors";
        selectColumn = "monitor_number";
      }

      if (normalizedInventoryCategory === "battery") {
        inventoryTable = "batteries";
        selectColumn = "battery_number";
      }

      if (normalizedInventoryCategory === "thermal-cameras") {
        inventoryTable = "thermal_imaging_cameras";
        selectColumn = "camera_number";
      }

      if (normalizedInventoryCategory === "ground-ladders") {
        inventoryTable = "ground_ladders";
        selectColumn = "ladder_number";
      }

      if (normalizedInventoryCategory === "ems-equipment") {
        inventoryTable = "ems_equipment";
        selectColumn = "equipment_name";
      }

      if (normalizedInventoryCategory === "ppe") {
        inventoryTable = "ppe_items";
        selectColumn = "item_name";
      }

      if (normalizedInventoryCategory === "rope") {
        inventoryTable = "rope_items";
        selectColumn = "rope_name, rope_identifier";
      }

      if (normalizedInventoryCategory === "misc-fire-equipment") {
        inventoryTable = "misc_fire_equipment";
        selectColumn = "equipment_name, asset_number";
      }

      const { data, error } = await supabase
        .from(inventoryTable)
        .select(selectColumn)
        .eq("id", inventoryItemId)
        .maybeSingle();

      if (!isMounted || error || !data || typeof data !== "object") {
        return;
      }

      const record = data as unknown as Record<string, unknown>;
      let nextLabel = "";

      if (normalizedInventoryCategory === "scba-cylinders") {
        nextLabel = typeof record.cylinder_number === "string" ? record.cylinder_number : "";
      } else if (normalizedInventoryCategory === "scba-packs") {
        nextLabel = typeof record.pack_number === "string" ? record.pack_number : "";
      } else if (normalizedInventoryCategory === "pie") {
        nextLabel = typeof record.equipment_number === "string" ? record.equipment_number : "";
      } else if (normalizedInventoryCategory === "gas-monitors") {
        nextLabel = typeof record.monitor_number === "string" ? record.monitor_number : "";
      } else if (normalizedInventoryCategory === "battery") {
        nextLabel = typeof record.battery_number === "string" ? record.battery_number : "";
      } else if (normalizedInventoryCategory === "thermal-cameras") {
        nextLabel = typeof record.camera_number === "string" ? record.camera_number : "";
      } else if (normalizedInventoryCategory === "ground-ladders") {
        nextLabel = typeof record.ladder_number === "string" ? record.ladder_number : "";
      } else if (normalizedInventoryCategory === "ems-equipment") {
        nextLabel = typeof record.equipment_name === "string" ? record.equipment_name : "";
      } else if (normalizedInventoryCategory === "ppe") {
        nextLabel = typeof record.item_name === "string" ? record.item_name : "";
      } else if (normalizedInventoryCategory === "rope") {
        nextLabel = typeof record.rope_name === "string" ? record.rope_name : typeof record.rope_identifier === "string" ? record.rope_identifier : "";
      } else if (normalizedInventoryCategory === "misc-fire-equipment") {
        nextLabel = typeof record.equipment_name === "string" ? record.equipment_name : "";
      } else {
        nextLabel = typeof record.inventory_number === "string" ? record.inventory_number : "";
      }

      setResolvedInventoryItemLabel(nextLabel);
    }

    void loadInventoryLabel();

    return () => {
      isMounted = false;
    };
  }, [normalizedInventoryCategory, inventoryItemId, inventoryItemLabel]);

  useEffect(() => {
    if (!isInventoryDeficiencyLaunch) {
      return;
    }

    if (
      normalizedInventoryCategory === "pie" ||
      normalizedInventoryCategory === "gas-monitors" ||
      normalizedInventoryCategory === "battery"
    ) {
      return;
    }

    setFormState((current) => ({
      ...current,
      description: "",
      photo: null,
      apparatusId: current.apparatusId || STATION_SUPPLY_OPTION.id,
    }));
  }, [isInventoryDeficiencyLaunch, normalizedInventoryCategory, inventoryItemId]);

  const canSubmit = useMemo(() => {
    const effectiveApparatusId = isSessionScopedDeficiency
      ? (apparatusIdParam ?? "")
      : (formState.apparatusId || (isInventoryDeficiencyLaunch ? STATION_SUPPLY_OPTION.id : ""));

    return (
      Boolean(formState.categoryId) &&
      Boolean(formState.priorityId) &&
      Boolean(effectiveApparatusId) &&
      Boolean(formState.description.trim()) &&
      Boolean(openStatusId)
    );
  }, [apparatusIdParam, formState, isInventoryDeficiencyLaunch, isSessionScopedDeficiency, openStatusId]);

  useEffect(() => {
    if (!isSessionScopedDeficiency || typeof apparatusIdParam !== "string" || !apparatusIdParam.trim()) {
      return;
    }

    setFormState((current) => ({
      ...current,
      apparatusId: apparatusIdParam,
    }));
  }, [apparatusIdParam, isSessionScopedDeficiency]);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoadingOptions(true);
      setErrorMessage(null);

      const [categoriesResult, prioritiesResult, apparatusResult, statusesResult] = await Promise.all([
        supabase.from("deficiency_categories").select("*").order("display_order"),
        supabase.from("deficiency_priorities").select("*").order("display_order"),
        supabase.from("apparatus").select("*").order("name"),
        supabase.from("deficiency_statuses").select("id, name").order("display_order"),
      ]);

      if (!isMounted) {
        return;
      }

      if (
        categoriesResult.error ||
        prioritiesResult.error ||
        apparatusResult.error ||
        statusesResult.error
      ) {
        setErrorMessage(
          categoriesResult.error?.message ||
            prioritiesResult.error?.message ||
            apparatusResult.error?.message ||
            statusesResult.error?.message ||
            "Unable to load deficiency form options."
        );
        setIsLoadingOptions(false);
        return;
      }

      setCategories((categoriesResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));
      setPriorities((prioritiesResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));
      setApparatusOptions((apparatusResult.data ?? []).map((record) => normalizeOption(record as Record<string, unknown>)));

      if (isInventoryDeficiencyLaunch) {
        const categoryOptions = (categoriesResult.data ?? []).map((record) =>
          normalizeOption(record as Record<string, unknown>)
        );
        const resolvedInventoryCategory = resolveInventoryCategoryOption(
          categoryOptions,
          normalizedInventoryCategory,
        );

        const defaultApparatusId =
          normalizedInventoryCategory === "pie" ||
          normalizedInventoryCategory === "gas-monitors" ||
          normalizedInventoryCategory === "battery" ||
          normalizedInventoryCategory === "thermal-cameras" ||
          normalizedInventoryCategory === "ground-ladders" ||
          normalizedInventoryCategory === "fire-extinguishers" ||
          normalizedInventoryCategory === "misc-fire-equipment"
            ? ((await resolveCurrentInventoryApparatusDefault(normalizedInventoryCategory, inventoryItemId)) ?? "")
            : STATION_SUPPLY_OPTION.id;

        setFormState((current) => ({
          ...current,
          categoryId: current.categoryId || resolvedInventoryCategory?.id || "",
          apparatusId: current.apparatusId || defaultApparatusId,
        }));
      }

      const resolvedOpenStatus = (statusesResult.data ?? []).find((statusRow) => {
        const status = statusRow as Record<string, unknown>;
        return typeof status.name === "string" && status.name.trim().toLowerCase() === "open";
      }) as Record<string, unknown> | undefined;

      const resolvedOpenStatusId = typeof resolvedOpenStatus?.id === "string" ? resolvedOpenStatus.id : "";
      setOpenStatusId(resolvedOpenStatusId);
      setIsLoadingOptions(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [isInventoryDeficiencyLaunch, normalizedInventoryCategory]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const reporter = await resolveCurrentReporter();
    if (!reporter) {
      setErrorMessage("Unable to determine your Redline HQ member identity.");
      return;
    }

    if (!canSubmit) {
      setErrorMessage("Complete all required fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const isFireHoseDeficiency = normalizedInventoryCategory === "fire-hose";
    const isScbaCylinderDeficiency = normalizedInventoryCategory === "scba-cylinders";
    const isScbaPackDeficiency = normalizedInventoryCategory === "scba-packs";
    const isPieDeficiency = normalizedInventoryCategory === "pie";
    const isGasMonitorDeficiency = normalizedInventoryCategory === "gas-monitors";
    const isBatteryDeficiency = normalizedInventoryCategory === "battery";
    const isThermalImagingCameraDeficiency = normalizedInventoryCategory === "thermal-cameras";
    const isGroundLadderDeficiency = normalizedInventoryCategory === "ground-ladders";
    const isEmsEquipmentDeficiency = normalizedInventoryCategory === "ems-equipment";
    const isPpeDeficiency = normalizedInventoryCategory === "ppe";
    const isRopeDeficiency = normalizedInventoryCategory === "rope";
    const isMiscFireEquipmentDeficiency = normalizedInventoryCategory === "misc-fire-equipment";

    const routeToNextStep = (insertedDeficiencyId?: string) => {
      if (isFireHoseDeficiency && failedHoseIds.length > 0 && failedIndex < failedHoseIds.length - 1) {
        const nextIndex = failedIndex + 1;
        const nextHoseId = failedHoseIds[nextIndex];
        const params = new URLSearchParams();

        if (safeReturnTo) {
          params.set("returnTo", safeReturnTo);
        }

        if (apparatusIdParam) {
          params.set("apparatusId", apparatusIdParam);
        }

        if (activeCheckSessionId) {
          params.set("checkSessionId", activeCheckSessionId);
        }

        params.set("inventoryCategory", "fire-hose");
        params.set("inventoryItemId", nextHoseId);
        params.set("failedHoseIds", failedHoseIds.join(","));
        params.set("failedIndex", String(nextIndex));

        router.push(`/deficiencies/report?${params.toString()}`);
        return;
      }

      if (safeReturnTo) {
        const needsRefreshReturn =
          normalizedInventoryCategory === "fire-extinguishers" ||
          normalizedInventoryCategory === "misc-fire-equipment";
        const nextReturnTo = needsRefreshReturn
          ? `${safeReturnTo}${safeReturnTo.includes("?") ? "&" : "?"}refresh=${Date.now()}`
          : safeReturnTo;

        router.push(nextReturnTo);
        return;
      }

      if (insertedDeficiencyId) {
        router.push(`/operations/deficiencies/${insertedDeficiencyId}`);
        return;
      }

      router.push("/deficiencies");
    };

    const deficiencyId = crypto.randomUUID();
    let uploadedPhotoPath: string | null = null;

    if (isSessionScopedDeficiency && (!apparatusIdParam || !apparatusIdParam.trim())) {
      setErrorMessage("This apparatus check session is missing an apparatus context.");
      setIsSubmitting(false);
      return;
    }

    const effectiveApparatusId = isSessionScopedDeficiency
      ? apparatusIdParam ?? ""
      : (formState.apparatusId || (isInventoryDeficiencyLaunch ? STATION_SUPPLY_OPTION.id : ""));

    if (isSessionScopedDeficiency && effectiveApparatusId === STATION_SUPPLY_OPTION.id) {
      setErrorMessage("Session-linked deficiencies must be reported against the active apparatus.");
      setIsSubmitting(false);
      return;
    }

    if (formState.photo) {
      const sanitizedName = formState.photo.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "photo.jpg";
      const photoPath = `${deficiencyId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("deficiency-photos")
        .upload(photoPath, formState.photo, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setErrorMessage(uploadError.message || "Unable to upload photo.");
        setIsSubmitting(false);
        return;
      }

      uploadedPhotoPath = photoPath;
    }

    const now = new Date().toISOString();
    const payload = {
      id: deficiencyId,
      category_id: formState.categoryId,
      priority: formState.priorityId,
      apparatus_id: effectiveApparatusId === STATION_SUPPLY_OPTION.id ? null : effectiveApparatusId,
      description: formState.description.trim(),
      location: null,
      reported_at: now,
      created_at: now,
      status: openStatusId,
      photo_path: uploadedPhotoPath,
      reported_by: reporter.memberId,
      check_session_id: activeCheckSessionId || null,
      fire_hose_id: isFireHoseDeficiency && inventoryItemId ? inventoryItemId : null,
      scba_cylinder_id: isScbaCylinderDeficiency && inventoryItemId ? inventoryItemId : null,
      scba_pack_id: isScbaPackDeficiency && inventoryItemId ? inventoryItemId : null,
      pie_equipment_id: isPieDeficiency && inventoryItemId ? inventoryItemId : null,
      gas_monitor_id: isGasMonitorDeficiency && inventoryItemId ? inventoryItemId : null,
      battery_id: isBatteryDeficiency && inventoryItemId ? inventoryItemId : null,
      thermal_imaging_camera_id: isThermalImagingCameraDeficiency && inventoryItemId ? inventoryItemId : null,
      ground_ladder_id: isGroundLadderDeficiency && inventoryItemId ? inventoryItemId : null,
      fire_extinguisher_id: normalizedInventoryCategory === "fire-extinguishers" && inventoryItemId ? inventoryItemId : null,
      ems_equipment_id: isEmsEquipmentDeficiency && inventoryItemId ? inventoryItemId : null,
      ppe_item_id: isPpeDeficiency && inventoryItemId ? inventoryItemId : null,
      rope_item_id: isRopeDeficiency && inventoryItemId ? inventoryItemId : null,
      misc_fire_equipment_id: isMiscFireEquipmentDeficiency && inventoryItemId ? inventoryItemId : null,
    };

    console.log("[fire-hose][deficiency-create] payload", JSON.stringify(payload, null, 2));
    console.log("[fire-hose][deficiency-create] context", {
      inventoryCategory,
      inventoryItemId,
      isFireHoseDeficiency,
      currentUrl: typeof window !== "undefined" ? window.location.href : null,
      searchParams: searchParams.toString(),
    });

    const insertResult = await supabase.from("deficiencies").insert(payload).select("id").single();

    if (insertResult.error) {
      setErrorMessage(insertResult.error.message || "Unable to submit deficiency right now.");
      setIsSubmitting(false);
      return;
    }

    const insertedDeficiencyId =
      typeof insertResult.data?.id === "string" ? insertResult.data.id : deficiencyId;

    await supabase.from("deficiency_history").insert({
      deficiency_id: insertedDeficiencyId,
      event_type: "Reported",
      event_description: "Deficiency reported.",
      member_id: reporter.memberId,
    });

    if ((isFireHoseDeficiency || isScbaCylinderDeficiency || isScbaPackDeficiency || isPieDeficiency || isGasMonitorDeficiency || isBatteryDeficiency || isThermalImagingCameraDeficiency || isGroundLadderDeficiency) && inventoryItemId) {
      let inventoryTable = "fire_hose";

      if (isScbaCylinderDeficiency) {
        inventoryTable = "scba_cylinders";
      }

      if (isScbaPackDeficiency) {
        inventoryTable = "scba_packs";
      }

      if (isPieDeficiency) {
        inventoryTable = "pie_equipment";
      }

      if (isGasMonitorDeficiency) {
        inventoryTable = "gas_monitors";
      }

      if (isBatteryDeficiency) {
        inventoryTable = "batteries";
      }

      if (isThermalImagingCameraDeficiency) {
        inventoryTable = "thermal_imaging_cameras";
      }

      if (isGroundLadderDeficiency) {
        inventoryTable = "ground_ladders";
      }

      const { data: updatedRow, error: rowUpdateError } = await supabase
        .from(inventoryTable)
        .update({ status: "Out of Service" })
        .eq("id", inventoryItemId)
        .select("id, status")
        .single();

      if (rowUpdateError || !updatedRow || updatedRow.id !== inventoryItemId) {
        const message = rowUpdateError?.message || "Failed to update expected inventory row.";
        console.error("[deficiency-create] update mismatch", {
          expectedId: inventoryItemId,
          actualRow: updatedRow ?? null,
          error: rowUpdateError ?? null,
          inventoryTable,
        });
        setErrorMessage(message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);

    routeToNextStep(insertedDeficiencyId);
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Report Deficiency</h1>
          <p className="mt-2 text-zinc-400">Capture a new deficiency using the standard application layout.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {errorMessage ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>
            ) : null}

            {isLoadingOptions ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">Loading form options...</div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              {(normalizedInventoryCategory === "fire-hose" ||
                normalizedInventoryCategory === "scba-cylinders" ||
                normalizedInventoryCategory === "scba-packs" ||
                normalizedInventoryCategory === "pie" ||
                normalizedInventoryCategory === "gas-monitors" ||
                normalizedInventoryCategory === "battery" ||
                normalizedInventoryCategory === "thermal-cameras" ||
                normalizedInventoryCategory === "ground-ladders" ||
                normalizedInventoryCategory === "ems-equipment" ||
                normalizedInventoryCategory === "ppe" ||
                normalizedInventoryCategory === "rope" ||
                normalizedInventoryCategory === "misc-fire-equipment") &&
              resolvedInventoryItemLabel ? (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Inventory Item</span>
                  <div className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300">
                    {resolvedInventoryItemLabel}
                  </div>
                </label>
              ) : null}

              {isInventoryDeficiencyLaunch && inventoryEquipmentTypeLabel ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Equipment Type</span>
                  <div className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300">
                    {inventoryEquipmentTypeLabel}
                  </div>
                </label>
              ) : null}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Apparatus</span>
                <select
                  value={formState.apparatusId}
                  onChange={(event) => setFormState((current) => ({ ...current, apparatusId: event.target.value }))}
                  disabled={isSessionScopedDeficiency}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select apparatus</option>
                  {[STATION_SUPPLY_OPTION, ...apparatusOptions].map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Category</span>
                <select
                  value={formState.categoryId}
                  onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select category</option>
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Priority</span>
                <select
                  value={formState.priorityId}
                  onChange={(event) => setFormState((current) => ({ ...current, priorityId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                >
                  <option value="">Select priority</option>
                  {priorities.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Description</span>
                <textarea
                  rows={4}
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                />
              </label>

              <div className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-zinc-200">Photo</span>
                <input
                  id="deficiency-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      photo: event.target.files && event.target.files.length > 0 ? event.target.files[0] : null,
                    }))
                  }
                  className="sr-only"
                />
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="deficiency-photo-upload"
                    className="inline-flex cursor-pointer items-center rounded-xl border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Add Photo
                  </label>
                  <span className="text-sm text-zinc-300">
                    {formState.photo ? formState.photo.name : "No photo selected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
              <Link
                href={backHref}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting || isLoadingOptions}
                className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Deficiency"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
