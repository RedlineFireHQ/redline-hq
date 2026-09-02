type WeatherApiLocation = {
  name?: string | null;
  region?: string | null;
};

type WeatherApiCurrent = {
  temp_f?: number | null;
  humidity?: number | null;
  wind_dir?: string | null;
  wind_mph?: number | null;
  feelslike_f?: number | null;
  last_updated?: string | null;
  condition?: {
    text?: string | null;
  } | null;
};

type WeatherApiResponse = {
  location?: WeatherApiLocation | null;
  current?: WeatherApiCurrent | null;
};

export type LiveWeather = {
  locationName: string;
  temperatureF: number | null;
  conditionText: string;
  humidityPercent: number | null;
  windDirection: string | null;
  windMph: number | null;
  feelsLikeF: number | null;
  lastUpdated: string | null;
};

const WEATHER_API_URL = "https://api.weatherapi.com/v1/current.json";
const ELLIOTT_IOWA_QUERY = "41.14916,-95.16388";
const FALLBACK_LOCATION_LABEL = "Elliott, IA";

const FALLBACK_WEATHER: LiveWeather = {
  locationName: FALLBACK_LOCATION_LABEL,
  temperatureF: null,
  conditionText: "Unavailable",
  humidityPercent: null,
  windDirection: null,
  windMph: null,
  feelsLikeF: null,
  lastUpdated: null,
};

function normalizeLocationName(location: WeatherApiLocation | null | undefined) {
  const name = typeof location?.name === "string" ? location.name.trim() : "";
  const region = typeof location?.region === "string" ? location.region.trim() : "";
  const regionLabel = region === "Iowa" ? "IA" : region;
  const label = [name, regionLabel].filter(Boolean).join(", ");

  return label || FALLBACK_LOCATION_LABEL;
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getElliottWeather(): Promise<LiveWeather> {
  const apiKey = process.env.WEATHERAPI_KEY?.trim();

  if (!apiKey) {
    console.error("[weather] WEATHERAPI_KEY is missing.");
    return FALLBACK_WEATHER;
  }

  try {
    const response = await fetch(
      `${WEATHER_API_URL}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(ELLIOTT_IOWA_QUERY)}`,
      {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      console.error("[weather] WeatherAPI request failed.", {
        status: response.status,
        statusText: response.statusText,
      });
      return FALLBACK_WEATHER;
    }

    const payload = (await response.json()) as WeatherApiResponse;
    const current = payload.current;

    return {
      locationName: normalizeLocationName(payload.location),
      temperatureF: normalizeNumber(current?.temp_f),
      conditionText:
        typeof current?.condition?.text === "string" && current.condition.text.trim()
          ? current.condition.text.trim()
          : "Unavailable",
      humidityPercent: normalizeNumber(current?.humidity),
      windDirection:
        typeof current?.wind_dir === "string" && current.wind_dir.trim()
          ? current.wind_dir.trim()
          : null,
      windMph: normalizeNumber(current?.wind_mph),
      feelsLikeF: normalizeNumber(current?.feelslike_f),
      lastUpdated:
        typeof current?.last_updated === "string" && current.last_updated.trim()
          ? current.last_updated.trim()
          : null,
    };
  } catch (error) {
    console.error("[weather] Failed to fetch live weather.", error);
    return FALLBACK_WEATHER;
  }
}