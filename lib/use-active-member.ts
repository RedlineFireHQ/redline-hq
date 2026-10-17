"use client";

import { useEffect, useState } from "react";

export type ActiveMemberInfo = {
  id: string;
  departmentId: string | null;
  name: string;
  role: string;
};

type CurrentMemberApiResponse = {
  ok?: boolean;
  member?: {
    id?: string;
    department_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
    name?: string | null;
  } | null;
};

/**
 * Resolves the current member for the ACTIVE department via the server route
 * /api/auth/current-member, which reads the httpOnly redline_active_department_id
 * cookie and picks the correct member row server-side.
 *
 * Use this instead of a client-side members lookup (`.eq("auth_user_id", ...)`
 * or `.eq("email", ...)` with maybeSingle), which is ambiguous once a user
 * belongs to more than one department and can return the wrong department.
 */
export function useActiveMember() {
  const [member, setMember] = useState<ActiveMemberInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await fetch("/api/auth/current-member", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as CurrentMemberApiResponse | null;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !result?.ok || !result.member) {
          setMember(null);
          setIsLoading(false);
          return;
        }

        const record = result.member;
        const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
        const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
        const combinedName = `${firstName} ${lastName}`.trim();
        const resolvedName =
          typeof record.name === "string" && record.name.trim()
            ? record.name
            : combinedName;

        setMember({
          id: typeof record.id === "string" ? record.id : "",
          departmentId: typeof record.department_id === "string" ? record.department_id : null,
          name: resolvedName,
          role: typeof record.role === "string" ? record.role : "firefighter",
        });
        setIsLoading(false);
      } catch {
        if (isMounted) {
          setMember(null);
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return { member, isLoading };
}
