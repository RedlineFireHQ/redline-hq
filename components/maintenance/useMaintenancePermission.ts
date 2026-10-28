"use client";

import { useActiveMember } from "@/lib/use-active-member";

// Any member of the active department may perform maintenance; the API enforces active status and department scope.
export function useMaintenancePermission() {
  const { member, isLoading } = useActiveMember();

  return {
    canPerformMaintenance: Boolean(member?.departmentId),
    isCheckingMaintenancePermission: isLoading,
  };
}
