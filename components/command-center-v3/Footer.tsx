import Image from "next/image";

export default function Footer() {
  return (
    <footer className="flex h-12 items-center justify-center">
      <div className="flex items-center gap-3 text-[16px] font-[700] tracking-[0.14em]">
        <Image
          src="/branding/logos/redline-brand-mark.png"
          alt="Redline HQ"
          width={60}
          height={60}
          className="h-15 w-auto"
        />

        <span className="text-[#D4D4D8]">LESS PAPERWORK.</span>

        <span className="text-[#EF2B2D]">MORE READINESS.</span>
      </div>
    </footer>
  );
}