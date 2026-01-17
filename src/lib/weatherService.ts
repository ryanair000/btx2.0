import axios from "axios";

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_API_URL = process.env.WEATHER_API_URL || "https://api.weatherapi.com/v1";

export interface WeatherData {
  temperature: number; // Celsius
  humidity: number; // 0-100%
  windSpeed: number; // km/h
  windDirection: string; // N, NE, E, etc.
  condition: string; // "Sunny", "Rainy", etc.
  visibility: number; // km
  feelsLike: number; // Celsius
  uvIndex: number; // 0-11+
  willRain: boolean; // Probability of rain
  rainProbability: number; // 0-100%
}

export interface StadiumWeather {
  stadium: string;
  city: string;
  country: string;
  weather: WeatherData;
  fetchedAt: string;
}

/**
 * Get weather conditions for a match venue
 * Considers temperature, humidity, wind, and precipitation
 */
export async function getStadiumWeather(
  stadiumCity: string,
  stadiumCountry: string = "England"
): Promise<WeatherData | null> {
  if (!WEATHER_API_KEY) {
    console.warn("Weather API key not configured");
    return null;
  }

  try {
    const response = await axios.get(`${WEATHER_API_URL}/current.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: `${stadiumCity}, ${stadiumCountry}`,
        aqi: "yes", // Include air quality
      },
      timeout: 5000,
    });

    const data = response.data.current;

    return {
      temperature: data.temp_c,
      humidity: data.humidity,
      windSpeed: data.wind_kph,
      windDirection: data.wind_dir,
      condition: data.condition.text,
      visibility: data.vis_km,
      feelsLike: data.feelslike_c,
      uvIndex: data.uv,
      willRain: data.chance_of_rain > 30,
      rainProbability: data.chance_of_rain,
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
}

/**
 * Get forecast weather for match day
 * Useful for predicting weather at match time
 */
export async function getForecastWeather(
  stadiumCity: string,
  matchDate: string, // YYYY-MM-DD
  stadiumCountry: string = "England"
): Promise<WeatherData | null> {
  if (!WEATHER_API_KEY) {
    console.warn("Weather API key not configured");
    return null;
  }

  try {
    const response = await axios.get(`${WEATHER_API_URL}/forecast.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: `${stadiumCity}, ${stadiumCountry}`,
        dt: matchDate,
        aqi: "yes",
      },
      timeout: 5000,
    });

    // Get midday forecast (12:00)
    const forecastDay = response.data.forecast.forecastday[0];
    const middayHour = forecastDay.hour.find((h: any) => h.time.includes("12:00"));

    if (!middayHour) {
      console.warn("No midday forecast available");
      return null;
    }

    return {
      temperature: middayHour.temp_c,
      humidity: middayHour.humidity,
      windSpeed: middayHour.wind_kph,
      windDirection: middayHour.wind_dir,
      condition: middayHour.condition.text,
      visibility: middayHour.vis_km,
      feelsLike: middayHour.feelslike_c,
      uvIndex: middayHour.uv,
      willRain: middayHour.chance_of_rain > 30,
      rainProbability: middayHour.chance_of_rain,
    };
  } catch (error) {
    console.error("Failed to fetch forecast weather:", error);
    return null;
  }
}

/**
 * Analyze weather impact on prediction
 * Returns a score from -0.15 to +0.15 to adjust prediction
 */
export function analyzeWeatherImpact(weather: WeatherData, homeTeamStyle: string): number {
  let impact = 0;

  // Extreme temperatures affect performance
  if (weather.temperature > 30) {
    impact -= 0.05; // Hot weather tires players faster
  } else if (weather.temperature < 0) {
    impact -= 0.03; // Cold reduces player agility
  }

  // High humidity with heat is worse
  if (weather.temperature > 25 && weather.humidity > 80) {
    impact -= 0.05;
  }

  // Wind affects play style
  if (weather.windSpeed > 40) {
    impact -= 0.03; // High wind disrupts passing game
  }

  // Rain affects different play styles differently
  if (weather.willRain && weather.rainProbability > 60) {
    // Defensive/counter-attacking teams may benefit
    if (homeTeamStyle === "defensive") {
      impact += 0.05;
    } else {
      impact -= 0.05; // Attacking play suffers in rain
    }
  }

  // Low visibility (fog) reduces precision
  if (weather.visibility < 1) {
    impact -= 0.05;
  }

  // UV index affects player fatigue
  if (weather.uvIndex > 8) {
    impact -= 0.03;
  }

  return Math.max(-0.15, Math.min(0.15, impact));
}

/**
 * Get weather-based player performance prediction
 * Returns array of affected players/positions
 */
export function getWeatherAffectedPositions(
  weather: WeatherData
): { position: string; impact: number; reason: string }[] {
  const affected = [];

  if (weather.windSpeed > 35) {
    affected.push({
      position: "Goalkeeper",
      impact: -0.1,
      reason: "High wind affects shot accuracy and catches",
    });
    affected.push({
      position: "Wingers",
      impact: -0.1,
      reason: "Wind disrupts crossing accuracy",
    });
  }

  if (weather.temperature > 28) {
    affected.push({
      position: "Midfielders",
      impact: -0.1,
      reason: "Heat causes faster fatigue in middle of pitch",
    });
  }

  if (weather.willRain && weather.rainProbability > 70) {
    affected.push({
      position: "Defenders",
      impact: -0.08,
      reason: "Rain reduces traction on tackles",
    });
  }

  return affected;
}
