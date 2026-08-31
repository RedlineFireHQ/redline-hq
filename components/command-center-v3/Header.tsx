"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type DeficiencyAlertRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  reported_at: string | null;
  status_info:
    | { name: string | null; active: boolean | null }
    | Array<{ name: string | null; active: boolean | null }>
    | null;
  priority_info:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  apparatus: { name: string | null } | Array<{ name: string | null }> | null;
};

type HeaderAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
  reportedAt: string | null;
};

function normalizeRelation<T extends Record<string, unknown>>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatAlertTime(value: string | null) {
  if (!value) {
    return "Recently reported";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently reported";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Header() {
  const router = useRouter();
  const { user, member, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<HeaderAlert[]>([]);
  const alertsRef = useRef<HTMLDivElement | null>(null);

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

  const alertCount = alerts.length;
  const hasAlerts = alertCount > 0;

  const loadAlerts = useMemo(
    () =>
      async function loadAlertsInternal() {
        const departmentId = member?.department_id;

        if (!departmentId) {
          setAlerts([]);
          setAlertsError(null);
          return;
        }

        setIsLoadingAlerts(true);
        setAlertsError(null);

        const { data, error } = await supabase
          .from("deficiencies")
          .select(
            "id, deficiency_number, description, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name), apparatus:apparatus!fk_deficiencies_apparatus(name)",
          )
          .eq("department_id", departmentId)
          .order("reported_at", { ascending: false })
          .limit(30);

        if (error) {
          setAlerts([]);
          setAlertsError(error.message || "Unable to load alerts.");
          setIsLoadingAlerts(false);
          return;
        }

        const mapped = ((data ?? []) as DeficiencyAlertRow[])
          .filter((row) => {
            const status = normalizeRelation(row.status_info);
            const statusName = typeof status?.name === "string" ? status.name.toLowerCase() : "";
            const isActiveStatus = status?.active === true;
            const isResolvedByName = statusName === "resolved" || statusName === "closed";
            return isActiveStatus || (Boolean(statusName) && !isResolvedByName);
          })
          .slice(0, 8)
          .map((row) => {
            const priority = normalizeRelation(row.priority_info);
            const apparatus = normalizeRelation(row.apparatus);
            const deficiencyNumber = row.deficiency_number?.trim();
            const priorityName = typeof priority?.name === "string" ? priority.name.trim() : "";
            const apparatusName = typeof apparatus?.name === "string" ? apparatus.name.trim() : "";
            const description = row.description?.trim() || "Deficiency requires attention.";

            const detailParts = [apparatusName, priorityName].filter(Boolean);

            return {
              id: row.id,
              title: deficiencyNumber ? `Deficiency ${deficiencyNumber}` : "Open Deficiency",
              detail: detailParts.length > 0 ? `${detailParts.join(" • ")} • ${description}` : description,
              href: `/operations/deficiencies/${row.id}`,
              reportedAt: row.reported_at,
            } satisfies HeaderAlert;
          });

        setAlerts(mapped);
        setIsLoadingAlerts(false);
      },
    [member?.department_id],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAlerts]);

  useEffect(() => {
    if (!isAlertsOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAlertsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAlertsOpen]);

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
            className="text-[48px] font-[700] leading-none tracking-[-0.2px] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Command Center
          </h1>

          <div className="mt-[2px] flex items-center gap-2 text-[18px] font-[500] text-[#A1A1AA]">
            <span>{date}</span>
            <span>•</span>
            <span suppressHydrationWarning>{time}</span>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">
          {/* Notification Button */}
          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isAlertsOpen}
              aria-label="Open alerts"
              onClick={() => setIsAlertsOpen((currentValue) => !currentValue)}
              className="relative flex h-14 w-14 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] transition hover:border-[#EF2B2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF2B2D]/50"
            >
              <Bell className="h-5 w-5 text-white" />

              {hasAlerts ? (
                <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF2B2D] px-1 text-[10px] font-bold text-white">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              ) : null}
            </button>

            {isAlertsOpen ? (
              <div className="absolute right-0 top-[62px] z-50 w-[360px] overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Alerts</p>
                  {hasAlerts ? <p className="text-xs font-medium text-[#A1A1AA]">{alertCount} active</p> : null}
                </div>

                {isLoadingAlerts ? (
                  <div className="px-4 py-5 text-sm text-[#A1A1AA]">Loading alerts...</div>
                ) : alertsError ? (
                  <div className="px-4 py-5 text-sm text-red-300">Unable to load alerts right now.</div>
                ) : hasAlerts ? (
                  <div className="max-h-[320px] overflow-y-auto">
                    {alerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          setIsAlertsOpen(false);
                          router.push(alert.href);
                        }}
                        className="w-full border-b border-white/10 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <p className="truncate text-sm font-semibold text-white">{alert.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[#A1A1AA]">{alert.detail}</p>
                        <p className="mt-1 text-[11px] text-[#737373]">{formatAlertTime(alert.reportedAt)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-[#A1A1AA]">No new alerts.</div>
                )}

                <div className="border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAlertsOpen(false);
                      router.push("/deficiencies");
                    }}
                    className="text-sm font-semibold text-white transition hover:text-[#EF2B2D]"
                  >
                    View all alerts
                  </button>
                </div>
              </div>
            ) : null}
          </div>

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