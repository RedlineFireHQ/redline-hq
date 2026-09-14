"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { type FormEvent, useState } from "react";

const images = {
  hero: "/branding/images/redline-hq-hero.webp.png",
  tablet: "/branding/images/redline-hq-firefighter-tablet.webp.png",
  apparatus: "/branding/images/redline-hq-apparatus-check.webp.png",
  command: "/branding/images/redline-hq-chief-command-center.webp.png",
  helmet: "/branding/images/redline-hq-firefighter-helmet.webp.png",
  team: "/branding/images/redline-hq-department-team.webp.png",
};

const navItems = [
  ["Features", "#features"],
  ["Redline Ready", "#redline-ready"],
  ["About", "#about"],
  ["Request a Demo", "#request-demo"],
] as const;

export default function PublicHomepage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoStatus, setDemoStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [demoError, setDemoError] = useState("");

  function closeMenu() {
    setMenuOpen(false);
  }

  async function submitDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDemoStatus("submitting");
    setDemoError("");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          departmentName: form.get("departmentName"),
          email: form.get("email"),
          phone: form.get("phone"),
          memberCount: form.get("memberCount"),
          message: form.get("message"),
        }),
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setDemoStatus("error");
        setDemoError(result.error || "We could not send your request. Please try again.");
        return;
      }

      formElement.reset();
      setDemoStatus("success");
    } catch {
      setDemoStatus("error");
      setDemoError("We could not connect to the request service. Please try again.");
    }
  }

  return (
    <main className="overflow-hidden bg-[#090a0b] text-white">
      <style>{`section[id] { scroll-margin-top: 6rem; }`}</style>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#090a0b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="#top" className="flex items-center gap-3" onClick={closeMenu}>
            <span className="relative block h-14 w-44 sm:h-16 sm:w-52">
              <Image
                src="/branding/images/transparentredlinhqlogo.png"
                alt="Redline HQ - Less Paperwork. More Readiness."
                fill
                priority
                className="object-contain object-left"
                sizes="(max-width: 640px) 176px, 208px"
              />
            </span>
          </Link>

          <nav className="hidden h-full items-center gap-10 lg:flex" aria-label="Main navigation">
            {navItems.map(([label, href]) => <Link key={href} href={href} className="inline-flex h-20 items-center text-sm text-zinc-300 transition hover:text-white">{label}</Link>)}
          </nav>

          <Link href="/login" className="hidden border border-[#ed302f] px-4 py-2.5 text-xs font-bold tracking-[0.12em] text-white transition hover:bg-[#ed302f] sm:block">FIREFIGHTER LOGIN</Link>
          <button type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((open) => !open)} className="p-2 text-zinc-200 lg:hidden">
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        {menuOpen ? (
          <nav className="border-t border-white/10 bg-[#101112] px-5 py-5 lg:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-5">
              {navItems.map(([label, href]) => <Link key={href} href={href} onClick={closeMenu} className="text-sm text-zinc-200">{label}</Link>)}
              <Link href="/login" onClick={closeMenu} className="border border-[#ed302f] px-4 py-3 text-center text-xs font-bold tracking-[0.12em]">FIREFIGHTER LOGIN</Link>
            </div>
          </nav>
        ) : null}
      </header>

      <section id="top" className="scroll-mt-24 relative flex min-h-[680px] items-end sm:min-h-[740px]">
        <Image src={images.hero} alt="Fire department crew and apparatus" fill priority className="object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,7,0.9)_0%,rgba(5,6,7,0.63)_45%,rgba(5,6,7,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(9,10,11,0.96)_0%,transparent_38%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-32 sm:px-8 lg:px-10 lg:pb-24 lg:pt-36">
          <div className="max-w-3xl">
            <p className="mb-7 flex items-center gap-3 text-xs font-bold tracking-[0.28em] text-[#ff5956]"><span className="h-px w-10 bg-[#ed302f]" /> BUILT FOR THE WORK</p>
            <h1 className="max-w-3xl text-5xl font-bold leading-[0.96] tracking-[-0.04em] sm:text-7xl lg:text-8xl">LESS PAPERWORK.<br /><span className="text-[#ed302f]">MORE READINESS.</span></h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-zinc-200 sm:text-xl">Fire department management software built by firefighters, for firefighters.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="#action" className="inline-flex items-center justify-center gap-3 bg-[#ed302f] px-6 py-4 text-sm font-bold tracking-[0.1em] transition hover:bg-[#ff4542]">SEE REDLINE HQ <ArrowDownRight size={17} /></Link>
              <Link href="/login" className="inline-flex items-center justify-center gap-3 border border-white/40 bg-black/20 px-6 py-4 text-sm font-bold tracking-[0.1em] backdrop-blur-sm transition hover:border-white hover:bg-white/10">FIREFIGHTER LOGIN <ArrowRight size={17} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section id="action" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div><p className="eyebrow">SEE REDLINE HQ IN ACTION</p><h2 className="section-title">A clearer view of the work that keeps a department ready.</h2><p className="mt-6 max-w-md text-base leading-7 text-zinc-400">A quick look at how Redline HQ helps fire departments stay organized, informed, and ready.</p></div>
          <div className="relative aspect-video overflow-hidden border border-white/15 bg-black"><Image src={images.tablet} alt="Firefighter using Redline HQ on a tablet" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" /></div>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 border-y border-white/10 bg-[#111314]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-24"><div className="relative aspect-[4/3] overflow-hidden border border-white/15"><Image src={images.command} alt="Redline HQ command center view" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" /></div><div><p className="eyebrow">ONE SOURCE OF TRUTH</p><h2 className="section-title">YOUR DEPARTMENT.<br /><span className="text-[#ed302f]">ONE COMMAND CENTER.</span></h2><p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">Bring your entire department together in one powerful, easy-to-use platform. Redline HQ connects the tools, information, and insights your department needs to stay organized and mission ready.</p><Link href="#features" className="mt-7 inline-flex items-center gap-3 text-sm font-bold tracking-[0.1em] text-white transition hover:text-[#ff5956]">EXPLORE FEATURES <ArrowRight size={17} className="text-[#ed302f]" /></Link></div></div>
      </section>

      <section id="redline-ready" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="eyebrow">REDLINE READY™</p><h2 className="section-title">KNOW HOW READY YOUR DEPARTMENT REALLY IS.</h2><p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">Redline Ready™ brings together the information that matters most to department readiness—so leadership can see where the department stands and where attention is needed.</p></div><div className="relative aspect-[5/4] overflow-hidden border border-white/15"><Image src={images.helmet} alt="Firefighter helmet in a station" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,10,11,0.5),transparent)]" /><p className="absolute bottom-6 left-6 text-xs font-bold tracking-[0.28em] text-white">SEE WHAT NEEDS ATTENTION</p></div></div></section>

      <section className="border-y border-white/10 bg-[#ed302f] text-[#100b0b]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-20"><div><h2 className="max-w-3xl text-4xl font-bold leading-[0.98] tracking-[-0.035em] sm:text-6xl">FIREFIGHTERS DIDN&apos;T GET INTO THE FIRE SERVICE TO DO PAPERWORK.</h2><p className="mt-5 max-w-xl text-base leading-7 text-red-950/80">Redline HQ was designed to make everyday department management faster, simpler, and easier to use.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1"><div className="border-t border-red-950/30 pt-3 text-sm font-bold tracking-[0.12em]">LOG TRAINING<br />IN MINUTES</div><div className="border-t border-red-950/30 pt-3 text-sm font-bold tracking-[0.12em]">COMPLETE CHECKS<br />ON THE GO</div><div className="border-t border-red-950/30 pt-3 text-sm font-bold tracking-[0.12em]">KEEP YOUR DEPARTMENT<br />MOVING FORWARD</div></div></div></section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">THE PLATFORM</p>
            <h2 className="section-title">EVERYTHING YOUR<br />DEPARTMENT NEEDS.</h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-zinc-500">One connected place for the information and responsibilities that matter every day.</p>
        </div>
        <div className="group mt-8 overflow-hidden border border-white/10 bg-black">
          <Image
            src="/branding/images/feature-grid-fire-service.jpg.png"
            alt="Redline HQ features for fire departments"
            width={2073}
            height={758}
            className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.01]"
            sizes="(max-width: 1280px) 100vw, 1200px"
          />
        </div>
      </section>

      <section className="bg-[#111314]" id="roles"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><p className="eyebrow">BUILT AROUND REAL ROLES</p><h2 className="section-title">DIFFERENT ROLES.<br /><span className="text-[#ed302f]">A STRONGER DEPARTMENT.</span></h2><div className="mt-10 grid gap-px border border-white/10 bg-white/10 md:grid-cols-2"><div className="relative min-h-72 overflow-hidden bg-[#161819] p-8"><Image src={images.tablet} alt="Firefighter using a tablet" fill className="object-cover opacity-35" sizes="(max-width: 768px) 100vw, 50vw" /><div className="relative"><p className="eyebrow">THE FIREFIGHTER</p><p className="mt-20 max-w-xs text-lg leading-7 text-white">Quickly complete checks, training, tasks, and department responsibilities.</p></div></div><div className="relative min-h-72 overflow-hidden bg-[#161819] p-8"><Image src={images.command} alt="Department leadership command center" fill className="object-cover opacity-35" sizes="(max-width: 768px) 100vw, 50vw" /><div className="relative"><p className="eyebrow">THE CHIEF / LEADERSHIP</p><p className="mt-20 max-w-xs text-lg leading-7 text-white">See readiness, deficiencies, certifications, training, apparatus status, and department information in one place.</p></div></div></div></div></section>

      <section id="request-demo" className="relative flex min-h-[440px] items-end"><Image src={images.team} alt="Fire department team together" fill className="object-cover object-center" sizes="100vw" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,7,0.86),rgba(5,6,7,0.3))]" /><div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:pb-20"><div><p className="eyebrow">REDLINE HQ</p><h2 className="max-w-2xl text-5xl font-bold leading-[0.96] tracking-[-0.04em] sm:text-7xl">READY TO PUT YOUR<br /><span className="text-[#ed302f]">DEPARTMENT ON REDLINE?</span></h2><p className="mt-5 text-sm text-zinc-300">Already have Redline HQ? <Link href="/login" className="font-bold text-white underline decoration-[#ed302f] underline-offset-4">Firefighter Login →</Link></p></div><form onSubmit={submitDemoRequest} className="border border-white/20 bg-[#090a0b]/80 p-5 backdrop-blur-sm sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300">NAME<input name="name" required maxLength={120} autoComplete="name" className="mt-2 w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300">FIRE DEPARTMENT NAME<input name="departmentName" required maxLength={160} autoComplete="organization" className="mt-2 w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300">EMAIL<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-2 w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300">PHONE <span className="font-normal text-zinc-500">OPTIONAL</span><input name="phone" type="tel" maxLength={60} autoComplete="tel" className="mt-2 w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300">NUMBER OF MEMBERS <span className="font-normal text-zinc-500">OPTIONAL</span><input name="memberCount" type="number" min="0" max="1000000" className="mt-2 w-full border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label><label className="text-xs font-semibold tracking-[0.08em] text-zinc-300 sm:col-span-2">WHAT REDLINE HQ FEATURES ARE YOU INTERESTED IN? <span className="font-normal text-zinc-500">OPTIONAL</span><textarea name="message" maxLength={4000} rows={3} className="mt-2 w-full resize-y border border-white/15 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[#ed302f]" /></label></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="submit" disabled={demoStatus === "submitting"} className="inline-flex items-center justify-center gap-3 bg-[#ed302f] px-6 py-3 text-sm font-bold tracking-[0.1em] transition hover:bg-[#ff4542] disabled:cursor-not-allowed disabled:opacity-60">{demoStatus === "submitting" ? "SENDING..." : "REQUEST A DEMO"} <ArrowRight size={17} /></button>{demoStatus === "success" ? <p role="status" className="text-sm text-emerald-300">Thanks. We&apos;ll be in touch soon.</p> : null}{demoStatus === "error" ? <p role="alert" className="text-sm text-red-300">{demoError}</p> : null}</div></form></div></section>

      <footer className="border-t border-white/10 bg-[#090a0b]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10"><div><p className="text-sm font-bold tracking-[0.18em]">REDLINE <span className="text-[#ed302f]">HQ</span></p><p className="mt-2 text-sm text-zinc-500">Less Paperwork. More Readiness.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500" aria-label="Footer navigation">{navItems.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-white">{label}</Link>)}<Link href="/login" className="text-zinc-300 transition hover:text-white">Firefighter Login</Link></nav></div></footer>
    </main>
  );
}