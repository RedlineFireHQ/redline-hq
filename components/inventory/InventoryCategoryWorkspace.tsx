"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import HoseFormModal, { HoseFormValues } from "@/components/inventory/HoseFormModal";
import HoseTestingSessionModal, {
	HoseTestingSessionValues,
} from "@/components/inventory/HoseTestingSessionModal";
import { supabase } from "@/lib/supabase";
import { completeHoseTest, formatHoseTestDate, hoseNextTestLabel } from "@/lib/fire-hose-testing";

const HOSE_TESTING_RESUME_STORAGE_KEY = "fire-hose-testing-resume";

type ReadinessTone = "success" | "warning" | "danger";
type ActionTone = "primary" | "secondary" | "danger";

interface ReadinessItem {
	label: string;
	count?: number;
	filter: "all" | "tests-due" | "deficiencies" | "out-of-service";
	tone: ReadinessTone;
}

interface QuickAction {
	label: string;
	href?: string;
	tone: ActionTone;
}

interface InventoryColumn {
	key: string;
	label: string;
}

type InventoryRow = Record<string, string>;

interface InventoryCategoryWorkspaceProps {
	title: string;
	subtitle: string;
	readinessScore: number;
	readinessLabel: string;
	readinessMessage: string;
	readinessItems: ReadinessItem[];
	searchPlaceholder: string;
	filters: string[];
	actions: QuickAction[];
	columns: InventoryColumn[];
	rows: InventoryRow[];
	departmentId?: string | null;
	departmentName?: string | null;
	searchKeys?: string[];
	initialError?: string | null;
	canManageInventory?: boolean;
	canDeleteHose?: boolean;
}

function readinessRowClasses(tone: ReadinessTone) {
	if (tone === "success") {
		return "cursor-pointer border-green-700/40 bg-green-900/20 hover:bg-green-900/30 text-green-200";
	}

	if (tone === "warning") {
		return "cursor-pointer border-amber-700/40 bg-amber-900/20 hover:bg-amber-900/30 text-amber-200";
	}

	return "cursor-pointer border-red-700/40 bg-red-900/20 hover:bg-red-900/30 text-red-200";
}

function quickActionClasses(tone: ActionTone) {
	if (tone === "primary") {
		return "border border-red-500/40 bg-red-600 px-4 py-3 text-white hover:bg-red-700";
	}

	if (tone === "danger") {
		return "border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 hover:bg-red-500/20";
	}

	return "border border-white/15 bg-neutral-900 px-4 py-3 text-white hover:bg-neutral-800";
}

function statusPillClasses(status: string) {
	if (status === "Ready") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Testing Due") {
		return "border-amber-700/40 bg-amber-900/20 text-amber-300";
	}

	if (status === "Out of Service") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

	if (status === "Retired") {
		return "border-neutral-600/40 bg-neutral-800 text-neutral-300";
	}

	return "border-white/15 bg-neutral-900 text-neutral-200";
}

function rowHasActiveDeficiency(row: InventoryRow) {
	return row.hasActiveDeficiency === "true" || row.deficiencyStatus === "Active";
}

export default function InventoryCategoryWorkspace({
	title,
	subtitle,
	readinessScore,
	readinessLabel,
	readinessMessage,
	readinessItems,
	searchPlaceholder,
	filters,
	actions,
	columns,
	rows,
	departmentId: initialDepartmentId = null,
	departmentName = null,
	searchKeys = ["inventoryNumber", "hoseSize", "length"],
	initialError = null,
	canDeleteHose = false,
}: InventoryCategoryWorkspaceProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const resumeTestingSummary = searchParams.get("resumeTestingSummary") === "1";
	const scoreWidth = `${Math.max(0, Math.min(100, readinessScore))}%`;
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [activeReadinessFilter, setActiveReadinessFilter] = useState<ReadinessItem["filter"]>("all");
	const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>(rows);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
	const [selectedHoseSizeFilter, setSelectedHoseSizeFilter] = useState("All");
	const [selectedTestingStatusFilter, setSelectedTestingStatusFilter] = useState("All");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isTestingModalOpen, setIsTestingModalOpen] = useState(false);
	const [editRowKey, setEditRowKey] = useState<string | null>(null);
	const [testerName, setTesterName] = useState("");
	const [resumeTestingValues, setResumeTestingValues] = useState<HoseTestingSessionValues | null>(
		null,
	);
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [toastVisible, setToastVisible] = useState(Boolean(initialError));

	useEffect(() => {
		console.log("[fire-hose][trace] InventoryCategoryWorkspace rows prop", rows);
	}, [rows]);

	useEffect(() => {
		setInventoryRows(rows);
	}, [rows]);

	useEffect(() => {
		setDepartmentId(initialDepartmentId);
	}, [initialDepartmentId]);

	useEffect(() => {
		if (departmentId) {
			return;
		}

		let isMounted = true;

		const loadDepartmentId = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const email = user?.email?.trim();

			if (!email) {
				return;
			}

			const { data, error } = await supabase
				.from("members")
				.select("department_id")
				.eq("email", email)
				.maybeSingle();

			if (error || !isMounted) {
				return;
			}

			const nextDepartmentId =
				typeof data?.department_id === "string" ? data.department_id : null;

			if (nextDepartmentId) {
				setDepartmentId(nextDepartmentId);
			}
		};

		void loadDepartmentId();

		return () => {
			isMounted = false;
		};
	}, [departmentId]);

	useEffect(() => {
		let isMounted = true;

		const loadTesterName = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const email = user?.email?.trim();
			if (!email || !isMounted) {
				return;
			}

			const { data } = await supabase
				.from("members")
				.select("first_name, last_name")
				.eq("email", email)
				.maybeSingle();

			if (!isMounted) {
				return;
			}

			const firstName =
				typeof data?.first_name === "string" ? data.first_name.trim() : "";
			const lastName = typeof data?.last_name === "string" ? data.last_name.trim() : "";
			const fullName = `${firstName} ${lastName}`.trim();
			setTesterName(fullName || email);
		};

		void loadTesterName();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!resumeTestingSummary || isTestingModalOpen) {
			return;
		}

		if (!departmentId) {
			return;
		}

		if (typeof window === "undefined") {
			return;
		}

		const raw = window.sessionStorage.getItem(HOSE_TESTING_RESUME_STORAGE_KEY);
		if (!raw) {
			router.replace("/inventory/fire-hose");
			return;
		}

		let isMounted = true;

		const resumeTestingFlow = async () => {
			try {
				const parsed = JSON.parse(raw) as HoseTestingSessionValues;
				if (
					typeof parsed.testingDate === "string" &&
					typeof parsed.tester === "string" &&
					parsed.hoseStatuses &&
					typeof parsed.hoseStatuses === "object"
				) {
					await refreshFireHoseRows();
					if (!isMounted) {
						return;
					}

					setResumeTestingValues(parsed);
					setIsTestingModalOpen(true);
				}
			} catch {
				// Ignore malformed resume payload and continue to normal page load.
			} finally {
				if (!isMounted) {
					return;
				}

				window.sessionStorage.removeItem(HOSE_TESTING_RESUME_STORAGE_KEY);
				router.replace("/inventory/fire-hose");
			}
		};

		void resumeTestingFlow();

		return () => {
			isMounted = false;
		};
	}, [departmentId, isTestingModalOpen, resumeTestingSummary, router]);

	useEffect(() => {
		if (!toastMessage) {
			return;
		}

		setToastVisible(true);
		const timeout = window.setTimeout(() => {
			setToastVisible(false);
		}, 4000);

		return () => window.clearTimeout(timeout);
	}, [toastMessage]);

	const activeRows = useMemo(
		() => inventoryRows.filter((row) => row.retired !== "true" && row.status !== "Retired"),
		[inventoryRows],
	);

	const filteredRows = useMemo(() => {
		let workingRows =
			selectedStatusFilter === "Retired"
				? inventoryRows.filter((row) => row.status === "Retired")
				: activeRows;

		if (searchTerm.trim().length > 0) {
			const normalized = searchTerm.trim().toLowerCase();
			workingRows = workingRows.filter((row) =>
				searchKeys.some((key) => (row[key] ?? "").toLowerCase().includes(normalized)),
			);
		}

		if (selectedStatusFilter !== "All") {
			workingRows = workingRows.filter((row) => row.status === selectedStatusFilter);
		}

		if (selectedHoseSizeFilter !== "All") {
			workingRows = workingRows.filter((row) => row.hoseSize === selectedHoseSizeFilter);
		}

		if (selectedTestingStatusFilter !== "All") {
			if (selectedTestingStatusFilter === "Overdue") {
				workingRows = workingRows.filter((row) => row.nextTestDate === "Overdue");
			} else if (selectedTestingStatusFilter === "Due Soon") {
				workingRows = workingRows.filter((row) => row.status === "Testing Due");
			} else if (selectedTestingStatusFilter === "Current") {
				workingRows = workingRows.filter(
					(row) => row.status === "Ready" && row.nextTestDate !== "Overdue",
				);
			}
		}

		if (activeReadinessFilter === "all") {
			return workingRows;
		}

		if (activeReadinessFilter === "tests-due") {
			return workingRows.filter(
				(row) => row.status === "Testing Due" || row.nextTestDate === "Overdue",
			);
		}

		if (activeReadinessFilter === "deficiencies") {
			return workingRows.filter((row) => rowHasActiveDeficiency(row));
		}

		console.log("WORKING ROWS", workingRows);
		return workingRows.filter((row) => row.status === "Out of Service");
	}, [
		activeReadinessFilter,
		activeRows,
		inventoryRows,
		searchKeys,
		searchTerm,
		selectedHoseSizeFilter,
		selectedStatusFilter,
		selectedTestingStatusFilter,
	]);

	const hasAnyInventoryRows = inventoryRows.length > 0;
	const hasVisibleRows = filteredRows.length > 0;

	const hoseSizeOptions = useMemo(
		() => [
			"All",
			...Array.from(new Set(activeRows.map((row) => row.hoseSize).filter(Boolean))).sort(),
		],
		[activeRows],
	);

	const rowIdentifier = (row: InventoryRow) =>
		row.id ?? row.inventoryNumber ?? row.serialNumber ?? `${row.hoseSize}-${row.length}`;

	const editingRow = useMemo(
		() =>
			editRowKey
				? inventoryRows.find((row) => rowIdentifier(row) === editRowKey) ?? null
				: null,
		[editRowKey, inventoryRows],
	);

	const toDateInputValue = (value: string) => {
		if (!value || value === "-") {
			return "";
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return "";
		}

		return parsed.toISOString().split("T")[0];
	};

	const formatMonthYear = (value: string) => {
		if (!value) {
			return "-";
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return value;
		}

		return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
	};

	const openAddModal = () => {
		setEditRowKey(null);
		setIsModalOpen(true);
	};

	const parseLengthFeet = (value: string) => {
		const digits = value.replace(/[^0-9]/g, "");
		const parsed = Number.parseInt(digits, 10);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const parseHoseSize = (value: string) => {
		const numericText = value.replace(/"/g, "").trim();
		const parsed = Number.parseFloat(numericText);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const formatHoseSize = (value: number | string | null) => {
		if (typeof value === "number" && Number.isFinite(value)) {
			return `${value}"`;
		}

		if (typeof value === "string") {
			const trimmed = value.trim();
			if (!trimmed) {
				return "-";
			}

			const parsed = Number.parseFloat(trimmed.replace(/"/g, ""));
			if (Number.isFinite(parsed)) {
				return `${parsed}"`;
			}

			return trimmed.endsWith('"') ? trimmed : `${trimmed}"`;
		}

		return "-";
	};

	const normalizeDateValue = (value: unknown) => {
		if (value instanceof Date) {
			return value.toISOString().split("T")[0];
		}

		if (typeof value === "string") {
			return value.trim();
		}

		if (value && typeof value === "object" && "value" in value) {
			const extracted = (value as { value?: unknown }).value;
			return typeof extracted === "string" ? extracted.trim() : "";
		}

		return "";
	};

	const mapFireHoseRow = (
		row: {
		id: string;
		inventory_number: string;
		hose_size: number | string | null;
		hose_length: number | null;
		booster_reel: boolean;
		in_service_date: string;
		last_test_date: string | null;
		next_test_date: string | null;
		status: string;
		},
		hasActiveDeficiencyByHoseId: Record<string, boolean>,
	): InventoryRow => {
		const hasActiveDeficiency = hasActiveDeficiencyByHoseId[row.id] === true;
		return {
			id: row.id,
			inventoryNumber: row.inventory_number,
			hoseSize: formatHoseSize(row.hose_size),
			length: row.booster_reel ? "N/A (Booster Reel Hose)" : `${row.hose_length ?? "-"} ft`,
			inServiceDateRaw: row.in_service_date ?? "",
			inServiceDate: formatMonthYear(row.in_service_date),
			lastTestDate: formatHoseTestDate(row.last_test_date),
			nextTestDateRaw: row.next_test_date ?? "",
			nextTestDate: hoseNextTestLabel(row.next_test_date),
			deficiencyStatus: hasActiveDeficiency ? "Active" : "None",
			hasActiveDeficiency: hasActiveDeficiency ? "true" : "false",
			status: row.status,
		};
	};

	const buildDeficiencyStatusByHoseId = async (hoseIds: string[]) => {
		if (hoseIds.length === 0) {
			return {
				hasActiveDeficiencyByHoseId: {} as Record<string, boolean>,
				linkedDeficiencyCountByHoseId: {} as Record<string, number>,
				activeDeficiencyCountByHoseId: {} as Record<string, number>,
			};
		}

		const { data: deficiencyRows, error: deficiencyRowsError } = await supabase
			.from("deficiencies")
			.select("id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
			.in("fire_hose_id", hoseIds);

		if (deficiencyRowsError) {
			console.error("[fire-hose] failed to load deficiency rows by fire_hose_id", {
				table: "deficiencies",
				select: "id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active)",
				filter: { fire_hose_id: hoseIds },
				error: {
					code: deficiencyRowsError.code ?? null,
					message: deficiencyRowsError.message ?? null,
					details: deficiencyRowsError.details ?? null,
					hint: deficiencyRowsError.hint ?? null,
				},
			});
			return {
				hasActiveDeficiencyByHoseId: {},
				linkedDeficiencyCountByHoseId: {},
				activeDeficiencyCountByHoseId: {},
			};
		}

		const hasActiveDeficiencyByHoseId: Record<string, boolean> = {};
		const linkedDeficiencyCountByHoseId: Record<string, number> = {};
		const activeDeficiencyCountByHoseId: Record<string, number> = {};
		for (const deficiencyRow of deficiencyRows ?? []) {
			const fireHoseId = deficiencyRow.fire_hose_id;
			if (typeof fireHoseId !== "string" || fireHoseId.length === 0) {
				continue;
			}

			linkedDeficiencyCountByHoseId[fireHoseId] =
				(linkedDeficiencyCountByHoseId[fireHoseId] ?? 0) + 1;

			const statusInfo = Array.isArray(deficiencyRow.status_info)
				? deficiencyRow.status_info[0]
				: deficiencyRow.status_info;
			const isActive = statusInfo?.active === true;

			if (isActive) {
				activeDeficiencyCountByHoseId[fireHoseId] =
					(activeDeficiencyCountByHoseId[fireHoseId] ?? 0) + 1;
				hasActiveDeficiencyByHoseId[fireHoseId] = true;
			}
		}

		return {
			hasActiveDeficiencyByHoseId,
			linkedDeficiencyCountByHoseId,
			activeDeficiencyCountByHoseId,
		};
	};

	const refreshFireHoseRows = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("fire_hose")
			.select(
				"id, inventory_number, hose_size, hose_length, booster_reel, in_service_date, last_test_date, next_test_date, status",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[fire-hose] failed to refresh rows", error);
			alert(error.message);
			setToastMessage(error.message || "Unable to refresh fire hose records.");
			return;
		}

		const normalizedRows = data ?? [];
		const deficiencyState = await buildDeficiencyStatusByHoseId(
			normalizedRows
				.map((row) => row.id)
				.filter((id): id is string => typeof id === "string" && id.length > 0),
		);

		for (const row of normalizedRows) {
			console.log("[fire-hose][deficiency-state]", {
				inventoryNumber: row.inventory_number,
				fireHoseId: row.id,
				linkedDeficiencyCount: deficiencyState.linkedDeficiencyCountByHoseId[row.id] ?? 0,
				activeDeficiencyCount: deficiencyState.activeDeficiencyCountByHoseId[row.id] ?? 0,
				hasActiveDeficiency: deficiencyState.hasActiveDeficiencyByHoseId[row.id] === true,
			});
		}

		setInventoryRows(
			normalizedRows.map((row) =>
				mapFireHoseRow(row, deficiencyState.hasActiveDeficiencyByHoseId),
			),
		);
	};

	const openEditModal = (row: InventoryRow) => {
		setEditRowKey(rowIdentifier(row));
		setIsModalOpen(true);
	};

	const viewEditingHoseTestingHistory = () => {
		if (!editingRow?.id) {
			return;
		}

		router.push(`/inventory/fire-hose/testing-history?hoseId=${encodeURIComponent(editingRow.id)}`);
	};

	const reportEditingHoseDeficiency = () => {
		if (!editingRow) {
			return;
		}

		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/fire-hose");
		params.set("inventoryCategory", "fire-hose");
		params.set("inventoryItemId", editingRow.id ?? "");
		params.set("inventoryItemLabel", editingRow.inventoryNumber ?? "");
		params.set("apparatusId", editingRow.apparatusId ?? "station-supply");

		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const openTestingSession = () => {
		try {
			setResumeTestingValues(null);
			setIsTestingModalOpen(true);
		} catch (err) {
			console.error("START HOSE TEST ERROR", err);
			throw err;
		}
	};

	const hasActiveDeficiencyForHose = async (hoseId: string): Promise<boolean | null> => {
		if (!hoseId) {
			return false;
		}

		const { data: deficiencyRows, error: deficiencyRowsError } = await supabase
			.from("deficiencies")
			.select("id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
			.eq("fire_hose_id", hoseId);

		if (deficiencyRowsError) {
			console.error(
				"[fire-hose] failed to check linked deficiencies",
				JSON.stringify(deficiencyRowsError, null, 2),
			);
			setToastMessage(
				deficiencyRowsError.message || "Unable to verify linked deficiencies for this hose.",
			);
			return null;
		}

		return (deficiencyRows ?? []).some((record) => {
			const statusInfoRecord = Array.isArray(record.status_info)
				? record.status_info[0]
				: record.status_info;

			return statusInfoRecord?.active === true;
		});
	};

	const saveTestingSession = (values: HoseTestingSessionValues) => {
		return (async () => {
			try {
				if (!departmentId) {
					setToastMessage("Unable to determine department. Please refresh and try again.");
					return false;
				}

				const targetRows = activeRows.filter((row) => {
					if (!row.id) {
						return false;
					}

					const hoseStatus = values.hoseStatuses[row.id] ?? "untested";
					return hoseStatus === "passed" || hoseStatus === "failed";
				});

				if (targetRows.length === 0) {
					setToastMessage("Mark at least one hose as Passed or Failed before saving.");
					return false;
				}

				const failedRows = targetRows.filter((row) => values.hoseStatuses[row.id] === "failed");
				for (const failedRow of failedRows) {
					const hasActiveDeficiency = await hasActiveDeficiencyForHose(failedRow.id);
					if (hasActiveDeficiency !== true) {
						setToastMessage(
							"Failed hoses require deficiencies. Use Create Deficiencies from the summary to continue.",
						);
						return false;
					}
				}

				await completeHoseTest(supabase, {
					departmentId,
					testingDate: values.testingDate,
					tester: values.tester.trim() || testerName || "Unknown Tester",
					results: targetRows.map((row) => ({
						hose_id: row.id,
						result: values.hoseStatuses[row.id] === "failed" ? "fail" : "pass",
					})),
				});

				await refreshFireHoseRows();
				router.refresh();
				setIsTestingModalOpen(false);
				setToastMessage(`Successfully tested ${targetRows.length} hoses.`);
				return true;
			} catch (err) {
				console.error("START HOSE TEST ERROR", err);
				const message =
					err instanceof Error
						? err.message
						: typeof err === "string"
							? err
							: JSON.stringify(err);
				setToastMessage(message || "Unexpected Start Hose Test error.");
				return false;
			}
		})();
	};

	const createDeficienciesForFailedHoses = async (
		failedHoses: Array<{ id: string; inventoryNumber: string }>,
		values: HoseTestingSessionValues,
	) => {
		if (failedHoses.length === 0) {
			return false;
		}

		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/fire-hose?resumeTestingSummary=1");
		params.set("inventoryCategory", "fire-hose");
		params.set("apparatusId", "station-supply");
		params.set("failedHoseIds", failedHoses.map((hose) => hose.id).join(","));
		params.set("failedIndex", "0");
		params.set("inventoryItemId", failedHoses[0].id);
		params.set("inventoryItemLabel", failedHoses[0].inventoryNumber);

		if (typeof window !== "undefined") {
			window.sessionStorage.setItem(HOSE_TESTING_RESUME_STORAGE_KEY, JSON.stringify(values));
		}

		setIsTestingModalOpen(false);
		router.push(`/deficiencies/report?${params.toString()}`);
		return true;
	};

	const saveHose = (values: HoseFormValues) => {
		console.log("3 - saveHose received", values);
		void (async () => {
		const rawInServiceDate = (values as { inServiceDate: unknown }).inServiceDate;
		console.log("4 - normalizeDateValue input", rawInServiceDate);
		const normalizedInServiceDate = normalizeDateValue(rawInServiceDate);
		console.log("5 - normalized value", normalizedInServiceDate);

		console.log("FORM VALUES");
		console.table({
			inventoryNumber: values.inventoryNumber,
			hoseSize: values.hoseSize,
			length: values.length,
			inServiceDate: values.inServiceDate,
			boosterReelHose: values.boosterReelHose,
		});

		const hasInventoryNumber = typeof values.inventoryNumber === "string" && values.inventoryNumber.trim().length > 0;
		const hasHoseSize = typeof values.hoseSize === "string" && values.hoseSize.trim().length > 0;
		const hasInServiceDate = normalizedInServiceDate.length > 0;

		if (!hasInventoryNumber || !hasHoseSize || !hasInServiceDate) {
			setToastMessage("Inventory Number, Hose Size, and In Service Date are required.");
			alert("Inventory Number, Hose Size, and In Service Date are required.");
			return;
		}

		if (!editingRow) {
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				alert("Unable to determine department. Please refresh and try again.");
				return;
			}

			const insertPayload = {
				department_id: departmentId,
				inventory_number: values.inventoryNumber.trim(),
				hose_size: parseHoseSize(values.hoseSize),
				hose_length: values.boosterReelHose ? 0 : parseLengthFeet(values.length),
				booster_reel: values.boosterReelHose,
				in_service_date: normalizedInServiceDate,
				status: "Ready",
			};

			console.log("Form data for insert", insertPayload);
			console.log("About to insert fire_hose");

			const { data, error } = await supabase.from("fire_hose").insert(insertPayload).select();

			console.log({ data, error });

			if (error) {
				console.error(error);
				alert(error.message);
				setToastMessage(error.message || "Unable to save hose.");
				return;
			}

			await refreshFireHoseRows();
			setIsModalOpen(false);
			setEditRowKey(null);
			alert("Hose saved successfully");
			return;
		}

		if (!departmentId || !editingRow?.id) {
			setToastMessage("Unable to update hose: missing hose id or department.");
			return;
		}

		const updatePayload = {
			inventory_number: values.inventoryNumber.trim(),
			hose_size: parseHoseSize(values.hoseSize),
			hose_length: values.boosterReelHose ? 0 : parseLengthFeet(values.length),
			booster_reel: values.boosterReelHose,
			in_service_date: normalizeDateValue(values.inServiceDate),
		};

		const { data: updatedHose, error: updateError } = await supabase
			.from("fire_hose")
			.update(updatePayload)
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (updateError || !updatedHose || updatedHose.id !== editingRow.id) {
			console.error("[fire-hose][edit] update mismatch", {
				expectedHoseId: editingRow.id,
				actualRow: updatedHose ?? null,
				error: updateError ?? null,
				payload: updatePayload,
			});
			setToastMessage(updateError?.message || "Unable to update hose.");
			return;
		}

		await refreshFireHoseRows();
		setIsModalOpen(false);
		setEditRowKey(null);
		})();
	};

	const retireEditingHose = () => {
		void (async () => {
			if (!editRowKey || !departmentId || !editingRow?.id) {
				setToastMessage("Unable to retire hose: missing hose id or department.");
				return;
			}

			const hoseLabel = editingRow.inventoryNumber ?? editingRow.id;
			const confirmed = window.confirm(
				`Retire Hose #${hoseLabel}?\n\nThis hose will be removed from active inventory but retained in your records and testing history.`,
			);

			if (!confirmed) {
				return;
			}

			const { data: retiredRow, error: retireError } = await supabase
				.from("fire_hose")
				.update({ status: "Retired" })
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, status")
				.single();

			if (
				retireError ||
				!retiredRow ||
				retiredRow.id !== editingRow.id ||
				retiredRow.status !== "Retired"
			) {
				console.error("[fire-hose][retire] update mismatch", {
					expectedHoseId: editingRow.id,
					expectedStatus: "Retired",
					actualRow: retiredRow ?? null,
					error: retireError ?? null,
				});
				setToastMessage(retireError?.message || "Unable to retire hose.");
				return;
			}

			await refreshFireHoseRows();
			setIsModalOpen(false);
			setEditRowKey(null);
		})();
	};

	const deleteEditingHose = () => {
		void (async () => {
			if (!canDeleteHose) {
				setToastMessage("Only administrators can delete hoses.");
				return;
			}

			if (!departmentId || !editingRow?.id) {
				setToastMessage("Unable to delete hose: missing hose id or department.");
				return;
			}

			const hoseLabel = editingRow.inventoryNumber ?? editingRow.id;
			const confirmed = window.confirm(
				`Delete Hose #${hoseLabel}?\n\nThis permanently removes this hose and its associated records. This action cannot be undone.`,
			);

			if (!confirmed) {
				return;
			}

			const { data: deletedRow, error: deleteError } = await supabase
				.from("fire_hose")
				.delete()
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id")
				.single();

			if (deleteError || !deletedRow || deletedRow.id !== editingRow.id) {
				console.error("[fire-hose][delete] delete mismatch", {
					expectedHoseId: editingRow.id,
					actualRow: deletedRow ?? null,
					error: deleteError ?? null,
				});
				setToastMessage(deleteError?.message || "Unable to delete hose.");
				return;
			}

			await refreshFireHoseRows();
			setIsModalOpen(false);
			setEditRowKey(null);
		})();
	};

	return (
		<div className="space-y-8">
			{toastVisible && toastMessage && (
				<div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-[#2E2E2E] px-4 py-3 text-sm text-red-200 shadow-lg">
					<div className="flex items-center gap-3">
						<span>{toastMessage}</span>
						<button
							type="button"
							onClick={() => setToastVisible(false)}
							className="text-red-200/80 transition hover:text-red-100"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{title !== "Fire Hose" && (
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>

					<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{title}</h1>

					<p className="mt-3 max-w-2xl text-lg text-neutral-400">{subtitle}</p>
				</div>
			)}

			{title === "Fire Hose" && (
				<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="min-w-0 flex-1">
							<div className="mb-4">
								<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
								<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{title}</h1>
								<p className="mt-3 max-w-2xl text-lg text-neutral-400">{subtitle}</p>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								{actions.map((action) =>
									action.label === "Report Deficiency" && action.href ? (
										<Link
											key={action.label}
											href={action.href}
											className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
										>
											{action.label}
										</Link>
									) : null,
								)}
								<Link
									href="/inventory/fire-hose/testing-history"
									className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									View Testing History →
								</Link>
								<button
									type="button"
									onClick={openTestingSession}
									className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									Start Hose Test
								</button>
								{actions.some((action) => action.label === "+ Add Hose") && (
									<button
										type="button"
										onClick={openAddModal}
										className={`rounded-lg text-xs font-semibold transition ${quickActionClasses(
											actions.find((action) => action.label === "+ Add Hose")?.tone ?? "primary",
										)}`}
									>
										+ Add Hose
									</button>
								)}
							</div>
						</div>

						<div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:max-w-[520px] lg:justify-end">
							{readinessItems.map((item) => (
								<button
									key={item.label}
									type="button"
									aria-pressed={activeReadinessFilter === item.filter}
									onClick={() =>
										setActiveReadinessFilter((current) =>
											current === item.filter ? "all" : item.filter,
										)
									}
									className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${readinessRowClasses(item.tone)} ${
										activeReadinessFilter === item.filter ? "ring-1 ring-white/30" : ""
									}`}
								>
									<span>{item.label}</span>
									{typeof item.count === "number" ? (
										<span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black/20 px-1.5 py-0.5 text-xs font-bold text-white">
											{item.count}
										</span>
									) : null}
								</button>
							))}
						</div>
					</div>
				</section>
			)}

			{title !== "Fire Hose" && (
			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-2xl font-bold text-white">{title} Readiness</h2>

						<div className="mt-4 space-y-2">
							{readinessItems.map((item) => (
								<button
									key={item.label}
									type="button"
									aria-pressed={activeReadinessFilter === item.filter}
									onClick={() =>
										setActiveReadinessFilter((current) =>
											current === item.filter ? "all" : item.filter,
										)
									}
									className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition ${readinessRowClasses(item.tone)} ${
										activeReadinessFilter === item.filter
											? "ring-1 ring-white/30"
											: ""
									}`}
								>
									{item.label}
								</button>
							))}
						</div>

						<div className="mt-4">
							<div className="flex flex-wrap items-start gap-2">
							{actions.map((action) =>
								action.label === "Report Deficiency" && action.href ? (
									<Link
										key={action.label}
										href={action.href}
										className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
									>
										{action.label}
									</Link>
								) : null,
							)}
								<Link
									href="/inventory/fire-hose/testing-history"
									className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									View Testing History →
								</Link>
								<button
									type="button"
									onClick={openTestingSession}
									className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									Start Hose Test
								</button>
							</div>
						</div>
					</div>

					<div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Fire Hose Readiness</p>
						<p className="mt-1 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{readinessScore}%</p>
						<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
							{readinessLabel}
						</p>
						<p className="mt-3 text-sm text-neutral-400">{readinessMessage}</p>

						<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
							<div className="h-full rounded-full bg-red-500 transition-all" style={{ width: scoreWidth }} />
						</div>
					</div>
				</div>
			</section>

			)}
			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="inventory-search" className="sr-only">
							Search inventory
						</label>
						<input
							id="inventory-search"
							type="text"
							placeholder={searchPlaceholder}
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>

					{filters.length > 0 && (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
							{title === "Fire Hose" ? (
								<div className="flex flex-wrap gap-2 sm:col-span-3">
									<button
										type="button"
										onClick={() => setSelectedStatusFilter("All")}
										className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
											selectedStatusFilter === "Retired"
												? "border-white/15 bg-neutral-900 text-white hover:bg-neutral-800"
												: "border-red-500/40 bg-red-600 text-white hover:bg-red-700"
										}`}
									>
										Active Hoses
									</button>
									<button
										type="button"
										onClick={() => setSelectedStatusFilter("Retired")}
										className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
											selectedStatusFilter === "Retired"
												? "border-red-500/40 bg-red-600 text-white hover:bg-red-700"
												: "border-white/15 bg-neutral-900 text-white hover:bg-neutral-800"
										}`}
									>
										Retired Hoses
									</button>
								</div>
							) : null}

							{filters.includes("Status") && (
								<select
									value={selectedStatusFilter}
									onChange={(event) => setSelectedStatusFilter(event.target.value)}
									className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
								>
									<option>All</option>
									<option>Ready</option>
									<option>Testing Due</option>
									<option>Out of Service</option>
									{title === "Fire Hose" ? <option>Retired</option> : null}
								</select>
							)}

							{filters.includes("Hose Size") && (
								<select
									value={selectedHoseSizeFilter}
									onChange={(event) => setSelectedHoseSizeFilter(event.target.value)}
									className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
								>
									{hoseSizeOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							)}

							{filters.includes("Testing Status") && (
								<select
									value={selectedTestingStatusFilter}
									onChange={(event) => setSelectedTestingStatusFilter(event.target.value)}
									className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
								>
									<option>All</option>
									<option>Current</option>
									<option>Due Soon</option>
									<option>Overdue</option>
								</select>
							)}
						</div>
					)}
				</div>

				{title !== "Fire Hose" && (
				<div className="mt-4 flex flex-wrap gap-3">
					{actions
						.filter((action) => action.label !== "Report Deficiency")
						.map((action) => (
							<button
								key={action.label}
								type="button"
								onClick={() => {
									if (action.label === "+ Add Hose") {
										openAddModal();
									}
								}}
								className={`rounded-xl text-sm font-semibold transition ${quickActionClasses(action.tone)}`}
							>
								{action.label}
							</button>
						))}
				</div>
				)}
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className={title === "Fire Hose" ? "max-h-[700px] overflow-auto" : "overflow-x-auto"}>
					<table className={`border-separate border-spacing-0 text-left ${title === "Fire Hose" ? "w-full min-w-[960px]" : "min-w-full"}`}>
						<thead>
							<tr>
								{columns.map((column) => (
									<th
										key={column.key}
										scope="col"
										className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
									>
										{column.label}
									</th>
								))}
							</tr>
						</thead>

						<tbody>
							{!hasAnyInventoryRows ? (
								<tr>
									<td
										colSpan={columns.length}
										className="border-b border-white/5 px-4 py-10"
									>
										<div className="flex flex-col items-start gap-4 text-left sm:items-center sm:text-center">
											<div>
												<p className="text-lg font-bold text-white">No Fire Hose Inventory</p>
												<p className="mt-2 max-w-2xl text-sm text-neutral-400">
													Add your department's hose inventory to begin tracking testing, deficiencies, and readiness.
												</p>
											</div>

											<div className="flex flex-wrap gap-3">
												{actions.some((action) => action.label === "+ Add Hose") ? (
													<button
														type="button"
														onClick={openAddModal}
														className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
													>
														Add Hose
													</button>
												) : null}
											</div>
										</div>
									</td>
								</tr>
							) : !hasVisibleRows ? (
								<tr>
									<td
										colSpan={columns.length}
										className="border-b border-white/5 px-4 py-10"
									>
										<div className="flex flex-col items-start gap-2 text-left sm:items-center sm:text-center">
											<p className="text-lg font-bold text-white">No Hoses Found</p>
											<p className="max-w-2xl text-sm text-neutral-400">No hoses currently match this filter.</p>
										</div>
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
								const rowKey = row.id ?? row.inventoryNumber ?? row.serialNumber ?? `${row.hoseSize}-${row.length}`;

								return (
								<tr
									key={rowKey}
									className="cursor-pointer transition hover:bg-white/5"
									onClick={() => openEditModal(row)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											openEditModal(row);
										}
									}}
									tabIndex={0}
								>
									{columns.map((column) => {
										const value = column.key === "nextTestDate" && row.nextTestDateRaw
											? `${formatHoseTestDate(row.nextTestDateRaw)}${row.nextTestDate === "Overdue" ? " (Overdue)" : ""}`
											: row[column.key] ?? "-";

										if (column.key === "status") {
											return (
												<td key={column.key} className="border-b border-white/5 px-4 py-3 text-sm text-white">
													<span
														className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClasses(value)}`}
													>
														{value}
													</span>
												</td>
											);
										}

										return (
											<td key={column.key} className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												{value}
											</td>
										);
									})}
								</tr>
								);
							})
							)}
						</tbody>
					</table>
				</div>
			</section>

			<HoseFormModal
				isOpen={isModalOpen}
				mode={editingRow ? "edit" : "add"}
				initialValues={
					editingRow
						? {
							inventoryNumber: editingRow.inventoryNumber ?? "",
							hoseSize: editingRow.hoseSize ?? "1\"",
							length:
								editingRow.length === "N/A (Booster Reel Hose)"
									? "25 ft"
									: editingRow.length ?? "25 ft",
							inServiceDate:
								typeof editingRow.inServiceDateRaw === "string" && editingRow.inServiceDateRaw.trim().length > 0
									? editingRow.inServiceDateRaw
									: toDateInputValue(editingRow.inServiceDate),
							boosterReelHose: editingRow.length === "N/A (Booster Reel Hose)",
						}
						: undefined
				}
				onClose={() => {
					setIsModalOpen(false);
					setEditRowKey(null);
				}}
				onSave={saveHose}
				onRetire={editingRow ? retireEditingHose : undefined}
				onDelete={editingRow && canDeleteHose ? deleteEditingHose : undefined}
				canDelete={canDeleteHose}
				onReportDeficiency={editingRow ? reportEditingHoseDeficiency : undefined}
				onViewTestingHistory={editingRow ? viewEditingHoseTestingHistory : undefined}
			/>

			<HoseTestingSessionModal
				isOpen={isTestingModalOpen}
				defaultTester={testerName}
				departmentName={departmentName ?? "Department"}
				resumeValues={resumeTestingValues}
				hoses={activeRows
					.filter((row) => Boolean(row.id))
					.map((row) => ({
						id: row.id,
						inventoryNumber: row.inventoryNumber ?? "-",
						hoseSize: row.hoseSize ?? "-",
						length: row.length ?? "-",
						hasActiveDeficiency: rowHasActiveDeficiency(row),
					}))}
				onClose={() => {
					setIsTestingModalOpen(false);
					setResumeTestingValues(null);
				}}
				onSave={saveTestingSession}
				onCreateDeficiencies={createDeficienciesForFailedHoses}
			/>
		</div>
	);
}