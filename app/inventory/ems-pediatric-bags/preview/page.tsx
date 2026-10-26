import Link from "next/link";
import { getPreviewBags } from "@/lib/pediatric-bags/preview";

export default function PediatricBagsPreviewPage() {
  const bags = getPreviewBags();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">Read-Only Preview</p>
        <h1 className="mt-2 text-2xl font-black text-white">Pediatric Bags — Preview</h1>
        <p className="mt-2 text-sm text-sky-100/80">
          This is a read-only preview of the checklist layout. Nothing is saved and no inspection is recorded.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {bags.map((bag) => (
          <Link
            key={bag.label}
            href={`/inventory/ems-pediatric-bags/preview/${bag.label}`}
            aria-label={`View checklist for ${bag.displayName} (read-only preview)`}
            className="group relative block overflow-hidden rounded-xl border border-neutral-800 bg-[#1b1b1b] transition hover:border-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <div className="aspect-[4/3] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bag.imagePath}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </div>

            {/* Readability overlay + integrated label (no separate gray footer). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-10">
              <p className="text-sm font-bold tracking-wide text-white">VIEW CHECKLIST</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
