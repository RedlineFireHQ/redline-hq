import Sidebar from "./Sidebar";
import Header from "./Header";
import ReadinessPanel from "./ReadinessPanel";
import MissionPanel from "./TodaysReadinessPanel";
import MyReadinessPanel from "./MyReadinessPanel";
import TrainingPanel from "./TrainingPanel";
import AlertsPanel from "./AlertsPanel";
import ApparatusPanel from "./ApparatusPanel";
import WeatherPanel from "./WeatherPanel";
import ActivityPanel from "./ActivityPanel";
import Footer from "./Footer";

export default function CommandCenterLayout() {
  return (
    <div className="flex h-screen bg-[#0b0c0d]">

      {/* Fixed Sidebar */}
      <aside className="sticky top-0 h-screen flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Right Side */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Fixed Header */}
        <div className="sticky top-0 z-40 bg-[#0b0c0d]">
          <Header />
        </div>

        {/* Scrollable Dashboard */}
        <main className="flex-1 overflow-y-auto">

          <div className="flex flex-col gap-4 p-4 pb-10">

            <div className="grid grid-cols-12 auto-rows-auto gap-4">

              {/* ================= TOP ROW ================= */}

              <div className="col-span-7">
                <ReadinessPanel />
              </div>

              <div className="col-span-5">
                <MissionPanel />
              </div>

              {/* ================= SECOND ROW ================= */}

              <div className="col-span-4">
                <MyReadinessPanel />
              </div>

              <div className="col-span-3">
                <TrainingPanel />
              </div>

              <div className="col-span-5">
                <AlertsPanel />
              </div>

              {/* ================= THIRD ROW ================= */}

              <div className="col-span-12">
                <ApparatusPanel />
              </div>

              {/* ================= FOURTH ROW ================= */}

              <div className="col-span-8">
                <ActivityPanel />
              </div>

              <div className="col-span-4">
                <WeatherPanel />
              </div>

            </div>

            <Footer />

          </div>

        </main>

      </div>

    </div>
  );
}