"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDateRangeFromPreset, REPORT_DATE_PRESETS } from "@/lib/reports/date-range";
import { REPORT_SOURCES } from "@/lib/reports/registry";
import { getInventoryReportTypeOptions } from "@/lib/reports/inventory-report";
import type {
	ReportColumn,
	ReportDatePresetKey,
	ReportErrorPayload,
	ReportFilterDefinition,
	ReportResultPayload,
	ReportRow,
	ReportRunRequest,
	ReportRunResponse,
	ReportSourceConfig,
} from "@/lib/reports/types";

type ReportsWorkspaceProps = {
	isAuthenticated: boolean;
	departmentName: string | null;
	initialError?: string | null;
	members: Array<{
		id: string;
		name: string;
		station?: string | null;
		shift?: string | null;
		status?: string | null;
		active?: boolean | null;
		departmentRoleId?: string | null;
	}>;
	trainingCategories: Array<{ id: string; name: string }>;
	certifications: Array<{ id: string; name: string }>;
	apparatuses: Array<{ id: string; name: string }>;
	apparatusCheckMembers: Array<{ id: string; name: string }>;
	departmentRoles: Array<{ id: string; name: string }>;
	inspectionFireHose: Array<{ id: string; name: string }>;
	inspectionScbaCylinders: Array<{ id: string; name: string }>;
	inspectionScbaPacks: Array<{ id: string; name: string }>;
	inspectionGasMonitors: Array<{ id: string; name: string }>;
	inspectionRopeItems: Array<{ id: string; name: string }>;
	inspectionGroundLadders: Array<{ id: string; name: string }>;
	emsEquipment: Array<{
		id: string;
		name: string;
		equipment_number?: string | null;
		equipment_type?: string | null;
		status?: string | null;
		location?: string | null;
	}>;
	emsSupplies: Array<{
		id: string;
		name: string;
		item_category?: string | null;
		status?: string | null;
		location?: string | null;
	}>;
};

type SortDirection = "asc" | "desc";

function asText(value: string | number | null | undefined) {
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value === "string") {
		return value;
	}
	return "-";
}

function buildInitialDateRange(preset: ReportDatePresetKey) {
	const range = buildDateRangeFromPreset(preset);
	return {
		preset,
		from: range.from,
		to: range.to,
	};
}

function resolveInitialFilterState(source: ReportSourceConfig | null) {
	const initial: Record<string, string> = {};
	if (!source) {
		return initial;
	}

	for (const filter of source.filters) {
		if (source.key === "personnel" && filter.key === "status") {
			initial[filter.key] = "active";
			continue;
		}
		if (source.key === "ems" && filter.key === "report_type") {
			initial[filter.key] = "supplies";
			continue;
		}
		if (source.key === "inspections" && filter.key === "report_type") {
			initial[filter.key] = "all-inspections";
			continue;
		}
		if (filter.type === "select" && filter.options && filter.options.length > 0) {
			initial[filter.key] = filter.options[0].value;
			continue;
		}

		initial[filter.key] = "";
	}

	return initial;
}

function getVisibleEmsFilters(source: ReportSourceConfig | null, reportType: string) {
	if (!source || source.key !== "ems") {
		return source?.filters ?? [];
	}

	const selectedType = reportType || "supplies";
	const relevantKeys = new Set<string>(["report_type"]);

	if (selectedType === "certification-status") {
		relevantKeys.add("member_id");
		relevantKeys.add("report_scope");
		relevantKeys.add("ems_level");
		relevantKeys.add("iowa_status");
		relevantKeys.add("nremt_maintained");
		relevantKeys.add("readiness_status");
		relevantKeys.add("expiration_window");
	} else if (selectedType === "training") {
		relevantKeys.add("member_id");
		relevantKeys.add("training_category_id");
	} else if (selectedType === "equipment") {
		relevantKeys.add("equipment_id");
		relevantKeys.add("equipment_status");
	} else if (selectedType === "supplies") {
		relevantKeys.add("supply_id");
		relevantKeys.add("supply_status");
		relevantKeys.add("supply_stock_level");
	}

	return source.filters.filter((filter) => relevantKeys.has(filter.key));
}

function getVisibleApparatusFilters(source: ReportSourceConfig | null, reportType: string) {
	if (!source || source.key !== "apparatus") {
		return source?.filters ?? [];
	}

	const selectedType = reportType || "overview";
	const relevantKeys = new Set<string>(["report_type", "apparatus_id"]);

	if (selectedType === "overview") {
		relevantKeys.add("apparatus_status");
		relevantKeys.add("check_status");
		relevantKeys.add("inspected_by");
		relevantKeys.add("check_activity");
	}

	if (selectedType === "mileage-hours") {
		relevantKeys.add("inspected_by");
	}

	return source.filters.filter((filter) => relevantKeys.has(filter.key));
}

function getVisibleInspectionsFilters(source: ReportSourceConfig | null, reportType: string) {
	if (!source || source.key !== "inspections") {
		return source?.filters ?? [];
	}

	const selectedType = reportType || "all-inspections";
	const relevantKeys = new Set<string>(["report_type"]);

	if (selectedType === "all-inspections") {
		relevantKeys.add("inspection_result");
		relevantKeys.add("due_status");
	}

	if (selectedType === "fire-hose-testing") {
		relevantKeys.add("fire_hose_id");
		relevantKeys.add("inspection_result");
		relevantKeys.add("due_status");
	}

	if (selectedType === "scba-cylinder-hydrostatic-testing") {
		relevantKeys.add("scba_cylinder_id");
		relevantKeys.add("due_status");
	}

	if (selectedType === "scba-pack-flow-testing") {
		relevantKeys.add("scba_pack_id");
		relevantKeys.add("inspection_result");
		relevantKeys.add("due_status");
	}

	if (selectedType === "gas-monitor-calibration") {
		relevantKeys.add("gas_monitor_id");
		relevantKeys.add("inspection_result");
		relevantKeys.add("due_status");
	}

	if (selectedType === "rope-inspections") {
		relevantKeys.add("rope_item_id");
		relevantKeys.add("inspection_result");
	}

	if (selectedType === "ground-ladder-service-testing") {
		relevantKeys.add("ground_ladder_id");
		relevantKeys.add("inspection_result");
		relevantKeys.add("due_status");
	}

	return source.filters.filter((filter) => relevantKeys.has(filter.key));
}

function FilterInput({
	definition,
	value,
	onChange,
}: {
	definition: ReportFilterDefinition;
	value: string;
	onChange: (value: string) => void;
}) {
	if (definition.type === "select") {
		return (
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
			>
				{(definition.options ?? []).map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	}

	return (
		<input
			type="text"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={definition.placeholder ?? "Enter value"}
			className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none"
		/>
	);
}

function ReportResultsTable({
	columns,
	rows,
	sortColumn,
	sortDirection,
	onSort,
	stickyMemberColumn,
	showHorizontalScrollHint,
}: {
	columns: ReportColumn[];
	rows: ReportRow[];
	sortColumn: string | null;
	sortDirection: SortDirection;
	onSort: (columnKey: string) => void;
	stickyMemberColumn?: boolean;
	showHorizontalScrollHint?: boolean;
}) {
	const scrollViewportRef = useRef<HTMLDivElement | null>(null);
	const scrollbarTrackRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
	const [scrollMetrics, setScrollMetrics] = useState({
		hasOverflow: false,
		thumbWidthPercent: 100,
		thumbLeftPercent: 0,
	});

	const updateScrollMetrics = () => {
		const viewport = scrollViewportRef.current;
		if (!viewport) {
			return;
		}

		const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
		if (maxScrollLeft <= 0) {
			setScrollMetrics({
				hasOverflow: false,
				thumbWidthPercent: 100,
				thumbLeftPercent: 0,
			});
			return;
		}

		const rawWidthPercent = (viewport.clientWidth / viewport.scrollWidth) * 100;
		const thumbWidthPercent = Math.max(10, Math.min(100, rawWidthPercent));
		const travel = 100 - thumbWidthPercent;
		const thumbLeftPercent = travel <= 0
			? 0
			: (viewport.scrollLeft / maxScrollLeft) * travel;

		setScrollMetrics({
			hasOverflow: true,
			thumbWidthPercent,
			thumbLeftPercent,
		});
	};

	useEffect(() => {
		updateScrollMetrics();
		const onResize = () => updateScrollMetrics();
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
		};
	}, [columns, rows]);

	const scrollToClientX = (clientX: number) => {
		const viewport = scrollViewportRef.current;
		const track = scrollbarTrackRef.current;
		if (!viewport || !track) {
			return;
		}

		const rect = track.getBoundingClientRect();
		const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
		if (maxScrollLeft <= 0 || rect.width <= 0) {
			return;
		}

		const x = Math.min(rect.right, Math.max(rect.left, clientX)) - rect.left;
		const ratio = x / rect.width;
		viewport.scrollLeft = ratio * maxScrollLeft;
		updateScrollMetrics();
	};

	const handleThumbPointerDown = (event: { clientX: number }) => {
		const viewport = scrollViewportRef.current;
		if (!viewport) {
			return;
		}

		dragStateRef.current = {
			startX: event.clientX,
			startScrollLeft: viewport.scrollLeft,
		};

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const track = scrollbarTrackRef.current;
			const currentDrag = dragStateRef.current;
			if (!track || !currentDrag || !scrollViewportRef.current) {
				return;
			}

			const viewportNow = scrollViewportRef.current;
			const maxScrollLeft = Math.max(0, viewportNow.scrollWidth - viewportNow.clientWidth);
			if (maxScrollLeft <= 0) {
				return;
			}

			const deltaX = moveEvent.clientX - currentDrag.startX;
			const scrollPerPixel = maxScrollLeft / Math.max(1, track.clientWidth);
			viewportNow.scrollLeft = Math.max(0, Math.min(maxScrollLeft, currentDrag.startScrollLeft + deltaX * scrollPerPixel));
			updateScrollMetrics();
		};

		const handlePointerUp = () => {
			dragStateRef.current = null;
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
	};

	return (
		<div className="rounded-2xl border border-white/10">
			<div
				ref={scrollViewportRef}
				className="report-results-scrollbar overflow-x-auto"
				onScroll={updateScrollMetrics}
			>
				<table className="min-w-max border-separate border-spacing-0 text-left">
				<thead className="bg-[#151515]">
					<tr>
						{columns.map((column, columnIndex) => {
							const isActive = sortColumn === column.key;
							const isStickyMember = stickyMemberColumn === true && column.key === "member_name" && columnIndex === 0;
							const widthClass = column.key === "member_name"
								? "min-w-[220px]"
								: column.key.endsWith("_status") || column.key.includes("progress")
									? "min-w-[170px]"
									: "min-w-[140px]";
							return (
								<th
									key={column.key}
									className={[
										"border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500",
										widthClass,
										isStickyMember ? "sticky left-0 z-20 bg-[#151515] shadow-[8px_0_14px_rgba(0,0,0,0.35)]" : "",
									].join(" ")}
								>
									<button
										type="button"
										onClick={() => onSort(column.key)}
										className="inline-flex items-center gap-1 text-left text-inherit"
									>
										<span>{column.label}</span>
										{isActive ? <span>{sortDirection === "asc" ? "▲" : "▼"}</span> : null}
									</button>
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => (
						<tr key={`${index}-${asText(row.id)}`} className="bg-[#0f0f0f] even:bg-[#121212]">
							{columns.map((column, columnIndex) => {
								const isStickyMember = stickyMemberColumn === true && column.key === "member_name" && columnIndex === 0;
								const widthClass = column.key === "member_name"
									? "min-w-[220px]"
									: column.key.endsWith("_status") || column.key.includes("progress")
										? "min-w-[170px]"
										: "min-w-[140px]";
								return (
									<td
										key={column.key}
										className={[
											"border-b border-white/5 px-4 py-3 text-sm text-zinc-200",
											widthClass,
											isStickyMember
												? `sticky left-0 z-10 ${index % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#121212]"} shadow-[8px_0_14px_rgba(0,0,0,0.28)]`
												: "",
										].join(" ")}
									>
										{asText(row[column.key])}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
				</table>
			</div>
			{showHorizontalScrollHint && scrollMetrics.hasOverflow ? (
				<div className="border-t border-white/10 bg-[#0f0f0f] px-3 py-2">
					<div
						ref={scrollbarTrackRef}
						className="relative h-3 cursor-ew-resize rounded-full bg-zinc-700/90"
						onClick={(event) => scrollToClientX(event.clientX)}
					>
						<div
							className="absolute top-0 h-3 rounded-full border border-zinc-300/60 bg-zinc-300"
							style={{
								left: `${scrollMetrics.thumbLeftPercent}%`,
								width: `${scrollMetrics.thumbWidthPercent}%`,
							}}
							onPointerDown={handleThumbPointerDown}
						/>
					</div>
				</div>
			) : null}
		</div>
	);
}

export default function ReportsWorkspace({
	isAuthenticated,
	departmentName,
	initialError = null,
	members = [],
	trainingCategories = [],
	certifications = [],
	apparatuses = [],
	apparatusCheckMembers = [],
	departmentRoles = [],
	inspectionFireHose = [],
	inspectionScbaCylinders = [],
	inspectionScbaPacks = [],
	inspectionGasMonitors = [],
	inspectionRopeItems = [],
	inspectionGroundLadders = [],
	emsEquipment = [],
	emsSupplies = [],
}: ReportsWorkspaceProps) {
	const [selectedCategory, setSelectedCategory] = useState<string>("");
	const [searchTerm, setSearchTerm] = useState("");
	const [dateRange, setDateRange] = useState(buildInitialDateRange("last-30-days"));
	const [filters, setFilters] = useState<Record<string, string>>({});
	const inventoryCategoryFilterValue = filters.inventory_category ?? "all";
	const inventoryReportTypeOptions = useMemo(
		() => getInventoryReportTypeOptions(inventoryCategoryFilterValue),
		[inventoryCategoryFilterValue],
	);
	const inventoryReportTypeValue = inventoryReportTypeOptions.some((option) => option.value === filters.inventory_report_type)
		? filters.inventory_report_type ?? inventoryReportTypeOptions[0]?.value ?? "inventory"
		: inventoryReportTypeOptions[0]?.value ?? "inventory";
	const [isRunning, setIsRunning] = useState(false);
	const [result, setResult] = useState<ReportResultPayload | null>(null);
	const [error, setError] = useState<ReportErrorPayload | null>(
		initialError
			? { ok: false, errorCode: "QUERY_ERROR", error: initialError }
			: null,
	);
	const [sortColumn, setSortColumn] = useState<string | null>(null);
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const reportSources = useMemo(() => {
		const memberOptions = [
			{ value: "all", label: "All Members" },
			...members.map((member) => ({ value: member.id, label: member.name })),
		];
		const apparatusCheckMemberOptions = [
			{ value: "all", label: "All Members" },
			...apparatusCheckMembers.map((member) => ({ value: member.id, label: member.name })),
		];

		const categoryOptions = [
			{ value: "all", label: "All Categories" },
			...trainingCategories.map((category) => ({ value: category.id, label: category.name })),
		];

		const stationOptions = [
			{ value: "all", label: "All Stations" },
			...Array.from(
				new Set(
					members
						.map((member) => member.station)
						.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
				),
			)
				.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
				.map((value) => ({ value, label: value })),
		];

		const shiftOptions = [
			{ value: "all", label: "All Shifts" },
			...Array.from(
				new Set(
					members
						.map((member) => member.shift)
						.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
				),
			)
				.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
				.map((value) => ({ value, label: value })),
		];

		const roleOptions = [
			{ value: "all", label: "All Roles" },
			...departmentRoles.map((role) => ({ value: role.id, label: role.name })),
		];

		const certificationOptions = [
			{ value: "all", label: "All Certifications" },
			...certifications.map((item) => ({ value: item.id, label: item.name })),
		];

		const apparatusOptions = [
			{ value: "all", label: "All Apparatus" },
			...apparatuses.map((apparatus) => ({ value: apparatus.id, label: apparatus.name })),
		];

		const emsEquipmentOptions = [
			{ value: "all", label: "All Equipment" },
			...emsEquipment.map((item) => ({ value: item.id, label: item.name })),
		];
		const emsSupplyOptions = [
			{ value: "all", label: "All Supplies" },
			...emsSupplies.map((item) => ({ value: item.id, label: item.name })),
		];
		const fireHoseInspectionOptions = [
			{ value: "all", label: "All Fire Hose" },
			...inspectionFireHose.map((item) => ({ value: item.id, label: item.name })),
		];
		const scbaCylinderInspectionOptions = [
			{ value: "all", label: "All SCBA Cylinders" },
			...inspectionScbaCylinders.map((item) => ({ value: item.id, label: item.name })),
		];
		const scbaPackInspectionOptions = [
			{ value: "all", label: "All SCBA Packs" },
			...inspectionScbaPacks.map((item) => ({ value: item.id, label: item.name })),
		];
		const gasMonitorInspectionOptions = [
			{ value: "all", label: "All Gas Monitors" },
			...inspectionGasMonitors.map((item) => ({ value: item.id, label: item.name })),
		];
		const ropeInspectionOptions = [
			{ value: "all", label: "All Rope Items" },
			...inspectionRopeItems.map((item) => ({ value: item.id, label: item.name })),
		];
		const groundLadderInspectionOptions = [
			{ value: "all", label: "All Ground Ladders" },
			...inspectionGroundLadders.map((item) => ({ value: item.id, label: item.name })),
		];

		return REPORT_SOURCES.map((source) => {
			if (source.key !== "training" && source.key !== "certifications" && source.key !== "maintenance" && source.key !== "apparatus" && source.key !== "personnel" && source.key !== "ems" && source.key !== "inspections" && source.key !== "activity") {
				return source;
			}

			return {
				...source,
				filters: source.filters.map((filter) => {
					if (filter.key === "member_id") {
						return {
							...filter,
							options: memberOptions,
						};
					}

					if (source.key === "training" && filter.key === "category_id") {
						return {
							...filter,
							options: categoryOptions,
						};
					}

					if (source.key === "certifications" && filter.key === "certification_id") {
						return {
							...filter,
							options: certificationOptions,
						};
					}

					if (source.key === "maintenance" && filter.key === "apparatus_id") {
						return {
							...filter,
							options: apparatusOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "apparatus_id") {
						return {
							...filter,
							options: apparatusOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "inspected_by") {
						return {
							...filter,
							options: apparatusCheckMemberOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "fire_hose_id") {
						return {
							...filter,
							options: fireHoseInspectionOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "scba_cylinder_id") {
						return {
							...filter,
							options: scbaCylinderInspectionOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "scba_pack_id") {
						return {
							...filter,
							options: scbaPackInspectionOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "gas_monitor_id") {
						return {
							...filter,
							options: gasMonitorInspectionOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "rope_item_id") {
						return {
							...filter,
							options: ropeInspectionOptions,
						};
					}

					if (source.key === "inspections" && filter.key === "ground_ladder_id") {
						return {
							...filter,
							options: groundLadderInspectionOptions,
						};
					}

					if (source.key === "personnel" && filter.key === "role_id") {
						return {
							...filter,
							options: roleOptions,
						};
					}

					if (source.key === "personnel" && filter.key === "station") {
						return {
							...filter,
							options: stationOptions,
						};
					}

					if (source.key === "personnel" && filter.key === "shift") {
						return {
							...filter,
							options: shiftOptions,
						};
					}

					if (source.key === "ems" && filter.key === "training_category_id") {
						return {
							...filter,
							options: categoryOptions,
						};
					}

					if (source.key === "ems" && filter.key === "equipment_id") {
						return {
							...filter,
							options: emsEquipmentOptions,
						};
					}

					if (source.key === "ems" && filter.key === "supply_id") {
						return {
							...filter,
							options: emsSupplyOptions,
						};
					}

					if (source.key === "ems" && filter.key === "supply_status") {
						return {
							...filter,
							options: [
								{ value: "all", label: "All Supply Statuses" },
								{ value: "active", label: "Active" },
								{ value: "inactive", label: "Inactive" },
							],
						};
					}

					if (source.key === "ems" && filter.key === "report_type") {
						return {
							...filter,
							options: [
								{ value: "certification-status", label: "EMS Certification Status" },
								{ value: "training", label: "EMS Training" },
								{ value: "equipment", label: "EMS Equipment" },
								{ value: "supplies", label: "EMS Supplies" },
							],
						};
					}

					if (source.key === "ems" && filter.key === "supply_stock_level") {
						return {
							...filter,
							options: [
								{ value: "all", label: "All Stock Levels" },
								{ value: "normal", label: "Normal" },
								{ value: "low", label: "Low" },
								{ value: "critical", label: "Critical" },
								{ value: "out_of_stock", label: "Out of Stock" },
								{ value: "low_or_worse", label: "Low, Critical, or Out of Stock" },
							],
						};
					}

					if (source.key === "ems" && filter.key === "equipment_status") {
						return {
							...filter,
							options: [
								{ value: "all", label: "All Equipment Statuses" },
								{ value: "active", label: "Active" },
								{ value: "inactive", label: "Inactive" },
							],
						};
					}

					if (source.key === "apparatus" && filter.key === "apparatus_id") {
						return {
							...filter,
							options: apparatusOptions,
						};
					}

					if (source.key === "maintenance" && filter.key === "completed_by") {
						return {
							...filter,
							options: memberOptions,
						};
					}

					if (source.key === "apparatus" && filter.key === "inspected_by") {
						return {
							...filter,
							options: apparatusCheckMemberOptions,
						};
					}

					return filter;
				}),
			};
		});
	}, [members, trainingCategories, certifications, apparatuses, apparatusCheckMembers, departmentRoles, inspectionFireHose, inspectionScbaCylinders, inspectionScbaPacks, inspectionGasMonitors, inspectionRopeItems, inspectionGroundLadders, emsEquipment, emsSupplies]);

	const selectedSource = useMemo(
		() => reportSources.find((source) => source.key === selectedCategory) ?? null,
		[reportSources, selectedCategory],
	);

	const emsReportTypeValue = filters.report_type ?? "supplies";
	const apparatusReportTypeValue = filters.report_type ?? "overview";
	const inspectionsReportTypeValue = filters.report_type ?? "all-inspections";
	const selectedSourceFilters = useMemo(
		() => {
			if (!selectedSource) {
				return [];
			}

			if (selectedSource.key === "ems") {
				return getVisibleEmsFilters(selectedSource, emsReportTypeValue);
			}

			if (selectedSource.key === "apparatus") {
				return getVisibleApparatusFilters(selectedSource, apparatusReportTypeValue);
			}

			if (selectedSource.key === "inspections") {
				return getVisibleInspectionsFilters(selectedSource, inspectionsReportTypeValue);
			}

			return selectedSource.filters;
		},
		[selectedSource, emsReportTypeValue, apparatusReportTypeValue, inspectionsReportTypeValue],
	);

	const sortedRows = useMemo(() => {
		if (!result?.rows || !sortColumn) {
			return result?.rows ?? [];
		}

		const rows = [...result.rows];
		rows.sort((left, right) => {
			const leftValue = asText(left[sortColumn]).toLowerCase();
			const rightValue = asText(right[sortColumn]).toLowerCase();
			const base = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
			return sortDirection === "asc" ? base : -base;
		});

		return rows;
	}, [result, sortColumn, sortDirection]);

	const isCustomDateRange = dateRange.preset === "custom";

	const generatedDateLabel = useMemo(() => {
		if (!result?.generatedAt) {
			return "";
		}

		const date = new Date(result.generatedAt);
		if (Number.isNaN(date.getTime())) {
			return result.generatedAt;
		}

		return date.toLocaleString("en-US", {
			month: "short",
			day: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}, [result]);

	const handleCategoryChange = (categoryKey: string) => {
		setSelectedCategory(categoryKey);
		const source = reportSources.find((item) => item.key === categoryKey) ?? null;
		setFilters(resolveInitialFilterState(source));
		if (categoryKey === "personnel") {
			setDateRange({ preset: "all-time", from: "2000-01-01", to: "2100-12-31" });
		}
		setResult(null);
		setError(null);
	};

	const handleInventoryCategoryChange = (value: string) => {
		setFilters((current) => {
			const next = { ...current, inventory_category: value };
			const options = getInventoryReportTypeOptions(value);
			const nextReportType = options.some((option) => option.value === current.inventory_report_type)
				? current.inventory_report_type
				: options[0]?.value ?? "inventory";
			return { ...next, inventory_report_type: nextReportType };
		});
	};

	const handlePresetChange = (preset: ReportDatePresetKey) => {
		if (preset === "custom") {
			setDateRange((current) => ({ ...current, preset }));
			return;
		}

		setDateRange({
			preset,
			...buildDateRangeFromPreset(preset),
		});
	};

	const handleSort = (columnKey: string) => {
		if (sortColumn === columnKey) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}

		setSortColumn(columnKey);
		setSortDirection("asc");
	};

	const handleGenerateReport = async () => {
		setError(null);
		setResult(null);

		if (!selectedSource) {
			setError({
				ok: false,
				errorCode: "INVALID_INPUT",
				error: "Select a report category to begin.",
			});
			return;
		}

		if (!isAuthenticated) {
			setError({
				ok: false,
				errorCode: "UNAUTHORIZED",
				error: "You must be signed in to run reports.",
			});
			return;
		}

		if (isCustomDateRange && (!dateRange.from || !dateRange.to)) {
			setError({
				ok: false,
				errorCode: "INVALID_DATE_RANGE",
				error: "Choose both From and To dates for a custom range.",
			});
			return;
		}

		const payload: ReportRunRequest = {
			category: selectedSource.key,
			searchTerm,
			dateRange,
			filters,
			page: 1,
			pageSize: 0,
		};

		setIsRunning(true);

		try {
			const response = await fetch("/api/reports/run", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			const body = (await response.json().catch(() => null)) as ReportRunResponse | null;
			if (!body) {
				setError({
					ok: false,
					errorCode: "UNKNOWN_ERROR",
					error: "Unexpected response from reporting engine.",
				});
				return;
			}

			if (!response.ok || !body.ok) {
				setError(
					body.ok
						? {
							ok: false,
							errorCode: "UNKNOWN_ERROR",
							error: "Unable to generate report.",
						}
						: body,
				);
				return;
			}

			setResult(body);
		} catch {
			setError({
				ok: false,
				errorCode: "UNKNOWN_ERROR",
				error: "Unable to generate report.",
			});
		} finally {
			setIsRunning(false);
		}
	};

	const canPrint = Boolean(result && !result.comingSoon && result.rows.length > 0);
	const isEmsCertificationStatusResult = Boolean(
		result &&
		result.source.key === "ems" &&
		result.columns.some((column) => column.key === "iowa_status" || column.key === "nremt_status"),
	);

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
				<p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">Reports</p>
				<h1
					className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
					style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
				>
					Reports
				</h1>
				<p className="mt-2 text-sm text-zinc-400">Search and generate department reports.</p>
				{departmentName ? (
					<p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{departmentName}</p>
				) : null}
			</section>

			<section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
				<div className="grid gap-4 xl:grid-cols-2">
					<div>
						<label htmlFor="report-category" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
							Report Category
						</label>
						<select
							id="report-category"
							value={selectedCategory}
							onChange={(event) => handleCategoryChange(event.target.value)}
							className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="">Select a report category</option>
							{reportSources.map((source) => (
								<option key={source.key} value={source.key}>
									{source.name}{source.availability === "coming-soon" ? " (Coming Soon)" : ""}
								</option>
							))}
						</select>
					</div>

					<div>
						<label htmlFor="report-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
							What are you looking for?
						</label>
						<input
							id="report-search"
							type="text"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search members, apparatus, deficiency numbers, inventory, and more..."
							className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>
				</div>

				<div className="mt-5 grid gap-4 xl:grid-cols-[220px_1fr]">
					<div>
						<label htmlFor="date-preset" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
							Date Range
						</label>
						<select
							id="date-preset"
							value={dateRange.preset}
							onChange={(event) => handlePresetChange(event.target.value as ReportDatePresetKey)}
							className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{REPORT_DATE_PRESETS.map((preset) => (
								<option key={preset.key} value={preset.key}>
									{preset.label}
								</option>
							))}
						</select>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<label htmlFor="date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
								From
							</label>
							<input
								id="date-from"
								type="date"
								value={dateRange.from}
								onChange={(event) => setDateRange((current) => ({ ...current, preset: "custom", from: event.target.value }))}
								className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
								disabled={!isCustomDateRange}
							/>
						</div>
						<div>
							<label htmlFor="date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
								To
							</label>
							<input
								id="date-to"
								type="date"
								value={dateRange.to}
								onChange={(event) => setDateRange((current) => ({ ...current, preset: "custom", to: event.target.value }))}
								className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
								disabled={!isCustomDateRange}
							/>
						</div>
					</div>
				</div>

				{selectedSource && selectedSource.filters.length > 0 ? (
					<div className="mt-5 border-t border-white/10 pt-4">
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Filters</p>
						<div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{selectedSourceFilters.map((definition) => {
								if (definition.key === "inventory_category") {
									return (
										<div key={definition.key}>
											<label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
												{definition.label}
											</label>
											<div className="mt-2">
												<select
													value={filters[definition.key] ?? "all"}
													onChange={(event) => handleInventoryCategoryChange(event.target.value)}
													className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
												>
													{(definition.options ?? []).map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</div>
										</div>
									);
								}

								if (definition.key === "inventory_report_type") {
									return (
										<div key={definition.key}>
											<label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
												Report Type
											</label>
											<div className="mt-2">
												<select
													value={inventoryReportTypeValue}
													onChange={(event) => setFilters((current) => ({ ...current, inventory_report_type: event.target.value }))}
													className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white focus:border-red-500/50 focus:outline-none"
													disabled={inventoryReportTypeOptions.length <= 1}
												>
													{inventoryReportTypeOptions.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</div>
										</div>
									);
								}

								return (
									<div key={definition.key}>
										<label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
											{definition.label}
										</label>
										<div className="mt-2">
											<FilterInput
												definition={definition}
												value={filters[definition.key] ?? ""}
												onChange={(value) => setFilters((current) => ({ ...current, [definition.key]: value }))}
											/>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				) : null}

				<div className="mt-5 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => void handleGenerateReport()}
						disabled={isRunning}
						className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isRunning ? "Generating..." : "Generate Report"}
					</button>
					<button
						type="button"
						onClick={() => window.print()}
						disabled={!canPrint}
						className="rounded-xl border border-white/20 bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Print Report
					</button>
				</div>
			</section>

			<section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Results</p>
						<h2 className="mt-1 text-2xl font-black tracking-tight text-white">Report Output</h2>
					</div>
					{result ? (
						<p className="text-sm text-zinc-400">{result.totalRows} record{result.totalRows === 1 ? "" : "s"}</p>
					) : null}
				</div>

				{!selectedSource ? (
					<div className="mt-5 rounded-xl border border-dashed border-white/15 bg-[#0f0f0f] px-4 py-8 text-sm text-zinc-400">
						Select a report category to begin.
					</div>
				) : null}

				{error ? (
					<div className="mt-5 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
						{error.error}
					</div>
				) : null}

				{result?.comingSoon ? (
					<div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-900/20 px-4 py-4 text-sm text-amber-100">
						This report is coming soon.
					</div>
				) : null}

				{result && !result.comingSoon && result.rows.length === 0 ? (
					<div className="mt-5 rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-8 text-sm text-zinc-400">
						No results found for the selected filters.
					</div>
				) : null}

				{result && !result.comingSoon && result.rows.length > 0 ? (
					<div className="mt-5 space-y-4">
						<div className="rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-3 text-xs text-zinc-400">
							<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
								<div>
									<p className="uppercase tracking-[0.14em] text-zinc-500">Department</p>
									<p className="mt-1 text-sm text-zinc-200">{result.departmentName ?? "Unknown Department"}</p>
								</div>
								<div>
									<p className="uppercase tracking-[0.14em] text-zinc-500">Report</p>
									<p className="mt-1 text-sm text-zinc-200">{result.source.name}</p>
								</div>
								<div>
									<p className="uppercase tracking-[0.14em] text-zinc-500">Period</p>
									<p className="mt-1 text-sm text-zinc-200">{result.period.label}</p>
								</div>
								<div>
									<p className="uppercase tracking-[0.14em] text-zinc-500">Period Basis</p>
									<p className="mt-1 text-sm text-zinc-200">{result.period.basisLabel}</p>
								</div>
								<div>
									<p className="uppercase tracking-[0.14em] text-zinc-500">Generated</p>
									<p className="mt-1 text-sm text-zinc-200">{generatedDateLabel}</p>
								</div>
							</div>
							{result.summary && result.summary.length > 0 ? (
								<div className="mt-3 border-t border-white/10 pt-3 text-sm text-zinc-300">
									<p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Summary</p>
									<p className="mt-1">
										{result.summary.map((item) => `${item.label}: ${item.value}`).join(" • ")}
									</p>
								</div>
							) : null}
							{result.filtersApplied.length > 0 ? (
								<div className="mt-3 border-t border-white/10 pt-3 text-sm text-zinc-300">
									<p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Applied Filters</p>
									<p className="mt-1">
										{result.filtersApplied.map((item) => `${item.label}: ${item.value}`).join(" • ")}
									</p>
								</div>
							) : null}
						</div>

						<ReportResultsTable
							columns={result.columns}
							rows={sortedRows}
							sortColumn={sortColumn}
							sortDirection={sortDirection}
							onSort={handleSort}
							stickyMemberColumn={isEmsCertificationStatusResult}
							showHorizontalScrollHint={isEmsCertificationStatusResult}
						/>
					</div>
				) : null}
			</section>

			{result && !result.comingSoon && result.rows.length > 0 ? (
				<section className="hidden print:block">
					<h1 className="text-2xl font-bold text-black">{result.source.name} Report</h1>
					<p className="mt-1 text-sm text-black">Department: {result.departmentName ?? "Unknown Department"}</p>
					<p className="text-sm text-black">Reporting Period: {result.period.label}</p>
					<p className="text-sm text-black">Period Basis: {result.period.basisLabel}</p>
					<p className="text-sm text-black">Generated: {generatedDateLabel}</p>
					{result.filtersApplied.length > 0 ? (
						<p className="mt-2 text-sm text-black">
							Filters: {result.filtersApplied.map((item) => `${item.label}: ${item.value}`).join("; ")}
						</p>
					) : null}
					{result.summary && result.summary.length > 0 ? (
						<p className="text-sm text-black">
							Summary: {result.summary.map((item) => `${item.label}: ${item.value}`).join("; ")}
						</p>
					) : null}
					<p className="mt-2 text-sm text-black">Records: {result.totalRows}</p>

					<table className="mt-4 w-full border-collapse text-left text-xs text-black">
						<thead>
							<tr>
								{result.columns.map((column) => (
									<th key={column.key} className="border border-black px-2 py-1 font-bold">
										{column.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{result.rows.map((row, index) => (
								<tr key={`${index}-${asText(row.id)}`}>
									{result.columns.map((column) => (
										<td key={column.key} className="border border-black px-2 py-1">
											{asText(row[column.key])}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</section>
			) : null}
		</div>
	);
}
