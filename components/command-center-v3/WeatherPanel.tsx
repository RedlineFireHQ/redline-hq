import Image from "next/image";
import {
  Cloud,
  Wind,
  Droplets,
  Gauge,
} from "lucide-react";
import { MapPin } from "lucide-react";

export default function WeatherPanel() {
  const weatherDetails = [
    { label: "Humidity", value: "61%", icon: Droplets },
    { label: "Wind", value: "S 12 mph", icon: Wind },
    { label: "Feels Like", value: "87°F", icon: Gauge },
  ];

  return (
    <section className="relative flex h-full flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Image
          src="/logos/redline-weather-logo.png"
          alt="Redline HQ Weather"
          width={180}
          height={30}
          className="h-[80px] w-[180px]"
          priority
        />

        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4 text-[#A1A1AA]" />
          <p className="text-[13px] font-[500] text-[#A1A1AA]">Elliott, IA</p>
        </div>
      </div>

      {/* Current Conditions */}
      <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="flex flex-col items-center justify-center rounded-[14px] bg-[#0d0d0d] py-5">
          <div className="relative flex h-[76px] w-[76px] items-center justify-center">
            <div className="absolute left-3 top-3 h-6 w-6 rounded-full bg-[#F59E0B]" />
            <Cloud className="relative z-10 h-[64px] w-[64px] text-white" />
          </div>

          <p className="mt-1 text-[46px] font-bold leading-none text-white">
            85°F
          </p>

          <p className="text-[18px] font-[500] text-[#A1A1AA]">
            Partly Cloudy
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 rounded-[14px] bg-[#0d0d0d] p-4">
          {weatherDetails.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#A1A1AA]" />
                <p className="text-[13px] text-[#A1A1AA]">{label}</p>
              </div>

              <p className="text-[14px] font-[600] text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}