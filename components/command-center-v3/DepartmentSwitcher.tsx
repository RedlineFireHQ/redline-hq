"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type DepartmentOption = {
  id: string;
  name: string;
};

export default function DepartmentSwitcher() {
  const router = useRouter();
  const { user, department, isLoading, refreshSession } = useAuth();
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function handleSelect(nextDepartmentId: string) {
    if (!nextDepartmentId || nextDepartmentId === activeDepartmentId || isSwitching) {
      setIsOpen(false);
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

      // Refresh the auth context first so the header/sidebar reflect the new
      // active department, then clear the switching state and navigate.
      await refreshSession();
      setIsSwitching(false);
      setIsOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to switch department.");
      setIsSwitching(false);
    }
  }

  // Single-department (or loading) users don't need a switcher.
  if (isLoading || options.length <= 1) {
    return null;
  }

  const activeName = department?.name ?? "Select Department";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Switch department"
        disabled={isSwitching}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-14 items-center gap-3 rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] px-4 transition hover:border-[#EF2B2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF2B2D]/50 disabled:opacity-60"
      >
        <Building2 className="h-5 w-5 shrink-0 text-white" />
        <span className="max-w-[180px] truncate text-left text-[15px] font-[600] text-white">
          {isSwitching ? "Switching..." : activeName}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#A1A1AA]" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[62px] z-50 w-[280px] overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[#111111] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Departments</p>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            {options.map((option) => {
              const isActive = option.id === activeDepartmentId;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isSwitching}
                  onClick={() => void handleSelect(option.id)}
                  className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[14px] transition hover:bg-[#1A1A1A] focus-visible:bg-[#1A1A1A] focus-visible:outline-none ${
                    isActive ? "font-semibold text-white" : "font-medium text-[#A1A1AA]"
                  }`}
                >
                  <span className="truncate">{option.name}</span>
                  {isActive ? <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-[#EF2B2D]" /> : null}
                </button>
              );
            })}
          </div>
          {error ? (
            <div className="border-t border-white/10 px-4 py-3 text-xs text-red-300">{error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
