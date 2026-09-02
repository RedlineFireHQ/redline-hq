import { ReactNode } from "react";

interface InventoryPageShellProps {
	eyebrow?: string;
	title?: string;
	subtitle?: string;
	primaryAction?: ReactNode;
	secondaryAction?: ReactNode;
	readiness?: ReactNode;
	toolbar?: ReactNode;
	children: ReactNode;
}

export default function InventoryPageShell({
	eyebrow,
	title,
	subtitle,
	primaryAction,
	secondaryAction,
	readiness,
	toolbar,
	children,
}: InventoryPageShellProps) {
	return (
		<div className="space-y-8">
			{eyebrow || title || subtitle ? (
				<div>
					{eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">{eyebrow}</p> : null}
					{title ? <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{title}</h1> : null}
					{subtitle ? <p className="mt-3 max-w-2xl text-lg text-neutral-400">{subtitle}</p> : null}
				</div>
			) : null}

			{readiness ? readiness : null}

			{toolbar ? toolbar : null}

			<div className="flex flex-wrap items-center gap-2">
				{primaryAction ? primaryAction : null}
				{secondaryAction ? secondaryAction : null}
			</div>

			{children}
		</div>
	);
}