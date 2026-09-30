import MobileShell from "@/components/mobile/MobileShell";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-document-root min-h-screen bg-[#000000] text-white [color-scheme:dark]">
      <MobileShell>{children}</MobileShell>
    </div>
  );
}
