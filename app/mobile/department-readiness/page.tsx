import { redirect } from "next/navigation";
import MobileDepartmentReadiness from "@/components/mobile/MobileDepartmentReadiness";
import { getCurrentMember } from "@/lib/current-member";
import { getDepartmentReadinessDataForCurrentMember } from "@/lib/readiness/department-readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileDepartmentReadinessPage() {
  const currentMember = await getCurrentMember();
  if (!currentMember?.departmentId || currentMember.role === "firefighter") {
    redirect("/mobile");
  }

  const readinessData = await getDepartmentReadinessDataForCurrentMember();
  if (!readinessData) redirect("/mobile");
  return <MobileDepartmentReadiness result={readinessData.result} />;
}
