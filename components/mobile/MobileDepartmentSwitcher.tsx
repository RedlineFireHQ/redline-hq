"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type DepartmentOption = {
  id: string;
  name: string;
};

/**
 * Mobile department selector. Mirrors the desktop DepartmentSwitcher but is
 * self-contained and styled for the mobile "More" sheet. It only appears when
 * the user belongs to more than one department, and reuses the existing
 * server-side /api/auth/set-active-department route which verifies membership
 * before writing the redline_active_department_id cookie.
 */
export default function MobileDepartmentSwitcher({ onSwitch }: { onSwitch?: () => void }) {
  const router = useRouter();
  const { user, department, isLoading, refreshSession } = useAuth();
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authUserId = typeof user?.id === "string" ? user.id : "";
  const activeDepartmentId = department?.id ?? "";

  const loadDepartments = useCallback(async () => {
    if (!authUserId) {
      setOptions([]);
      return;
    }

    // RLS scopes this to the user's own membership rows.
    const { data, error: loadError } = await supabase
      .from("members")
      .select("department_id")
      .eq("auth_user_id", authUserId);

    if (loadError) {
      setOptions([]);
      return;
    }

    const departmentIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => (typeof row?.department_id === "string" ? row.department_id : ""))
          .filter((id) => id.length > 0),
      ),
    );

    if (departmentIds.length === 0) {
      setOptions([]);
      return;
    }

    const { data: departmentRows, error: departmentError } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", departmentIds)
      .order("name", { ascending: true });

    if (departmentError) {
      setOptions([]);
      return;
    }

    setOptions(
      (departmentRows ?? [])
        .map((row) => ({
          id: typeof row?.id === "string" ? row.id : "",
          name: typeof row?.name === "string" ? row.name : "",
        }))
        .filter((row) => row.id && row.name),
    );
  }, [authUserId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDepartments();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadDepartments]);

  async function handleSelect(nextDepartmentId: string) {
    if (!nextDepartmentId || nextDepartmentId === activeDepartmentId || isSwitching) {
      return;
    }

    setIsSwitching(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/set-active-department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: nextDepartmentId }),
      });

      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setError(result.error || "Unable to switch department.");
        setIsSwitching(false);
        return;
      }

      // Refresh the auth context first so the new active department is reflected,
      // then clear the switching state, close the sheet, and reload mobile data.
      await refreshSession();
      setIsSwitching(false);
      onSwitch?.();
      router.push("/mobile");
      router.refresh();
    } catch {
      setError("Unable to switch department.");
      setIsSwitching(false);
    }
  }

  // Single-department (or loading) users don't need a selector.
  if (isLoading || options.length <= 1) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-base font-black text-white">Department</span>
          <span className="block text-xs text-white/45">
            {isSwitching ? "Switching..." : department?.name ?? "Select department"}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {options.map((option) => {
          const isActive = option.id === activeDepartmentId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isSwitching}
              onClick={() => void handleSelect(option.id)}
              className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? "border-red-400/30 bg-red-500/10 text-white"
                  : "border-white/10 bg-[#111111] text-white/70 hover:border-white/20"
              }`}
            >
              <span className="truncate text-sm font-bold">{option.name}</span>
              {isActive ? <Check className="h-4 w-4 shrink-0 text-red-300" /> : <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />}
            </button>
          );
        })}
      </div>

      {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
