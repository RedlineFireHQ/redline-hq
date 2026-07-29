import ReadinessHero from "./ReadinessHero";
import TodaysMission from "./TodaysMission";
import AtAGlance from "./AtAGlance";
import MyTasks from "./MyTasks";
import DepartmentAlerts from "./DepartmentAlerts";
import QuickActions from "./QuickActions";
import ApparatusStatus from "./ApparatusStatus";
import InventorySnapshot from "./InventorySnapshot";
import Weather from "./Weather";
import ActivityFeed from "./ActivityFeed";
import Footer from "./Footer";

export default function CommandCenter() {
  return (
    <main className="h-screen overflow-hidden bg-[#080808] p-5">

      <div className="mx-auto flex h-full max-w-[1850px] flex-col gap-5">

        {/* ---------- TOP ---------- */}

        <div className="grid h-[28%] grid-cols-12 gap-5">

          <div className="col-span-7 h-full">
            <ReadinessHero />
          </div>

          <div className="col-span-3 h-full">
            <TodaysMission />
          </div>

          <div className="col-span-2 h-full">
            <AtAGlance />
          </div>

        </div>

        {/* ---------- MIDDLE ---------- */}

        <div className="grid h-[28%] grid-cols-12 gap-5">

          <div className="col-span-4 h-full">
            <MyTasks />
          </div>

          <div className="col-span-4 h-full">
            <DepartmentAlerts />
          </div>

          <div className="col-span-4 h-full">
            <QuickActions />
          </div>

        </div>

        {/* ---------- LOWER ---------- */}

        <div className="grid h-[34%] grid-cols-12 gap-5">

          <div className="col-span-8 h-full">
            <ApparatusStatus />
          </div>

          <div className="col-span-4 flex h-full flex-col gap-5">

            <div className="flex-1">
              <InventorySnapshot />
            </div>

            <div className="flex-1">
              <Weather />
            </div>

          </div>

        </div>

        {/* ---------- BOTTOM ---------- */}

        <div className="grid h-[10%] grid-cols-12 gap-5">

          <div className="col-span-9 h-full">
            <ActivityFeed />
          </div>

          <div className="col-span-3 h-full">
            <Footer />
          </div>

        </div>

      </div>

    </main>
  );
}