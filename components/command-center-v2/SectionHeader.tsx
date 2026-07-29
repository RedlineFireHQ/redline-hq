type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: Props) {
  return (
    <div className="flex h-[72px] items-center justify-between border-b border-zinc-800 bg-[#141414] px-5">

      <div>

        <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-500">
          {eyebrow}
        </div>

        <h2 className="mt-1 text-xl font-black leading-none text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-zinc-500">
            {subtitle}
          </p>
        )}

      </div>

      {action && action}

    </div>
  );
}