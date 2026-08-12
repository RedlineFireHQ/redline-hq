"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ScbaPackFormModal, {
	ScbaPackFormValues,
	ScbaPackInitialFlowTestValues,
} from "@/components/inventory/ScbaPackFormModal";
import ScbaPackFlowTestModal, {
	ScbaPackFlowTestTesterOption,
	ScbaPackFlowTestValues,
} from "@/components/inventory/ScbaPackFlowTestModal";
import ScbaPackSessionFlowTestModal, {
	ScbaPackSessionFlowTestValues,
} from "@/components/inventory/ScbaPackSessionFlowTestModal";

type ScbaPackRecord = {
	id: string;
	department_id: string;
	pack_number: string;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	in_service_date: string | null;
	last_flow_test_date: string | null;
	next_flow_test_due_date: string | null;
	status: string;
	notes: string | null;
	created_at: string;
};

interface ScbaPackWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: ScbaPackRecord[];
	initialError?: string | null;
	canDeletePack: boolean;
}

type RowTone = "ready" | "due" | "overdue" | "out-of-service" | "retired";

type MemberRecord = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type FlowTesterInput = {
	testerMode: "member" | "external";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
};

function comparePackNumbers(left: string | null | undefined, right: string | null | undefined) {
	const leftValue = typeof left === "string" ? left.trim() : "";
	const rightValue = typeof right === "string" ? right.trim() : "";

	if (!leftValue && !rightValue) {
		return 0;
	}

	if (!leftValue) {
		return 1;
	}

	if (!rightValue) {
		return -1;
	}

	return leftValue.localeCompare(rightValue, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function formatDate(value: string | null | undefined) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
}

function normalizeOptionalText(value: string) {
	return value.trim();
}

function addOneYearToIsoDate(value: string) {
	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	parsed.setFullYear(parsed.getFullYear() + 1);
	return parsed.toISOString().split("T")[0];
}

function resolveTesterFromSelection(
	values: FlowTesterInput,
	testerOptions: ScbaPackFlowTestTesterOption[],
): { tester: string; error: string | null } {
	if (values.testerMode === "member") {
		if (!values.memberId) {
			return {
				tester: "",
				error: "Select a department member or External Tester.",
			};
		}

		const selectedMember = testerOptions.find((option) => option.id === values.memberId);
		if (!selectedMember) {
			return {
				tester: "",
				error: "Selected department member is no longer available.",
			};
		}

		return {
			tester: selectedMember.label,
			error: null,
		};
	}

	const externalTesterName = normalizeOptionalText(values.externalTesterName);
	const externalTesterCompany = normalizeOptionalText(values.externalTesterCompany);

	if (!externalTesterName) {
		return {
			tester: "",
			error: "External tester name is required.",
		};
	}

	return {
		tester: externalTesterCompany ? `${externalTesterName} (${externalTesterCompany})` : externalTesterName,
		error: null,
	};
}

function buildSessionFlowTestNotes(sessionNotes: string, packNotes: string) {
	const normalizedSessionNotes = normalizeOptionalText(sessionNotes);
	const normalizedPackNotes = normalizeOptionalText(packNotes);

	if (normalizedSessionNotes && normalizedPackNotes) {
		return `${normalizedSessionNotes}\n\nPack Note: ${normalizedPackNotes}`;
	}

	if (normalizedPackNotes) {
		return normalizedPackNotes;
	}

	if (normalizedSessionNotes) {
		return normalizedSessionNotes;
	}

	return "";
}

function compareWithToday(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (parsed.getTime() < today.getTime()) {
		return "past";
	}

	if (parsed.getTime() === today.getTime()) {
		return "today";
	}

	return "future";
}

function getFlowState(row: ScbaPackRecord) {
	if (row.status === "Retired") {
		return "retired" as const;
	}

	const dueComparison = compareWithToday(row.next_flow_test_due_date);
	if (!dueComparison) {
		return "due" as const;
	}

	if (dueComparison === "past") {
		return "overdue" as const;
	}

	if (dueComparison === "today") {
		return "due" as const;
	}

	return "current" as const;
}

function statusBadgeClasses(status: string) {
	if (status === "Ready") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Flow Test Due") {
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

function summaryCardClasses(active: boolean, tone: RowTone) {
	const base = "rounded-xl border px-4 py-3 text-left transition";

	if (active) {
		return `${base} border-white/20 bg-white/[0.06]`;
	}

	if (tone === "overdue") {
		return `${base} border-red-700/30 bg-red-950/20 hover:bg-red-950/30`;
	}

	if (tone === "due") {
		return `${base} border-amber-700/30 bg-amber-950/20 hover:bg-amber-950/30`;
	}

	if (tone === "out-of-service") {
		return `${base} border-red-700/30 bg-red-950/20 hover:bg-red-950/30`;
	}

	if (tone === "retired") {
		return `${base} border-neutral-700/30 bg-neutral-900/40 hover:bg-neutral-900/60`;
	}

	return `${base} border-green-700/30 bg-green-950/20 hover:bg-green-950/30`;
}

export default function ScbaPackWorkspace({
	departmentId: initialDepartmentId = null,
	departmentName = null,
	initialRows,
	initialError = null,
	canDeletePack,
}: ScbaPackWorkspaceProps) {
	const router = useRouter();
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [inventoryRows, setInventoryRows] = useState<ScbaPackRecord[]>(initialRows);
	const [activeDeficiencyByPackId, setActiveDeficiencyByPackId] = useState<Record<string, boolean>>({});
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isFlowTestModalOpen, setIsFlowTestModalOpen] = useState(false);
	const [isSessionFlowTestModalOpen, setIsSessionFlowTestModalOpen] = useState(false);
	const [editPackId, setEditPackId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [toastVisible, setToastVisible] = useState(Boolean(initialError));
	const [isSaving, setIsSaving] = useState(false);
	const [isSavingFlowTest, setIsSavingFlowTest] = useState(false);
	const [flowTestErrorMessage, setFlowTestErrorMessage] = useState<string | null>(null);
	const [sessionFlowTestErrorMessage, setSessionFlowTestErrorMessage] = useState<string | null>(null);
	const [flowTestTesterOptions, setFlowTestTesterOptions] = useState<ScbaPackFlowTestTesterOption[]>([]);
	const [isSavingSessionFlowTest, setIsSavingSessionFlowTest] = useState(false);

	useEffect(() => {
		setDepartmentId(initialDepartmentId);
	}, [initialDepartmentId]);

	useEffect(() => {
		setInventoryRows(initialRows);
	}, [initialRows]);

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

			const nextDepartmentId = typeof data?.department_id === "string" ? data.department_id : null;
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
		if (!toastMessage) {
			return;
		}

		setToastVisible(true);
		const timeout = window.setTimeout(() => setToastVisible(false), 4000);
		return () => window.clearTimeout(timeout);
	}, [toastMessage]);

	useEffect(() => {
		if (!departmentId) {
			setFlowTestTesterOptions([]);
			return;
		}

		let isMounted = true;

		const loadTesterOptions = async () => {
			const { data, error } = await supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", departmentId)
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true });

			if (error) {
				console.error("[scba-packs] failed to load department members for flow tests", error);
				return;
			}

			if (!isMounted) {
				return;
			}

			const normalizedOptions = ((data ?? []) as MemberRecord[])
				.map((member) => {
					const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
					const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
					const label = `${firstName} ${lastName}`.trim() || member.id;

					return {
						id: member.id,
						label,
					};
				})
				.filter((member) => typeof member.id === "string" && member.id.length > 0);

			setFlowTestTesterOptions(normalizedOptions);
		};

		void loadTesterOptions();

		return () => {
			isMounted = false;
		};
	}, [departmentId]);

	const buildActiveDeficiencyMap = async (packIds: string[]) => {
		if (packIds.length === 0) {
			setActiveDeficiencyByPackId({});
			return;
		}

		const { data: deficiencyRows, error } = await supabase
			.from("deficiencies")
			.select("id, scba_pack_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.in("scba_pack_id", packIds);

		if (error) {
			console.error("[scba-packs] failed to read linked deficiencies", error);
			setToastMessage(error.message || "Unable to verify linked deficiencies.");
			return;
		}

		const nextMap: Record<string, boolean> = {};
		for (const deficiencyRow of deficiencyRows ?? []) {
			const packId = deficiencyRow.scba_pack_id;
			if (typeof packId !== "string" || !packId) {
				continue;
			}

			const statusInfo = Array.isArray(deficiencyRow.status_info)
				? deficiencyRow.status_info[0]
				: deficiencyRow.status_info;

			const statusName =
				typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			if (statusName === "resolved" || statusName === "closed") {
				continue;
			}

			if (statusInfo?.active === true) {
				nextMap[packId] = true;
				continue;
			}

			if (!statusName) {
				nextMap[packId] = true;
			}
		}

		setActiveDeficiencyByPackId(nextMap);
	};

	const refreshPacks = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("scba_packs")
			.select(
				"id, department_id, pack_number, manufacturer, model, serial_number, in_service_date, last_flow_test_date, next_flow_test_due_date, status, notes, created_at",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[scba-packs] failed to refresh rows", error);
			setToastMessage(error.message || "Unable to load SCBA packs.");
			return;
		}

		const nextRows = (data ?? []) as ScbaPackRecord[];
		setInventoryRows(nextRows);
		await buildActiveDeficiencyMap(
			nextRows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0),
		);
	};

	useEffect(() => {
		void buildActiveDeficiencyMap(
			inventoryRows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0),
		);
	}, [inventoryRows]);

	const sortedRows = useMemo(() => {
		return [...inventoryRows].sort((left, right) => {
			const leftRetired = left.status === "Retired";
			const rightRetired = right.status === "Retired";

			if (leftRetired !== rightRetired) {
				return leftRetired ? 1 : -1;
			}

			return comparePackNumbers(left.pack_number, right.pack_number);
		});
	}, [inventoryRows]);

	const derivedRows = useMemo(() => {
		return sortedRows.map((row) => {
			const hasActiveDeficiency = activeDeficiencyByPackId[row.id] === true;
			const flowState = getFlowState(row);

			let displayStatus = row.status;
			if (row.status === "Retired") {
				displayStatus = "Retired";
			} else if (row.status === "Out of Service" || hasActiveDeficiency) {
				displayStatus = "Out of Service";
			} else if (flowState === "due" || flowState === "overdue") {
				displayStatus = "Flow Test Due";
			} else {
				displayStatus = "Ready";
			}

			let tone: RowTone = "ready";
			if (displayStatus === "Retired") {
				tone = "retired";
			} else if (displayStatus === "Out of Service") {
				tone = "out-of-service";
			} else if (flowState === "overdue") {
				tone = "overdue";
			} else if (flowState === "due") {
				tone = "due";
			}

			return {
				...row,
				hasActiveDeficiency,
				flowState,
				displayStatus,
				tone,
			};
		});
	}, [activeDeficiencyByPackId, sortedRows]);

	const filteredRows = useMemo(() => {
		let workingRows = derivedRows;

		if (searchTerm.trim()) {
			const normalized = searchTerm.trim().toLowerCase();
			workingRows = workingRows.filter((row) => {
				const haystack = [row.pack_number, row.manufacturer, row.model, row.serial_number]
					.map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
					.join(" ");

				return haystack.includes(normalized);
			});
		}

		if (statusFilter !== "All") {
			workingRows = workingRows.filter((row) => row.displayStatus === statusFilter);
		}

		return workingRows;
	}, [derivedRows, searchTerm, statusFilter]);

	const editingRow = useMemo(
		() => (editPackId ? derivedRows.find((row) => row.id === editPackId) ?? null : null),
		[derivedRows, editPackId],
	);

	const activeRows = useMemo(() => derivedRows.filter((row) => row.status !== "Retired"), [derivedRows]);
	const totalCount = derivedRows.length;
	const dueCount = activeRows.filter((row) => row.flowState === "due" || row.flowState === "overdue").length;
	const activeDeficiencyCount = activeRows.filter((row) => row.hasActiveDeficiency).length;
	const outOfServiceCount = activeRows.filter((row) => row.displayStatus === "Out of Service").length;
	const retiredCount = derivedRows.filter((row) => row.status === "Retired").length;
	const currentTestCount = activeRows.filter(
		(row) => row.flowState === "current" && !row.hasActiveDeficiency && row.displayStatus === "Ready",
	).length;
	const activePackCount = activeRows.length;
	const readinessPercentage = activePackCount > 0 ? Math.round((currentTestCount / activePackCount) * 100) : 100;
	const scoreWidth = `${Math.max(0, Math.min(100, readinessPercentage))}%`;

	const openAddModal = () => {
		setEditPackId(null);
		setIsModalOpen(true);
	};

	const openEditModal = (rowId: string) => {
		setEditPackId(rowId);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setEditPackId(null);
	};

	const closeFlowTestModal = () => {
		setIsFlowTestModalOpen(false);
		setFlowTestErrorMessage(null);
	};

	const closeSessionFlowTestModal = () => {
		setIsSessionFlowTestModalOpen(false);
		setSessionFlowTestErrorMessage(null);
	};

	const reportDeficiencyForRow = (row: ScbaPackRecord) => {
		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/scba-packs");
		params.set("inventoryCategory", "scba-packs");
		params.set("inventoryItemId", row.id);
		params.set("inventoryItemLabel", row.pack_number);
		params.set("apparatusId", "station-supply");
		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const viewFlowTestHistoryForRow = (row: ScbaPackRecord) => {
		router.push(`/inventory/scba-packs/flow-test-history?packId=${encodeURIComponent(row.id)}`);
	};

	const retirePackForRow = async (row: ScbaPackRecord) => {
		if (!departmentId) {
			setToastMessage("Unable to determine department. Please refresh and try again.");
			return;
		}

		const confirmed = window.confirm(
			`Retire Pack ${row.pack_number}?\n\nThis pack will stay in inventory as a retired record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data: retiredRow, error } = await supabase
			.from("scba_packs")
			.update({ status: "Retired" })
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.select("id, status")
			.single();

		if (error || !retiredRow || retiredRow.id !== row.id || retiredRow.status !== "Retired") {
			setToastMessage(error?.message || "Unable to retire pack.");
			return;
		}

		await refreshPacks();
		if (editPackId === row.id) {
			closeModal();
		}
	};

	const deletePackForRow = async (row: ScbaPackRecord) => {
		if (!canDeletePack) {
			setToastMessage("Only administrators can delete packs.");
			return;
		}

		if (!departmentId) {
			setToastMessage("Unable to determine department. Please refresh and try again.");
			return;
		}

		const confirmed = window.confirm(
			`Delete Pack ${row.pack_number}?\n\nThis permanently removes the inventory record. This action cannot be undone.`,
		);

		if (!confirmed) {
			return;
		}

		const { data: deletedRow, error } = await supabase
			.from("scba_packs")
			.delete()
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !deletedRow || deletedRow.id !== row.id) {
			setToastMessage(error?.message || "Unable to delete pack.");
			return;
		}

		await refreshPacks();
		if (editPackId === row.id) {
			closeModal();
		}
	};

	const savePack = (values: ScbaPackFormValues, initialFlowTest: ScbaPackInitialFlowTestValues | null) => {
		void (async () => {
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				return;
			}

			const packNumber = values.packNumber.trim();
			if (!packNumber) {
				setToastMessage("Pack Number is required.");
				return;
			}

			const payload = {
				department_id: departmentId,
				pack_number: packNumber,
				manufacturer: normalizeOptionalText(values.manufacturer) || null,
				model: normalizeOptionalText(values.model) || null,
				serial_number: normalizeOptionalText(values.serialNumber) || null,
				in_service_date: normalizeOptionalText(values.inServiceDate) || null,
				notes: normalizeOptionalText(values.notes) || null,
			};

			const initialFlowDate = normalizeOptionalText(initialFlowTest?.lastFlowTestDate ?? "");
			const initialFlowTester = normalizeOptionalText(initialFlowTest?.tester ?? "");
			const initialFlowResult = initialFlowTest?.result ?? "";
			const initialFlowNotes = normalizeOptionalText(initialFlowTest?.notes ?? "");
			const shouldCreateInitialFlowTest = initialFlowDate.length > 0;

			if (shouldCreateInitialFlowTest) {
				if (!initialFlowTester) {
					setToastMessage("Tester is required when Last Flow Test Date is provided.");
					return;
				}

				if (initialFlowResult !== "Pass" && initialFlowResult !== "Fail") {
					setToastMessage("Result is required when Last Flow Test Date is provided.");
					return;
				}
			}

			setIsSaving(true);

			if (!editingRow) {
				let nextFlowDueDate: string | null = null;
				if (shouldCreateInitialFlowTest) {
					nextFlowDueDate = addOneYearToIsoDate(initialFlowDate);
					if (!nextFlowDueDate) {
						setIsSaving(false);
						setToastMessage("Invalid Last Flow Test Date.");
						return;
					}
				}

				const initialStatus: "Ready" | "Out of Service" =
					shouldCreateInitialFlowTest && initialFlowResult === "Fail" ? "Out of Service" : "Ready";

				const { data, error } = await supabase
					.from("scba_packs")
					.insert({
						...payload,
						status: initialStatus,
						last_flow_test_date: shouldCreateInitialFlowTest ? initialFlowDate : null,
						next_flow_test_due_date: shouldCreateInitialFlowTest ? nextFlowDueDate : null,
					})
					.select("id, pack_number")
					.single();

				if (error || !data) {
					setIsSaving(false);
					setToastMessage(error?.message || "Unable to save pack.");
					return;
				}

				if (shouldCreateInitialFlowTest) {
					const { data: flowTestRow, error: flowTestError } = await supabase
						.from("scba_pack_flow_tests")
						.insert({
							scba_pack_id: data.id,
							department_id: departmentId,
							test_date: initialFlowDate,
							tester: initialFlowTester,
							result: initialFlowResult,
							notes: initialFlowNotes || null,
						})
						.select("id")
						.single();

					if (flowTestError || !flowTestRow) {
						await supabase.from("scba_packs").delete().eq("id", data.id).eq("department_id", departmentId);
						setIsSaving(false);
						setToastMessage(flowTestError?.message || "Unable to save initial flow-test history.");
						return;
					}
				}

				setIsSaving(false);

				await refreshPacks();
				closeModal();
				setToastMessage(`Pack ${data.pack_number} saved successfully.`);
				return;
			}

			const { data, error } = await supabase
				.from("scba_packs")
				.update(payload)
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, pack_number")
				.single();

			setIsSaving(false);
			if (error || !data || data.id !== editingRow.id) {
				setToastMessage(error?.message || "Unable to update pack.");
				return;
			}

			await refreshPacks();
			closeModal();
			setToastMessage(`Pack ${data.pack_number} updated successfully.`);
		})();
	};

	const saveFlowTest = (values: ScbaPackFlowTestValues) => {
		void (async () => {
			if (!departmentId || !editingRow) {
				setFlowTestErrorMessage("Unable to determine SCBA pack context.");
				return;
			}

			const testDate = values.testDate.trim();
			const result = values.result;
			const testerResolution = resolveTesterFromSelection(values, flowTestTesterOptions);
			if (testerResolution.error) {
				setFlowTestErrorMessage(testerResolution.error);
				return;
			}

			const tester = testerResolution.tester;

			if (!testDate || !tester || !result) {
				setFlowTestErrorMessage("Test Date, Tester, and Result are required.");
				return;
			}

			const nextFlowDueDate = addOneYearToIsoDate(testDate);
			if (!nextFlowDueDate) {
				setFlowTestErrorMessage("Invalid test date.");
				return;
			}

			setIsSavingFlowTest(true);
			setFlowTestErrorMessage(null);

			const insertResult = await supabase
				.from("scba_pack_flow_tests")
				.insert({
					department_id: departmentId,
					scba_pack_id: editingRow.id,
					test_date: testDate,
					tester,
					result,
					notes: normalizeOptionalText(values.notes) || null,
				})
				.select("id")
				.single();

			if (insertResult.error || !insertResult.data) {
				setIsSavingFlowTest(false);
				setFlowTestErrorMessage(insertResult.error?.message || "Unable to save flow test.");
				return;
			}

			let nextStatus: "Ready" | "Flow Test Due" | "Out of Service" | "Retired" = editingRow.status === "Retired" ? "Retired" : "Ready";
			if (editingRow.status === "Retired") {
				nextStatus = "Retired";
			} else if (result === "Fail") {
				nextStatus = "Out of Service";
			} else if (activeDeficiencyByPackId[editingRow.id] === true) {
				nextStatus = "Out of Service";
			} else {
				nextStatus = "Ready";
			}

			const updateResult = await supabase
				.from("scba_packs")
				.update({
					last_flow_test_date: testDate,
					next_flow_test_due_date: nextFlowDueDate,
					status: nextStatus,
				})
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id")
				.single();

			setIsSavingFlowTest(false);

			if (updateResult.error || !updateResult.data) {
				setFlowTestErrorMessage(updateResult.error?.message || "Unable to update pack with flow test data.");
				return;
			}

			await refreshPacks();
			setIsFlowTestModalOpen(false);
			setFlowTestErrorMessage(null);
			setToastMessage(`Flow test saved for Pack ${editingRow.pack_number}.`);
		})();
	};

	const saveSessionFlowTests = (values: ScbaPackSessionFlowTestValues) => {
		void (async () => {
			if (!departmentId) {
				setSessionFlowTestErrorMessage("Unable to determine department context.");
				return;
			}

			const testDate = normalizeOptionalText(values.testDate);
			if (!testDate) {
				setSessionFlowTestErrorMessage("Test Date is required.");
				return;
			}

			const nextFlowDueDate = addOneYearToIsoDate(testDate);
			if (!nextFlowDueDate) {
				setSessionFlowTestErrorMessage("Invalid test date.");
				return;
			}

			const testerResolution = resolveTesterFromSelection(values, flowTestTesterOptions);
			if (testerResolution.error) {
				setSessionFlowTestErrorMessage(testerResolution.error);
				return;
			}

			const tester = testerResolution.tester;
			const selectedRows = derivedRows.filter((row) => {
				const result = values.packResults[row.id] ?? "";
				return result === "Pass" || result === "Fail";
			});

			if (selectedRows.length === 0) {
				setSessionFlowTestErrorMessage("Mark at least one pack as Pass or Fail before saving.");
				return;
			}

			setIsSavingSessionFlowTest(true);
			setSessionFlowTestErrorMessage(null);

			let processedCount = 0;

			for (const row of selectedRows) {
				const result = values.packResults[row.id];
				if (result !== "Pass" && result !== "Fail") {
					continue;
				}

				const notes = buildSessionFlowTestNotes(values.sessionNotes, values.packNotes[row.id] ?? "");

				const insertResult = await supabase
					.from("scba_pack_flow_tests")
					.insert({
						department_id: departmentId,
						scba_pack_id: row.id,
						test_date: testDate,
						tester,
						result,
						notes: notes || null,
					})
					.select("id")
					.single();

				if (insertResult.error || !insertResult.data) {
					setIsSavingSessionFlowTest(false);
					setSessionFlowTestErrorMessage(
						insertResult.error?.message || `Unable to save flow test for Pack ${row.pack_number}.`,
					);
					return;
				}

				let nextStatus: "Ready" | "Flow Test Due" | "Out of Service" | "Retired" = row.status === "Retired" ? "Retired" : "Ready";
				if (row.status === "Retired") {
					nextStatus = "Retired";
				} else if (result === "Fail") {
					nextStatus = "Out of Service";
				} else if (activeDeficiencyByPackId[row.id] === true) {
					nextStatus = "Out of Service";
				} else {
					nextStatus = "Ready";
				}

				const updateResult = await supabase
					.from("scba_packs")
					.update({
						last_flow_test_date: testDate,
						next_flow_test_due_date: nextFlowDueDate,
						status: nextStatus,
					})
					.eq("id", row.id)
					.eq("department_id", departmentId)
					.select("id")
					.single();

				if (updateResult.error || !updateResult.data) {
					setIsSavingSessionFlowTest(false);
					setSessionFlowTestErrorMessage(
						updateResult.error?.message || `Unable to update Pack ${row.pack_number} after flow test save.`,
					);
					return;
				}

				processedCount += 1;
			}

			setIsSavingSessionFlowTest(false);
			await refreshPacks();
			closeSessionFlowTestModal();
			setToastMessage(`Session flow test saved for ${processedCount} pack${processedCount === 1 ? "" : "s"}.`);
		})();
	};

	const topSummaryCards = [
		{ label: "Total Active Packs", value: activePackCount, tone: "ready" as RowTone, filter: "All" },
		{ label: "Flow Test Due/Overdue", value: dueCount, tone: "due" as RowTone, filter: "Flow Test Due" },
		{ label: "Active Deficiencies", value: activeDeficiencyCount, tone: "out-of-service" as RowTone, filter: "Out of Service" },
		{ label: "Retired", value: retiredCount, tone: "retired" as RowTone, filter: "Retired" },
	];

	return (
		<div className="space-y-8">
			{toastVisible && toastMessage ? (
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
			) : null}

			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>
					<h1 className="mt-2 text-5xl font-black tracking-tight text-white">SCBA Packs</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">Manage SCBA pack inventory, annual flow testing, and deficiency readiness.</p>
					{departmentName ? <p className="mt-2 text-sm text-neutral-500">Department: {departmentName}</p> : null}
				</div>

				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setIsSessionFlowTestModalOpen(true)}
						className="inline-flex rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
					>
						Session Testing
					</button>
					<button
						type="button"
						onClick={openAddModal}
						className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
					>
						+ Add Pack
					</button>
				</div>
			</div>

			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-2xl font-bold text-white">Pack Readiness</h2>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">Readiness is based on active packs that are current on annual flow testing and do not have active deficiencies.</p>

						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{topSummaryCards.map((card) => {
								const active = statusFilter === card.filter;
								return (
									<button
										key={card.label}
										type="button"
										onClick={() => setStatusFilter(card.filter)}
										className={summaryCardClasses(active, card.tone)}
									>
										<p className="text-xs uppercase tracking-[0.22em] text-neutral-500">{card.label}</p>
										<p className="mt-2 text-4xl font-black text-white">{card.value}</p>
									</button>
								);
							})}
						</div>
					</div>

					<div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">SCBA Pack Readiness</p>
						<p className="mt-1 text-4xl font-black text-white">{readinessPercentage}%</p>
						<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">{currentTestCount} Current / {activePackCount} Active</p>
						<p className="mt-3 text-sm text-neutral-400">Retired packs are excluded from active readiness.</p>

						<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
							<div className="h-full rounded-full bg-red-500 transition-all" style={{ width: scoreWidth }} />
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="scba-pack-search" className="sr-only">Search packs</label>
						<input
							id="scba-pack-search"
							type="text"
							placeholder="Search by pack number, manufacturer, model, or serial number..."
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>

					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value)}
						className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
					>
						<option value="All">All Statuses</option>
						<option value="Ready">Ready</option>
						<option value="Flow Test Due">Flow Test Due</option>
						<option value="Out of Service">Out of Service</option>
						<option value="Retired">Retired</option>
					</select>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="overflow-x-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
						<thead>
							<tr>
								{[
									"Pack Number",
									"Manufacturer / Model",
									"Serial Number",
									"In-Service Date",
									"Last Flow Test",
									"Next Flow Test Due",
									"Status",
									"Actions",
								].map((label) => (
									<th key={label} scope="col" className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
										{label}
									</th>
								))}
							</tr>
						</thead>

						<tbody>
							{derivedRows.length === 0 ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-10">
										<div className="flex flex-col items-start gap-4 text-left sm:items-center sm:text-center">
											<div>
												<p className="text-lg font-bold text-white">No SCBA Packs</p>
												<p className="mt-2 max-w-2xl text-sm text-neutral-400">Add your department's SCBA packs to track annual flow tests and deficiencies.</p>
											</div>

											<button
												type="button"
												onClick={openAddModal}
												className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
											>
												Add Pack
											</button>
										</div>
									</td>
								</tr>
							) : filteredRows.length === 0 ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-10 text-center text-sm text-neutral-400">
										No packs currently match the selected filters.
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
									const rowClassName =
										row.tone === "overdue" || row.tone === "out-of-service"
											? "cursor-pointer bg-red-950/15 transition hover:bg-white/5"
											: row.tone === "due"
												? "cursor-pointer bg-amber-950/15 transition hover:bg-white/5"
												: row.tone === "retired"
													? "cursor-pointer opacity-75 transition hover:bg-white/5"
													: "cursor-pointer transition hover:bg-white/5";

									return (
										<tr
											key={row.id}
											className={rowClassName}
											onClick={() => openEditModal(row.id)}
											tabIndex={0}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													openEditModal(row.id);
												}
											}}
										>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<div>
													<p className="font-semibold text-white">{row.pack_number}</p>
													{row.hasActiveDeficiency ? <p className="text-xs text-red-300">Active deficiency linked</p> : null}
												</div>
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												{[row.manufacturer, row.model].filter(Boolean).join(" / ") || "-"}
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.serial_number ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatDate(row.in_service_date)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatDate(row.last_flow_test_date)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												{row.flowState === "overdue" ? (
													<span className="inline-flex items-center gap-2 rounded-full border border-red-700/40 bg-red-900/20 px-2.5 py-1 text-xs font-semibold text-red-200">
														Overdue {formatDate(row.next_flow_test_due_date)}
													</span>
												) : row.flowState === "due" ? (
													<span className="inline-flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-900/20 px-2.5 py-1 text-xs font-semibold text-amber-200">
														Due {formatDate(row.next_flow_test_due_date)}
													</span>
												) : (
													formatDate(row.next_flow_test_due_date)
												)}
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.displayStatus)}`}>
													{row.displayStatus}
												</span>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															openEditModal(row.id);
														}}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Edit
													</button>

													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															setEditPackId(row.id);
															setIsFlowTestModalOpen(true);
														}}
														className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
													>
														Record Flow Test
													</button>

													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															viewFlowTestHistoryForRow(row);
														}}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														View Flow Test History
													</button>

													{row.status !== "Retired" ? (
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																reportDeficiencyForRow(row);
															}}
															className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
														>
															Report Deficiency
														</button>
													) : null}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>

			<ScbaPackFormModal
				isOpen={isModalOpen}
				mode={editingRow ? "edit" : "add"}
				initialValues={
					editingRow
						? {
							packNumber: editingRow.pack_number ?? "",
							manufacturer: editingRow.manufacturer ?? "",
							model: editingRow.model ?? "",
							serialNumber: editingRow.serial_number ?? "",
							inServiceDate: editingRow.in_service_date ?? "",
							notes: editingRow.notes ?? "",
						}
						: undefined
				}
				currentStatus={editingRow?.displayStatus ?? "Ready"}
				lastFlowTestDate={editingRow?.last_flow_test_date ?? null}
				nextFlowTestDueDate={editingRow?.next_flow_test_due_date ?? null}
				isSaving={isSaving}
				onClose={closeModal}
				onSave={savePack}
				onRecordFlowTest={
					editingRow
						? () => {
							setIsModalOpen(false);
							setIsFlowTestModalOpen(true);
						}
						: undefined
				}
				onViewFlowTestHistory={editingRow ? () => viewFlowTestHistoryForRow(editingRow) : undefined}
				onReportDeficiency={editingRow ? () => reportDeficiencyForRow(editingRow) : undefined}
				onRetire={editingRow ? () => void retirePackForRow(editingRow) : undefined}
				onDelete={editingRow && canDeletePack ? () => void deletePackForRow(editingRow) : undefined}
				canDelete={canDeletePack}
			/>

			<ScbaPackFlowTestModal
				isOpen={isFlowTestModalOpen}
				packNumber={editingRow?.pack_number ?? ""}
				testerOptions={flowTestTesterOptions}
				isSaving={isSavingFlowTest}
				errorMessage={flowTestErrorMessage}
				onClose={closeFlowTestModal}
				onSave={saveFlowTest}
			/>

			<ScbaPackSessionFlowTestModal
				isOpen={isSessionFlowTestModalOpen}
				packs={derivedRows
					.filter((row) => row.status !== "Retired")
					.map((row) => ({
						id: row.id,
						packNumber: row.pack_number,
						currentStatus: row.displayStatus,
						hasActiveDeficiency: row.hasActiveDeficiency,
					}))}
				testerOptions={flowTestTesterOptions}
				isSaving={isSavingSessionFlowTest}
				errorMessage={sessionFlowTestErrorMessage}
				onClose={closeSessionFlowTestModal}
				onSave={saveSessionFlowTests}
			/>
		</div>
	);
}
