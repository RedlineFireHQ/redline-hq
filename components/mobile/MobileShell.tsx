"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ChevronRight, FileText, Home, LogOut, MoreHorizontal, ScanLine, Shield, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const focusedRoutePatterns = [
  /^\/mobile\/apparatus-checks\/[^/]+$/,
  /^\/mobile\/training\/new$/,
  /^\/mobile\/gas-monitor-calibration$/,
  /^\/mobile\/ladder-inspections$/,
  /^\/mobile\/rope-inspections$/,
  /^\/mobile\/hose-testing$/,
  /^\/mobile\/pre-plans\/new$/,
];

const MobileWorkflowContext = createContext<((focused: boolean) => void) | null>(null);

export function useMobileWorkflow() {
  return useContext(MobileWorkflowContext);
}

export default function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFocusedWorkflow = focusedRoutePatterns.some((pattern) => pattern.test(pathname));

  return <MobileShellContent pathname={pathname} initialFocused={isFocusedWorkflow}>{children}</MobileShellContent>;
}

function MobileShellContent({ pathname, initialFocused, children }: { pathname: string; initialFocused: boolean; children: ReactNode }) {
  const [isWorkflowFocused, setIsWorkflowFocused] = useState(initialFocused);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  return <MobileWorkflowContext.Provider value={setIsWorkflowFocused}><div className={isWorkflowFocused ? "min-h-screen" : "min-h-screen pb-[calc(5.75rem+env(safe-area-inset-bottom))]"}>
      {children}
      {!isWorkflowFocused ? <>
        <nav className="fixed bottom-2 left-1/2 z-30 grid w-[calc(100%-16px)] max-w-md -translate-x-1/2 grid-cols-5 items-center overflow-hidden rounded-[26px] border border-white/16 bg-[linear-gradient(to_bottom,rgba(31,31,31,0.97),rgba(11,11,11,0.99))] px-4 py-2 shadow-[0_16px_26px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(0,0,0,0.22)]" aria-label="Mobile navigation">
          <span className="pointer-events-none absolute left-5 right-5 top-[1px] h-px bg-[linear-gradient(to_right,rgba(255,255,255,0),rgba(245,245,245,0.2),rgba(255,255,255,0))]" />
          <span className="pointer-events-none absolute inset-x-4 top-0 h-[45%] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
          <LegacyNavLink href="/mobile" label="Home" active={pathname === "/mobile"}><Home className="h-6 w-6" /></LegacyNavLink>
          <LegacyNavLink href="/mobile/alerts" label="Alerts" active={pathname.startsWith("/mobile/alerts")}><Shield className="h-6 w-6" /></LegacyNavLink>
          <Link href="/mobile/my-readiness" aria-label="My Readiness" className="relative flex justify-center rounded-[16px]">
            <span className="absolute -top-7 h-[72px] w-[72px] rounded-[22px] border border-[#ef2b2d]/25 bg-[radial-gradient(circle_at_30%_20%,#3a1313,#100c0c)] shadow-[0_20px_30px_rgba(0,0,0,0.5)]" />
            <Image src="/branding/logos/redline-brand-mark.png" alt="Redline My Readiness" width={91} height={91} className="relative z-10 mt-[-14px]" />
          </Link>
          <LegacyNavLink href="/mobile/scan" label="Scan" active={pathname.startsWith("/mobile/scan")}><ScanLine className="h-6 w-6" /></LegacyNavLink>
          <button type="button" onClick={() => setIsMoreOpen(true)} aria-label="More" className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 ${isMoreOpen || ["/mobile/reports", "/mobile/documents"].some((href) => pathname.startsWith(href)) ? "text-white" : "text-white/55"}`}><MoreHorizontal className="h-6 w-6" /><span className="text-[11px] font-semibold uppercase tracking-[0.08em]">More</span></button>
        </nav>
        {isMoreOpen ? <MoreSheet onClose={() => setIsMoreOpen(false)} /> : null}
      </> : null}
  </div></MobileWorkflowContext.Provider>;
}

function LegacyNavLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: ReactNode }) {
  return <Link href={href} aria-label={label} className={`flex flex-col items-center gap-1 rounded-[12px] px-1 py-1 ${active ? "text-[#ef2b2d]" : "text-white/55"}`}>{children}<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span></Link>;
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const signOutPending = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleLogOut() {
    if (signOutPending.current) return;
    signOutPending.current = true;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await signOut();
      if (error) {
        setSignOutError("Unable to log out. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Unable to log out. Please try again.");
    } finally {
      signOutPending.current = false;
      setIsSigningOut(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="More mobile destinations"><section className="w-full max-w-md rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">Mobile</p><h2 className="mt-1 text-2xl font-black">More</h2></div><button type="button" onClick={onClose} aria-label="Close More menu" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 text-white/65"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-2"><MoreLink href="/mobile/reports" label="Reports" detail="Department reporting" icon={FileText} onClick={onClose} /><MoreLink href="/mobile/documents" label="Documents" detail="Department reference" icon={FileText} onClick={onClose} /><MoreLink href="/mobile/my-readiness" label="My Readiness" detail="Personal readiness" icon={UserRound} onClick={onClose} /><button type="button" onClick={handleLogOut} disabled={isSigningOut} aria-busy={isSigningOut} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200"><LogOut className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-base font-black text-white">{isSigningOut ? "Logging out..." : "Log Out"}</span><span className="block text-xs text-white/45">Sign out of your account</span></span><ChevronRight className="h-4 w-4 text-white/35" /></button>{signOutError ? <p role="alert" className="text-sm text-red-300">{signOutError}</p> : null}</div></section></div>;
}

function MoreLink({ href, label, detail, icon: Icon, onClick }: { href: string; label: string; detail: string; icon: typeof FileText; onClick: () => void }) {
  return <Link href={href} onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-base font-black text-white">{label}</span><span className="block text-xs text-white/45">{detail}</span></span><ChevronRight className="h-4 w-4 text-white/35" /></Link>;
}
