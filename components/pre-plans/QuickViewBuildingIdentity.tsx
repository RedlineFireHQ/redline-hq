import Link from "next/link";

type QuickViewBuildingIdentityProps = {
  prePlanId: string;
  businessName: string;
  fullAddress: string | null;
  occupancyId: string | null;
  buildingFrontPhotoHref: string | null;
  lastVerifiedDate: string | null;
  verifiedByName: string | null;
};

export default function QuickViewBuildingIdentity({
  prePlanId,
  businessName,
  fullAddress,
  occupancyId,
  buildingFrontPhotoHref,
  lastVerifiedDate,
  verifiedByName,
}: QuickViewBuildingIdentityProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#121212_0%,#0f0f0f_100%)] p-5 md:p-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Building Identity</p>

        <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_auto] lg:items-center">
          <div>
            {buildingFrontPhotoHref ? (
              <a href={buildingFrontPhotoHref} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buildingFrontPhotoHref}
                  alt="Building front photo"
                  className="h-40 w-full rounded-xl border border-white/10 object-cover lg:h-44"
                />
              </a>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#151515] px-3 text-center text-sm text-neutral-500 lg:h-44">
                No building front photo attached.
              </div>
            )}
          </div>

          <div className="min-w-0 self-center">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl xl:text-[2.75rem]">{businessName}</h1>
            {fullAddress ? <p className="mt-2 text-base leading-6 text-neutral-200 md:text-lg xl:text-[1.15rem]">{fullAddress}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {occupancyId ? (
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-100 md:text-sm">
                  Occupancy ID: {occupancyId}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[220px] lg:items-end lg:self-center">
            <Link
              href={`/pre-plans/${prePlanId}/full`}
              className="inline-flex items-center justify-center rounded-lg border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              View Full Pre-Plan
            </Link>

            {(lastVerifiedDate || verifiedByName) ? (
              <div className="rounded-xl border border-white/10 bg-[#171717] p-3 lg:max-w-[220px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Verification</p>
                {lastVerifiedDate ? <p className="mt-1.5 text-[15px] font-semibold leading-6 text-white">Last Verified {lastVerifiedDate}</p> : null}
                {verifiedByName ? <p className="text-[15px] leading-6 text-neutral-300">by {verifiedByName}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}