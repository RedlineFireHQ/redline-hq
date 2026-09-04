import PageLayout from "@/components/layout/PageLayout";
import Link from "next/link";

const inventoryCategories = [
	{ name: "EMS Inventory", detail: "Supplies and equipment", href: "/inventory/ems-supplies" },
	{ name: "Fire Hose", detail: "148 sections", href: "/inventory/fire-hose" },
	{ name: "SCBA Packs", detail: "24 tracked units", href: "/inventory/scba-packs" },
	{ name: "SCBA Cylinders", detail: "62 tracked cylinders", href: "/inventory/scba-cylinders" },
	{ name: "Portable Radios", detail: "39 assigned radios", href: "/inventory/portable-radios" },
	{ name: "Fire Extinguishers", detail: "Tracked extinguisher inventory", href: "/inventory/fire-extinguishers" },
	{
		name: "Thermal Imaging Cameras",
		detail: "7 assigned cameras",
		href: "/inventory/thermal-cameras",
	},
	{ name: "Gas Monitors", detail: "12 calibrated monitors", href: "/inventory/gas-monitors" },
	{ name: "PPE", detail: "92 stocked items", href: "/inventory/ppe" },
	{ name: "Rope", detail: "Inspection-ready rope inventory", href: "/inventory/rope" },
	{ name: "Miscellaneous Fire Equipment", detail: "General fire equipment and tools", href: "/inventory/misc-fire-equipment" },
	{ name: "Batteries", detail: "61 on hand", href: "/inventory/batteries" },
	{ name: "Power & Industrial Equipment", detail: "14 tracked units", href: "/inventory/pie" },
	{ name: "Ground Ladders", detail: "18 inspection records", href: "/inventory/ground-ladders" },
];

export default function AssetsPage() {
	return (
		<PageLayout
			environmentBackgroundUrl="/branding/images/inventorypage.png"
			environmentBackgroundPosition="left center"
		>
			<div className="space-y-8">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
						Command Center
					</p>

					<h1
						className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
						style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
					>
						Inventory
					</h1>

					<p className="mt-3 max-w-2xl text-lg text-neutral-400">
						Track. Inspect. Maintain. Stay Ready.
					</p>
				</div>

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
						<div className="flex flex-col items-start gap-2 md:items-end">
							<Link
								href="/deficiencies/report"
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</Link>
							<p className="text-sm font-semibold text-neutral-400">Launch Into Category Management</p>
						</div>
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
