import { describe, expect, it } from "vitest";
import { mapOwmWeather } from "@/lib/weather";

const owm = (main: string, description: string, temp = 28.6) => ({ weather: [{ main, description }], main: { temp } });

describe("OpenWeatherMap to the diary's four choices", () => {
  it("maps each kind of sky", () => {
    expect(mapOwmWeather(owm("Clear", "clear sky"))).toEqual({ weather: "Sunny", note: "29°C, clear sky (automatic)" });
    expect(mapOwmWeather(owm("Clouds", "broken clouds"))?.weather).toBe("Cloudy");
    expect(mapOwmWeather(owm("Haze", "haze"))?.weather).toBe("Cloudy");
    expect(mapOwmWeather(owm("Drizzle", "light intensity drizzle"))?.weather).toBe("Rain");
    expect(mapOwmWeather(owm("Rain", "moderate rain"))?.weather).toBe("Rain");
    expect(mapOwmWeather(owm("Rain", "heavy intensity rain"))?.weather).toBe("Heavy rain");
    expect(mapOwmWeather(owm("Thunderstorm", "thunderstorm with rain"))?.weather).toBe("Heavy rain");
  });
  it("gives nothing for an answer it cannot read", () => {
    expect(mapOwmWeather({})).toBeNull();
    expect(mapOwmWeather({ weather: [] })).toBeNull();
  });
});
