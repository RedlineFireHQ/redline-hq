import { Wrench } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";

interface ComingSoonPageProps {
	title: string;
	description?: string;
}

export default function ComingSoonPage({
	title,
	description = "This module is currently under development and will be available soon.",
}: ComingSoonPageProps) {
	return (
		<PageLayout>
			<div className="flex min-h-[70vh] items-center justify-center px-4">
				<div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#111111] px-8 py-12 text-center shadow-[0_25px_70px_rgba(0,0,0,.45)]">
					<div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/15 px-4 py-1.5">
						<span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">
							COMING SOON
						</span>
					</div>

					<div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1a1a] text-red-400">
						<Wrench size={24} />
					</div>

					<h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
						{title}
					</h1>

					<p className="mx-auto mt-4 max-w-2xl text-base text-neutral-400 md:text-lg">
						{description}
					</p>
				</div>
			</div>
		</PageLayout>
	);
}
