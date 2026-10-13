import type { DIARY_WEATHER } from "@/lib/constants";

type Weather = (typeof DIARY_WEATHER)[number];

type OwmCurrent = { weather?: { main?: string; description?: string }[]; main?: { temp?: number } };

/** OpenWeatherMap's "current weather" answer, reduced to the four choices on the site diary. */
export function mapOwmWeather(json: OwmCurrent): { weather: Weather; note: string } | null {
  const w = json.weather?.[0];
  if (!w?.main) return null;
  const main = w.main.toLowerCase();
  const desc = (w.description ?? "").toLowerCase();
  let weather: Weather;
  if (main === "clear") weather = "Sunny";
  else if (main === "thunderstorm") weather = "Heavy rain";
  else if (main === "rain" || main === "drizzle") weather = /heavy|extreme|very/.test(desc) ? "Heavy rain" : "Rain";
  else weather = "Cloudy";
  const temp = typeof json.main?.temp === "number" ? `${Math.round(json.main.temp)}°C, ` : "";
  return { weather, note: `${temp}${w.description ?? w.main} (automatic)` };
}

/**
 * Today's weather at the site from OpenWeatherMap. Without OPENWEATHER_API_KEY, without GPS, offline,
 * slow or on any error it returns null and the diary simply asks the person to tap the weather.
 * (OPENWEATHER_BASE_URL exists so tests can point at a local stand-in.)
 */
export async function fetchSiteWeather(lat: number, lon: number): Promise<{ weather: Weather; note: string } | null> {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) return null;
  const base = (process.env.OPENWEATHER_BASE_URL?.trim() || "https://api.openweathermap.org").replace(/\/$/, "");
  try {
    const url = `${base}/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${encodeURIComponent(key)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!response.ok) return null;
    return mapOwmWeather((await response.json()) as OwmCurrent);
  } catch {
    return null;
  }
}
