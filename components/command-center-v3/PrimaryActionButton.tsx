import { ChevronRight } from "lucide-react";

type PrimaryActionButtonProps = {
  label: string;
  className?: string;
};

export default function PrimaryActionButton({
  label,
  className = "",
}: PrimaryActionButtonProps) {
  return (
    <button
      className={`group flex h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-4 text-white shadow-[0_0_18px_rgba(239,43,45,.28)] transition-all duration-300 hover:shadow-[0_0_26px_rgba(239,43,45,.40)] active:translate-y-[1px] active:shadow-[0_0_14px_rgba(239,43,45,.24)] ${className}`}
      type="button"
    >
      <span className="text-[16px] font-semibold leading-none">{label}</span>

      <ChevronRight
        size={17}
        className="text-white transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-[2px]"
      />
    </button>
  );
}