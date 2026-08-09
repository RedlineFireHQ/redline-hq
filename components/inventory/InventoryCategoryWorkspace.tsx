"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import HoseFormModal, { HoseFormValues } from "@/components/inventory/HoseFormModal";
import HoseTestingSessionModal, {
	HoseTestingSessionValues,
} from "@/components/inventory/HoseTestingSessionModal";
import { supabase } from "@/lib/supabase";

type ReadinessTone = "success" | "warning" | "danger";
type ActionTone = "primary" | "secondary" | "danger";

interface ReadinessItem {
	label: string;
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
}

function readinessRowClasses(tone: ReadinessTone) {
	if (tone === "success") {
		return "border-green-700/40 bg-green-900/20 hover:bg-green-900/30 text-green-200";
	}

	if (tone === "warning") {
		return "border-amber-700/40 bg-amber-900/20 hover:bg-amber-900/30 text-amber-200";
	}

	return "border-red-700/40 bg-red-900/20 hover:bg-red-900/30 text-red-200";
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

	return "border-white/15 bg-neutral-900 text-neutral-200";
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
}: InventoryCategoryWorkspaceProps) {
	const router = useRouter();
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
		() => inventoryRows.filter((row) => row.retired !== "true"),
		[inventoryRows],
	);

	const filteredRows = useMemo(() => {
		let workingRows = activeRows;

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
			return workingRows.filter((row) => row.deficiencyStatus === "Active");
		}

		console.log("WORKING ROWS", workingRows);
		return workingRows.filter((row) => row.status === "Out of Service");
	}, [
		activeReadinessFilter,
		activeRows,
		searchKeys,
		searchTerm,
		selectedHoseSizeFilter,
		selectedStatusFilter,
		selectedTestingStatusFilter,
	]);

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

	const formatNextTestDate = (value: string | null | undefined) => {
		if (!value) {
			return "Pending";
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return value;
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (parsed.getTime() < today.getTime()) {
			return "Overdue";
		}

		return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
	};

	const addOneYearIso = (isoDate: string) => {
		const parsed = new Date(`${isoDate}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) {
			return isoDate;
		}

		parsed.setFullYear(parsed.getFullYear() + 1);
		return parsed.toISOString().split("T")[0];
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
		next_test_date: string | null;
		status: string;
		},
		deficiencyStatusByHoseId: Record<string, string>,
	): InventoryRow => ({
		id: row.id,
		inventoryNumber: row.inventory_number,
		hoseSize: formatHoseSize(row.hose_size),
		length: row.booster_reel ? "N/A (Booster Reel Hose)" : `${row.hose_length ?? "-"} ft`,
			inServiceDateRaw: row.in_service_date ?? "",
		inServiceDate: formatMonthYear(row.in_service_date),
		nextTestDate: formatNextTestDate(row.next_test_date),
		deficiencyStatus: deficiencyStatusByHoseId[row.id] ?? "None",
		status: row.status,
	});

	const buildDeficiencyStatusByHoseId = async (hoseIds: string[]) => {
		if (hoseIds.length === 0) {
			return {} as Record<string, string>;
		}

		const { data: deficiencyRows, error: deficiencyRowsError } = await supabase
			.from("deficiencies")
			.select("id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
			.in("fire_hose_id", hoseIds);

		if (deficiencyRowsError) {
			console.error("[fire-hose] failed to load deficiency rows by fire_hose_id", {
				table: "deficiencies",
				select: "id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(name)",
				filter: { fire_hose_id: hoseIds },
				error: {
					code: deficiencyRowsError.code ?? null,
					message: deficiencyRowsError.message ?? null,
					details: deficiencyRowsError.details ?? null,
					hint: deficiencyRowsError.hint ?? null,
				},
			});
			return {};
		}

		const deficiencyStatusByHoseId: Record<string, string> = {};
		for (const deficiencyRow of deficiencyRows ?? []) {
			const fireHoseId = deficiencyRow.fire_hose_id;
			const statusInfo = Array.isArray(deficiencyRow.status_info)
				? deficiencyRow.status_info[0]
				: deficiencyRow.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			const isUnresolved = statusName !== "resolved" && statusName !== "closed";

			if (typeof fireHoseId === "string" && isUnresolved) {
				deficiencyStatusByHoseId[fireHoseId] = "Active";
			}
		}

		return deficiencyStatusByHoseId;
	};

	const refreshFireHoseRows = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("fire_hose")
			.select(
				"id, inventory_number, hose_size, hose_length, booster_reel, in_service_date, next_test_date, status",
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
		const deficiencyStatusByHoseId = await buildDeficiencyStatusByHoseId(
			normalizedRows
				.map((row) => row.id)
				.filter((id): id is string => typeof id === "string" && id.length > 0),
		);

		setInventoryRows(normalizedRows.map((row) => mapFireHoseRow(row, deficiencyStatusByHoseId)));
	};

	const openEditModal = (row: InventoryRow) => {
		setEditRowKey(rowIdentifier(row));
		setIsModalOpen(true);
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
			.select("id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
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
			const normalizedStatusName =
				typeof statusInfoRecord?.name === "string"
					? statusInfoRecord.name.trim().toLowerCase()
					: "";

			return normalizedStatusName !== "resolved" && normalizedStatusName !== "closed";
		});
	};

	const applyHoseTestResult = async (values: {
		testingDate: string;
		tester: string;
		hoseId: string;
		status: "passed" | "failed";
	}) => {
		if (!departmentId) {
			setToastMessage("Unable to determine department. Please refresh and try again.");
			return { ok: false, error: "Missing department context." };
		}

		const row = activeRows.find((candidate) => candidate.id === values.hoseId);
		if (!row?.id) {
			setToastMessage("Selected hose could not be found.");
			return { ok: false, error: `Missing hose row for ${values.hoseId}.` };
		}

		const nextTestDate = addOneYearIso(values.testingDate);
		const expectedStatus = values.status === "failed" ? "Out of Service" : "Ready";

		if (values.status === "passed") {
			const hasActiveDeficiency = await hasActiveDeficiencyForHose(
				row.id,
			);
			if (hasActiveDeficiency === null) {
				return { ok: false, error: "Failed to verify linked deficiencies." };
			}
			const passStatus = hasActiveDeficiency ? "Out of Service" : "Ready";
			const expectedPassStatus = passStatus;

			const { data, error } = await supabase
				.from("fire_hose")
				.update({
					next_test_date: nextTestDate,
					status: passStatus,
				})
				.eq("id", row.id)
				.eq("department_id", departmentId)
				.select();

			console.log("[fire-hose update]", {
				hoseId: row.id,
				departmentId,
				nextTestDate,
				data,
				error,
			});

			if (error) {
				const message = error.message || "Unable to save hose test results.";
				setToastMessage(message);
				console.error("[hose-test] fire_hose update failed", {
					hoseId: row.id,
					status: values.status,
					testingDate: values.testingDate,
					nextTestDate,
					error,
				});
				return { ok: false, error: message };
			}

			const { data: verificationData, error: verificationError } = await supabase
				.from("fire_hose")
				.select("next_test_date, status")
				.eq("id", row.id)
				.eq("department_id", departmentId)
				.single();

			if (verificationError || !verificationData) {
				const message = verificationError?.message || "Unable to verify hose test update.";
				setToastMessage(message);
				console.error("[hose-test] fire_hose verification failed", {
					hoseId: row.id,
					error: verificationError,
					verificationData,
				});
				return { ok: false, error: message };
			}

			const verifiedNext = verificationData.next_test_date ?? null;
			const verifiedStatus = verificationData.status ?? "";

			if (
				verifiedNext !== nextTestDate ||
				verifiedStatus !== expectedPassStatus
			) {
				const message = `Hose ${row.inventoryNumber ?? row.id} verification mismatch after save.`;
				setToastMessage(message);
				console.error("[hose-test] verification mismatch", {
					hoseId: row.id,
					expected: {
						next_test_date: nextTestDate,
						status: expectedPassStatus,
					},
					actual: verificationData,
				});
				return { ok: false, error: message };
			}

			return { ok: true };
		}

		const { data, error } = await supabase
			.from("fire_hose")
			.update({
				next_test_date: nextTestDate,
				status: "Out of Service",
			})
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.select();

		console.log("[fire-hose update]", {
			hoseId: row.id,
			departmentId,
			nextTestDate,
			data,
			error,
		});

		if (error) {
			const message = error.message || "Unable to save hose test results.";
			setToastMessage(message);
			console.error("[hose-test] fire_hose failed-update failed", {
				hoseId: row.id,
				status: values.status,
				testingDate: values.testingDate,
				nextTestDate,
				error,
			});
			return { ok: false, error: message };
		}

		const { data: verificationData, error: verificationError } = await supabase
			.from("fire_hose")
			.select("next_test_date, status")
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.single();

		if (verificationError || !verificationData) {
			const message = verificationError?.message || "Unable to verify hose test update.";
			setToastMessage(message);
			console.error("[hose-test] fire_hose failed-update verification failed", {
				hoseId: row.id,
				error: verificationError,
				verificationData,
			});
			return { ok: false, error: message };
		}

		const verifiedNext = verificationData.next_test_date ?? null;
		const verifiedStatus = verificationData.status ?? "";

		if (
			verifiedNext !== nextTestDate ||
			verifiedStatus !== expectedStatus
		) {
			const message = `Hose ${row.inventoryNumber ?? row.id} verification mismatch after save.`;
			setToastMessage(message);
			console.error("[hose-test] failed-hose verification mismatch", {
				hoseId: row.id,
				expected: {
					next_test_date: nextTestDate,
					status: expectedStatus,
				},
				actual: verificationData,
			});
			return { ok: false, error: message };
		}

		return { ok: true, failedRow: row };
	};

	const saveTestingSession = (
		values: HoseTestingSessionValues,
		options?: { closeModalOnSuccess?: boolean },
	) => {
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

				const updateResults = await Promise.all(
					targetRows.map(async (row) => {
						if (!row.id) {
							return { ok: false, error: { message: "Missing hose id." } };
						}

						const hoseStatus = values.hoseStatuses[row.id] ?? "untested";
						if (hoseStatus !== "passed" && hoseStatus !== "failed") {
							return { ok: false };
						}

						return applyHoseTestResult({
							testingDate: values.testingDate,
							tester: values.tester,
							hoseId: row.id,
							status: hoseStatus,
						});
					}),
				);

				const failedUpdate = updateResults.find((result) => !result.ok);
				if (failedUpdate) {
					return false;
				}

				for (const row of targetRows) {
					const expectedNextTestDate = addOneYearIso(values.testingDate);

					const { data: verifiedHoseRow, error: verifiedHoseRowError } = await supabase
						.from("fire_hose")
						.select("id, inventory_number, next_test_date")
						.eq("id", row.id)
						.eq("department_id", departmentId)
						.single();

					if (verifiedHoseRowError || !verifiedHoseRow) {
						const message =
							verifiedHoseRowError?.message ||
							`Unable to verify saved hose row for ${row.inventoryNumber ?? row.id}.`;
						setToastMessage(message);
						console.error("[hose-test][save-session] post-save readback failed", {
							expectedHoseId: row.id,
							expectedInventoryNumber: row.inventoryNumber ?? null,
							error: {
								code: verifiedHoseRowError?.code ?? null,
								message: verifiedHoseRowError?.message ?? null,
								details: verifiedHoseRowError?.details ?? null,
								hint: verifiedHoseRowError?.hint ?? null,
							},
						});
						return false;
					}

					console.log("[hose-test][save-session] post-save hose readback", {
						hoseId: verifiedHoseRow.id,
						inventoryNumber: verifiedHoseRow.inventory_number,
						next_test_date: verifiedHoseRow.next_test_date,
					});

					const mismatchDetails: string[] = [];
					if (verifiedHoseRow.id !== row.id) {
						mismatchDetails.push(`id expected ${row.id} got ${verifiedHoseRow.id}`);
					}
					if ((verifiedHoseRow.next_test_date ?? null) !== expectedNextTestDate) {
						mismatchDetails.push(
							`next_test_date expected ${expectedNextTestDate} got ${verifiedHoseRow.next_test_date ?? "null"}`,
						);
					}

					if (mismatchDetails.length > 0) {
						const message = `Hose ${row.inventoryNumber ?? row.id} verification mismatch: ${mismatchDetails.join("; ")}`;
						setToastMessage(message);
						console.error("[hose-test][save-session] post-save mismatch", {
							expected: {
								hoseId: row.id,
								inventoryNumber: row.inventoryNumber ?? null,
								next_test_date: expectedNextTestDate,
							},
							actual: {
								hoseId: verifiedHoseRow.id,
								inventoryNumber: verifiedHoseRow.inventory_number,
								next_test_date: verifiedHoseRow.next_test_date,
							},
						});
						return false;
					}
				}

				const testerLabel = values.tester.trim() || testerName || "Unknown Tester";
				const { data: sessionInsertData, error: sessionInsertError } = await supabase
					.from("fire_hose_testing_sessions")
					.insert({
						department_id: departmentId,
						test_date: values.testingDate,
						tester: testerLabel,
					})
					.select("id")
					.single();

				if (sessionInsertError || !sessionInsertData?.id) {
					setToastMessage(sessionInsertError?.message || "Unable to save testing session history.");
					return false;
				}

				const testingResultsPayload = targetRows
					.filter((row): row is InventoryRow & { id: string } => Boolean(row.id))
					.map((row) => {
						const hoseStatus = values.hoseStatuses[row.id] ?? "untested";
						return {
							testing_session_id: sessionInsertData.id,
							department_id: departmentId,
							hose_id: row.id,
							inventory_number: row.inventoryNumber ?? "",
							test_date: values.testingDate,
							tester: testerLabel,
							result: hoseStatus === "failed" ? "fail" : "pass",
						};
					});

				const { error: resultsInsertError } = await supabase
					.from("fire_hose_testing_results")
					.insert(testingResultsPayload);

				if (resultsInsertError) {
					setToastMessage(resultsInsertError.message || "Unable to save hose test result history.");
					console.error("[hose-test] fire_hose_testing_results insert failed", {
						testingSessionId: sessionInsertData.id,
						testingResultsPayload,
						error: resultsInsertError,
					});
					return false;
				}

				const { data: insertedResults, error: insertedResultsError } = await supabase
					.from("fire_hose_testing_results")
					.select("hose_id, result, tester, testing_session_id")
					.eq("testing_session_id", sessionInsertData.id)
					.eq("department_id", departmentId);

				if (insertedResultsError) {
					setToastMessage(insertedResultsError.message || "Unable to verify saved hose test results.");
					console.error("[hose-test] fire_hose_testing_results verification query failed", {
						testingSessionId: sessionInsertData.id,
						error: insertedResultsError,
					});
					return false;
				}

				const expectedByHoseId = new Map(
					testingResultsPayload.map((record) => [record.hose_id, record.result]),
				);

				if ((insertedResults ?? []).length !== testingResultsPayload.length) {
					const message = "Saved hose testing result count does not match tested hose count.";
					setToastMessage(message);
					console.error("[hose-test] results count mismatch", {
						testingSessionId: sessionInsertData.id,
						expectedCount: testingResultsPayload.length,
						actualCount: (insertedResults ?? []).length,
						insertedResults,
					});
					return false;
				}

				const invalidResult = (insertedResults ?? []).find((resultRow) => {
					const expected = expectedByHoseId.get(resultRow.hose_id);
					const testerMatches = resultRow.tester === testerLabel;
					const sessionMatches = resultRow.testing_session_id === sessionInsertData.id;
					return expected !== resultRow.result || !testerMatches || !sessionMatches;
				});

				if (invalidResult) {
					const message = "Saved hose testing results did not match expected values.";
					setToastMessage(message);
					console.error("[hose-test] results verification mismatch", {
						testingSessionId: sessionInsertData.id,
						invalidResult,
						expectedByHoseId: Object.fromEntries(expectedByHoseId),
					});
					return false;
				}

				await refreshFireHoseRows();
				router.refresh();
				if (options?.closeModalOnSuccess ?? true) {
					setIsTestingModalOpen(false);
				}
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
				throw err;
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

		const saved = await saveTestingSession(values, { closeModalOnSuccess: false });
		if (!saved) {
			return false;
		}

		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/fire-hose");
		params.set("inventoryCategory", "fire-hose");
		params.set("apparatusId", "station-supply");
		params.set("failedHoseIds", failedHoses.map((hose) => hose.id).join(","));
		params.set("failedIndex", "0");
		params.set("inventoryItemId", failedHoses[0].id);
		params.set("inventoryItemLabel", failedHoses[0].inventoryNumber);

		setIsTestingModalOpen(false);
		router.push(`/deficiencies/report?${params.toString()}`);
		return true;
	};

	const saveQuickTestResult = async (values: {
		testingDate: string;
		tester: string;
		hoseId: string;
		status: "passed" | "failed";
	}) => {
		try {
			const result = await applyHoseTestResult(values);
			if (!result.ok) {
				return false;
			}

			await refreshFireHoseRows();
			router.refresh();
			setToastMessage(`Marked ${values.hoseId} as ${values.status === "passed" ? "PASS" : "FAIL"}.`);
			return true;
		} catch (err) {
			console.error("START HOSE TEST ERROR", err);
			throw err;
		}
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
				hose_length: values.boosterReelHose ? null : parseLengthFeet(values.length),
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
			hose_length: values.boosterReelHose ? null : parseLengthFeet(values.length),
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

			const { data: retiredRow, error: retireError } = await supabase
				.from("fire_hose")
				.update({ status: "Out of Service" })
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, status")
				.single();

			if (retireError || !retiredRow || retiredRow.id !== editingRow.id) {
				console.error("[fire-hose][retire] update mismatch", {
					expectedHoseId: editingRow.id,
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

			<div>
				<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>

				<h1 className="mt-2 text-5xl font-black tracking-tight text-white">{title}</h1>

				<p className="mt-3 max-w-2xl text-lg text-neutral-400">{subtitle}</p>
			</div>

			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-2xl font-bold text-white">{title} Readiness</h2>

						<div className="mt-4 space-y-2">
							{readinessItems.map((item) => (
								<button
									key={item.label}
									type="button"
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
							<div className="flex flex-col items-start gap-2">
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
						<p className="mt-1 text-4xl font-black text-white">{readinessScore}%</p>
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
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="overflow-x-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
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
							{filteredRows.length === 0 && (
								<tr>
									<td
										colSpan={columns.length}
										className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400"
									>
										No fire hose has been added yet.
									</td>
								</tr>
							)}
							{filteredRows.map((row) => {
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
										const value = row[column.key] ?? "-";

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
							})}
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
				onReportDeficiency={editingRow ? reportEditingHoseDeficiency : undefined}
			/>

			<HoseTestingSessionModal
				isOpen={isTestingModalOpen}
				defaultTester={testerName}
				departmentName={departmentName ?? "Department"}
				hoses={activeRows
					.filter((row) => Boolean(row.id))
					.map((row) => ({
						id: row.id,
						inventoryNumber: row.inventoryNumber ?? "-",
						hoseSize: row.hoseSize ?? "-",
						length: row.length ?? "-",
					}))}
				onClose={() => setIsTestingModalOpen(false)}
				onSave={saveTestingSession}
				onCreateDeficiencies={createDeficienciesForFailedHoses}
				onQuickMark={saveQuickTestResult}
			/>
		</div>
	);
}