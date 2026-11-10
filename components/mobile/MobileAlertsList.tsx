"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MobileAlertsList({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, href, read_at, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setNotifications([]);
      setLoadError(error.message || "Unable to load alerts.");
      setIsLoading(false);
      return;
    }

    setNotifications((data ?? []) as NotificationRow[]);
    setIsLoading(false);
  }, [memberId]);

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

  async function markAllRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length === 0) {
      return;
    }

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => (notification.read_at ? notification : { ...notification, read_at: readAt })),
    );

    await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .is("read_at", null);
  }

  function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      void markNotificationRead(notification.id);
    }

    if (notification.href) {
      router.push(notification.href);
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">
          Back to Field Actions
        </Link>

        <header className="mt-5 flex items-end justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Mobile</p>
            <h1 className="mt-2 text-3xl font-black">Alerts</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/80"
            >
              Mark all read
            </button>
          ) : null}
        </header>

        {loadError ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{loadError}</div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-5 text-sm text-white/55">Loading alerts…</div>
        ) : notifications.length === 0 && !loadError ? (
          <section className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-5">
            <p className="text-sm font-bold leading-6 text-white/55">
              No alerts yet. Training assignments, deficiency assignments, and other department notifications will appear here.
            </p>
          </section>
        ) : (
          <div className="mt-5 space-y-3">
            {notifications.map((notification) => {
              const isUnread = !notification.read_at;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`block w-full rounded-2xl border p-4 text-left transition ${
                    isUnread ? "border-[#ef2b2d]/45 bg-[#1a1212]" : "border-white/10 bg-[#121212]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-white">{notification.title}</p>
                    {isUnread ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#ef2b2d]" /> : null}
                  </div>
                  {notification.body ? (
                    <p className="mt-1 text-sm leading-6 text-white/65">{notification.body}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-white/40">{formatAlertTime(notification.created_at)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
