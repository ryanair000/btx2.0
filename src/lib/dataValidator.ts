import { DataFreshness, DataValidation } from "@/types";

/**
 * Validates team and standings data quality
 */
export function validateTeamData(
  homeTeam: any,
  awayTeam: any,
  standings: any
): DataValidation {
  const issues: string[] = [];

  // Validate home team
  const homeTeamValid = validateTeam(homeTeam, "home", issues);

  // Validate away team
  const awayTeamValid = validateTeam(awayTeam, "away", issues);

  // Validate standings data exists
  const standingsValid = !!standings && Object.keys(standings).length > 0;
  if (!standingsValid) {
    issues.push("League standings data is incomplete");
  }

  return {
    homeTeamValid,
    awayTeamValid,
    standingsValid,
    allValid: homeTeamValid && awayTeamValid && standingsValid,
    issues,
  };
}

/**
 * Validates a single team's data
 */
function validateTeam(team: any, side: string, issues: string[]): boolean {
  if (!team) {
    issues.push(`${side} team data is missing`);
    return false;
  }

  const requiredFields = ["name", "played", "won", "draw", "lost", "points"];
  const missingFields = requiredFields.filter((field) => team[field] === null);

  if (missingFields.length > 0) {
    issues.push(
      `${side} team missing fields: ${missingFields.join(", ")}`
    );
    return false;
  }

  return true;
}

/**
 * Checks how fresh the data is and returns staleness info
 */
export function checkDataFreshness(dataTimestamp: number): DataFreshness {
  const now = Date.now();
  const ageMs = now - dataTimestamp;
  const hoursOld = Math.floor(ageMs / (1000 * 60 * 60));
  const minutesOld = Math.floor((ageMs / (1000 * 60)) % 60);

  // Determine staleness level
  let staleness: "fresh" | "recent" | "stale" | "very_stale" = "fresh";
  let message = "";

  if (hoursOld === 0) {
    staleness = "fresh";
    if (minutesOld === 0) {
      message = `Data just updated (${Math.floor(ageMs / 1000)} seconds ago)`;
    } else {
      message = `Data updated ${minutesOld} minute${minutesOld > 1 ? "s" : ""} ago`;
    }
  } else if (hoursOld <= 3) {
    staleness = "recent";
    message = `Data updated ${hoursOld} hour${hoursOld > 1 ? "s" : ""} ago`;
  } else if (hoursOld <= 6) {
    staleness = "stale";
    message = `Data updated ${hoursOld} hour${hoursOld > 1 ? "s" : ""} ago - slightly outdated`;
  } else {
    staleness = "very_stale";
    message = `Data is ${hoursOld}+ hours old - may be significantly outdated`;
  }

  return {
    dataTimestamp,
    hoursOld,
    isStale: hoursOld >= 6,
    staleness,
    message,
  };
}

/**
 * Calculates confidence adjustment based on data staleness
 * Returns a negative number to reduce confidence for old data
 */
export function calculateConfidenceAdjustment(hoursOld: number): number {
  if (hoursOld <= 3) return 0; // No adjustment for fresh data
  if (hoursOld <= 6) return -3; // -3% for 3-6 hours old
  if (hoursOld <= 12) return -7; // -7% for 6-12 hours old
  if (hoursOld <= 24) return -12; // -12% for 12-24 hours old
  return -20; // -20% for very old data (>24 hours)
}

/**
 * Generates a staleness warning message for UI display
 */
export function getStalenessWarning(freshness: DataFreshness): string | null {
  if (freshness.staleness === "very_stale") {
    return `⚠️ Warning: Data is very old (${freshness.hoursOld} hours). Prediction confidence reduced by ${calculateConfidenceAdjustment(freshness.hoursOld)}%.`;
  }

  if (freshness.staleness === "stale") {
    return `📋 Note: Data is ${freshness.hoursOld} hours old. Consider refreshing for latest information.`;
  }

  return null;
}

/**
 * Validates API response has necessary fields
 */
export function validateApiResponse(
  data: any,
  requiredFields: string[]
): boolean {
  if (!data || typeof data !== "object") return false;
  return requiredFields.every((field) => data[field] !== null && data[field] !== undefined);
}
