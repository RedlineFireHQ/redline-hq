"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PagerRecord = {
	id: string;
	department_id: string;
	pager_number: string;
	serial_number: string | null;
	manufacturer: string | null;
	model: string | null;
	location: string | null;
	assigned_member_id: string | null;
	status: "In Service" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type MemberOption = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type PagerFormValues = {
	pagerNumber: string;
	serialNumber: string;
	manufacturer: string;
	model: string;
	assignedMemberId: string;
	status: PagerRecord["status"];
	notes: string;
};

interface PagersWorkspaceProps {
	departmentId: string;
	departmentName: string | null;
	initialPagers: PagerRecord[];
	memberOptions: MemberOption[];
	membersError?: string | null;
	initialError?: string | null;
	canManagePagers: boolean;
}

const STATUS_OPTIONS: PagerRecord["status"][] = [
	"In Service",
	"Out of Service",
	"Lost",
	"Stolen",
	"Retired",
];

const EMPTY_FORM: PagerFormValues = {
	pagerNumber: "",
	serialNumber: "",
	manufacturer: "",
	model: "",
	assignedMemberId: "",
	status: "In Service",
	notes: "",
};

function normalizeOptionalText(value: string) {
	const trimmed = value.trim();
	return trimmed || null;
}

function formatDateTime(value: string | null | undefined) {
	if (!value) return "-";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function statusBadgeClasses(status: string) {
	if (status === "In Service") return "border-green-700/40 bg-green-900/20 text-green-300";
	if (status === "Out of Service" || status === "Lost" || status === "Stolen") return "border-red-700/40 bg-red-900/20 text-red-300";
	if (status === "Retired") return "border-neutral-600/40 bg-neutral-800 text-neutral-300";
	return "border-white/15 bg-neutral-900 text-neutral-200";
}

function getMemberName(member: MemberOption | undefined) {
	if (!member) return "-";
	const full = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
	return full || "-";
}

export default function PagersWorkspace({
	departmentId,
	departmentName,
	initialPagers,
	memberOptions,
	membersError = null,
	initialError = null,
	canManagePagers,
}: PagersWorkspaceProps) {
	const router = useRouter();
	const [rows, setRows] = useState(initialPagers);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingPager, setEditingPager] = useState<PagerRecord | null>(null);
	const [formValues, setFormValues] = useState<PagerFormValues>(EMPTY_FORM);
	const [error, setError] = useState<string | null>(initialError);
	const [isSaving, setIsSaving] = useState(false);

	const memberNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const member of memberOptions) {
			map.set(member.id, getMemberName(member));
		}
		return map;
	}, [memberOptions]);

	const filteredRows = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase();
		return rows.filter((row) => {
			if (statusFilter !== "All" && row.status !== statusFilter) return false;
			if (!normalizedSearch) return true;
			const assignedName = row.assigned_member_id ? memberNameById.get(row.assigned_member_id) ?? "" : "";
			return [row.pager_number, row.serial_number, row.manufacturer, row.model, assignedName, row.status, row.notes]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(normalizedSearch);
		});
	}, [rows, searchTerm, statusFilter, memberNameById]);

	const inServiceCount = rows.filter((row) => row.status === "In Service").length;
	const assignedCount = rows.filter((row) => row.assigned_member_id !== null).length;
	const outOfServiceCount = rows.filter((row) => row.status === "Out of Service").length;

	function openCreateModal() {
		setEditingPager(null);
		setFormValues(EMPTY_FORM);
		setIsModalOpen(true);
	}

	function openEditModal(pager: PagerRecord) {
		setEditingPager(pager);
		setFormValues({
			pagerNumber: pager.pager_number,
			serialNumber: pager.serial_number ?? "",
			manufacturer: pager.manufacturer ?? "",
			model: pager.model ?? "",
			assignedMemberId: pager.assigned_member_id ?? "",
			status: pager.status,
			notes: pager.notes ?? "",
		});
		setIsModalOpen(true);
	}

	function reportDeficiency(pager?: PagerRecord) {
		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/pagers");
		params.set("inventoryCategory", "pagers");
		if (pager) {
			params.set("inventoryItemId", pager.id);
			params.set("inventoryItemLabel", pager.pager_number);
		}
		router.push(`/deficiencies/report?${params.toString()}`);
	}

	async function refreshRows() {
		const { data, error: loadError } = await supabase
			.from("pagers")
			.select("*")
			.eq("department_id", departmentId)
			.order("pager_number", { ascending: true });

		if (loadError) {
			setError(loadError.message || "Unable to load pagers.");
			return;
		}

		setRows((data ?? []) as PagerRecord[]);
		setError(null);
	}

	async function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canManagePagers) return;

		const pagerNumber = formValues.pagerNumber.trim();
		if (!pagerNumber) {
			setError("Pager number is required.");
			return;
		}

		setIsSaving(true);
		setError(null);

		const payload = {
			pager_number: pagerNumber,
			serial_number: normalizeOptionalText(formValues.serialNumber),
			manufacturer: normalizeOptionalText(formValues.manufacturer),
			model: normalizeOptionalText(formValues.model),
			assigned_member_id: formValues.assignedMemberId || null,
			status: formValues.status,
			notes: normalizeOptionalText(formValues.notes),
		};

		const result = editingPager
			? await supabase.from("pagers").update(payload).eq("id", editingPager.id).eq("department_id", departmentId)
			: await supabase.from("pagers").insert({ ...payload, department_id: departmentId });

		setIsSaving(false);

		if (result.error) {
			setError(result.error.message || "Unable to save pager.");
			return;
		}

		setIsModalOpen(false);
		setEditingPager(null);
		setFormValues(EMPTY_FORM);
		await refreshRows();
	}

	return (
		<div className="space-y-6 p-6 text-white">
			<header className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Inventory</p>
				<div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<h1 className="text-4xl font-black tracking-tight">Pagers</h1>
						<p className="mt-2 text-sm font-semibold text-neutral-400">
							{departmentName ? `${departmentName} pager inventory and accountability.` : "Department pager inventory and accountability."}
						</p>
					</div>
					{canManagePagers ? (
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => reportDeficiency()}
								className="rounded-xl border border-amber-500/40 bg-amber-600/20 px-4 py-3 text-sm font-black uppercase tracking-wide text-amber-200 transition hover:bg-amber-600/30"
							>
								Report Deficiency
							</button>
							<button
								type="button"
								onClick={openCreateModal}
								className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-red-700"
							>
								Add Pager
							</button>
						</div>
					) : null}
				</div>
				<div className="mt-6 grid gap-3 sm:grid-cols-3">
					<div className="rounded-xl border border-green-700/30 bg-green-950/20 px-4 py-3"><p className="text-xs uppercase text-green-300">In Service</p><p className="mt-1 text-2xl font-black">{inServiceCount}</p></div>
					<div className="rounded-xl border border-sky-700/30 bg-sky-950/20 px-4 py-3"><p className="text-xs uppercase text-sky-300">Assigned</p><p className="mt-1 text-2xl font-black">{assignedCount}</p></div>
					<div className="rounded-xl border border-red-700/30 bg-red-950/20 px-4 py-3"><p className="text-xs uppercase text-red-300">Out of Service</p><p className="mt-1 text-2xl font-black">{outOfServiceCount}</p></div>
				</div>
			</header>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="grid gap-3 md:grid-cols-[1fr_220px]">
					<input
						value={searchTerm}
						onChange={(event) => setSearchTerm(event.target.value)}
						placeholder="Search pagers by number, serial, member, manufacturer, or model..."
						className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
					/>
					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value)}
						className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
					>
						<option value="All">All Statuses</option>
						{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
					</select>
				</div>
			</section>

			{error ? <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm font-semibold text-red-200">{error}</div> : null}

			<section className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#2E2E2E]">
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-neutral-800 text-left text-sm">
						<thead className="bg-[#1b1b1b] text-xs uppercase tracking-[0.16em] text-neutral-500">
							<tr>
								<th className="px-4 py-3">Pager</th>
								<th className="px-4 py-3">Serial</th>
								<th className="px-4 py-3">Manufacturer / Model</th>
								<th className="px-4 py-3">Assigned To</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Updated</th>
								<th className="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-neutral-800">
							{filteredRows.map((pager) => (
								<tr key={pager.id} className="text-neutral-200">
									<td className="px-4 py-3 font-black text-white">{pager.pager_number}</td>
									<td className="px-4 py-3">{pager.serial_number ?? "-"}</td>
									<td className="px-4 py-3">{[pager.manufacturer, pager.model].filter(Boolean).join(" ") || "-"}</td>
									<td className="px-4 py-3">{pager.assigned_member_id ? memberNameById.get(pager.assigned_member_id) ?? "-" : "-"}</td>
									<td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusBadgeClasses(pager.status)}`}>{pager.status}</span></td>
									<td className="px-4 py-3">{formatDateTime(pager.updated_at ?? pager.created_at)}</td>
									<td className="px-4 py-3 text-right">
										{canManagePagers ? (
											<div className="flex justify-end gap-2">
												<button type="button" onClick={() => reportDeficiency(pager)} className="rounded-lg border border-amber-500/30 bg-amber-600/10 px-3 py-2 text-xs font-black uppercase text-amber-200 transition hover:bg-amber-600/20">Report Deficiency</button>
												<button type="button" onClick={() => openEditModal(pager)} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-black uppercase text-white transition hover:bg-white/10">Edit</button>
											</div>
										) : <span className="text-xs text-neutral-500">Read only</span>}
									</td>
								</tr>
							))}
							{filteredRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-neutral-500">No pagers found.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</section>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<form onSubmit={handleSave} className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#242424] p-6 shadow-2xl">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2 className="text-2xl font-black">{editingPager ? "Edit Pager" : "Add Pager"}</h2>
								<p className="mt-1 text-sm text-neutral-400">Track pager identity, status, and station location.</p>
							</div>
							<button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10">Close</button>
						</div>
						<div className="mt-6 grid gap-4 sm:grid-cols-2">
							<label className="text-sm font-semibold text-neutral-300">Pager Number<input required value={formValues.pagerNumber} onChange={(event) => setFormValues((current) => ({ ...current, pagerNumber: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none" /></label>
							<label className="text-sm font-semibold text-neutral-300">Serial Number<input value={formValues.serialNumber} onChange={(event) => setFormValues((current) => ({ ...current, serialNumber: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none" /></label>
							<label className="text-sm font-semibold text-neutral-300">Manufacturer<input value={formValues.manufacturer} onChange={(event) => setFormValues((current) => ({ ...current, manufacturer: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none" /></label>
							<label className="text-sm font-semibold text-neutral-300">Model<input value={formValues.model} onChange={(event) => setFormValues((current) => ({ ...current, model: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none" /></label>
							<label className="text-sm font-semibold text-neutral-300">Assigned To
								<select value={formValues.assignedMemberId} onChange={(event) => setFormValues((current) => ({ ...current, assignedMemberId: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none">
									<option value="">Unassigned</option>
									{memberOptions.map((member) => <option key={member.id} value={member.id}>{getMemberName(member)}</option>)}
								</select>
								{memberOptions.length === 0 ? <p className="mt-2 text-xs font-semibold text-amber-300">{membersError ? `Could not load members: ${membersError}` : "No active department members found."}</p> : null}
							</label>
							<label className="text-sm font-semibold text-neutral-300">Status<select value={formValues.status} onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value as PagerRecord["status"] }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none">{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
							<label className="text-sm font-semibold text-neutral-300 sm:col-span-2">Notes<textarea value={formValues.notes} onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-white focus:border-red-500/50 focus:outline-none" /></label>
						</div>
						<div className="mt-6 flex justify-end gap-3">
							<button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black uppercase text-neutral-300 hover:bg-white/10">Cancel</button>
							<button type="submit" disabled={isSaving} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase text-white transition hover:bg-red-700 disabled:opacity-60">{isSaving ? "Saving..." : editingPager ? "Save Pager" : "Add Pager"}</button>
						</div>
					</form>
				</div>
			) : null}
		</div>
	);
}
