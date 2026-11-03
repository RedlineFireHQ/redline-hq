import DailyLogPage, { type DailyLogSearch } from "@/components/daily-log/DailyLogPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<DailyLogSearch> }) {
  return <DailyLogPage params={await searchParams} />;
}
