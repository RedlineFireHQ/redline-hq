import Link from "next/link";

export const metadata = {
  title: "Delete Account & Data | Redline HQ",
  description: "Request deletion of your Redline HQ account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#090a0b] text-white">
      <header className="border-b border-white/10 bg-[#090a0b]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-sm font-bold tracking-[0.18em]">
            REDLINE <span className="text-[#ed302f]">HQ</span>
          </Link>
          <Link href="/login" className="text-xs font-bold tracking-[0.12em] text-zinc-300 transition hover:text-white">
            FIREFIGHTER LOGIN
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl border-b border-white/10 pb-10">
          <p className="mb-5 text-xs font-bold tracking-[0.28em] text-[#ff5956]">REDLINE HQ LLC</p>
          <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-6xl">Delete Account &amp; Data</h1>
          <p className="mt-6 text-base leading-7 text-zinc-400">Effective date: September 23, 2026</p>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Redline HQ account holders can request deletion of their account and associated personal data.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          <section className="py-10 first:pt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white">How to Request Deletion</h2>
            <div className="mt-5 max-w-3xl space-y-4 text-base leading-8 text-zinc-400">
              <p>Email <a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="mailto:adam@redlinefirehq.com">adam@redlinefirehq.com</a> to request account and associated data deletion.</p>
              <p>Include the email address associated with your Redline HQ account and clearly state that you are requesting deletion of your account and associated data.</p>
              <p>Redline HQ will verify the request and process it in accordance with applicable requirements and the Redline HQ Privacy Policy.</p>
            </div>
          </section>

          <section className="py-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Information That May Be Deleted</h2>
            <div className="mt-5 max-w-3xl space-y-4 text-base leading-8 text-zinc-400">
              <p>Subject to verification, department control, applicable law, and operational requirements, deletion may include:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Account and profile information associated with your account.</li>
                <li>User or member information associated with your account.</li>
                <li>User-submitted content associated with your account, where applicable.</li>
              </ul>
              <p>Some information may be controlled by the fire department that deployed Redline HQ. In those cases, the department may need to participate in or approve the request.</p>
            </div>
          </section>

          <section className="py-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Information That May Be Retained</h2>
            <div className="mt-5 max-w-3xl space-y-4 text-base leading-8 text-zinc-400">
              <p>Certain information may be retained when required for legal compliance, security, fraud prevention, accounting, dispute resolution, enforcement of agreements, backup-cycle completion, or other legitimate business purposes. Any retained information will be handled consistently with the Redline HQ Privacy Policy and applicable law.</p>
            </div>
          </section>

          <section className="py-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Privacy Policy</h2>
            <div className="mt-5 max-w-3xl text-base leading-8 text-zinc-400">
              <p>For more information about how Redline HQ handles information, review the <a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="https://redlinefirehq.com/privacy">Redline HQ Privacy Policy</a>.</p>
            </div>
          </section>
        </div>

        <section className="border-t border-white/10 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Contact Information</h2>
          <div className="mt-5 space-y-2 text-base leading-8 text-zinc-400">
            <p>Redline HQ LLC</p>
            <p><a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="mailto:adam@redlinefirehq.com">adam@redlinefirehq.com</a></p>
            <p><a className="text-zinc-200 underline decoration-[#ed302f] underline-offset-4" href="https://redlinefirehq.com/">https://redlinefirehq.com/</a></p>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 bg-[#111314]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>REDLINE <span className="text-[#ed302f]">HQ</span></span>
          <Link href="/" className="transition hover:text-white">Back to Redline HQ</Link>
        </div>
      </footer>
    </main>
  );
}
