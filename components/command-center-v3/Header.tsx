"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

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

interface HeaderProps {
  translucent?: boolean;
}

export default function Header({ translucent = false }: HeaderProps) {
  const router = useRouter();
  const { user, member, signOut, isLoading } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
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

  const fallbackEmail = isLoading ? "Loading user..." : user?.email?.trim() || "Unknown User";
  const userDisplayName = fullName || fallbackEmail;
  const userRole =
    isLoading
      ? "Loading..."
      : typeof member?.role === "string" && member.role.trim()
      ? member.role.trim()
      : "Firefighter";
  const initialsSource = fullName || fallbackEmail.split("@")[0] || "User";
  const initials = initialsSource
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const hasAlerts = unreadCount > 0;

  const loadAlerts = useCallback(async () => {
    const memberId = typeof member?.id === "string" ? member.id : "";

    if (!memberId) {
      setNotifications([]);
      setAlertsError(null);
      return;
    }

    setIsLoadingAlerts(true);
    setAlertsError(null);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, href, read_at, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setNotifications([]);
      setAlertsError(error.message || "Unable to load notifications.");
      setIsLoadingAlerts(false);
      return;
    }

    setNotifications((data ?? []) as NotificationRow[]);
    setIsLoadingAlerts(false);
  }, [member]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAlerts]);

  async function markNotificationRead(notificationId: string) {
    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read_at: readAt } : notification,
      ),
    );

    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId)
      .is("read_at", null);
  }

  async function markAllNotificationsRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);

    if (unreadIds.length === 0) {
      return;
    }

    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) =>
        notification.read_at ? notification : { ...notification, read_at: readAt },
      ),
    );

    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .is("read_at", null);
  }

  function handleOpenNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      void markNotificationRead(notification.id);
    }

    setIsAlertsOpen(false);

    if (notification.href) {
      router.push(notification.href);
    }
  }

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
    <header
      className={`h-[88px] border-b border-[rgba(255,255,255,0.08)] px-6 ${
        translucent ? "bg-[#070708]/56 backdrop-blur-[2px]" : "bg-[#090909]"
      }`}
    >
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
              onClick={() => {
                const nextOpen = !isAlertsOpen;
                setIsAlertsOpen(nextOpen);
                if (nextOpen) {
                  void loadAlerts();
                }
              }}
              className="relative flex h-14 w-14 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] transition hover:border-[#EF2B2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF2B2D]/50"
            >
              <Bell className="h-5 w-5 text-white" />

              {hasAlerts ? (
                <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF2B2D] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {isAlertsOpen ? (
              <div className="absolute right-0 top-[62px] z-50 w-[360px] overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  {hasAlerts ? (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="text-xs font-medium text-[#A1A1AA] transition hover:text-white"
                    >
                      Mark all as read
                    </button>
                  ) : null}
                </div>

                {isLoadingAlerts ? (
                  <div className="px-4 py-5 text-sm text-[#A1A1AA]">Loading notifications...</div>
                ) : alertsError ? (
                  <div className="px-4 py-5 text-sm text-red-300">Unable to load notifications right now.</div>
                ) : notifications.length > 0 ? (
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.map((notification) => {
                      const isUnread = !notification.read_at;

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleOpenNotification(notification)}
                          className={`flex w-full items-start gap-3 border-b border-white/10 px-4 py-3 text-left transition hover:bg-white/5 ${
                            isUnread ? "bg-white/[0.03]" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              isUnread ? "bg-[#EF2B2D]" : "bg-transparent"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <p
                              className={`truncate text-sm ${
                                isUnread ? "font-semibold text-white" : "font-medium text-[#A1A1AA]"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {notification.body ? (
                              <p className="mt-1 line-clamp-2 text-xs text-[#A1A1AA]">{notification.body}</p>
                            ) : null}
                            <p className="mt-1 text-[11px] text-[#737373]">
                              {formatAlertTime(notification.created_at)}
                            </p>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-[#A1A1AA]">You&apos;re all caught up.</div>
                )}
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
                {member?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      router.push(`/personnel/${member.id}`);
                    }}
                    className="w-full cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13px] font-[600] text-white transition-colors duration-200 ease-out hover:bg-[#1A1A1A] focus-visible:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2A2A2A]"
                  >
                    My Profile
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push("/change-password");
                  }}
                  className="w-full cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13px] font-[600] text-white transition-colors duration-200 ease-out hover:bg-[#1A1A1A] focus-visible:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2A2A2A]"
                >
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="w-full cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13px] font-[600] text-white transition-colors duration-200 ease-out hover:bg-[#1A1A1A] focus-visible:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Logging Out..." : "Sign Out"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}