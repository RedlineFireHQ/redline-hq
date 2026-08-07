import PageLayout from "@/components/layout/PageLayout";

export default function AssestsPage() {
	return (
		<PageLayout>
			<main className="min-h-screen bg-[#090909] px-6 py-10 text-white">
				<div className="mx-auto w-full max-w-7xl">
					<h1 className="text-4xl font-black tracking-tight text-white">Inventory</h1>
					<p className="mt-3 max-w-2xl text-base text-zinc-400">
						Track, manage, and resolve apparatus and equipment deficiencies.
					</p>
				</div>
			</main>
		</PageLayout>
	);
}
