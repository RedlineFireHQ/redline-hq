import { redirect } from "next/navigation";

import MobileGasMonitorCalibration from "@/components/mobile/MobileGasMonitorCalibration";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Monitor = {
  id: string;
  monitor_number: string;
  serial_number: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
};

type CalibrationDateRow = {
  gas_monitor_id: string;
  calibration_date: string;
};

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function MobileGasMonitorCalibrationPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [monitorsResult, settingsResult, calibrationsResult, sessionResultsResult, membersResult] = await Promise.all([
    supabase
      .from("gas_monitors")
      .select("id, monitor_number, serial_number, manufacturer, model, status")
      .eq("department_id", departmentId)
      .neq("status", "Retired")
      .order("monitor_number", { ascending: true }),
    supabase
      .from("gas_monitor_calibration_settings")
      .select("calibration_interval_months")
      .eq("department_id", departmentId)
      .maybeSingle(),
    supabase
      .from("gas_monitor_calibrations")
      .select("gas_monitor_id, calibration_date")
      .eq("department_id", departmentId),
    supabase
      .from("gas_monitor_calibration_session_results")
      .select("gas_monitor_id, calibration_date")
      .eq("department_id", departmentId),
    supabase.rpc("get_active_department_training_members", { p_department_id: departmentId }),
  ]);

  const error = monitorsResult.error
    ?? settingsResult.error
    ?? calibrationsResult.error
    ?? sessionResultsResult.error
    ?? membersResult.error;

  const latestCalibrationByMonitorId: Record<string, string> = {};
  const calibrationRows = [
    ...((calibrationsResult.data ?? []) as CalibrationDateRow[]),
    ...((sessionResultsResult.data ?? []) as CalibrationDateRow[]),
  ];
  for (const row of calibrationRows) {
    const current = latestCalibrationByMonitorId[row.gas_monitor_id];
    if (!current || row.calibration_date > current) {
      latestCalibrationByMonitorId[row.gas_monitor_id] = row.calibration_date;
    }
  }

  const interval = settingsResult.data?.calibration_interval_months;

  return (
    <MobileGasMonitorCalibration
      departmentId={departmentId}
      memberId={currentMember.id}
      monitors={(monitorsResult.data ?? []) as Monitor[]}
      members={(membersResult.data ?? []) as Member[]}
      latestCalibrationByMonitorId={latestCalibrationByMonitorId}
      calibrationIntervalMonths={typeof interval === "number" && interval > 0 ? interval : 6}
      initialError={error?.message ?? null}
    />
  );
}
