import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function TodaysReadinessPanel() {
  return (
    <section className="relative h-full overflow-hidden rounded-[20px] border border-[rgba(239,43,45,0.30)] bg-[#170909]">

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(239,43,45,.24),transparent_58%)]" />

      <div className="relative flex h-full flex-col px-6 py-5">

        {/* Header */}

        <p className="text-[14px] font-bold uppercase tracking-[2px] text-[#EF2B2D]">
          TODAY'S READINESS
        </p>

        <p className="mt-2 max-w-[55%] text-[15px] leading-5 text-[#B3B3B3]">
          How prepared we are for today's operations.
        </p>

        {/* Main Content */}

        <div className="relative mt-2 flex-1">

          {/* Score */}

          <div className="flex items-start">

            <span className="text-[58px] font-black leading-none text-white">
              87
            </span>

            <span className="mt-1 text-[22px] font-bold text-white">
              %
            </span>

          </div>

          <p className="mt-2 text-[16px] font-bold uppercase tracking-[2px] text-[#EF2B2D]">
            READY TODAY
          </p>

          {/* Floating Shield */}

          <div className="pointer-events-none absolute right-[-95px] top-[-170px] h-[485px] w-[485px]">

            <Image
              src="/branding/images/todays-readiness-shield.png"
              alt="Today's Readiness Shield"
              fill
              priority
              className="object-contain drop-shadow-[0_0_60px_rgba(239,43,45,.45)]"
            />

          </div>

          {/* Biggest Readiness Gain */}

          <div className="mt-7 w-[50%]">

            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[#EF2B2D]/90">
              TODAY'S BIGGEST READINESS GAIN
            </p>

            <h3 className="mt-2 text-[19px] font-bold leading-6 text-white">
              Complete Engine 432
            </h3>

            <p className="text-[15px] text-[#C8C8C8]">
              Daily Inspection
            </p>

            <div className="mt-3 flex items-center gap-3">

              <div className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />

              <span className="text-[15px] font-bold text-[#22C55E]">
                +4% Department Readiness
              </span>

            </div>

          </div>

        </div>

        {/* Button */}

        <button
          className="
            mt-3
            flex
            h-12
            items-center
            justify-center
            gap-3
            rounded-xl
            bg-[#EF2B2D]
            text-[15px]
            font-bold
            text-white
            transition-all
            duration-300
            hover:bg-[#d91d1f]
            hover:shadow-[0_0_24px_rgba(239,43,45,.45)]
          "
        >
          View Today's Readiness

          <ArrowRight className="h-4 w-4" />

        </button>

      </div>

    </section>
  );
}