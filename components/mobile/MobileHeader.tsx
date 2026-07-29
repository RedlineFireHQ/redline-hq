"use client";

import Image from "next/image";
import { Bell } from "lucide-react";

interface MobileHeaderProps {
  name: string;
  department: string;
  notificationCount?: number;
}

export default function MobileHeader({
  name,
  department,
  notificationCount = 0,
}: MobileHeaderProps) {
  return (
    <header className="mb-8">

      {/* Top Row */}
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <Image
            src="/branding/logos/redline-brand-mark.png"
            alt="Redline HQ"
            width={42}
            height={42}
            priority
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
              Redline HQ
            </p>

            <h1 className="text-2xl font-bold text-zinc-900">
              Good Morning, {name}
            </h1>

            <p className="text-sm text-zinc-500">
              {department}
            </p>
          </div>

        </div>

        <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">

          <Bell size={20} className="text-zinc-700" />

          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {notificationCount}
            </span>
          )}

        </button>

      </div>

    </header>
  );
}