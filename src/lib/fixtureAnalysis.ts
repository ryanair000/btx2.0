/**
 * Calculates fixture congestion and rest days between matches
 * More rest = better performance potential
 */

export interface FixtureCongestion {
  daysSinceLastMatch: number; // Days team had to recover
  nextMatchIn: number; // Days until next match
  matchesIn7Days: number; // Number of matches in next 7 days
  matchesIn14Days: number; // Number of matches in next 14 days
  isHighCongestion: boolean; // True if 3+ matches in 14 days
  fatigueMultiplier: number; // 0.85 (fatigued) to 1.15 (well-rested)
  injuryRisk: number; // 0-1 probability (more matches = higher risk)
}

/**
 * Calculate fixture congestion for a team
 * Based on recent match dates and upcoming fixtures
 */
export function calculateFixtureCongestion(
  recentMatches: { date: string }[] = [],
  upcomingMatchDate: string
): FixtureCongestion {
  const now = new Date();
  const matchDate = new Date(upcomingMatchDate);

  // Sort matches by date (most recent first)
  const sortedMatches = [...recentMatches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Days since last match
  const lastMatch = sortedMatches[0];
  const daysSinceLastMatch = lastMatch
    ? Math.floor((now.getTime() - new Date(lastMatch.date).getTime()) / (1000 * 60 * 60 * 24))
    : 7; // Default to 7 if no recent matches

  // Days until next match
  const nextMatchIn = Math.floor((matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Count matches in next 7 and 14 days
  const futureMatches = recentMatches.filter((m) => {
    const mDate = new Date(m.date);
    const daysUntil = (mDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 14;
  });

  const matchesIn7Days = futureMatches.filter((m) => {
    const daysUntil = (new Date(m.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 7;
  }).length;

  const matchesIn14Days = futureMatches.length;

  // Determine congestion level
  const isHighCongestion = matchesIn14Days >= 3;

  // Calculate fatigue multiplier (0.85 to 1.15)
  // Less rest = lower multiplier
  let fatigueMultiplier = 1.0;

  if (daysSinceLastMatch < 3) {
    // Less than 3 days rest
    fatigueMultiplier = 0.85 + (daysSinceLastMatch / 3) * 0.1; // 0.85-0.95
  } else if (daysSinceLastMatch >= 7) {
    // 7+ days rest = fresher
    fatigueMultiplier = 1.05 + Math.min(daysSinceLastMatch / 10, 0.1); // 1.05-1.15
  } else {
    // 3-7 days = normal
    fatigueMultiplier = 0.95 + ((daysSinceLastMatch - 3) / 4) * 0.1; // 0.95-1.05
  }

  // Injury risk increases with fixture congestion
  // 3+ matches in 14 days = high injury risk
  let injuryRisk = 0.05; // Baseline 5%

  if (matchesIn14Days >= 3) {
    injuryRisk += 0.1; // +10% for congestion
  }
  if (daysSinceLastMatch < 4) {
    injuryRisk += 0.05; // +5% if less than 4 days rest
  }

  injuryRisk = Math.min(injuryRisk, 0.3); // Cap at 30%

  return {
    daysSinceLastMatch,
    nextMatchIn,
    matchesIn7Days,
    matchesIn14Days,
    isHighCongestion,
    fatigueMultiplier,
    injuryRisk,
  };
}

/**
 * Get fatigue impact on prediction
 * Returns adjustment to prediction score
 */
export function getFatigueImpact(congestion: FixtureCongestion): number {
  const fatigueImpact = (congestion.fatigueMultiplier - 1.0) * 0.15; // Scale to -0.15 to +0.15
  return fatigueImpact;
}

/**
 * Get injury risk impact on prediction
 * Higher injury risk = lower confidence
 */
export function getInjuryRiskImpact(injuryRisk: number): number {
  // Risk of 5% = 0 impact
  // Risk of 30% = -0.15 impact
  const baselineRisk = 0.05;
  const maxRisk = 0.3;
  const impact = ((injuryRisk - baselineRisk) / (maxRisk - baselineRisk)) * -0.15;
  return Math.max(-0.15, Math.min(0, impact));
}

/**
 * Determine if team is in "congestion mode"
 * Multiple fixtures with minimal rest
 */
export function isTeamCongested(congestion: FixtureCongestion): boolean {
  return (
    congestion.isHighCongestion &&
    congestion.daysSinceLastMatch < 4
  );
}

/**
 * Get recovery status description
 */
export function getRecoveryStatus(
  congestion: FixtureCongestion
): {
  status: "Fresh" | "Normal" | "Fatigued" | "Congested";
  description: string;
} {
  if (isTeamCongested(congestion)) {
    return {
      status: "Congested",
      description: `${congestion.matchesIn14Days} matches in 14 days with only ${congestion.daysSinceLastMatch} days rest`,
    };
  }

  if (congestion.daysSinceLastMatch < 3) {
    return {
      status: "Fatigued",
      description: `Only ${congestion.daysSinceLastMatch} days since last match`,
    };
  }

  if (congestion.daysSinceLastMatch >= 7) {
    return {
      status: "Fresh",
      description: `${congestion.daysSinceLastMatch} days rest before this match`,
    };
  }

  return {
    status: "Normal",
    description: `${congestion.daysSinceLastMatch} days rest, normal recovery`,
  };
}
