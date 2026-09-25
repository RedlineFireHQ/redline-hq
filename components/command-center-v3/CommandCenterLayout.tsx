import ReadinessPanel from "./ReadinessPanel";
import MissionPanel from "./TodaysReadinessPanel";
import MyReadinessPanel from "./MyReadinessPanel";
import TrainingPanel from "./TrainingPanel";
import AlertsPanel from "./AlertsPanel";
import ApparatusPanel from "./ApparatusPanel";
import WeatherPanel from "./WeatherPanel";

export default function CommandCenterLayout() {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="grid grid-cols-1 auto-rows-auto gap-4 2xl:grid-cols-12">
        <div className="2xl:col-span-7">
          <ReadinessPanel />
        </div>

        <div className="2xl:col-span-5">
          <MissionPanel />
        </div>

        <div className="2xl:col-span-4 2xl:-translate-y-[93px]">
          <MyReadinessPanel />
        </div>

        <div className="2xl:col-span-3 2xl:-translate-y-[93px]">
          <TrainingPanel />
        </div>

        <div className="2xl:col-span-5">
          <AlertsPanel />
        </div>

        <div className="2xl:col-start-5 2xl:col-span-3 2xl:-translate-y-[258px]">
          <WeatherPanel />
        </div>

        <div className="2xl:col-span-12 2xl:-translate-y-[253px]">
          <ApparatusPanel />
        </div>
      </div>
    </div>
  );
}