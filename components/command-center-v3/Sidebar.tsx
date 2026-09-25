"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Home,
  Gauge,
  Truck,
  Package,
  Users,
  GraduationCap,
  Wrench,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  FolderOpen,
  Building2,
  Settings,
  ChevronDown,
} from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import { useAuth } from "@/components/auth/AuthProvider";

const navigationItems = [
  { label: "Command Center", icon: Home, href: "/" },
  { label: "My Readiness", icon: Gauge, href: "/my-readiness" },
  { label: "Apparatus", icon: Truck, href: "/apparatus" },
  { label: "Pre-Plans", icon: Building2, href: "/pre-plans" },
  { label: "Inventory", icon: Package, href: "/assets" },
  { label: "Personnel", icon: Users, href: "/personnel" },
  { label: "Training", icon: GraduationCap, href: "/training" },
  { label: "Maintenance", icon: Wrench, href: "/maintenance" },
  { label: "Deficiencies", icon: AlertTriangle, href: "/deficiencies" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Documents", icon: FolderOpen, href: "/documents" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

interface SidebarProps {
  translucent?: boolean;
}

export default function Sidebar({ translucent = false }: SidebarProps) {
  const pathname = usePathname();
  const { member, user, permissions, department, isLoading } = useAuth();
  const normalizedRole = typeof member?.role === "string" ? member.role.trim().toLowerCase() : "";
  const isAdministrator = normalizedRole === "administrator";
  const canManagePersonnel = permissions.personnel_management;
  const canAccessReports = permissions.reports_management;

  const departmentName = isLoading ? "Loading department..." : department?.name?.trim() || "Redline HQ";

  const memberFirstName =
    typeof member?.first_name === "string" ? member.first_name.trim() : "";
  const memberLastName =
    typeof member?.last_name === "string" ? member.last_name.trim() : "";
  const fullName = `${memberFirstName} ${memberLastName}`.trim();
  const displayName = isLoading ? "Loading user..." : fullName || user?.email?.trim() || "Unknown User";
  const displayRole =
    isLoading
      ? "Loading..."
      : typeof member?.role === "string" && member.role.trim()
      ? member.role.trim()
      : "Firefighter";

  const visibleNavigationItems = navigationItems.filter((item) => {
    if (item.href === "/personnel") {
      return isAdministrator || canManagePersonnel;
    }

    if (item.href === "/reports") {
      return isAdministrator || canAccessReports;
    }

    return true;
  });

  const isActivePath = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={`sticky top-0 flex h-screen w-[270px] flex-shrink-0 flex-col overflow-hidden border-r ${
        translucent
          ? "border-white/15 bg-[#070708]/58 backdrop-blur-[2px]"
          : "border-white/10 bg-[#090909]"
      }`}
    >

      {/* ================= Logo ================= */}

      <div className="flex flex-shrink-0 flex-col items-center border-b border-white/10 px-5 py-[clamp(1rem,3vh,2rem)]">

        <img
          src="/branding/images/redlinesidebarlogo.png"
          alt="Redline HQ"
          className="h-auto w-[clamp(160px,22vh,220px)]"
        />

        <div className="mt-[clamp(0.5rem,1.8vh,1rem)] text-center">
          <p className="text-[12px] font-semibold uppercase leading-5 tracking-[0.22em] text-zinc-300">
            {departmentName}
          </p>
        </div>

      </div>

      {/* ================= Navigation ================= */}

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pr-2 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">

        <div className="space-y-1">

          {visibleNavigationItems.map(({ label, icon: Icon, href }) => (

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

      <div className="flex-shrink-0 border-t border-white/10 p-[clamp(0.5rem,1.6vh,1rem)]">

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