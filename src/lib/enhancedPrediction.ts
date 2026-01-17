/**
 * Enhanced Prediction Engine
 * Incorporates weather, fixture congestion, and head-to-head analysis
 */

import { WeatherData, analyzeWeatherImpact } from "./weatherService";
import { FixtureCongestion, getFatigueImpact, getInjuryRiskImpact } from "./fixtureAnalysis";
import { HeadToHeadStats, getHeadToHeadImpact } from "./headToHeadAnalysis";

export interface EnhancedPredictionFactors {
  weather?: WeatherData;
  homeTeamCongestion?: FixtureCongestion;
  awayTeamCongestion?: FixtureCongestion;
  headToHead?: HeadToHeadStats;
  homeTeamStyle?: "defensive" | "balanced" | "attacking";
  awayTeamStyle?: "defensive" | "balanced" | "attacking";
}

export interface EnhancedPredictionAdjustments {
  weatherImpact: number;
  homeFatigueImpact: number;
  awayFatigueImpact: number;
  homeInjuryImpact: number;
  awayInjuryImpact: number;
  headToHeadImpact: number;
  totalAdjustment: number;
  factorsApplied: string[];
}

/**
 * Calculate all enhancement adjustments
 */
export function calculateEnhancements(
  factors: EnhancedPredictionFactors
): EnhancedPredictionAdjustments {
  const adjustments: EnhancedPredictionAdjustments = {
    weatherImpact: 0,
    homeFatigueImpact: 0,
    awayFatigueImpact: 0,
    homeInjuryImpact: 0,
    awayInjuryImpact: 0,
    headToHeadImpact: 0,
    totalAdjustment: 0,
    factorsApplied: [],
  };

  // Weather impact
  if (factors.weather) {
    adjustments.weatherImpact = analyzeWeatherImpact(
      factors.weather,
      factors.homeTeamStyle || "balanced"
    );
    adjustments.factorsApplied.push(`Weather: ${factors.weather.condition}`);
  }

  // Home team fatigue and injury
  if (factors.homeTeamCongestion) {
    adjustments.homeFatigueImpact = getFatigueImpact(factors.homeTeamCongestion);
    adjustments.homeInjuryImpact = getInjuryRiskImpact(
      factors.homeTeamCongestion.injuryRisk
    );

    if (adjustments.homeFatigueImpact !== 0) {
      adjustments.factorsApplied.push(
        `Home Team Rest: ${factors.homeTeamCongestion.daysSinceLastMatch} days`
      );
    }
    if (adjustments.homeInjuryImpact !== 0) {
      adjustments.factorsApplied.push(
        `Home Team Injury Risk: ${(factors.homeTeamCongestion.injuryRisk * 100).toFixed(0)}%`
      );
    }
  }

  // Away team fatigue and injury
  if (factors.awayTeamCongestion) {
    adjustments.awayFatigueImpact = getFatigueImpact(factors.awayTeamCongestion);
    adjustments.awayInjuryImpact = getInjuryRiskImpact(
      factors.awayTeamCongestion.injuryRisk
    );

    if (adjustments.awayFatigueImpact !== 0) {
      adjustments.factorsApplied.push(
        `Away Team Rest: ${factors.awayTeamCongestion.daysSinceLastMatch} days`
      );
    }
    if (adjustments.awayInjuryImpact !== 0) {
      adjustments.factorsApplied.push(
        `Away Team Injury Risk: ${(factors.awayTeamCongestion.injuryRisk * 100).toFixed(0)}%`
      );
    }
  }

  // Head-to-head impact
  if (factors.headToHead && factors.headToHead.totalMatches > 0) {
    adjustments.headToHeadImpact = getHeadToHeadImpact(
      factors.headToHead,
      "home"
    );
    adjustments.factorsApplied.push(
      `H2H Record: ${factors.headToHead.homeTeamWins}W-${factors.headToHead.draws}D-${factors.headToHead.awayTeamWins}L`
    );
  }

  // Calculate total adjustment
  adjustments.totalAdjustment =
    adjustments.weatherImpact +
    (adjustments.homeFatigueImpact - adjustments.awayFatigueImpact) +
    (adjustments.homeInjuryImpact - adjustments.awayInjuryImpact) +
    adjustments.headToHeadImpact;

  return adjustments;
}

/**
 * Apply enhancements to base prediction scores
 */
export function applyEnhancementsToScores(
  homeScore: number,
  awayScore: number,
  adjustments: EnhancedPredictionAdjustments
): { adjustedHome: number; adjustedAway: number } {
  // Weather affects both teams equally
  const weatherAdjustedHome = homeScore + adjustments.weatherImpact;
  const weatherAdjustedAway = awayScore - adjustments.weatherImpact;

  // Fatigue affects home vs away
  const fatigueAdjustedHome =
    weatherAdjustedHome + adjustments.homeFatigueImpact - adjustments.awayFatigueImpact;
  const fatigueAdjustedAway =
    weatherAdjustedAway + adjustments.awayFatigueImpact - adjustments.homeFatigueImpact;

  // Injury risk affects both
  const injuryAdjustedHome =
    fatigueAdjustedHome + adjustments.homeInjuryImpact - adjustments.awayInjuryImpact;
  const injuryAdjustedAway =
    fatigueAdjustedAway + adjustments.awayInjuryImpact - adjustments.homeInjuryImpact;

  // Head-to-head (home team only)
  const adjustedHome = injuryAdjustedHome + adjustments.headToHeadImpact;
  const adjustedAway = injuryAdjustedAway - adjustments.headToHeadImpact;

  return { adjustedHome, adjustedAway };
}

/**
 * Generate enhanced key factors
 */
export function generateEnhancedFactors(
  adjustments: EnhancedPredictionAdjustments,
  baseFactors: string[]
): string[] {
  const enhanced = [...baseFactors];

  // Add weather impact
  if (adjustments.weatherImpact > 0.05) {
    enhanced.push("Weather conditions favor home team");
  } else if (adjustments.weatherImpact < -0.05) {
    enhanced.push("Weather conditions favor away team");
  }

  // Add fatigue impact
  if (Math.abs(adjustments.homeFatigueImpact - adjustments.awayFatigueImpact) > 0.05) {
    if (adjustments.homeFatigueImpact > adjustments.awayFatigueImpact) {
      enhanced.push("Home team fresher with better rest");
    } else {
      enhanced.push("Away team fresher with better rest");
    }
  }

  // Add injury risk
  if (adjustments.homeInjuryImpact < -0.05) {
    enhanced.push("Home team at higher injury risk due to congestion");
  } else if (adjustments.awayInjuryImpact < -0.05) {
    enhanced.push("Away team at higher injury risk due to congestion");
  }

  // Add head-to-head
  if (adjustments.headToHeadImpact > 0.05) {
    enhanced.push("Home team historically dominant in meetings");
  } else if (adjustments.headToHeadImpact < -0.05) {
    enhanced.push("Away team historically dominant in meetings");
  }

  return enhanced.slice(0, 5); // Return top 5 factors
}

/**
 * Calculate confidence adjustment based on enhancements
 * More data = higher confidence
 */
export function getConfidenceAdjustment(
  adjustments: EnhancedPredictionAdjustments
): number {
  const factorCount = adjustments.factorsApplied.length;
  // Each factor adds ~2% confidence (capped at +10%)
  return Math.min(10, factorCount * 2);
}

/**
 * Generate enhanced summary with all factors
 */
export function generateEnhancedSummary(
  baseInsight: string,
  adjustments: EnhancedPredictionAdjustments,
  predictedWinner: "Home" | "Away" | "Draw"
): string {
  const enhancements: string[] = [];

  if (adjustments.weatherImpact > 0.05) {
    enhancements.push("favorable weather conditions");
  } else if (adjustments.weatherImpact < -0.05) {
    enhancements.push("challenging weather ahead");
  }

  if (adjustments.homeFatigueImpact > adjustments.awayFatigueImpact) {
    enhancements.push("home team advantage in recovery");
  } else if (adjustments.awayFatigueImpact > adjustments.homeFatigueImpact) {
    enhancements.push("away team advantage in recovery");
  }

  if (adjustments.headToHeadImpact > 0.05) {
    enhancements.push("strong home team h2h record");
  } else if (adjustments.headToHeadImpact < -0.05) {
    enhancements.push("strong away team h2h record");
  }

  if (enhancements.length === 0) {
    return baseInsight;
  }

  const enhancementStr = enhancements.join(" and ");
  return `${baseInsight} Enhanced analysis includes ${enhancementStr}.`;
}
