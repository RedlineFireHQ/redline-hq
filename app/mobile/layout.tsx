import MobileShell from "@/components/mobile/MobileShell";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b0c0e] text-white [color-scheme:dark]">
      <MobileShell>{children}</MobileShell>
    </div>
  );
}
