import ReadinessPanel from "./ReadinessPanel";
import MissionPanel from "./TodaysReadinessPanel";
import MyReadinessPanel from "./MyReadinessPanel";
import TrainingPanel from "./TrainingPanel";
import AlertsPanel from "./AlertsPanel";
import ApparatusPanel from "./ApparatusPanel";
import WeatherPanel from "./WeatherPanel";
import ActivityPanel from "./ActivityPanel";

export default function CommandCenterLayout() {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="grid grid-cols-12 auto-rows-auto gap-4">
        <div className="col-span-7">
          <ReadinessPanel />
        </div>

        <div className="col-span-5">
          <MissionPanel />
        </div>

        <div className="col-span-4">
          <MyReadinessPanel />
        </div>

        <div className="col-span-3">
          <TrainingPanel />
        </div>

        <div className="col-span-5">
          <AlertsPanel />
        </div>

        <div className="col-span-12">
          <ApparatusPanel />
        </div>

        <div className="col-span-8">
          <ActivityPanel />
        </div>

        <div className="col-span-4">
          <WeatherPanel />
        </div>
      </div>
    </div>
  );
}