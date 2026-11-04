"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export type ActiveMemberInfo = {
  id: string;
  departmentId: string | null;
  name: string;
  role: string;
};

/**
 * Resolves the current member for the ACTIVE department via the server route
 * shared auth context, resolved server-side through /api/auth/current-member.
 * Department switches update this context instead of leaving a mount-time cache.
 *
 * Use this instead of a client-side members lookup (`.eq("auth_user_id", ...)`
 * or `.eq("email", ...)` with maybeSingle), which is ambiguous once a user
 * belongs to more than one department and can return the wrong department.
 */
export function useActiveMember() {
  const { member: record, isLoading } = useAuth();
  const member = useMemo<ActiveMemberInfo | null>(() => {
    if (!record) return null;
    const combinedName = `${record.first_name?.trim() ?? ""} ${record.last_name?.trim() ?? ""}`.trim();
    return {
      id: record.id,
      departmentId: record.department_id,
      name: record.name?.trim() ? record.name : combinedName,
      role: record.role ?? "firefighter",
    };
  }, [record]);

  return { member, isLoading };
}
