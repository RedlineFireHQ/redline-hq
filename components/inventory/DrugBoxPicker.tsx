import Link from "next/link";
import type { DrugBoxRecord } from "@/lib/drug-boxes/data";

type DrugBoxPickerProps = {
  boxes: DrugBoxRecord[];
};

/** Approved artwork per squad, mapped by squad number. Files live in
 *  public/branding/images/ (verified to exist); paths are URL-encoded for spaces. */
const SQUAD_IMAGE_PATHS: Record<string, string> = {
  "114": "/branding/images/Cinematic%20EMS%20Case%20114.png",
  "115": "/branding/images/Futuristic%20Neon%20EMS%20Case%20115.png",
  "116": "/branding/images/High-Tech%20Emergency%20Medical%20Case%20116.png",
  "117": "/branding/images/Neon%20Green%20117%20Emergency%20Medical%20Case.png",
};

/**
 * The four squad drug boxes (114, 115, 116, 117), each opening a fresh
 * inspection for that squad. Each card shows its squad artwork with the squad
 * number and a single START INSPECTION action.
 */
export default function DrugBoxPicker({ boxes }: DrugBoxPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {boxes.map((box) => (
        <Link
          key={box.id}
          href={`/inventory/ems-drug-box/${box.id}`}
          aria-label={`Open drug box inspection for Squad ${box.squadNumber}`}
          className="group relative block overflow-hidden rounded-xl border border-neutral-800 bg-[#1b1b1b] transition hover:border-red-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <div className="aspect-[4/3] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SQUAD_IMAGE_PATHS[box.squadNumber]}
              alt={`Squad ${box.squadNumber} drug box`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          </div>

          {/* Readability overlay + squad number + single action label. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-10">
            <p className="text-2xl font-black leading-none text-white">{box.squadNumber}</p>
            <p className="mt-1 text-sm font-bold tracking-wide text-white">START INSPECTION</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
