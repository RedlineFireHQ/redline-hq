import PageLayout from "@/components/layout/PageLayout";
import { getAssetById } from "@/lib/database";
import { notFound } from "next/navigation";

interface AssetDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function AssetDetailPage({
	params,
}: AssetDetailPageProps) {
	const { id } = await params;
	const asset = await getAssetById(id);

	if (!asset) {
		notFound();
	}

	const statusValue =
		asset.status ?? asset.inspection_status ?? asset.current_status ?? "Not Set";

	const assignedApparatusValue =
		asset.assigned_apparatus_name ??
		asset.assigned_apparatus ??
		asset.apparatus_name ??
		asset.apparatus?.name ??
		asset.apparatus_id ??
		"Not Set";

	const infoCards = [
		{ label: "Inventory Type", value: asset.type ?? asset.asset_type ?? "Not Set" },
		{ label: "Manufacturer", value: asset.manufacturer ?? "Not Set" },
		{ label: "Serial Number", value: asset.serial_number ?? "Not Set" },
		{ label: "Assigned Apparatus", value: assignedApparatusValue },
		{ label: "Current Status", value: statusValue },
	];

	return (
		<PageLayout>
			<div className="space-y-8">
				<h1 className="text-5xl font-black tracking-tight text-white">
					{asset.name ?? "Inventory Item"}
				</h1>

				<p className="text-lg text-neutral-400">Inventory ID: {id}</p>

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{infoCards.map((item) => (
						<div
							key={item.label}
							className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6"
						>
							<p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
								{item.label}
							</p>

							<p className="mt-3 text-xl font-bold text-white">{item.value}</p>
						</div>
					))}
				</div>
			</div>
		</PageLayout>
	);
}
