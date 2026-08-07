"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Home,
  Truck,
  Package,
  Users,
  GraduationCap,
  Award,
  Wrench,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  FolderOpen,
  Settings,
  ChevronDown,
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";

const navigationItems = [
  { label: "Command Center", icon: Home, href: "/" },
  { label: "Apparatus", icon: Truck, href: "/apparatus" },
  { label: "Inventory", icon: Package, href: "/assets" },
  { label: "Personnel", icon: Users, href: "/personnel" },
  { label: "Training", icon: GraduationCap, href: "/training" },
  { label: "Certifications", icon: Award, href: "/certifications" },
  { label: "Maintenance", icon: Wrench, href: "/maintenance" },
  { label: "Deficiencies", icon: AlertTriangle, href: "/deficiencies" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Documents", icon: FolderOpen, href: "/documents" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { member, user } = useAuth();

  const memberFirstName =
    typeof member?.first_name === "string" ? member.first_name.trim() : "";
  const memberLastName =
    typeof member?.last_name === "string" ? member.last_name.trim() : "";
  const fullName = `${memberFirstName} ${memberLastName}`.trim();
  const displayName = fullName || user?.email?.trim() || "Unknown User";
  const displayRole =
    typeof member?.role === "string" && member.role.trim()
      ? member.role.trim()
      : "Firefighter";

  const isActivePath = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[270px] flex-shrink-0 flex-col border-r border-white/10 bg-[#090909]">

      {/* ================= Logo ================= */}

      <div className="flex flex-col items-center border-b border-white/10 px-5 pt-8 pb-6">

        <img
          src="/branding/images/redline-hq-logo.png"
          alt="Redline HQ"
          className="h-auto w-[220px]"
        />

        <div className="mt-4 text-center">
          <p className="text-[12px] font-semibold uppercase leading-5 tracking-[0.22em] text-zinc-300">
            Elliott Volunteer
            <br />
            Fire Department
          </p>
        </div>

      </div>

      {/* ================= Navigation ================= */}

      <nav className="flex-1 px-3 py-4">

        <div className="space-y-1">

          {navigationItems.map(({ label, icon: Icon, href }) => (

            <Link
              key={label}
              href={href}
              className={`flex h-[48px] w-full items-center gap-3 rounded-xl px-4 transition-all duration-200 ${
                isActivePath(href)
                  ? "bg-[#EF2B2D] text-white shadow-lg"
                  : "text-white hover:bg-[#171717]"
              }`}
            >

              <Icon
                size={20}
                className="flex-shrink-0"
              />

              <span className="text-[16px] font-semibold">
                {label}
              </span>

            </Link>

          ))}

        </div>

      </nav>

      {/* ================= User ================= */}

      <div className="border-t border-white/10 p-4">

        <button className="flex w-full items-center gap-3 rounded-xl p-3 transition hover:bg-[#171717]">

          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#EF2B2D]">

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EF2B2D] text-[10px] font-bold leading-none text-[#EF2B2D]">
              EV
              <br />
              FD
            </div>

          </div>

          <div className="flex-1 text-left">

            <div className="text-[15px] font-semibold text-white">
              {displayName}
            </div>

            <div className="text-[12px] text-zinc-400">
              {displayRole}
            </div>

          </div>

          <ChevronDown
            size={18}
            className="text-zinc-400"
          />

        </button>

        <LogoutButton />

      </div>

    </aside>
  );
}