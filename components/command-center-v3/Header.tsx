"use client";

import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Header() {
  const router = useRouter();
  const { user, member, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const now = new Date();

  const metadata = user?.user_metadata;
  const firstName = typeof metadata?.first_name === "string" ? metadata.first_name : "";
  const lastName = typeof metadata?.last_name === "string" ? metadata.last_name : "";
  const fullNameFromParts = `${firstName} ${lastName}`.trim();
  const fullName =
    typeof metadata?.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : fullNameFromParts;

  const fallbackEmail = user?.email?.trim() || "Unknown User";
  const userDisplayName = fullName || fallbackEmail;
  const userRole =
    typeof member?.role === "string" && member.role.trim()
      ? member.role.trim()
      : "Firefighter";
  const initialsSource = fullName || fallbackEmail.split("@")[0] || "User";
  const initials = initialsSource
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");

  async function handleLogout() {
    setIsSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setIsSigningOut(false);
      return;
    }

    setIsUserMenuOpen(false);
    router.replace("/login");
    router.refresh();
  }

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
              className="flex h-14 w-[240px] items-center justify-between rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] px-4 transition hover:border-[#EF2B2D]"
            >
              <div className="min-w-0 flex flex-1 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#EF2B2D] bg-[#090909]">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#EF2B2D] text-[10px] font-[800] leading-none text-[#EF2B2D]">
                    {initials || "U"}
                  </div>
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <p
                    title={fallbackEmail}
                    className="truncate text-[16px] font-[600] leading-none text-white"
                  >
                    {userDisplayName}
                  </p>

                  <p className="mt-1 text-[13px] font-[400] text-[#A1A1AA]">
                    {userRole}
                  </p>
                </div>
              </div>

              <ChevronDown className="h-4 w-4 shrink-0 text-[#A1A1AA]" />
            </button>

            {isUserMenuOpen ? (
              <div className="absolute right-0 top-[60px] z-50 w-[240px] rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="w-full cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13px] font-[600] text-white transition-colors duration-200 ease-out hover:bg-[#1A1A1A] focus-visible:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Logging Out..." : "Log Out"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}