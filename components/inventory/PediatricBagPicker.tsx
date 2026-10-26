import Link from "next/link";
import type { PediatricBagRow } from "@/lib/pediatric-bags/data";

type PediatricBagPickerProps = {
  bags: PediatricBagRow[];
};

/**
 * Approved artwork for each bag, mapped by bag label. Files live in
 * public/branding/images/ (verified to exist); paths are URL-encoded for spaces.
 */
const BAG_IMAGE_PATHS: Record<string, string> = {
  A: "/branding/images/Pediatric%20Bag%20A%20Emergency%20Emblem.png",
  B: "/branding/images/Futuristic%20Pediatric%20Bag%20B%20Emblem.png",
  C: "/branding/images/Industrial%20Pediatric%20Bag%20C%20Emblem.png",
  D: "/branding/images/Industrial%20Pediatric%20bag%20d%20EMS%20Emblem.png",
};

export default function PediatricBagPicker({ bags }: PediatricBagPickerProps) {
  if (bags.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 p-8 text-center">
        <p className="text-lg font-semibold text-white">No pediatric bags found for this department.</p>
        <p className="mt-2 text-sm text-neutral-400">
          An administrator can initialize Pediatric Bags A–D from the department template.
        </p>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {bags.map((bag) => (
        <Link
          key={bag.id}
          href={`/inventory/ems-pediatric-bags/${bag.id}`}
          aria-label={`Open checklist for ${bag.displayName}`}
          className="group relative block overflow-hidden rounded-xl border border-neutral-800 bg-[#1b1b1b] transition hover:border-red-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <div className="aspect-[4/3] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BAG_IMAGE_PATHS[bag.bagLabel]}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          </div>

          {/* Readability overlay + integrated label. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-10">
            <p className="text-sm font-bold tracking-wide text-white">VIEW CHECKLIST</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
