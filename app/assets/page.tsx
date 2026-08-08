import PageLayout from "@/components/layout/PageLayout";
import Link from "next/link";

const inventoryCategories = [
	{ name: "EMS Supplies", detail: "284 items", href: "/inventory/ems-supplies" },
	{ name: "Fire Hose", detail: "148 sections", href: "/inventory/fire-hose" },
	{ name: "SCBA Packs", detail: "24 tracked units", href: "/inventory/scba-packs" },
	{ name: "SCBA Cylinders", detail: "62 tracked cylinders", href: "/inventory/scba-cylinders" },
	{ name: "Portable Radios", detail: "39 assigned radios", href: "/inventory/radios" },
	{
		name: "Thermal Imaging Cameras",
		detail: "7 assigned cameras",
		href: "/inventory/thermal-cameras",
	},
	{ name: "Gas Monitors", detail: "12 calibrated monitors", href: "/inventory/gas-monitors" },
	{ name: "AEDs", detail: "6 frontline units", href: "/inventory/aeds" },
	{ name: "PPE", detail: "92 stocked items", href: "/inventory/ppe" },
	{ name: "Batteries", detail: "61 on hand", href: "/inventory/batteries" },
	{ name: "Ground Ladders", detail: "18 inspection records", href: "/inventory/ground-ladders" },
	{ name: "Station Supplies", detail: "73 consumables", href: "/inventory/station-supplies" },
	{ name: "Cleaning Supplies", detail: "56 in stock", href: "/inventory/cleaning-supplies" },
	{ name: "Office Supplies", detail: "48 in stock", href: "/inventory/office-supplies" },
];

const lowStockItemsCount = 27;
const expiringItemsCount = 13;
const inventoryAlertsCount = 41;
const inventoryReadinessScore = 94;

export default function AssetsPage() {
	return (
		<PageLayout>
			<div className="space-y-8">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
						Command Center
					</p>

					<h1 className="mt-2 text-5xl font-black tracking-tight text-white">
						Inventory
					</h1>

					<p className="mt-3 max-w-2xl text-lg text-neutral-400">
						Track. Inspect. Maintain. Stay Ready.
					</p>
				</div>

				<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0 flex-1">
							<h2 className="text-2xl font-bold text-white">Inventory Readiness</h2>

							<ul className="mt-4 space-y-2 text-sm text-neutral-200">
								<li>
									<Link
										href="/inventory/current"
										className="inline-flex rounded-md border border-emerald-700/40 bg-emerald-900/20 px-3 py-1.5 text-emerald-200 transition hover:bg-emerald-900/30"
									>
										✓ Inventory Current
									</Link>
								</li>
								<li>
									<Link
										href="/inventory/low-stock"
										className="inline-flex rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-amber-200 transition hover:bg-amber-900/30"
									>
										⚠ {lowStockItemsCount} Low Stock Items
									</Link>
								</li>
								<li>
									<Link
										href="/inventory/expiring"
										className="inline-flex rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-amber-200 transition hover:bg-amber-900/30"
									>
										⚠ {expiringItemsCount} Expiring Items
									</Link>
								</li>
								<li>
									<Link
										href="/inventory/alerts"
										className="inline-flex rounded-md border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-red-200 transition hover:bg-red-900/30"
									>
										⚠ {inventoryAlertsCount} Inventory Alerts
									</Link>
								</li>
							</ul>

							<div className="mt-4">
								<Link
									href="/deficiencies/report"
									className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									Report Deficiency
								</Link>
							</div>
						</div>

						<div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.15em] text-neutral-500">Readiness</p>
							<p className="mt-1 text-4xl font-black text-white">{inventoryReadinessScore}%</p>
							<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">Ready</p>

							<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
								<div
									className="h-full rounded-full bg-red-500 transition-all"
									style={{ width: `${inventoryReadinessScore}%` }}
								/>
							</div>
						</div>
					</div>
				</section>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
					<div className="flex flex-col gap-3 md:flex-row md:items-center">
						<div className="min-w-0 flex-1">
							<label htmlFor="inventory-search" className="sr-only">
								Search inventory
							</label>
							<input
								id="inventory-search"
								type="text"
								placeholder="Search inventory by name, inventory number, serial number, manufacturer, or QR code..."
								className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
							/>
						</div>

					</div>
				</section>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Operations</p>
							<h2 className="mt-2 text-3xl font-black tracking-tight text-white">Inventory Categories</h2>
						</div>
						<p className="text-sm font-semibold text-neutral-400">Launch Into Category Management</p>
					</div>

					<div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{inventoryCategories.map((category) => (
							<Link
								key={category.name}
								href={category.href}
								className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-left transition hover:border-red-500/40 hover:bg-[#202020]"
							>
								<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Category</p>
								<p className="mt-2 text-base font-semibold text-white">{category.name}</p>
								<p className="mt-2 text-sm text-neutral-400">{category.detail}</p>
							</Link>
						))}
					</div>
				</section>


			</div>
		</PageLayout>
	);
}
