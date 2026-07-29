"use client";

import { ReactNode } from "react";
import { House, QrCode, Bell, User } from "lucide-react";

interface MobileFrameProps {
  children: ReactNode;
}

export default function MobileFrame({
  children,
}: MobileFrameProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-8">

      {/* Phone */}
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[42px] border-[10px] border-zinc-900 bg-[#1D1D1F] shadow-2xl">

        {/* Background Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(225,24,27,.22),transparent_55%)]" />

        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-3 z-20 h-8 w-36 -translate-x-1/2 rounded-full bg-black" />

        {/* Screen */}
        <div className="relative flex h-full flex-col pt-12">

          {/* Page */}
          <main className="flex-1 overflow-y-auto px-5 pb-24 text-white">
            {children}
          </main>

          {/* Bottom Navigation */}
          <nav className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-[#191919]/95 backdrop-blur">

            <div className="flex h-20 items-center justify-around">

              <button className="flex flex-col items-center text-red-500">
                <House size={24} />
                <span className="mt-1 text-[11px] font-medium">
                  Home
                </span>
              </button>

              <button className="flex flex-col items-center text-zinc-500">
                <QrCode size={24} />
                <span className="mt-1 text-[11px]">
                  Scan
                </span>
              </button>

              <button className="flex flex-col items-center text-zinc-500">
                <Bell size={24} />
                <span className="mt-1 text-[11px]">
                  Alerts
                </span>
              </button>

              <button className="flex flex-col items-center text-zinc-500">
                <User size={24} />
                <span className="mt-1 text-[11px]">
                  Me
                </span>
              </button>

            </div>

          </nav>

        </div>

      </div>

    </div>
  );
}