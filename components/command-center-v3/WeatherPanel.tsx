import Image from "next/image";
import {
  Cloud,
  Wind,
  Droplets,
  Gauge,
} from "lucide-react";
import { MapPin } from "lucide-react";
import { getElliottWeather } from "@/lib/weather/weatherapi";

function formatTemperature(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}°F`;
}

function formatHumidity(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatWind(direction: string | null, speed: number | null) {
  if (!direction && speed === null) {
    return "--";
  }

  const roundedSpeed = speed === null ? "--" : `${Math.round(speed)} mph`;
  return direction ? `${direction} ${roundedSpeed}` : roundedSpeed;
}

export default async function WeatherPanel() {
  const weather = await getElliottWeather();
  const weatherDetails = [
    { label: "Humidity", value: formatHumidity(weather.humidityPercent), icon: Droplets },
    { label: "Wind", value: formatWind(weather.windDirection, weather.windMph), icon: Wind },
    { label: "Feels Like", value: formatTemperature(weather.feelsLikeF), icon: Gauge },
  ];

  return (
    <section className="relative flex h-[155px] flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Image
          src="/branding/logos/redline-weather-logo.png"
          alt="Redline HQ Weather"
          width={180}
          height={30}
          className="h-[50px] w-[219px]"
          priority
        />

        <div className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-[#A1A1AA]" />
          <p className="text-[11px] font-[500] text-[#A1A1AA]">{weather.locationName}</p>
        </div>
      </div>

      {/* Current Conditions */}
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-2">
        <div className="flex min-h-0 flex-col justify-center rounded-[12px] bg-[#0d0d0d] px-2 py-1.5">
          <div className="flex items-center gap-2">
            <div className="relative flex h-[28px] w-[28px] items-center justify-center">
              <div className="absolute left-1 top-1 h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
              <Cloud className="relative z-10 h-[22px] w-[22px] text-white" />
            </div>

            <p className="text-[28px] font-bold leading-none text-white">
              {formatTemperature(weather.temperatureF)}
            </p>
          </div>

          <p className="mt-1 text-[12px] font-[500] leading-none text-[#A1A1AA]">
            {weather.conditionText}
          </p>
        </div>

        <div className="flex min-h-0 flex-col justify-center gap-1.5 rounded-[12px] bg-[#0d0d0d] p-2">
          {weatherDetails.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[#A1A1AA]" />
                <p className="text-[11px] text-[#A1A1AA]">{label}</p>
              </div>

              <p className="text-[12px] font-[600] text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}