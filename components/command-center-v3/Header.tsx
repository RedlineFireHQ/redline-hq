import { Bell, ChevronDown } from "lucide-react";

export default function Header() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="h-[88px] border-b border-[rgba(255,255,255,0.08)] bg-[#090909] px-6">
      <div className="flex h-full items-center justify-between">
        {/* LEFT SIDE */}
        <div className="flex flex-col justify-center">
          <h1
            className="text-[48px] font-[700] leading-none tracking-[-0.5px] text-white"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            Command Center
          </h1>

          <div className="mt-[2px] flex items-center gap-2 text-[18px] font-[500] text-[#A1A1AA]">
            <span>{date}</span>
            <span>•</span>
            <span>{time}</span>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">
          {/* Notification Button */}
          <button className="relative flex h-14 w-14 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] transition hover:border-[#EF2B2D]">
            <Bell className="h-5 w-5 text-white" />

            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF2B2D] text-xs font-bold text-white">
              3
            </span>
          </button>

          {/* User Card */}
          <button className="flex h-14 w-[240px] items-center justify-between rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] px-4 transition hover:border-[#EF2B2D]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#EF2B2D] bg-[#090909]">
                <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#EF2B2D] text-[10px] font-[800] leading-none text-[#EF2B2D]">
                  EV
                  <br />
                  FD
                </div>
              </div>

              <div className="text-left">
                <p className="text-[16px] font-[600] leading-none text-white">
                  Adam Smith
                </p>

                <p className="mt-1 text-[13px] font-[400] text-[#A1A1AA]">
                  Administrator
                </p>
              </div>
            </div>

            <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />
          </button>
        </div>
      </div>
    </header>
  );
}