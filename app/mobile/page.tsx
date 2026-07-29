"use client";

import Image from "next/image";
import {
	Activity,
	AlertTriangle,
	Bell,
	Dumbbell,
	Box,
	ChevronRight,
	ClipboardCheck,
	FileBarChart2,
	FileText,
	GraduationCap,
	Home,
	Map,
	MoreHorizontal,
	ScanLine,
	Shield,
	Truck,
	Wrench,
} from "lucide-react";

type CardItem = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
};

const operations: CardItem[] = [
	{ label: "Check\nTrucks", icon: Truck },
	{ label: "Apparatus\nChecks", icon: ClipboardCheck },
	{ label: "Log\nTraining", icon: GraduationCap },
	{ label: "Quick\nTraining", icon: GraduationCap },
	{ label: "Pre-Plans", icon: Map },
	{ label: "Fitness", icon: Dumbbell },
];

const buttonInteraction = "transition-all duration-200 active:scale-[0.98]";
const actionCardClassName =
	"group relative flex h-[94px] w-full flex-col justify-start overflow-hidden border border-white/18 bg-[linear-gradient(to_bottom,rgba(34,34,34,0.94),rgba(9,9,9,0.98))] px-5 pb-4 pt-4 text-left shadow-[0_12px_20px_rgba(0,0,0,0.32),0_2px_8px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-10px_16px_rgba(0,0,0,0.26)]";

const equipment: CardItem[] = [
	{ label: "Ladder\nInspections", icon: Wrench },
	{ label: "Rope\nInspections", icon: Activity },
	{ label: "Hose\nTesting", icon: Activity },
	{ label: "Inventory", icon: Box },
	{ label: "Deficiencies", icon: AlertTriangle },
	{ label: "Maintenance", icon: Wrench },
];

const resources: CardItem[] = [
	{ label: "Reports", icon: FileBarChart2 },
	{ label: "Documents", icon: FileText },
];

function SectionHeader({ title, meta, className = "" }: { title: string; meta: string; className?: string }) {
	return (
		<div className={`mb-4 mt-6 flex items-center justify-between ${className}`}>
			<div className="flex items-center gap-2">
				<span className="h-[14px] w-[6px] -skew-x-[20deg] rounded-sm bg-[#ef2b2d]" />
				<h3 className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white/85">{title}</h3>
			</div>
			<button className={`inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[14px] font-semibold uppercase tracking-[0.08em] text-[#ef2b2d]/80 hover:text-[#ef2b2d] ${buttonInteraction}`}>
				{meta}
				<ChevronRight className="h-4 w-4" />
			</button>
		</div>
	);
}

function ActionCard({ label, Icon }: { label: string; Icon: CardItem["icon"] }) {
	return (
		<button
			className={`${actionCardClassName} ${buttonInteraction}`}
			style={{ clipPath: "polygon(8% 0, 93% 0, 100% 12%, 100% 88%, 92% 100%, 7% 100%, 0 87%, 0 13%)" }}
		>
			<span className="pointer-events-none absolute left-[10px] right-[10px] top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.22),rgba(255,255,255,0))]" />
			<span className="pointer-events-none absolute left-[17px] top-[8px] h-[10px] w-[14px] -skew-x-[18deg] border-l border-t border-white/16" />
			<span className="pointer-events-none absolute right-[17px] top-[8px] h-[10px] w-[14px] skew-x-[18deg] border-r border-t border-white/14" />
			<span className="pointer-events-none absolute inset-x-3 top-0 h-[40%] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
			<span className="absolute left-0 top-[18px] h-5 w-[3px] bg-[#ef2b2d] opacity-90 shadow-[0_0_7px_rgba(239,43,45,0.24)]" />
			<ChevronRight className="absolute right-3 top-3 h-[18px] w-[18px] text-white/55 transition group-hover:text-white/80" />
			<div className="flex items-start">
				<Icon className="h-7 w-7 text-[#ef2b2d]" />
			</div>
			<div className="mt-1 flex min-h-0 flex-1 items-end">
				<span
					className={`whitespace-pre-line break-words text-[17px] font-medium leading-[1.15] text-white/95 ${
						label === "Maintenance"
							? "-translate-x-[10px]"
							: label === "Deficiencies"
								? "-translate-x-[8px]"
								: label === "Ladder\nInspections"
									? "-translate-x-[4px]"
								: label === "Rope\nInspections"
									? "-translate-x-[4px]"
									: ""
					}`}
				>
					{label}
				</span>
			</div>
		</button>
	);
}

export default function MobilePage() {
	const readiness = 98;
	const gaugeSize = 108;
	const stroke = 7;
	const radius = (gaugeSize - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const startAngle = 135;
	const sweepAngle = 270;
	const arcLength = (circumference * sweepAngle) / 360;
	const progressLength = (readiness / 100) * arcLength;
	const tickCount = 18;
	const innerTickCount = 36;

	return (
		<>
			<main className="min-h-screen overscroll-y-none bg-[#020202] px-3 py-5 text-white">
			<div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[44px] border border-white/20 bg-[#050505] shadow-[0_40px_100px_rgba(0,0,0,0.75)]">
				<div className="pointer-events-none fixed left-1/2 top-5 z-0 h-[280px] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 overflow-hidden rounded-[44px] border-b border-white/10">
					<Image
						src="/branding/logos/desktop.png"
						alt="Firefighter background"
						fill
						priority
						className="object-cover brightness-145 contrast-128 saturate-138"
						style={{ objectPosition: "84% calc(55% + 6px)" }}
					/>
					<div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.06),rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.46))]" />
				</div>

				<div className="relative z-10 h-[280px] overflow-hidden border-b border-white/10">

					<div className="absolute inset-x-6 top-5 flex items-center justify-between text-[12px] font-semibold tracking-tight">
						<span>9:41</span>
						<div className="flex items-center gap-2 text-sm text-white/80">
							<span className="h-2 w-2 rounded-full bg-white" />
							<span className="h-2 w-2 rounded-full bg-white/70" />
							<span className="h-2 w-2 rounded-full bg-white/40" />
						</div>
					</div>

					<div className="absolute left-6 right-6 top-20">
						<div className="flex items-start justify-between">
							<button className={`relative mt-2 rounded-full border border-white/25 bg-black/30 p-2 text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] ${buttonInteraction}`}>
								<Bell className="h-6 w-6" />
								<span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#ef2b2d] text-xs font-bold text-white">
									3
								</span>
							</button>
						</div>

						<p className="mt-6 -translate-y-[116px] text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75">
							Elliott Fire Department
						</p>
						<h1 className="mt-4 -translate-y-[130px] translate-x-[10px] text-[22px] font-semibold leading-none tracking-tight">Adam</h1>
						<div className="mt-4 h-[3px] w-10 bg-[#ef2b2d]" />
					</div>
				</div>

				<div className="relative z-10 -mt-6 px-4 pb-48">
					<section
						className="-mt-[47px] relative h-[175.2px] overflow-hidden border border-white/16 bg-[linear-gradient(to_bottom,rgba(35,35,35,0.96),rgba(10,10,10,0.99))] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.46),0_3px_12px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-14px_20px_rgba(0,0,0,0.24)]"
						style={{ clipPath: "polygon(6% 0, 94% 0, 100% 12%, 100% 89%, 95% 100%, 5% 100%, 0 89%, 0 12%)" }}
					>
						<div className="pointer-events-none absolute left-[14px] right-[14px] top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.24),rgba(255,255,255,0))]" />
						<div className="pointer-events-none absolute left-[18px] top-[9px] h-[10px] w-[14px] -skew-x-[18deg] border-l border-t border-white/16" />
						<div className="pointer-events-none absolute right-[18px] top-[9px] h-[10px] w-[14px] skew-x-[18deg] border-r border-t border-white/14" />
						<div className="pointer-events-none absolute inset-x-6 top-2 h-7 rounded-full bg-[linear-gradient(to_bottom,rgba(255,255,255,0.18),rgba(255,255,255,0))] blur-[1px]" />
						<div className="translate-y-[14px] flex items-center gap-4">
							<div className="relative flex h-[92px] w-[92px] flex-shrink-0 items-center justify-center rounded-full bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-10px_16px_rgba(0,0,0,0.48)]">
								<span className="pointer-events-none absolute inset-[7px] rounded-full shadow-[0_0_18px_rgba(239,43,45,0.22)]" />
								<span className="pointer-events-none absolute left-1/2 top-[7px] h-[26px] w-[68px] -translate-x-1/2 rounded-full bg-[linear-gradient(to_bottom,rgba(255,255,255,0.2),rgba(255,255,255,0))] blur-[1px]" />
								<svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
									<g style={{ transform: `rotate(${startAngle}deg)`, transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px` }}>
										{Array.from({ length: innerTickCount }).map((_, index) => {
											const tickAngle = (sweepAngle / (innerTickCount - 1)) * index;
											return (
												<line
													key={`inner-${index}`}
													x1={gaugeSize / 2}
													y1={17}
													x2={gaugeSize / 2}
													y2={20}
													stroke="rgba(255,255,255,0.18)"
													strokeWidth={0.9}
													strokeLinecap="round"
													transform={`rotate(${tickAngle} ${gaugeSize / 2} ${gaugeSize / 2})`}
												/>
											);
										})}
									</g>
									<g style={{ transform: `rotate(${startAngle}deg)`, transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px` }}>
										{Array.from({ length: tickCount }).map((_, index) => {
											const tickAngle = (sweepAngle / (tickCount - 1)) * index;
											const isRedline = index >= tickCount - 4;
											return (
												<line
													key={index}
													x1={gaugeSize / 2}
													y1={isRedline ? 8 : 10}
													x2={gaugeSize / 2}
													y2={isRedline ? 16 : 14}
													stroke={isRedline ? "rgba(239,43,45,0.9)" : "rgba(255,255,255,0.2)"}
													strokeWidth={isRedline ? 1.9 : 1}
													strokeLinecap="round"
													transform={`rotate(${tickAngle} ${gaugeSize / 2} ${gaugeSize / 2})`}
												/>
											);
										})}
									</g>
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={radius}
										stroke="rgba(255,255,255,0.14)"
										strokeWidth={stroke}
										strokeDasharray={`${arcLength} ${circumference}`}
										fill="none"
										style={{
											transform: `rotate(${startAngle}deg)`,
											transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px`,
										}}
									/>
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={radius}
										stroke="#ef2b2d"
										strokeWidth={stroke}
										strokeLinecap="round"
										strokeDasharray={`${progressLength} ${circumference}`}
										fill="none"
										style={{
											transform: `rotate(${startAngle}deg)`,
											transformOrigin: `${gaugeSize / 2}px ${gaugeSize / 2}px`,
											filter: "drop-shadow(0 0 5px rgba(239,43,45,0.34))",
										}}
									/>
								</svg>
								<div className="relative z-10 text-center">
									<div className="text-[38px] font-semibold leading-none tracking-tight">98<span className="text-[23px]">%</span></div>
								</div>
							</div>

							<div className="min-w-0 flex-1">
								<p className="w-full translate-y-[-11px] whitespace-nowrap text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">My Readiness</p>
								<div
									className="readiness-flow mx-auto mt-1 h-[2px] w-[230px] -translate-y-[11px] bg-[linear-gradient(to_right,rgba(239,43,45,0),rgba(120,12,12,0.92),rgba(239,43,45,0))]"
								/>
								<h2
									className="mt-1 text-[21px] font-semibold uppercase tracking-[0.03em] text-[#ff3c36]"
									style={{ fontFamily: '"Ultra Pro", sans-serif' }}
								>
									Redline Ready
								</h2>
								<p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/85">
									<Shield className="h-3.5 w-3.5 text-[#ef2b2d]" />
									All certifications current
								</p>
								<button className={`mt-1 inline-flex h-9 min-w-[190px] -translate-x-[10px] translate-y-[20px] items-center justify-between gap-2 rounded-[12px] border border-[#ef2b2d] bg-[#ef2b2d] px-6 text-[12px] font-semibold text-white/90 shadow-[0_10px_22px_rgba(0,0,0,0.3)] hover:bg-[#ff3c36] ${buttonInteraction}`}>
									Improve My Readiness
									<ChevronRight className="h-4 w-4 text-white" />
								</button>
							</div>

						</div>
					</section>

					<SectionHeader title="Operations" meta="6 Tasks" />
					<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
						{operations.map((item) => (
							<ActionCard key={item.label} label={item.label} Icon={item.icon} />
						))}
					</div>

					<SectionHeader title="Equipment" meta="6 Systems" className="mt-10" />
					<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
						{equipment.map((item) => (
							<ActionCard key={item.label} label={item.label} Icon={item.icon} />
						))}
					</div>

					<SectionHeader title="Resources" meta="2 Libraries" className="mt-10" />
					<div className="grid grid-cols-2 gap-3">
						{resources.map((item) => (
							<ActionCard key={item.label} label={item.label} Icon={item.icon} />
						))}
					</div>
				</div>

				<nav className="fixed bottom-2 left-1/2 z-30 grid w-[calc(100%-16px)] max-w-[404px] -translate-x-1/2 grid-cols-5 items-center overflow-hidden rounded-[26px] border border-white/16 bg-[linear-gradient(to_bottom,rgba(31,31,31,0.97),rgba(11,11,11,0.99))] px-4 py-2 shadow-[0_16px_26px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(0,0,0,0.22)]">
					<span className="pointer-events-none absolute left-5 right-5 top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.2),rgba(255,255,255,0))]" />
					<span className="pointer-events-none absolute inset-x-4 top-0 h-[45%] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
					<button className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 text-[#ef2b2d] ${buttonInteraction}`}>
						<Home className="h-6 w-6" />
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Home</span>
					</button>
					<button className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 text-white/55 ${buttonInteraction}`}>
						<Shield className="h-6 w-6" />
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Alerts</span>
					</button>
					<button className={`relative flex justify-center rounded-[16px] ${buttonInteraction}`}>
						<span className="absolute -top-7 h-[72px] w-[72px] rounded-[22px] border border-[#ef2b2d]/25 bg-[radial-gradient(circle_at_30%_20%,#3a1313,#100c0c)] shadow-[0_20px_30px_rgba(0,0,0,0.5)]" />
						<Image
							src="/branding/logos/redline-brand-mark.png"
							alt="Redline"
							width={91}
							height={91}
							className="relative z-10 mt-[-14px]"
						/>
					</button>
					<button className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 text-white/55 ${buttonInteraction}`}>
						<ScanLine className="h-6 w-6" />
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Scan</span>
					</button>
					<button className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 text-white/55 ${buttonInteraction}`}>
						<MoreHorizontal className="h-6 w-6" />
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">More</span>
					</button>
				</nav>
			</div>
			</main>

			<style jsx global>{`
				.readiness-flow {
					background-size: 200% 100%;
					animation: readiness-flow 2.1s linear infinite;
				}

				@keyframes readiness-flow {
					0% {
						background-position: -200% 0;
					}
					100% {
						background-position: 200% 0;
					}
				}
			`}</style>
		</>
	);
}
