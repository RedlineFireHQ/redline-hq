"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useMaintenancePermission() {
  const [canManageMaintenance, setCanManageMaintenance] = useState(false);
  const [isCheckingMaintenancePermission, setIsCheckingMaintenancePermission] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (isMounted) setIsCheckingMaintenancePermission(false);
        return;
      }

      let memberQuery = await supabase
        .from("members")
        .select("department_id, active")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!memberQuery.data && user.email) {
        memberQuery = await supabase
          .from("members")
          .select("department_id, active")
          .eq("email", user.email)
          .maybeSingle();
      }

      const departmentId = typeof memberQuery.data?.department_id === "string" ? memberQuery.data.department_id : "";
      const allowed = memberQuery.data?.active === true && departmentId
        ? await supabase.rpc("member_has_app_permission", {
            p_department_id: departmentId,
            p_permission_key: "maintenance_management",
          })
        : { data: false, error: null };

      if (isMounted) {
        setCanManageMaintenance(!allowed.error && Boolean(allowed.data));
        setIsCheckingMaintenancePermission(false);
      }
    }

    void checkPermission();
    return () => {
      isMounted = false;
    };
  }, []);

  return { canManageMaintenance, isCheckingMaintenancePermission };
}
